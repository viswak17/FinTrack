import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, PlayCircle, Pause, RefreshCw } from 'lucide-react';
import { recurringService } from '../services/phase2';
import { accountsService } from '../services/accounts';
import { categoriesService } from '../services/categories';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];
const FREQ_LABELS = { daily:'Daily', weekly:'Weekly', fortnightly:'Every 2 Weeks', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly' };

function RecurringForm({ initial = {}, accounts = [], categories = [], onSubmit, loading }) {
  const today = dayjs().format('YYYY-MM-DD');
  const [form, setForm] = useState({
    name:'', account_id:'', category_id:'', type:'expense',
    amount:'', currency:'INR', frequency:'monthly', interval:1,
    start_date: today, end_date:'', payee:'', description:'',
    remind_days_before: 0, ...initial,
    start_date: initial.start_date ? dayjs(initial.start_date).format('YYYY-MM-DD') : today,
    end_date: initial.end_date ? dayjs(initial.end_date).format('YYYY-MM-DD') : '',
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const expCats = categories.filter((c) => c.type === 'expense');
  const incCats = categories.filter((c) => c.type === 'income');
  const cats = form.type === 'income' ? incCats : expCats;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, amount: parseFloat(form.amount), interval: parseInt(form.interval), start_date: form.start_date, end_date: form.end_date || null }); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="input-label">Rule Name *</label>
        <input className="input" value={form.name} onChange={u('name')} required placeholder="e.g. Netflix Subscription" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {['income', 'expense'].map((t) => (
          <button key={t} type="button" className={`btn btn-sm ${form.type === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, textTransform: 'capitalize' }} onClick={() => setForm((f) => ({ ...f, type: t }))}>
            {t === 'income' ? '💰' : '💸'} {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Amount (₹) *</label>
          <input type="number" className="input" value={form.amount} onChange={u('amount')} required min="0" step="0.01" />
        </div>
        <div>
          <label className="input-label">Frequency</label>
          <select className="input" value={form.frequency} onChange={u('frequency')}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Account *</label>
        <select className="input" value={form.account_id} onChange={u('account_id')} required>
          <option value="">Select account...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="input-label">Category</label>
        <select className="input" value={form.category_id} onChange={u('category_id')}>
          <option value="">— Uncategorized —</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Payee</label>
          <input className="input" value={form.payee} onChange={u('payee')} placeholder="e.g. Netflix" />
        </div>
        <div>
          <label className="input-label">Remind N days before</label>
          <input type="number" className="input" value={form.remind_days_before} onChange={u('remind_days_before')} min="0" max="30" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Start Date *</label>
          <input type="date" className="input" value={form.start_date} onChange={u('start_date')} required />
        </div>
        <div>
          <label className="input-label">End Date (optional)</label>
          <input type="date" className="input" value={form.end_date} onChange={u('end_date')} />
        </div>
      </div>
      <Button type="submit" loading={loading}>{initial.id ? 'Save Changes' : 'Create Rule'}</Button>
    </form>
  );
}

export default function Recurring() {
  const [rules, setRules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [rules, accts, cats] = await Promise.all([
      recurringService.list(false),
      accountsService.list(),
      categoriesService.list(null, true),
    ]);
    setRules(rules); setAccounts(accts); setCategories(cats);
  };

  const handleCreate = async (form) => {
    setLoading(true);
    try { await recurringService.create(form); await loadAll(); setModalOpen(false); }
    finally { setLoading(false); }
  };
  const handleEdit = async (form) => {
    setLoading(true);
    try { await recurringService.update(editTarget.id, form); await loadAll(); setEditTarget(null); }
    finally { setLoading(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recurring rule?')) return;
    await recurringService.delete(id);
    await loadAll();
  };
  const handleToggle = async (rule) => {
    await recurringService.update(rule.id, { is_active: !rule.is_active });
    await loadAll();
  };
  const handleProcessNow = async (id) => {
    setProcessing(id);
    try { await recurringService.processNow(id); await loadAll(); }
    finally { setProcessing(null); }
  };

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const acctMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 className="page-title">🔁 Recurring</h1><p className="page-sub">Automate subscriptions, bills & income</p></div>
          <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>New Rule</Button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-tertiary)' }}>
            No recurring rules yet. Add bills, subscriptions, or salary here!
          </div>
        ) : rules.map((rule, i) => {
          const cat  = catMap[rule.category_id];
          const acct = acctMap[rule.account_id];
          const isOverdue = rule.next_due && dayjs(rule.next_due).isBefore(dayjs());
          return (
            <motion.div key={rule.id} className="card"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{ opacity: rule.is_active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Type icon */}
                <div style={{ width: 42, height: 42, borderRadius: 12,
                  background: rule.type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {cat?.emoji || (rule.type === 'income' ? '💰' : '💸')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{rule.name || rule.payee}</span>
                    <span className={`badge badge-${rule.type === 'income' ? 'up' : 'down'}`} style={{ fontSize: 11 }}>
                      {rule.type}
                    </span>
                    {!rule.is_active && <span className="badge badge-warn" style={{ fontSize: 11 }}>Paused</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {FREQ_LABELS[rule.frequency]} · {acct?.name || '—'}
                    {rule.next_due && (
                      <span style={{ marginLeft: 8, color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        · Next: {dayjs(rule.next_due).format('DD MMM YYYY')}
                        {isOverdue && ' ⚠️'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
                  color: rule.type === 'income' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                  {rule.type === 'income' ? '+' : '-'}₹{rule.amount.toLocaleString('en-IN')}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" title={processing === rule.id ? 'Processing…' : 'Run now'}
                    style={{ padding: 6 }} disabled={processing === rule.id}
                    onClick={() => handleProcessNow(rule.id)}>
                    <RefreshCw size={13} style={{ animation: processing === rule.id ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 6 }}
                    title={rule.is_active ? 'Pause' : 'Resume'} onClick={() => handleToggle(rule)}>
                    {rule.is_active ? <Pause size={13} /> : <PlayCircle size={13} />}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setEditTarget(rule)}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--danger)' }} onClick={() => handleDelete(rule.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Recurring Rule" width={520}>
        <RecurringForm accounts={accounts} categories={categories} onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Recurring Rule" width={520}>
        {editTarget && <RecurringForm initial={editTarget} accounts={accounts} categories={categories} onSubmit={handleEdit} loading={loading} />}
      </Modal>
    </div>
  );
}
