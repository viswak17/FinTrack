import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Bell, Palette, Globe, Database, Save, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { currencyService } from '../services/phase2';
import useAppStore from '../store/useAppStore';
import Button from '../components/ui/Button';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const LANGS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada'];
const DATE_FMTS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        paddingBottom: 14, borderBottom: '1px solid var(--bg-border)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color="var(--accent)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

// ── Two-col row ───────────────────────────────────────────────────────────────
function Row({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--bg-border)', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? 'var(--accent)' : 'var(--bg-border)',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
      }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function Settings() {
  const { user } = useAppStore();

  // Profile
  const [name, setName]   = useState(user?.name || '');
  const [email]           = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  // Password
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Preferences
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [dateFormat, setDateFormat]     = useState('DD/MM/YYYY');
  const [language, setLanguage]         = useState('English');

  // Notifications
  const [notifBudget, setNotifBudget]   = useState(true);
  const [notifGoal, setNotifGoal]       = useState(true);
  const [notifAnomaly, setNotifAnomaly] = useState(true);
  const [notifRecurring, setNotifRecurring] = useState(false);

  // AI
  const [groqKey, setGroqKey]     = useState('');
  const [fxKey, setFxKey]         = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [showGroqKey, setShowGroqKey] = useState(false);

  useEffect(() => { loadPrefs(); }, []);

  const loadPrefs = async () => {
    try {
      const prefs = await currencyService.getPreferences();
      setBaseCurrency(prefs.base || 'INR');
    } catch {}
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/auth/me', { name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await currencyService.updatePreferences({ currencies: [baseCurrency, 'USD'], base: baseCurrency });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">⚙️ Settings</h1>
        <p className="page-sub">Manage your account, preferences, and integrations</p>
      </div>

      <div style={{ padding: '0 32px 80px', maxWidth: 720 }}>

        {/* Profile */}
        <Section icon={User} title="Profile">
          <Row label="Display Name" hint="Shown in the top bar">
            <input className="input" style={{ width: 200 }} value={name} onChange={e => setName(e.target.value)} />
          </Row>
          <Row label="Email Address" hint="Cannot be changed">
            <input className="input" style={{ width: 200 }} value={email} disabled />
          </Row>
          <div style={{ paddingTop: 4 }}>
            <Button loading={saving} onClick={saveProfile} size="sm" icon={<Save size={13} />}>
              {saved ? '✓ Saved!' : 'Save Profile'}
            </Button>
          </div>
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Security">
          <Row label="Change Password" hint="Leave blank to keep current password">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="input" style={{ width: 200, paddingRight: 36 }}
                  placeholder="Current password" value={oldPw} onChange={e => setOldPw(e.target.value)} />
                <button onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input type={showPw ? 'text' : 'password'} className="input" style={{ width: 200 }}
                placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} />
              <Button size="sm" onClick={async () => {
                if (!oldPw || !newPw) return;
                await api.put('/auth/password', { old_password: oldPw, new_password: newPw });
                setOldPw(''); setNewPw('');
              }}>Update Password</Button>
            </div>
          </Row>
          <Row label="Active Sessions" hint="Manage logged-in devices">
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => api.post('/auth/logout-all').catch(() => {})}>
              Log Out All Devices
            </button>
          </Row>
        </Section>

        {/* Preferences */}
        <Section icon={Globe} title="Preferences">
          <Row label="Base Currency" hint="All amounts will be shown in this currency">
            <select className="input" style={{ width: 120 }} value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>
          <Row label="Date Format" hint="How dates are displayed throughout the app">
            <select className="input" style={{ width: 150 }} value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
              {DATE_FMTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Row>
          <Row label="Language" hint="Interface language">
            <select className="input" style={{ width: 140 }} value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </Row>
          <div style={{ paddingTop: 4 }}>
            <Button loading={saving} onClick={savePreferences} size="sm" icon={<Save size={13} />}>
              {saved ? '✓ Saved!' : 'Save Preferences'}
            </Button>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          {[
            { label: 'Budget Alerts',       hint: 'Alert when budget reaches 80% or overruns', val: notifBudget,   set: setNotifBudget },
            { label: 'Goal Milestones',      hint: 'Celebrate 25%, 50%, 75%, 100% progress',   val: notifGoal,     set: setNotifGoal },
            { label: 'Anomaly Alerts',       hint: 'Flag unusually large or suspicious transactions', val: notifAnomaly, set: setNotifAnomaly },
            { label: 'Recurring Reminders',  hint: 'Remind N days before recurring transactions are due', val: notifRecurring, set: setNotifRecurring },
          ].map(({ label, hint, val, set }) => (
            <Row key={label} label={label} hint={hint}>
              <Toggle value={val} onChange={set} />
            </Row>
          ))}
        </Section>

        {/* AI & Integrations */}
        <Section icon={Database} title="AI & Integrations">
          <Row label="AI Advisor" hint="Enable ML categorization and Groq LLM insights">
            <Toggle value={aiEnabled} onChange={setAiEnabled} />
          </Row>
          <Row label="Groq API Key" hint="For AI insights and chat. Get free key at groq.com">
            <div style={{ position: 'relative' }}>
              <input
                type={showGroqKey ? 'text' : 'password'}
                className="input" style={{ width: 200, paddingRight: 36, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                placeholder="gsk_xxxxxxxxxxxxxxxx"
                value={groqKey} onChange={e => setGroqKey(e.target.value)}
              />
              <button onClick={() => setShowGroqKey(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                {showGroqKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </Row>
          <Row label="Exchange Rate API Key" hint="For live FX rates. Get free key at exchangerate-api.com">
            <input type="password" className="input" style={{ width: 200, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              placeholder="xxxxxxxxxxxxxxxx"
              value={fxKey} onChange={e => setFxKey(e.target.value)} />
          </Row>
          <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            💡 API keys are stored in <code>backend/.env</code> — they are never sent to the frontend. Edit the .env file directly for security.
          </div>
        </Section>

        {/* Data */}
        <Section icon={Palette} title="Data Management">
          <Row label="Export All Data" hint="Download a complete CSV of all your transactions">
            <a href="/api/v1/reports/export/csv" download className="btn btn-ghost btn-sm">Download CSV</a>
          </Row>
          <Row label="Delete Account" hint="Permanently delete your account and all data">
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => {
                if (window.confirm('Are you absolutely sure? This cannot be undone.')) {
                  api.delete('/auth/me').then(() => { localStorage.clear(); window.location.href = '/login'; });
                }
              }}>
              Delete Account
            </button>
          </Row>
        </Section>
      </div>
    </div>
  );
}
