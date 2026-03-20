import api from './api';

export const authService = {
  async register(data) {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('access_token', res.data.access_token);
    return res.data;
  },

  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    return res.data;
  },

  async logout() {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
  },

  async getMe() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },
};
