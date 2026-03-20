/**
 * QuickAdd — NLP Command Palette (Phase 4)
 * Opens on Cmd+K / Ctrl+K from anywhere in the app.
 * User types natural language → backend NLP parses it → prefills the transaction form.
 */
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, ArrowRight, Check, X } from 'lucide-react';
import api from '../../services/api';
import { transactionsService } from '../../services/transactions';
import { accountsService } from '../../services/accounts';
import { categoriesService } from '../../services/categories';
import dayjs from 'dayjs';

const EXAMPLES = [
  'paid 450 swiggy last night',
  'got salary 50000 today',
  'spent 1200 on petrol yesterday',
  'amazon 3499 electronics',
  'transferred 5000 to savings',
  'netflix 649 subscription',
];

function Tag({ children, color = 'var(--accent)' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      background: `${color}15`, color, fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-mono)', letterSpacing: 0.3,
    }}>{children}</span>
  );
}

export default function QuickAdd({ open, onClose }) {
  const [input, setInput]       = useState('');
  const [parsed, setParsed]     = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCats]   = useState([]);
  const [accountId, setAccountId] = useState('');
  const [catId, setCatId]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [step, setStep]         = useState('input'); // 'input' | 'confirm' | 'done'
  const inputRef = useRef(null);

  // Load account / category lists once
  useEffect(() => {
    if (open) {
      accountsService.list().then(a => { setAccounts(a); if (a.length) setAccountId(a[0].id); }).catch(() => {});
      categoriesService.list(null, true).then(setCats).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClose = () => {
    setInput(''); setParsed(null); setStep('input'); setSaving(false);
    onClose();
  };

  const handleParse = async (text = input) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await api.post('/nlp/parse', { text }).then(r => r.data);
      setParsed(result);
      // Try to match category name to ID
      const catName = result.category?.category?.toLowerCase() || '';
      const matched = categories.find(c => c.name?.toLowerCase().includes(catName) || catName.includes(c.name?.toLowerCase()));
      if (matched) setCatId(matched.id);
      setStep('confirm');
    } catch (e) {
      console.error('NLP parse failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsed || !accountId) return;
    setSaving(true);
    try {
      await transactionsService.create({
        account_id:  accountId,
        category_id: catId || null,
        type:        parsed.parsed.type,
        amount:      parsed.parsed.amount,
        currency:    parsed.parsed.currency || 'INR',
        date:        parsed.parsed.date,
        description: parsed.parsed.description,
        payee:       parsed.parsed.payee,
        tags:        ['quick-add'],
      });
      setStep('done');
      setTimeout(handleClose, 1200);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const typeColor = { income: 'var(--success)', expense: 'var(--danger)', transfer: 'var(--warning)' };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 999 }} />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
              width: 520, maxWidth: '90vw', zIndex: 1000,
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={14} color="var(--accent)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Quick Add Transaction
              </span>
              <kbd style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', border: '1px solid var(--bg-border)' }}>ESC</kbd>
            </div>

            {step === 'input' && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    ref={inputRef}
                    className="input" style={{ flex: 1, fontSize: 15, height: 44 }}
                    placeholder='e.g. "paid 450 swiggy last night"'
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleParse()}
                  />
                  <button className="btn btn-primary" style={{ height: 44, paddingLeft: 16, paddingRight: 16 }}
                    onClick={() => handleParse()} disabled={loading || !input.trim()}>
                    {loading ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> : <ArrowRight size={16} />}
                  </button>
                </div>
                {/* Example chips */}
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>Try:</span>
                  {EXAMPLES.map(ex => (
                    <button key={ex} className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20 }}
                      onClick={() => { setInput(ex); handleParse(ex); }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'confirm' && parsed && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Parsed preview */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, fontWeight: 600 }}>
                    ✨ NLP PARSED
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {parsed.parsed.amount && (
                      <Tag color={typeColor[parsed.parsed.type] || 'var(--accent)'}>
                        ₹{parsed.parsed.amount.toLocaleString('en-IN')}
                      </Tag>
                    )}
                    <Tag color={typeColor[parsed.parsed.type] || 'var(--accent)'}>
                      {parsed.parsed.type}
                    </Tag>
                    {parsed.parsed.payee && <Tag>{parsed.parsed.payee}</Tag>}
                    {parsed.parsed.description && parsed.parsed.description !== parsed.parsed.payee && (
                      <Tag color="var(--text-secondary)">{parsed.parsed.description}</Tag>
                    )}
                    <Tag color="var(--info)">{dayjs(parsed.parsed.date).format('DD MMM')}</Tag>
                    {parsed.category?.category && (
                      <Tag color="var(--success)">
                        {parsed.category.category} ({Math.round((parsed.confidence || 0) * 100)}%)
                      </Tag>
                    )}
                  </div>
                </div>

                {/* Editable fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="input-label">Account *</label>
                    <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Category</label>
                    <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
                      <option value="">— Uncategorised —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setStep('input')}>
                    ← Re-type
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }}
                    onClick={handleSave} disabled={saving || !accountId}>
                    {saving ? 'Saving…' : '✓ Save Transaction'}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check size={24} color="var(--success)" />
                </motion.div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Transaction saved!</div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
