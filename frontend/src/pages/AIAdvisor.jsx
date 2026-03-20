import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RefreshCw, AlertTriangle, TrendingUp, Bot, Sparkles, RotateCcw } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { reportsService } from '../services/phase2';
import dayjs from 'dayjs';

// ── service calls (using api.js directly for /ai/* routes) ──────────────────
import api from '../services/api';
const aiService = {
  insights:   ()         => api.get('/ai/insights').then(r => r.data),
  forecast:   ()         => api.get('/ai/forecast').then(r => r.data),
  anomalies:  (days=30)  => api.get(`/ai/anomalies?days=${days}`).then(r => r.data),
  chat:       (msg)      => api.post('/ai/chat', { message: msg }).then(r => r.data),
  retrain:    ()         => api.post('/ai/retrain').then(r => r.data),
};

// ── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card"
      style={{ borderLeft: '3px solid var(--accent)', padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{insight.emoji || '💡'}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{insight.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight.body}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Anomaly Card ─────────────────────────────────────────────────────────────
function AnomalyCard({ anomaly, index }) {
  const sev = anomaly.severity === 'high' ? 'var(--danger)' : 'var(--warning)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background: 'var(--bg-elevated)', borderRadius: 12,
        borderLeft: `3px solid ${sev}`,
      }}
    >
      <AlertTriangle size={18} color={sev} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {anomaly.payee || anomaly.description || 'Unknown payee'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {anomaly.date ? dayjs(anomaly.date).format('DD MMM YYYY') : ''} · threshold ₹{anomaly.threshold?.toLocaleString('en-IN')}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: sev, flexShrink: 0 }}>
        ₹{anomaly.amount?.toLocaleString('en-IN')}
      </div>
      <span className={`badge badge-${anomaly.severity === 'high' ? 'down' : 'warn'}`} style={{ flexShrink: 0 }}>
        {anomaly.severity}
      </span>
    </motion.div>
  );
}

