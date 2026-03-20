import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { reportsService } from '../services/phase2';
import dayjs from 'dayjs';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Reports() {
  const now = dayjs();
  const [year, setYear]           = useState(now.year());
  const [month, setMonth]         = useState(now.month() + 1);
  const [summary, setSummary]     = useState(null);
  const [catData, setCatData]     = useState(null);
  const [trend, setTrend]         = useState([]);
  const [dailySpend, setDailySpend] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => { loadAll(); }, [year, month]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, cat, tr, ds, merc] = await Promise.all([
        reportsService.summary(year, month),
        reportsService.categoryBreakdown(year, month, 'expense'),
        reportsService.monthlyTrend(6),
        reportsService.dailySpend(year, month),
        reportsService.topMerchants(1),
      ]);
      setSummary(s); setCatData(cat); setTrend(tr);
      setDailySpend(ds); setMerchants(merc);
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const store = JSON.parse(localStorage.getItem('fintrack-store'));
      const token = store?.state?.accessToken || store?.state?.token || localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/v1/reports/export/csv', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fintrack_${year}_${month}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  // Chart: Monthly Trend Line
  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Income', 'Expense', 'Savings'] },
    xAxis: { type: 'category', data: trend.map((t) => t.label) },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => `₹${(v/1000).toFixed(0)}k` } },
    series: [
      { name: 'Income',  type: 'line', smooth: true, data: trend.map((t) => t.income),  lineStyle: { color: '#10B981' }, itemStyle: { color: '#10B981' } },
      { name: 'Expense', type: 'line', smooth: true, data: trend.map((t) => t.expense), lineStyle: { color: '#EF4444' }, itemStyle: { color: '#EF4444' } },
      { name: 'Savings', type: 'line', smooth: true, data: trend.map((t) => t.savings), lineStyle: { color: '#6366F1', type: 'dashed' }, itemStyle: { color: '#6366F1' } },
    ],
  };

  // Chart: Category Pie
  const pieOption = catData ? {
    tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'middle', formatter: (name) => name.length > 12 ? name.slice(0, 12) + '…' : name },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'],
      data: (catData.items || []).map((i) => ({
        name: i.category_name, value: i.total,
        itemStyle: { color: i.color || '#6366F1' },
      })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 700 } },
    }],
  } : {};

  // Chart: Daily Spend Bar
  const dailyOption = {
    tooltip: { trigger: 'axis', formatter: (params) => `Day ${params[0].name}: ₹${params[0].value.toLocaleString('en-IN')}` },
    xAxis: { type: 'category', data: dailySpend.map((d) => d.day), axisLabel: { interval: 4 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}` } },
    series: [{
      type: 'bar', data: dailySpend.map((d) => d.total),
      itemStyle: { color: '#6366F1', borderRadius: [4, 4, 0, 0] },
    }],
  };

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 className="page-title">📊 Reports</h1><p className="page-sub">Your money story, visualised</p></div>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} style={{ gap: 8 }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Month selector */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 130 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_LABELS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2022, 2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Summary strip */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { label: 'INCOME',        value: summary.income,    color: 'var(--success)' },
              { label: 'EXPENSES',      value: summary.expense,   color: 'var(--danger)' },
              { label: 'NET SAVINGS',   value: summary.savings,   color: summary.savings >= 0 ? 'var(--success)' : 'var(--danger)' },
              { label: 'SAVINGS RATE',  value: `${summary.savings_rate}%`, color: 'var(--accent)', noRupee: true },
            ].map(({ label, value, color, noRupee }) => (
              <motion.div key={label} className="stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="stat-label">{label}</div>
                <div className="stat-value mono" style={{ color, fontSize: 20 }}>
                  {noRupee ? value : `₹${Math.abs(value).toLocaleString('en-IN')}`}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Trend line */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              6-Month Trend
            </h3>
            <div className="chart-container">
              <ReactECharts option={trendOption} theme="fintrac" style={{ height: 260 }} />
            </div>
          </div>

          {/* Category pie */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              Expense by Category
            </h3>
            {catData?.items?.length ? (
              <div className="chart-container">
                <ReactECharts option={pieOption} theme="fintrac" style={{ height: 260 }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
                No category data this month
              </div>
            )}
          </div>
        </div>

        {/* Daily spend bar */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            Daily Spending — {MONTH_LABELS[month - 1]} {year}
          </h3>
          <ReactECharts option={dailyOption} theme="fintrac" style={{ height: 200 }} />
        </div>

        {/* Top merchants */}
        {merchants.length > 0 && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              Top Merchants this Month
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {merchants.map((m, i) => (
                <div key={m.payee} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 14 }}>{m.payee}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.count} tx</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
                    ₹{m.total.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
