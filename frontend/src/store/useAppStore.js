/**
 * Zustand global state store.
 * Houses: auth user, accounts, categories, transactions, budgets,
 * and UI state (sidebar collapse, active currency, notifications).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/auth';
import { accountsService } from '../services/accounts';
import { categoriesService } from '../services/categories';

const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Auth ──────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        const data = await authService.login(email, password);
        const me = await authService.getMe();
        set({ user: me, isAuthenticated: true });
        return me;
      },

      register: async (formData) => {
        const data = await authService.register(formData);
        const me = await authService.getMe();
        set({ user: me, isAuthenticated: true });
        return me;
      },

      logout: async () => {
        await authService.logout();
        set({ user: null, isAuthenticated: false, accounts: [], categories: [] });
      },

      loadMe: async () => {
        try {
          const me = await authService.getMe();
          set({ user: me, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      // ── UI State ──────────────────────────────────────────────────────────
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      activeCurrency: 'INR',
      setActiveCurrency: (c) => set({ activeCurrency: c }),

      notifications: [],
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { id: Date.now(), ...n },
            ...s.notifications.slice(0, 19),
          ],
        })),
      clearNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      // ── Data: Accounts ────────────────────────────────────────────────────
      accounts: [],
      accountsLoaded: false,
      loadAccounts: async () => {
        const data = await accountsService.list();
        set({ accounts: data, accountsLoaded: true });
      },
      addAccount: (acct) => set((s) => ({ accounts: [...s.accounts, acct] })),
      updateAccount: (id, updates) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),

      // ── Data: Categories ──────────────────────────────────────────────────
      categories: [],
      categoriesLoaded: false,
      loadCategories: async () => {
        const data = await categoriesService.list(null, true); // flat list
        set({ categories: data, categoriesLoaded: true });
      },

      // ── Computed helpers ──────────────────────────────────────────────────
      getCategoryById: (id) => get().categories.find((c) => c.id === id),
      getAccountById: (id) => get().accounts.find((a) => a.id === id),
    }),
    {
      name: 'fintrack-store',
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        sidebarCollapsed: s.sidebarCollapsed,
        activeCurrency: s.activeCurrency,
      }),
    }
  )
);

export default useAppStore;
