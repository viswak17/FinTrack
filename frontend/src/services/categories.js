import api from './api';

export const categoriesService = {
  async list(type = null, flat = false) {
    const res = await api.get('/categories/', { params: { type, flat } });
    return res.data;
  },
  async create(data) {
    const res = await api.post('/categories/', data);
    return res.data;
  },
  async get(id) {
    const res = await api.get(`/categories/${id}`);
    return res.data;
  },
  async update(id, data) {
    const res = await api.put(`/categories/${id}`, data);
    return res.data;
  },
  async delete(id) {
    await api.delete(`/categories/${id}`);
  },
};
