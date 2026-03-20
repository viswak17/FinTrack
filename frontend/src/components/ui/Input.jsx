export default function Input({
  label,
  error,
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  prefix = null,
  suffix = null,
  required = false,
  ...props
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label className="input-label">
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{
            position: 'absolute', left: 12,
            color: 'var(--text-tertiary)', fontSize: 14,
          }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          className={`input ${className}`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={{
            paddingLeft: prefix ? 32 : undefined,
            paddingRight: suffix ? 36 : undefined,
          }}
          required={required}
          {...props}
        />
        {suffix && (
          <span style={{
            position: 'absolute', right: 12,
            color: 'var(--text-tertiary)', fontSize: 13,
          }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
