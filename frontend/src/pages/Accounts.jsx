import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Archive } from 'lucide-react';
import { accountsService } from '../services/accounts';
import useAppStore from '../store/useAppStore';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const ACCOUNT_TYPES = ['bank', 'cash', 'credit_card', 'investment', 'crypto', 'loan'];
const TYPE_ICONS = { bank: '🏦', cash: '💵', credit_card: '💳', investment: '📈', crypto: '⚡', loan: '📋' };
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY'];
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#38BDF8', '#EF4444', '#818CF8', '#F472B6', '#A78BFA'];

function AccountForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: '', type: 'bank', currency: 'INR',
    initial_balance: 0, credit_limit: '', color: '#6366F1', icon: 'bank',
    ...initial,
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="input-label">Account Name *</label>
        <input className="input" value={form.name} onChange={u('name')} placeholder="e.g. SBI Savings" required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Type *</label>
          <select className="input" value={form.type} onChange={u('type')}>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Currency</label>
          <select className="input" value={form.currency} onChange={u('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Opening Balance</label>
        <input type="number" className="input" value={form.initial_balance}
          onChange={u('initial_balance')} step="0.01" />
      </div>
      {form.type === 'credit_card' && (
        <div>
          <label className="input-label">Credit Limit</label>
          <input type="number" className="input" value={form.credit_limit}
            onChange={u('credit_limit')} placeholder="e.g. 100000" />
        </div>
      )}
      <div>
        <label className="input-label">Color</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c} type="button"
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                cursor: 'pointer', outline: form.color === c ? `2px solid white` : 'none',
                transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.15s',
              }} />
          ))}
        </div>
      </div>
      <Button type="submit" loading={loading} style={{ marginTop: 8 }}>
        {initial.id ? 'Save Changes' : 'Create Account'}
      </Button>
    </form>
  );
}

export default function Accounts() {
  const { accounts, loadAccounts, addAccount, updateAccount, removeAccount } = useAppStore();
  const [netWorth, setNetWorth] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    await loadAccounts();
    const nw = await accountsService.getNetWorth();
    setNetWorth(nw);
  };

  const handleCreate = async (form) => {
    setLoading(true);
    try {
      const acct = await accountsService.create({
        ...form,
        initial_balance: parseFloat(form.initial_balance) || 0,
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined,
      });
      addAccount(acct);
      setModalOpen(false);
      loadData();
    } finally { setLoading(false); }
  };

  const handleEdit = async (form) => {
    setLoading(true);
    try {
      const updated = await accountsService.update(editTarget.id, {
        name: form.name, color: form.color,
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined,
      });
      updateAccount(updated.id, updated);
      setEditTarget(null);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Archive this account?')) return;
    await accountsService.delete(id);
    removeAccount(id);
    loadData();
  };

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">🏦 Accounts</h1>
            <p className="page-sub">Your complete financial picture</p>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            Add Account
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Net Worth Summary */}
        {netWorth && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), var(--bg-surface))' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {[
                { label: 'NET WORTH', value: netWorth.net_worth, color: 'var(--accent)' },
                { label: 'TOTAL ASSETS', value: netWorth.total_assets, color: 'var(--success)' },
                { label: 'LIABILITIES', value: netWorth.total_liabilities, color: 'var(--danger)' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="stat-label">{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>
                    ₹{Math.abs(value).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Account cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {accounts.filter((a) => !a.is_archived).map((acct, i) => (
            <motion.div key={acct.id}
              className="card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{ border: `1px solid ${acct.color}30` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${acct.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {TYPE_ICONS[acct.type] || '🏦'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{acct.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                      {acct.type.replace('_', ' ')} · {acct.currency}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 6 }}
                    onClick={() => setEditTarget(acct)}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--danger)' }}
                    onClick={() => handleDelete(acct.id)}>
                    <Archive size={13} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>CURRENT BALANCE</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
                  color: acct.current_balance >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                }}>
                  {acct.currency === 'INR' ? '₹' : '$'}{Math.abs(acct.current_balance).toLocaleString('en-IN')}
                  {acct.current_balance < 0 && <span style={{ fontSize: 14, color: 'var(--danger)' }}> DR</span>}
                </div>
                {acct.type === 'credit_card' && acct.credit_limit && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      <span>Utilization</span>
                      <span>{Math.round((Math.abs(acct.current_balance) / acct.credit_limit) * 100)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${Math.min((Math.abs(acct.current_balance) / acct.credit_limit) * 100, 100)}%`,
                        background: 'var(--danger)',
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {accounts.filter((a) => !a.is_archived).length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
              No accounts yet. Add your first account to get started!
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Account">
        <AccountForm onSubmit={handleCreate} loading={loading} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Account">
        {editTarget && <AccountForm initial={editTarget} onSubmit={handleEdit} loading={loading} />}
      </Modal>
    </div>
  );
}
