import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Search, Upload, Trash2, Edit2, ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { transactionsService } from '../services/transactions';
import { accountsService } from '../services/accounts';
import { categoriesService } from '../services/categories';
import useAppStore from '../store/useAppStore';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import CSVImporter from '../components/ui/CSVImporter';
import TransferModal from '../components/ui/TransferModal';

const TX_TYPES = ['income', 'expense', 'transfer'];

function TransactionForm({ initial = {}, accounts = [], categories = [], onSubmit, loading }) {
  const [form, setForm] = useState({
    account_id: '', category_id: '', type: 'expense',
    amount: '', currency: 'INR', description: '', payee: '',
    date: new Date().toISOString().slice(0, 16), tags: '', notes: '',
    ...initial,
    date: initial.date ? new Date(initial.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: parseFloat(form.amount),
      date: new Date(form.date).toISOString(),
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  };

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');
  const currentCats = form.type === 'income' ? incomeCats : expenseCats;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TX_TYPES.map((t) => (
          <button key={t} type="button"
            onClick={() => setForm((f) => ({ ...f, type: t }))}
            className={`btn btn-sm ${form.type === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, textTransform: 'capitalize' }}>
            {t === 'income' ? '💰' : t === 'expense' ? '💸' : '🔄'} {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Amount *</label>
          <input type="number" className="input" value={form.amount} onChange={u('amount')}
            required step="0.01" min="0" placeholder="0.00" />
        </div>
        <div>
          <label className="input-label">Date *</label>
          <input type="datetime-local" className="input" value={form.date} onChange={u('date')} required />
        </div>
      </div>

      <div>
        <label className="input-label">Account *</label>
        <select className="input" value={form.account_id} onChange={u('account_id')} required>
          <option value="">Select account...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      </div>

      {form.type !== 'transfer' ? (
        <div>
          <label className="input-label">Category</label>
          <select className="input" value={form.category_id} onChange={u('category_id')}>
            <option value="">— Uncategorized —</option>
            {currentCats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className="input-label">To Account *</label>
          <select className="input" value={form.to_account_id || ''} onChange={u('to_account_id')} required>
            <option value="">Select destination...</option>
            {accounts.filter((a) => a.id !== form.account_id).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Payee</label>
          <input className="input" value={form.payee} onChange={u('payee')} placeholder="e.g. Swiggy" />
        </div>
        <div>
          <label className="input-label">Description</label>
          <input className="input" value={form.description} onChange={u('description')} placeholder="Short note..." />
        </div>
      </div>

      <div>
        <label className="input-label">Tags (comma-separated)</label>
        <input className="input" value={form.tags} onChange={u('tags')} placeholder="work, travel, one-time" />
      </div>

      <Button type="submit" loading={loading}>
        {initial.id ? 'Save Changes' : 'Add Transaction'}
      </Button>
    </form>
  );
}

export default function Transactions() {
  const { getCategoryById, getAccountById } = useAppStore();
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen]         = useState(false);
  const [editTarget, setEditTarget]       = useState(null);
  const [loading, setLoading]             = useState(false);
  const [filters, setFilters]             = useState({ type: '', search: '' });
  const [showFilters, setShowFilters]     = useState(false);
  const [csvOpen, setCsvOpen]             = useState(false);
  const [transferOpen, setTransferOpen]   = useState(false);

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadTransactions(); }, [page, filters]);

  const loadMeta = async () => {
    const [accts, cats] = await Promise.all([
      accountsService.list(),
      categoriesService.list(null, true),
    ]);
    setAccounts(accts);
    setCategories(cats);
  };

  const loadTransactions = useCallback(async () => {
    const params = { page, page_size: 20 };
    if (filters.type) params.type = filters.type;
    if (filters.search) params.search = filters.search;
    const data = await transactionsService.list(params);
    setTransactions(data.items || []);
    setTotal(data.total || 0);
    setPages(data.pages || 1);
  }, [page, filters]);

  const handleCreate = async (form) => {
    setLoading(true);
    try {
      await transactionsService.create(form);
      await loadTransactions();
      setModalOpen(false);
    } finally { setLoading(false); }
  };

  const handleEdit = async (form) => {
    setLoading(true);
    try {
      await transactionsService.update(editTarget.id, form);
      await loadTransactions();
      setEditTarget(null);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await transactionsService.delete(id);
    await loadTransactions();
  };

  const typeColor = (t) => t === 'income' ? 'var(--success)' : t === 'expense' ? 'var(--danger)' : 'var(--info)';
  const typeSign = (t) => t === 'income' ? '+' : t === 'expense' ? '-' : '↔';

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">💳 Transactions</h1>
            <p className="page-sub">{total} transactions</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" icon={<Filter size={14} />}
              onClick={() => setShowFilters((v) => !v)}>
              Filters
            </Button>
            <Button variant="ghost" size="sm" icon={<Upload size={14} />}
              onClick={() => setCsvOpen(true)}>
              Import CSV
            </Button>
            <Button variant="ghost" size="sm" icon={<ArrowRightLeft size={14} />}
              onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
            <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
              Add Transaction
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: 16 }}
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBottom: 4 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input className="input" style={{ paddingLeft: 36 }}
                    placeholder="Search payee, description..."
                    value={filters.search}
                    onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, search: e.target.value })); }} />
                </div>
                <select className="input" style={{ width: 140 }}
                  value={filters.type}
                  onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, type: e.target.value })); }}>
                  <option value="">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ft-table">
            <thead>
              <tr>
                <th>Date</th><th>Payee / Description</th><th>Category</th>
                <th>Account</th><th style={{ textAlign: 'right' }}>Amount</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                    No transactions yet. Add your first!
                  </td>
                </tr>
              ) : transactions.map((tx, i) => {
                const cat = categories.find((c) => c.id === tx.category_id);
                const acct = accounts.find((a) => a.id === tx.account_id);
                return (
                  <motion.tr key={tx.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{tx.payee || tx.description || '—'}</div>
                      {tx.payee && tx.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tx.description}</div>
                      )}
                    </td>
                    <td>
                      {cat ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <span>{cat.emoji}</span> {cat.name}
                        </span>
                      ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Uncategorized</span>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{acct?.name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, color: typeColor(tx.type) }}>
                        {typeSign(tx.type)}₹{tx.amount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: 5 }}
                          onClick={() => setEditTarget(tx)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: 5, color: 'var(--danger)' }}
                          onClick={() => handleDelete(tx.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Page {page} of {pages}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Transaction" width={520}>
        <TransactionForm accounts={accounts} categories={categories} onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Transaction" width={520}>
        {editTarget && (
          <TransactionForm initial={editTarget} accounts={accounts} categories={categories} onSubmit={handleEdit} loading={loading} />
        )}
      </Modal>
      <CSVImporter open={csvOpen} onClose={() => setCsvOpen(false)} onImported={loadTransactions} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)}
        accounts={accounts} onTransferred={() => { loadTransactions(); setTransferOpen(false); }} />
    </div>
  );
}
