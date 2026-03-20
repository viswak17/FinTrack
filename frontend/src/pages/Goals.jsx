import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, PlusCircle, TrendingUp } from 'lucide-react';
import { goalsService } from '../services/phase2';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';
import dayjs from 'dayjs';

const GOAL_TYPES = ['savings', 'debt_payoff', 'investment', 'net_worth'];
const GOAL_EMOJIS = ['🎯', '🏠', '🚗', '✈️', '💍', '📚', '🏋️', '🎓', '💻', '🌴', '💰', '🏦'];
const GOAL_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#38BDF8', '#EF4444', '#818CF8', '#F472B6'];

function GoalForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: '', goal_type: 'savings', target_amount: '', current_amount: '0',
    target_date: dayjs().add(1, 'year').format('YYYY-MM-DD'),
    description: '', emoji: '🎯', color: '#6366F1', ...initial,
    target_date: initial.target_date
      ? dayjs(initial.target_date).format('YYYY-MM-DD')
      : dayjs().add(1, 'year').format('YYYY-MM-DD'),
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount) || 0 }); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="input-label">Goal Name *</label>
        <input className="input" value={form.name} onChange={u('name')} required placeholder="e.g. Emergency Fund" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Type</label>
          <select className="input" value={form.goal_type} onChange={u('goal_type')}>
            {GOAL_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Target Date</label>
          <input type="date" className="input" value={form.target_date} onChange={u('target_date')} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Target Amount (₹) *</label>
          <input type="number" className="input" value={form.target_amount} onChange={u('target_amount')} required min="1" />
        </div>
        <div>
          <label className="input-label">Already Saved (₹)</label>
          <input type="number" className="input" value={form.current_amount} onChange={u('current_amount')} min="0" />
        </div>
      </div>
      <div>
        <label className="input-label">Description</label>
        <input className="input" value={form.description} onChange={u('description')} placeholder="What's this goal for?" />
      </div>
      <div>
        <label className="input-label">Emoji</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {GOAL_EMOJIS.map((e) => (
            <button key={e} type="button"
              onClick={() => setForm((f) => ({ ...f, emoji: e }))}
              style={{ width: 34, height: 34, borderRadius: 8, fontSize: 18, cursor: 'pointer',
                background: form.emoji === e ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                border: form.emoji === e ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="input-label">Color</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {GOAL_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: form.color === c ? '3px solid white' : 'none',
                transform: form.color === c ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.15s' }} />
          ))}
        </div>
      </div>
      <Button type="submit" loading={loading}>{initial.id ? 'Save Changes' : 'Create Goal'}</Button>
    </form>
  );
}

function ContributeForm({ goal, onSubmit, loading }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const remaining = (goal.target_amount - goal.current_amount).toLocaleString('en-IN');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ amount: parseFloat(amount), note }); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
        Remaining: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>₹{remaining}</span>
      </div>
      <div>
        <label className="input-label">Contribution Amount (₹) *</label>
        <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" placeholder="0.00" />
      </div>
      <div>
        <label className="input-label">Note</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly savings" />
      </div>
      <Button type="submit" loading={loading} icon={<PlusCircle size={15} />}>Add Contribution</Button>
    </form>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [contributeTarget, setContributeTarget] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadGoals(); }, []);
  const loadGoals = async () => { setGoals(await goalsService.list()); };

  const handleCreate = async (form) => {
    setLoading(true);
    try { await goalsService.create(form); await loadGoals(); setModalOpen(false); }
    finally { setLoading(false); }
  };
  const handleEdit = async (form) => {
    setLoading(true);
    try { await goalsService.update(editTarget.id, form); await loadGoals(); setEditTarget(null); }
    finally { setLoading(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    await goalsService.delete(id);
    await loadGoals();
  };
  const handleContribute = async (data) => {
    setLoading(true);
    try { await goalsService.contribute(contributeTarget.id, data); await loadGoals(); setContributeTarget(null); }
    finally { setLoading(false); }
  };

  const achieved = goals.filter((g) => g.is_achieved);
  const active   = goals.filter((g) => !g.is_achieved);

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 className="page-title">🎯 Goals</h1><p className="page-sub">Dream big, save smart</p></div>
          <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>New Goal</Button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'ACTIVE GOALS',    value: active.length,   color: 'var(--accent)' },
            { label: 'ACHIEVED',         value: achieved.length, color: 'var(--success)' },
            { label: 'TOTAL TARGET',     value: `₹${goals.reduce((s, g) => s + g.target_amount, 0).toLocaleString('en-IN')}`, color: 'var(--info)', mono: true },
          ].map(({ label, value, color, mono }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className={`stat-value ${mono ? 'mono' : ''}`} style={{ color, fontSize: 22 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Active goals grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {goals.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '56px 0', color: 'var(--text-tertiary)' }}>
              No goals yet. Create your first savings goal!
            </div>
          )}
          {goals.map((goal, i) => {
            const daysLeft = goal.target_date ? dayjs(goal.target_date).diff(dayjs(), 'day') : null;
            return (
              <motion.div key={goal.id} className="card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{ border: `1px solid ${goal.color}30`, position: 'relative', overflow: 'hidden' }}>
                {/* Achieved badge */}
                {goal.is_achieved && (
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <span className="badge badge-up">✓ Achieved!</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${goal.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {goal.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{goal.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                      {goal.goal_type.replace('_', ' ')}
                      {daysLeft !== null && (
                        <span style={{ marginLeft: 6, color: daysLeft < 30 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                          · {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Progress */}
                <div style={{ marginBottom: 10 }}>
                  <ProgressBar value={goal.current_amount} max={goal.target_amount} color={goal.color} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: goal.color, fontWeight: 600 }}>
                    ₹{goal.current_amount.toLocaleString('en-IN')}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    of ₹{goal.target_amount.toLocaleString('en-IN')} ({goal.percent_complete}%)
                  </span>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                  <Button variant="ghost" size="sm" style={{ flex: 1 }}
                    icon={<PlusCircle size={13} />} onClick={() => setContributeTarget(goal)}>
                    Add Funds
                  </Button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 8 }} onClick={() => setEditTarget(goal)}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 8, color: 'var(--danger)' }} onClick={() => handleDelete(goal.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Goal">
        <GoalForm onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Goal">
        {editTarget && <GoalForm initial={editTarget} onSubmit={handleEdit} loading={loading} />}
      </Modal>
      <Modal isOpen={!!contributeTarget} onClose={() => setContributeTarget(null)} title={`Add to ${contributeTarget?.name}`}>
        {contributeTarget && <ContributeForm goal={contributeTarget} onSubmit={handleContribute} loading={loading} />}
      </Modal>
    </div>
  );
}
