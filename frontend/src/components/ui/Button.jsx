import { motion } from 'framer-motion';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'ghost' | 'danger'
  size = '',           // '' | 'sm' | 'lg'
  loading = false,
  disabled = false,
  icon = null,
  onClick,
  type = 'button',
  className = '',
  style = {},
}) {
  return (
    <motion.button
      type={type}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
      style={{ opacity: disabled ? 0.5 : 1, ...style }}
    >
      {loading ? (
        <svg style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : icon}
      {children}
    </motion.button>
  );
}
