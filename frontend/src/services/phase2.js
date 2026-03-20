import api from './api';

export const goalsService = {
  async list()              { return (await api.get('/goals/')).data; },
  async create(data)        { return (await api.post('/goals/', data)).data; },
  async get(id)             { return (await api.get(`/goals/${id}`)).data; },
  async update(id, data)    { return (await api.put(`/goals/${id}`, data)).data; },
  async delete(id)          { await api.delete(`/goals/${id}`); },
  async contribute(id, data){ return (await api.post(`/goals/${id}/contribute`, data)).data; },
  async contributions(id)   { return (await api.get(`/goals/${id}/contributions`)).data; },
};

export const recurringService = {
  async list(activeOnly = true) {
    return (await api.get('/recurring/', { params: { active_only: activeOnly } })).data;
  },
  async create(data)     { return (await api.post('/recurring/', data)).data; },
  async get(id)          { return (await api.get(`/recurring/${id}`)).data; },
  async update(id, data) { return (await api.put(`/recurring/${id}`, data)).data; },
  async delete(id)       { await api.delete(`/recurring/${id}`); },
  async processNow(id)   { return (await api.post(`/recurring/${id}/process-now`)).data; },
};

export const currencyService = {
  async rates(base = 'USD')     { return (await api.get('/currency/rates', { params: { base } })).data; },
  async convert(amount, from_, to_) {
    return (await api.get('/currency/convert', {
      params: { amount, from_currency: from_, to_currency: to_ },
    })).data;
  },
  async supported()              { return (await api.get('/currency/supported')).data; },
  async getPreferences()         { return (await api.get('/currency/preferences')).data; },
  async updatePreferences(data)  { return (await api.put('/currency/preferences', data)).data; },
};

export const reportsService = {
  async summary(year, month)       { return (await api.get('/reports/summary',            { params: { year, month } })).data; },
  async categoryBreakdown(y, m, t) { return (await api.get('/reports/category-breakdown', { params: { year: y, month: m, type: t } })).data; },
  async monthlyTrend(months = 6)   { return (await api.get('/reports/monthly-trend',      { params: { months } })).data; },
  async dailySpend(year, month)    { return (await api.get('/reports/daily-spend',         { params: { year, month } })).data; },
  async topMerchants(months = 1)   { return (await api.get('/reports/top-merchants',       { params: { months } })).data; },
  exportCsvUrl(start, end) {
    const p = new URLSearchParams();
    if (start) p.set('start_date', start);
    if (end)   p.set('end_date',   end);
    return `/api/v1/reports/export/csv?${p}`;
  },
};
