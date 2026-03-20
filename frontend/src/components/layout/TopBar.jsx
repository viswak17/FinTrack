import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Settings, ChevronDown, Sparkles, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/useAppStore';
import QuickAdd from '../ui/QuickAdd';
import api from '../../services/api';

const SEV_COLOR = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--info)' };

export default function TopBar() {
  const { user, logout, activeCurrency, setActiveCurrency } = useAppStore();
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [quickAddOpen, setQuickAddOpen]       = useState(false);
  const [showBell, setShowBell]               = useState(false);
  const [notifications, setNotifications]     = useState([]);
  const [notifsRead, setNotifsRead]           = useState(false);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setQuickAddOpen(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Poll notifications every 60s
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.get('/notifications').then(r => r.data);
        if (!cancelled) { setNotifications(data || []); setNotifsRead(false); }
      } catch {}
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Click outside closes bell panel
  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async () => {
    setNotifsRead(true);
    try { await api.post('/notifications/read'); } catch {}
  };

  const unreadCount = notifsRead ? 0 : notifications.length;

  return (
    <>
      <header className="topbar">
        {/* Quick Add */}
        <button className="btn btn-ghost btn-sm" style={{ gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}
          onClick={() => setQuickAddOpen(true)}>
          <Sparkles size={14} />
          <span>Quick add…</span>
          <span style={{ background: 'var(--bg-border)', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Currency */}
        <select className="input" value={activeCurrency} onChange={(e) => setActiveCurrency(e.target.value)}
          style={{ width: 80, padding: '6px 10px', fontSize: 13 }}>
          {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={bellRef}>
          <button className="btn btn-ghost btn-sm" style={{ position: 'relative', padding: '8px' }}
            onClick={() => { setShowBell(v => !v); if (!notifsRead) markRead(); }}>
            <Bell size={16} />
            {unreadCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                style={{ position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, borderRadius: 8,
                  background: 'var(--danger)', fontSize: 9, color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '0 4px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {showBell && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                style={{
                  position: 'absolute', top: '110%', right: 0,
                  width: 340, maxHeight: 440, overflowY: 'auto',
                  background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 14, zIndex: 300,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={markRead}>
                    <Check size={12} /> Mark all read
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    ✅ You're all caught up!
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', cursor: 'default',
                        borderLeft: `3px solid ${SEV_COLOR[n.severity] || 'var(--accent)'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" style={{ gap: 8 }} onClick={() => setShowUserMenu(v => !v)}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-glow)',
              border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ fontSize: 13 }}>{user?.full_name || user?.email?.split('@')[0] || 'User'}</span>
            <ChevronDown size={14} />
          </button>
          {showUserMenu && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)', borderRadius: 12, padding: 8, width: 180, zIndex: 200 }}>
              <button className="sidebar-nav-item" style={{ width: '100%', gap: 8, fontSize: 13 }}
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}>
                <Settings size={14} /> Settings
              </button>
              <div className="divider" style={{ margin: '4px 0' }} />
              <button className="sidebar-nav-item" style={{ width: '100%', gap: 8, fontSize: 13, color: 'var(--danger)' }}
                onClick={handleLogout}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
