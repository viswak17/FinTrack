/**
 * TransferModal — Inter-account transfer UI.
 * Creates a pair of linked transactions: debit from source, credit to destination.
 * Uses POST /transactions with type='transfer'.
 */
import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { transactionsService } from '../../services/transactions';
import dayjs from 'dayjs';

export default function TransferModal({ open, onClose, accounts = [], onTransferred }) {
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate]     = useState(dayjs().format('YYYY-MM-DD'));
  const [note, setNote]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSwap = () => { const tmp = from; setFrom(to); setTo(tmp); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (from === to) { setError('Source and destination must be different.'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }

    setLoading(true);
    try {
      // Debit from source account (expense type so balance decreases)
      await transactionsService.create({
        account_id:  from,
        type:        'transfer',
        amount:      amt,
        date:        new Date(date).toISOString(),
        description: note || `Transfer to ${accounts.find(a => a.id === to)?.name || 'account'}`,
        transfer_to_account_id: to,
        currency:    'INR',
      });
      onTransferred?.();
      onClose();
      setAmount(''); setNote(''); setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const fromAcc = accounts.find(a => a.id === from);
  const toAcc   = accounts.find(a => a.id === to);

  return (
    <Modal isOpen={open} onClose={onClose} title="↔️ Transfer Between Accounts">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* From / To with swap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">From Account *</label>
            <select className="input" value={from} onChange={e => setFrom(e.target.value)} required>
              <option value="">Select…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {fromAcc && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Balance: <span style={{ fontFamily: 'var(--font-mono)', color: fromAcc.current_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  ₹{fromAcc.current_balance?.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          <button type="button" onClick={handleSwap}
            style={{ marginTop: 14, width: 34, height: 34, borderRadius: 10, background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowRightLeft size={14} color="var(--accent)" />
          </button>

          <div style={{ flex: 1 }}>
            <label className="input-label">To Account *</label>
            <select className="input" value={to} onChange={e => setTo(e.target.value)} required>
              <option value="">Select…</option>
              {accounts.filter(a => a.id !== from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {toAcc && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Balance: <span style={{ fontFamily: 'var(--font-mono)', color: toAcc.current_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  ₹{toAcc.current_balance?.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Preview arrow */}
        {from && to && fromAcc && toAcc && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0' }}>
            <span style={{ color: 'var(--danger)' }}>{fromAcc.name}</span>
            <span style={{ margin: '0 8px', color: 'var(--accent)' }}>→</span>
            <span style={{ color: 'var(--success)' }}>{toAcc.name}</span>
          </div>
        )}

        {/* Amount + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="input-label">Amount (₹) *</label>
            <input type="number" className="input" value={amount}
              onChange={e => setAmount(e.target.value)} required min="0.01" step="0.01" placeholder="0.00" />
          </div>
          <div>
            <label className="input-label">Date *</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="input-label">Note (optional)</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Moving to savings" />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} icon={<ArrowRightLeft size={14} />}>
          Transfer ₹{parseFloat(amount || 0).toLocaleString('en-IN')}
        </Button>
      </form>
    </Modal>
  );
}
