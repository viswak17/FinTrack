export default function Badge({ children, variant = 'accent', style = {} }) {
  // variant: 'up' | 'down' | 'warn' | 'info' | 'accent'
  return (
    <span className={`badge badge-${variant}`} style={style}>
      {children}
    </span>
  );
}
