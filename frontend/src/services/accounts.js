import api from './api';

export const accountsService = {
  async list(includeArchived = false) {
    const res = await api.get('/accounts/', { params: { include_archived: includeArchived } });
    return res.data;
  },
  async create(data) {
    const res = await api.post('/accounts/', data);
    return res.data;
  },
  async get(id) {
    const res = await api.get(`/accounts/${id}`);
    return res.data;
  },
  async update(id, data) {
    const res = await api.put(`/accounts/${id}`, data);
    return res.data;
  },
  async delete(id) {
    await api.delete(`/accounts/${id}`);
  },
  async getNetWorth() {
    const res = await api.get('/accounts/net-worth');
    return res.data;
  },
};
