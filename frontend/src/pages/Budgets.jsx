import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { budgetsService } from '../services/transactions';
import { categoriesService } from '../services/categories';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';
import Card from '../components/ui/Card';
import dayjs from 'dayjs';

const BUDGET_TYPES = ['category', 'envelope', 'zero_based', 'project'];

function BudgetForm({ initial = {}, categories = [], onSubmit, loading }) {
  const [form, setForm] = useState({
    name: '', category_id: '', amount: '', budget_type: 'category',
    rollover_enabled: false,
    start_date: dayjs().startOf('month').toISOString().slice(0, 16),
    end_date: dayjs().endOf('month').toISOString().slice(0, 16),
    ...initial,
    start_date: initial.start_date
      ? new Date(initial.start_date).toISOString().slice(0, 16)
      : dayjs().startOf('month').toISOString().slice(0, 16),
    end_date: initial.end_date
      ? new Date(initial.end_date).toISOString().slice(0, 16)
      : dayjs().endOf('month').toISOString().slice(0, 16),
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const expenseCats = categories.filter((c) => c.type === 'expense');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: parseFloat(form.amount),
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      category_id: form.category_id || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="input-label">Budget Name *</label>
        <input className="input" value={form.name} onChange={u('name')} required placeholder="e.g. Monthly Food Budget" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Type</label>
          <select className="input" value={form.budget_type} onChange={u('budget_type')}>
            {BUDGET_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', '-')}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Category</label>
          <select className="input" value={form.category_id} onChange={u('category_id')}>
            <option value="">— All Expenses —</option>
            {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Budget Amount (₹) *</label>
        <input type="number" className="input" value={form.amount} onChange={u('amount')} required step="0.01" min="0" placeholder="0.00" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Start Date *</label>
          <input type="datetime-local" className="input" value={form.start_date} onChange={u('start_date')} required />
        </div>
        <div>
          <label className="input-label">End Date</label>
          <input type="datetime-local" className="input" value={form.end_date} onChange={u('end_date')} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={form.rollover_enabled}
          onChange={(e) => setForm((f) => ({ ...f, rollover_enabled: e.target.checked }))} />
        Rollover unspent to next month
      </label>
      <Button type="submit" loading={loading}>
        {initial.id ? 'Save Changes' : 'Create Budget'}
      </Button>
    </form>
  );
}

function StatusBadge({ status }) {
  const map = {
    under:   { color: 'var(--success)', bg: 'rgba(16,185,129,0.1)',  label: '✓ On Track'   },
    warning: { color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)',  label: '⚠ Warning'    },
    over:    { color: 'var(--danger)',  bg: 'rgba(239, 68, 68,0.1)', label: '✗ Overspent'  },
  };
  const s = map[status] || map.under;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 99, padding: '3px 10px' }}>
      {s.label}
    </span>
  );
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [vsActual, setVsActual] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === 'vs-actual') loadVsActual(); }, [tab, month]);

  const loadAll = async () => {
    const [b, cats] = await Promise.all([
      budgetsService.listActive(),
      categoriesService.list(null, true),
    ]);
    setBudgets(b);
    setCategories(cats);
  };

  const loadVsActual = async () => {
    const data = await budgetsService.vsActual(month);
    setVsActual(data);
  };

  const handleCreate = async (form) => {
    setLoading(true);
    try {
      await budgetsService.create(form);
      await loadAll();
      setModalOpen(false);
    } finally { setLoading(false); }
  };

  const handleEdit = async (form) => {
    setLoading(true);
    try {
      await budgetsService.update(editTarget.id, form);
      await loadAll();
      setEditTarget(null);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    await budgetsService.delete(id);
    await loadAll();
  };

  // Summary totals
  const totalBudgeted = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const totalLeft     = totalBudgeted - totalSpent;

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">💰 Budgets</h1>
            <p className="page-sub">Spend intentionally every month</p>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            New Budget
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'TOTAL BUDGETED', value: totalBudgeted, color: 'var(--accent)' },
            { label: 'TOTAL SPENT',    value: totalSpent,    color: 'var(--danger)' },
            { label: 'REMAINING',      value: totalLeft,     color: totalLeft >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(({ label, value, color }) => (
            <motion.div key={label} className="stat-card"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="stat-label">{label}</div>
              <div className="stat-value mono" style={{ color }}>
                ₹{Math.abs(value).toLocaleString('en-IN')}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[['active', '📋 Active Budgets'], ['vs-actual', '📊 vs Actual']].map(([val, label]) => (
            <button key={val} className={`btn btn-sm ${tab === val ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(val)}>
              {label}
            </button>
          ))}
          {tab === 'vs-actual' && (
            <input type="month" className="input" style={{ width: 160, marginLeft: 'auto' }}
              value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
        </div>

        {/* ── Active Budgets tab ── */}
        <AnimatePresence mode="wait">
          {tab === 'active' && (
            <motion.div key="active"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {budgets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-tertiary)' }}>
                  No active budgets. Create your first budget!
                </div>
              ) : budgets.map((b, i) => {
                const cat = categories.find((c) => c.id === b.category_id);
                return (
                  <motion.div key={b.id} className="card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {cat && (
                        <div style={{ width: 40, height: 40, borderRadius: 10,
                          background: `${cat.color || 'var(--accent)'}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {cat.emoji}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>
                            {b.name || cat?.name || 'Budget'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
                              color: b.percent_used > 100 ? 'var(--danger)' : 'var(--text-primary)' }}>
                              ₹{(b.spent || 0).toLocaleString('en-IN')}
                              <span style={{ font: 'inherit', fontWeight: 400, color: 'var(--text-tertiary)' }}>
                                {' / '}₹{(b.amount || 0).toLocaleString('en-IN')}
                              </span>
                            </span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: 5 }}
                              onClick={() => setEditTarget(b)}><Edit2 size={13} /></button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: 5, color: 'var(--danger)' }}
                              onClick={() => handleDelete(b.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <ProgressBar value={b.spent || 0} max={b.amount || 1} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                          <span>{b.percent_used?.toFixed(1)}% used</span>
                          <span>₹{(b.remaining || 0).toLocaleString('en-IN')} left</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ── Vs Actual tab ── */}
          {tab === 'vs-actual' && (
            <motion.div key="vs-actual"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table className="ft-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Budgeted</th>
                      <th style={{ textAlign: 'right' }}>Actual</th>
                      <th style={{ textAlign: 'right' }}>Variance</th>
                      <th style={{ textAlign: 'center' }}>Usage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vsActual.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                        No budget data for this month.
                      </td></tr>
                    ) : vsActual.map((row, i) => (
                      <motion.tr key={row.category_id || i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                        <td style={{ fontWeight: 500 }}>{row.category_name}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          ₹{row.budget_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          ₹{row.actual_spent.toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                          color: row.variance >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {row.variance >= 0 ? '+' : ''}₹{row.variance.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ width: 120, margin: '0 auto' }}>
                            <ProgressBar value={row.actual_spent} max={row.budget_amount || 1} animated={false} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                            {row.percent_used}%
                          </div>
                        </td>
                        <td><StatusBadge status={row.status} /></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Budget" width={500}>
        <BudgetForm categories={categories} onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Budget" width={500}>
        {editTarget && <BudgetForm initial={editTarget} categories={categories} onSubmit={handleEdit} loading={loading} />}
      </Modal>
    </div>
  );
}
