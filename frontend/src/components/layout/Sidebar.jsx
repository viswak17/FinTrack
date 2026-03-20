import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/useAppStore';

const NAV_ITEMS = [
  { path: '/',            icon: '🌌', label: 'Command Center' },
  { path: '/transactions',icon: '💳', label: 'Transactions'   },
  { path: '/accounts',    icon: '🏦', label: 'Accounts'       },
  { path: '/categories',  icon: '📂', label: 'Categories'     },
  { path: '/budgets',     icon: '💰', label: 'Budgets'        },
  { path: '/goals',       icon: '🎯', label: 'Goals'          },
  { path: '/recurring',   icon: '🔁', label: 'Recurring'      },
  { path: '/currency',    icon: '🌍', label: 'Multi-Currency' },
  { path: '/ai',          icon: '🤖', label: 'AI Advisor'     },
  { path: '/reports',     icon: '📊', label: 'Reports'        },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, user } = useAppStore();

  return (
    <motion.aside
      className="sidebar"
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden' }}
    >
      {/* ── Logo ── */}
      <div style={{
        padding: '20px 14px',
        borderBottom: '1px solid var(--bg-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 64,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>⚡</span>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--text-primary)',
              }}>
                FinTrack
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Personal Finance OS
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <div
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ fontSize: 14, whiteSpace: 'nowrap' }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User + Collapse Toggle ── */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid var(--bg-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* User avatar */}
        <div className="sidebar-nav-item" style={{ cursor: 'default' }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent-glow)',
            border: '2px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--accent)',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {user?.full_name || 'User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {user?.base_currency || 'INR'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="sidebar-nav-item"
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>
            {sidebarCollapsed ? '→' : '←'}
          </span>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: 13 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
