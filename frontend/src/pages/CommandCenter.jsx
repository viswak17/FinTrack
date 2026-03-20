import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Target, BarChart2, Zap } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { accountsService } from '../services/accounts';
import { transactionsService } from '../services/transactions';
import { budgetsService } from '../services/transactions';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import SpendingHeatmap from '../components/charts/SpendingHeatmap';

// Animated counter hook
function useCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, delta, icon, color = 'var(--accent)', currency = 'INR', index = 0 }) {
  const animated = useCounter(Math.abs(value));
  const isPositive = delta >= 0;

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value mono" style={{ color }}>
            {currency === 'INR' ? '₹' : '$'}{animated.toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {icon}
        </div>
      </div>
      {delta !== undefined && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPositive ? <TrendingUp size={12} color="var(--success)" /> : <TrendingDown size={12} color="var(--danger)" />}
          <span style={{ fontSize: 12, color: isPositive ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
            {isPositive ? '+' : ''}{delta?.toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

export default function CommandCenter() {
  const { user, accounts, loadAccounts, getCategoryById } = useAppStore();
  const [netWorth, setNetWorth] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [activeBudgets, setActiveBudgets] = useState([]);
  const [monthStats, setMonthStats] = useState({ income: 0, expenses: 0, saved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [nw, txData, budgets] = await Promise.all([
        accountsService.getNetWorth(),
        transactionsService.list({ page_size: 5, sort_by: 'date', sort_dir: -1 }),
        budgetsService.listActive(),
      ]);
      setNetWorth(nw);
      setRecentTx(txData.items || []);
      setActiveBudgets(budgets.slice(0, 3));

      // Compute this month's stats
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthTx = await transactionsService.list({
        start_date: start,
        page_size: 100,
      });
      let income = 0, expenses = 0;
      (monthTx.items || []).forEach((t) => {
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expenses += t.amount;
      });
      setMonthStats({ income, expenses, saved: income - expenses });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          🌌 Command Center
        </motion.h1>
        <p className="page-sub">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* ── Summary Strip ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}>
          <StatCard label="Net Worth" value={netWorth?.net_worth || 0} icon="💎" color="var(--accent)" index={0} />
          <StatCard label="Balance" value={netWorth?.total_assets || 0} icon="🏦" color="var(--info)" index={1} />
          <StatCard label="Income" value={monthStats.income} icon="💰" color="var(--success)" index={2} />
          <StatCard label="Expenses" value={monthStats.expenses} icon="💸" color="var(--danger)" index={3} />
          <StatCard label="Net Saved" value={monthStats.saved} icon="🎯" color={monthStats.saved >= 0 ? 'var(--success)' : 'var(--danger)'} index={4} />
          <StatCard label="Accounts" value={accounts.length} icon="📊" color="var(--warning)" currency="" index={5} />
        </div>

        {/* ── AI Pulse Card ── */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--bg-surface) 60%)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              FinTrack Intelligence
            </span>
            <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>ML Active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              '💡 Connect to the backend to see your ML-powered financial pulse',
              '📊 Anomaly detection will monitor your spending patterns automatically',
              '🎯 Set up budgets to get pace alerts and forecasts',
            ].map((bullet, i) => (
              <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                <span style={{ flexShrink: 0 }}></span>
                {bullet}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Main Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Recent Transactions */}
          <Card>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Recent Transactions
            </h3>
            {recentTx.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
                No transactions yet. Add your first one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentTx.map((tx) => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {tx.payee || tx.description || 'Transaction'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {new Date(tx.date).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
                      color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Budget Health */}
          <Card>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Budget Health
            </h3>
            {activeBudgets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
                No active budgets. Create your first budget!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {activeBudgets.map((b) => (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {b.name || b.category_id || 'Budget'}
                      </span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        ₹{b.spent?.toLocaleString('en-IN')} / ₹{b.amount?.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <ProgressBar value={b.spent || 0} max={b.amount || 1} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Accounts Overview */}
        {netWorth && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
                Net Worth Breakdown
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                ₹{netWorth.net_worth?.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>ASSETS</div>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                  +₹{netWorth.total_assets?.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>LIABILITIES</div>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                  -₹{netWorth.total_liabilities?.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {/* ── Spending Heatmap ── */}
        <SpendingHeatmap />

      </div>
    </div>
  );
}
