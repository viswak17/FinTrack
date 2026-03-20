import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { currencyService } from '../services/phase2';

const FLAGS = { INR:'🇮🇳', USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', AED:'🇦🇪', SGD:'🇸🇬', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦', CHF:'🇨🇭' };
const CURRENCIES = ['INR','USD','EUR','GBP','AED','SGD','JPY','AUD','CAD','CHF'];

export default function Currency() {
  const [rates, setRates]           = useState(null);
  const [base, setBase]             = useState('USD');
  const [amount, setAmount]         = useState('1000');
  const [fromCur, setFromCur]       = useState('INR');
  const [toCur, setToCur]           = useState('USD');
  const [converted, setConverted]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [convLoading, setConvLoading] = useState(false);

  useEffect(() => { loadRates(); }, [base]);

  const loadRates = async () => {
    setLoading(true);
    try { setRates(await currencyService.rates(base)); }
    finally { setLoading(false); }
  };

  const handleConvert = async () => {
    setConvLoading(true);
    try { setConverted(await currencyService.convert(parseFloat(amount), fromCur, toCur)); }
    finally { setConvLoading(false); }
  };

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">🌍 Multi-Currency</h1>
        <p className="page-sub">Live FX rates · Cached every hour</p>
      </div>

      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Converter */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 18 }}>
            Currency Converter
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label className="input-label">Amount</label>
              <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" />
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="input-label">From</label>
              <select className="input" value={fromCur} onChange={(e) => setFromCur(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 2 }}>
              <ArrowRight size={18} color="var(--text-tertiary)" />
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="input-label">To</label>
              <select className="input" value={toCur} onChange={(e) => setToCur(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleConvert} disabled={convLoading}>
              {convLoading ? 'Converting…' : 'Convert'}
            </button>
          </div>
          {converted && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 18, padding: 16, background: 'var(--bg-elevated)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Result</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--accent)', margin: '4px 0' }}>
                {converted.converted.toLocaleString()} {toCur}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                1 {fromCur} = {converted.rate} {toCur}
              </div>
            </motion.div>
          )}
        </div>

        {/* Live rates table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              Live Rates (Base: {base})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" style={{ width: 100 }} value={base} onChange={(e) => setBase(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={loadRates} disabled={loading}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {CURRENCIES.filter((c) => c !== base).map((cur, i) => (
              <motion.div key={cur} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '14px 16px',
                  border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{FLAGS[cur]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{cur}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                  {rates?.rates?.[cur]?.toFixed(4) ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>per 1 {base}</div>
              </motion.div>
            ))}
          </div>
          {rates?.timestamp && (
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
              Last updated: {new Date(rates.timestamp).toLocaleTimeString('en-IN')}
              {rates.source === 'fallback' && ' (dev fallback rates)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
