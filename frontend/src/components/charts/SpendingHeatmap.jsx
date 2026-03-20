/**
 * SpendingHeatmap — 52-week GitHub-style calendar heatmap.
 * Uses daily spending aggregated from the Reports API.
 * Color intensity: light purple → deep indigo based on spend.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import api from '../../services/api';

dayjs.extend(isoWeek);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function intensityColor(amount, max) {
  if (!amount || amount === 0) return 'var(--bg-elevated)';
  const ratio = Math.min(amount / (max || 1), 1);
  // Purple gradient: low → high spend
  const stops = [
    [99, 102, 241, 0.15],   // near-zero
    [99, 102, 241, 0.35],
    [99, 102, 241, 0.55],
    [99, 102, 241, 0.80],
    [79,  70, 229, 1.00],   // max spend
  ];
  const idx  = Math.min(Math.floor(ratio * (stops.length - 1)), stops.length - 2);
  const t    = (ratio * (stops.length - 1)) - idx;
  const [r1,g1,b1,a1] = stops[idx];
  const [r2,g2,b2,a2] = stops[idx+1];
  const r = Math.round(r1 + (r2-r1)*t);
  const g = Math.round(g1 + (g2-g1)*t);
  const b = Math.round(b1 + (b2-b1)*t);
  const a = +(a1 + (a2-a1)*t).toFixed(2);
  return `rgba(${r},${g},${b},${a})`;
}

export default function SpendingHeatmap() {
  const [data, setData]       = useState({});   // { 'YYYY-MM-DD': amount }
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maxSpend, setMaxSpend] = useState(1);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      // Fetch last 12 months daily‐spend from the report endpoint
      const promises = [];
      const now = dayjs();
      for (let m = 11; m >= 0; m--) {
        const target = now.subtract(m, 'month');
        promises.push(
          api.get('/reports/daily-spend', {
            params: { year: target.year(), month: target.month() + 1 },
          }).then(r => ({ month: target, days: r.data }))
        );
      }
      const results = await Promise.all(promises);
      const map = {};
      let max = 0;
      results.forEach(({ month, days }) => {
        (days || []).forEach(d => {
          if (d.total > 0) {
            map[d.label] = d.total;
            if (d.total > max) max = d.total;
          }
        });
      });
      setData(map);
      setMaxSpend(max || 1);
    } catch {}
    finally { setLoading(false); }
  };

  // Build 53-week grid ending today
  const today    = dayjs();
  const startDay = today.subtract(52, 'week').startOf('week');
  const weeks    = [];
  let cur = startDay;
  while (cur.isBefore(today) || cur.isSame(today, 'day')) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = cur.add(d, 'day');
      week.push(dt);
    }
    weeks.push(week);
    cur = cur.add(7, 'day');
  }

  // Month label positions
  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (first.date() <= 7) {
      monthLabels.push({ wi, label: MONTHS[first.month()] });
    }
  });

  const CELL = 12;
  const GAP  = 3;

  const totalSpend = Object.values(data).reduce((s, v) => s + v, 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
          🔥 Spending Heatmap
        </h3>
        {totalSpend > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            12-month total:&nbsp;
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
              ₹{totalSpend.toLocaleString('en-IN')}
            </span>
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Loading heatmap…
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Month labels row */}
            <div style={{ display: 'flex', marginBottom: 4, marginLeft: 28 }}>
              {weeks.map((_, wi) => {
                const label = monthLabels.find(m => m.wi === wi);
                return (
                  <div key={wi} style={{ width: CELL + GAP, fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {label?.label || ''}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Day labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 4, paddingTop: 2 }}>
                {DAYS.map((d, i) => (
                  <div key={d} style={{ height: CELL, fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                    {i % 2 === 1 ? d.slice(0,1) : ''}
                  </div>
                ))}
              </div>
              {/* Cells */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: GAP }}>
                  {week.map((dt) => {
                    const key    = dt.format('YYYY-MM-DD');
                    const amount = data[key] || 0;
                    const isFuture = dt.isAfter(today, 'day');
                    return (
                      <div
                        key={key}
                        onMouseEnter={(e) => {
                          if (!isFuture) setTooltip({ key, amount, x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          width:  CELL, height: CELL, borderRadius: 3,
                          background: isFuture ? 'transparent' : intensityColor(amount, maxSpend),
                          cursor: amount > 0 ? 'pointer' : 'default',
                          transition: 'transform 0.1s',
                          flexShrink: 0,
                        }}
                        onMouseOver={e => { if (amount > 0) e.currentTarget.style.transform = 'scale(1.3)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Less</span>
              {[0, 0.2, 0.4, 0.7, 1].map((ratio, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: intensityColor(ratio * maxSpend, maxSpend),
                }} />
              ))}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>More</span>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed', zIndex: 9999,
            left: tooltip.x + 12, top: tooltip.y - 36,
            background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 8, padding: '6px 10px', fontSize: 12, pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <strong>{tooltip.key}</strong>
          <br />
          {tooltip.amount > 0
            ? <span style={{ color: 'var(--danger)' }}>₹{tooltip.amount.toLocaleString('en-IN')}</span>
            : <span style={{ color: 'var(--text-tertiary)' }}>No spend</span>}
        </motion.div>
      )}
    </div>
  );
}
