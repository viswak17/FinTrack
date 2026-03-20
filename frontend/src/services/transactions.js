import api from './api';

export const transactionsService = {
  async list(params = {}) {
    const res = await api.get('/transactions/', { params });
    return res.data;
  },
  async create(data) {
    const res = await api.post('/transactions/', data);
    return res.data;
  },
  async get(id) {
    const res = await api.get(`/transactions/${id}`);
    return res.data;
  },
  async update(id, data) {
    const res = await api.put(`/transactions/${id}`, data);
    return res.data;
  },
  async delete(id) {
    await api.delete(`/transactions/${id}`);
  },
  async split(id, splits) {
    const res = await api.post(`/transactions/${id}/split`, { splits });
    return res.data;
  },
  async bulkImport(file, accountId) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/transactions/bulk-import?account_id=${accountId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export const budgetsService = {
  async list() {
    const res = await api.get('/budgets/');
    return res.data;
  },
  async listActive() {
    const res = await api.get('/budgets/active');
    return res.data;
  },
  async vsActual(month = null) {
    const res = await api.get('/budgets/vs-actual', { params: { month } });
    return res.data;
  },
  async create(data) {
    const res = await api.post('/budgets/', data);
    return res.data;
  },
  async get(id) {
    const res = await api.get(`/budgets/${id}`);
    return res.data;
  },
  async update(id, data) {
    const res = await api.put(`/budgets/${id}`, data);
    return res.data;
  },
  async delete(id) {
    await api.delete(`/budgets/${id}`);
  },
};
