import { motion } from 'framer-motion';

export default function ProgressBar({ value = 0, max = 100, color, height = 6, animated = true }) {
  const percent = Math.min((value / max) * 100, 100);

  // Auto-color based on percentage if not overridden
  const barColor = color || (
    percent > 100 ? 'var(--danger)' :
    percent > 80  ? 'var(--warning)' :
    'var(--success)'
  );

  return (
    <div className="progress-track" style={{ height }}>
      <motion.div
        className="progress-fill"
        style={{ background: barColor }}
        initial={animated ? { width: 0 } : { width: `${percent}%` }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      />
    </div>
  );
}
