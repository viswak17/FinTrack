import { motion } from 'framer-motion';

export default function Card({ children, className = '', hover = true, style = {}, ...props }) {
  return (
    <motion.div
      className={`card ${className}`}
      whileHover={hover ? { y: -2, borderColor: 'rgba(99,102,241,0.3)' } : {}}
      transition={{ duration: 0.2 }}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}
