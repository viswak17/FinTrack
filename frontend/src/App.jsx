import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import useAppStore from './store/useAppStore';

// Pages — Phase 1
import Login from './pages/Login';
import Register from './pages/Register';
import CommandCenter from './pages/CommandCenter';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';

// Pages — Phase 2
import Goals from './pages/Goals';
import Recurring from './pages/Recurring';
import Currency from './pages/Currency';
import Reports from './pages/Reports';

// Pages — Phase 3 + 4
import AIAdvisor from './pages/AIAdvisor';
import Settings from './pages/Settings';

// Lazy placeholders for pages not yet implemented
function PlaceholderPage({ title, emoji }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontSize: 48 }}>{emoji}</span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Coming in Phase 2 / Phase 3</p>
    </div>
  );
}

// ── Auth Guard ────────────────────────────────────────────────────────────────
function RequireAuth() {
  const { isAuthenticated } = useAppStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

// ── Main app shell with sidebar + topbar ──────────────────────────────────────
function AppShell() {
  const { loadAccounts, loadCategories, accountsLoaded, categoriesLoaded } = useAppStore();

  // Eager-load shared data once authenticated
  useEffect(() => {
    if (!accountsLoaded) loadAccounts();
    if (!categoriesLoaded) loadCategories();
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, loadMe } = useAppStore();

  // Rehydrate user on hard refresh if token present
  useEffect(() => {
    if (!isAuthenticated && localStorage.getItem('access_token')) {
      loadMe();
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />

        {/* Protected */}
        <Route element={<RequireAuth />}>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/ai" element={<AIAdvisor />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