// ── Forecast Chart ────────────────────────────────────────────────────────────
function ForecastChart({ data }) {
  if (!data) return null;

  const historical = (data.series || []).slice(-30);
  const forecast   = (data.forecast || []).slice(0, 30);

  const hDates  = historical.map(p => p.ds);
  const hVals   = historical.map(p => p.y);
  const fDates  = forecast.map(p => p.ds);
  const fYhat   = forecast.map(p => p.yhat);
  const fLower  = forecast.map(p => p.yhat_lower);
  const fUpper  = forecast.map(p => p.yhat_upper);

  const allDates = [...hDates, ...fDates];

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['Actual Spend', 'Forecast', 'Confidence Band'] },
    xAxis: {
      type: 'category', data: allDates,
      axisLabel: { formatter: v => dayjs(v).format('DD MMM'), rotate: 30, interval: Math.floor(allDates.length / 8) },
    },
    yAxis: { type: 'value', axisLabel: { formatter: v => `₹${(v/1000).toFixed(0)}k` } },
    series: [
      {
        name: 'Actual Spend', type: 'line', data: [...hVals, ...fDates.map(() => null)],
        lineStyle: { color: '#6366F1', width: 2 }, itemStyle: { color: '#6366F1' },
        smooth: true, symbol: 'none',
      },
      {
        name: 'Forecast', type: 'line',
        data: [...hDates.map(() => null), ...fYhat],
        lineStyle: { color: '#38BDF8', type: 'dashed', width: 2 }, itemStyle: { color: '#38BDF8' },
        smooth: true, symbol: 'none',
      },
      {
        name: 'Confidence Band', type: 'line',
        data: [...hDates.map(() => null), ...fUpper],
        lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(56,189,248,0.12)', origin: 'start' },
        smooth: true, symbol: 'none', stack: 'conf',
      },
      {
        name: 'Lower', type: 'line',
        data: [...hDates.map(() => null), ...fLower],
        lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(56,189,248,0.0)' },
        smooth: true, symbol: 'none', stack: 'conf',
      },
    ],
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
          📈 30-Day Spend Forecast
        </h3>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Method: <span style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{data.method}</span>
          {data.total_predicted && (
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              · Predicted: ₹{data.total_predicted.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>
      <ReactECharts option={option} theme="fintrac" style={{ height: 260 }} />
      {data.note && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          ℹ️ {data.note}
        </div>
      )}
    </div>
  );
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm FinTrack AI 🤖 Ask me anything about your finances — spending habits, budgets, savings tips, or anything money-related!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const QUICK = [
    'How can I reduce my spending?',
    'Should I increase my savings rate?',
    'What\'s a good emergency fund size for me?',
    'How am I tracking this month?',
  ];

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    try {
      const resp = await aiService.chat(msg);
      setMessages(m => [...m, { role: 'assistant', content: resp.reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ AI service error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 480, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={16} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>FinTrack AI</div>
          <div style={{ fontSize: 11, color: 'var(--success)' }}>● Powered by Llama 3</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
              color: m.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.5,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '16px 16px 16px 4px', width: 'fit-content' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ease ${i*0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--bg-border)' }}>
          {QUICK.map(q => (
            <button key={q} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 8 }}>
        <input
          className="input" style={{ flex: 1, fontSize: 13 }}
          placeholder="Ask anything about your finances…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading || !input.trim()}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AIAdvisor() {
  const [insights, setInsights]   = useState(null);
  const [forecast, setForecast]   = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [tab, setTab]             = useState('insights');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ins, fore, anom] = await Promise.all([
        aiService.insights().catch(() => ({ insights: [], cached: false })),
        aiService.forecast().catch(() => null),
        aiService.anomalies().catch(() => []),
      ]);
      setInsights(ins);
      setForecast(fore);
      setAnomalies(Array.isArray(anom) ? anom : []);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrain = async () => {
    await aiService.retrain();
    setTimeout(loadAll, 2000);
  };

  const TABS = [
    { id: 'insights',  label: '✨ Insights' },
    { id: 'forecast',  label: '📈 Forecast' },
    { id: 'anomalies', label: `⚠️ Anomalies${anomalies.length ? ` (${anomalies.length})` : ''}` },
    { id: 'chat',      label: '💬 Chat' },
  ];

  return (
    <div style={{ flex: 1 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">🤖 AI Advisor</h1>
            <p className="page-sub">ML models + LLM intelligence, powered by Llama 3 via Groq</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleRetrain} title="Retrain your personal ML model">
              <RotateCcw size={14} /> Retrain
            </button>
            <button className="btn btn-ghost btn-sm" onClick={loadAll} disabled={loading}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid var(--bg-border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s', marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AnimatePresence mode="wait">
          {/* ── Insights Tab ── */}
          {tab === 'insights' && (
            <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  <Sparkles size={24} style={{ marginBottom: 8 }} />
                  <div>Generating AI insights…</div>
                </div>
              )}
              {!loading && insights && (insights.insights || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-tertiary)' }}>
                  No insights yet — add some transactions first!
                </div>
              )}
              {!loading && (insights?.insights || []).map((ins, i) => (
                <InsightCard key={i} insight={ins} index={i} />
              ))}
              {insights?.method === 'placeholder' && (
                <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  💡 Add <code>GROQ_API_KEY</code> to your <code>backend/.env</code> to enable real AI insights.
                </div>
              )}
            </motion.div>
          )}

          {/* ── Forecast Tab ── */}
          {tab === 'forecast' && (
            <motion.div key="forecast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {forecast ? (
                <ForecastChart data={forecast} />
              ) : (
                <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-tertiary)' }}>
                  Not enough transaction data for forecasting yet.
                </div>
              )}
              {forecast?.total_predicted && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 }}>
                  {[
                    { label: 'PREDICTED SPEND (30D)', value: `₹${forecast.total_predicted.toLocaleString('en-IN')}`, color: 'var(--accent)' },
                    { label: 'DAILY AVG (FORECAST)',  value: `₹${(forecast.total_predicted / 30).toFixed(0)}`, color: 'var(--info)' },
                    { label: 'FORECAST METHOD',      value: forecast.method, color: 'var(--success)', noMono: true },
                  ].map(({ label, value, color, noMono }) => (
                    <div key={label} className="stat-card">
                      <div className="stat-label">{label}</div>
                      <div className={noMono ? 'stat-value' : 'stat-value mono'} style={{ color, fontSize: 18, textTransform: 'capitalize' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Anomalies Tab ── */}
          {tab === 'anomalies' && (
            <motion.div key="anomalies" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {anomalies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-tertiary)' }}>
                  ✅ No anomalies detected in the last 30 days. Good job!
                </div>
              ) : anomalies.map((a, i) => (
                <AnomalyCard key={a.transaction_id || i} anomaly={a} index={i} />
              ))}
            </motion.div>
          )}

          {/* ── Chat Tab ── */}
          {tab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
