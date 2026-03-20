import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { categoriesService } from '../services/categories';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const EMOJIS = ['📂', '🍽️', '🚗', '🏠', '🎬', '🛍️', '🏥', '📚', '🌍', '🔁', '💳', '💰', '📊'];
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#38BDF8', '#EF4444', '#818CF8', '#F472B6', '#A78BFA'];

function CategoryForm({ initial = {}, categories = [], onSubmit, loading }) {
  const [form, setForm] = useState({
    name: '', type: 'expense', color: '#6366F1', emoji: '📂', parent_id: null, ...initial,
  });
  const u = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="input-label">Name *</label>
        <input className="input" value={form.name} onChange={u('name')} required placeholder="e.g. Food Delivery" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="input-label">Type</label>
          <select className="input" value={form.type} onChange={u('type')}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div>
          <label className="input-label">Parent Category</label>
          <select className="input" value={form.parent_id || ''} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value || null }))}>
            <option value="">— Top Level —</option>
            {categories.filter((c) => !c.parent_id && c.type === form.type).map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Emoji</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EMOJIS.map((e) => (
            <button key={e} type="button"
              onClick={() => setForm((f) => ({ ...f, emoji: e }))}
              style={{
                width: 34, height: 34, borderRadius: 8, fontSize: 18,
                background: form.emoji === e ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                border: form.emoji === e ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="input-label">Color</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {COLORS.map((c) => (
            <button key={c} type="button"
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                cursor: 'pointer', outline: form.color === c ? '3px solid white' : 'none',
                transform: form.color === c ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.15s',
              }} />
          ))}
        </div>
      </div>
      <Button type="submit" loading={loading}>
        {initial.id ? 'Save Changes' : 'Create Category'}
      </Button>
    </form>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('expense');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const data = await categoriesService.list(null, true);
    setCategories(data);
  };

  const topLevel = categories.filter((c) => !c.parent_id && c.type === tab);
  const childrenOf = (id) => categories.filter((c) => c.parent_id === id);

  const handleCreate = async (form) => {
    setLoading(true);
    try {
      await categoriesService.create(form);
      await loadCategories();
      setModalOpen(false);
    } finally { setLoading(false); }
  };

  const handleEdit = async (form) => {
    setLoading(true);
    try {
      await categoriesService.update(editTarget.id, form);
      await loadCategories();
      setEditTarget(null);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category and all sub-categories?')) return;
    await categoriesService.delete(id);
    await loadCategories();
  };

  return (
    <div style={{ flex: 1 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">📂 Categories</h1>
            <p className="page-sub">Smarter categorization, zero manual effort</p>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            New Category
          </Button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {/* Tab switch */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['expense', 'income'].map((t) => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t === 'expense' ? '💸' : '💰'} {t}
            </button>
          ))}
        </div>

        {/* Categories tree */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {topLevel.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
              No {tab} categories yet. Add your first one!
            </div>
          )}
          {topLevel.map((cat, i) => {
            const children = childrenOf(cat.id);
            return (
              <motion.div key={cat.id}
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ padding: '16px 20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${cat.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{cat.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
                    {children.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {children.length} sub-{children.length === 1 ? 'category' : 'categories'}
                      </div>
                    )}
                  </div>
                  {cat.is_system && <span className="badge badge-info" style={{ fontSize: 11 }}>System</span>}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 6 }}
                      onClick={() => setEditTarget(cat)}><Edit2 size={13} /></button>
                    {!cat.is_system && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--danger)' }}
                        onClick={() => handleDelete(cat.id)}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>

                {/* Children */}
                {children.length > 0 && (
                  <div style={{ marginTop: 10, paddingLeft: 48, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {children.map((child) => (
                      <div key={child.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 8,
                        background: 'var(--bg-elevated)',
                      }}>
                        <ChevronRight size={12} color="var(--text-tertiary)" />
                        <span style={{ fontSize: 15 }}>{child.emoji}</span>
                        <span style={{ fontSize: 13, flex: 1 }}>{child.name}</span>
                        <button className="btn btn-ghost btn-sm" style={{ padding: 4 }}
                          onClick={() => setEditTarget(child)}><Edit2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Category">
        <CategoryForm categories={categories} onSubmit={handleCreate} loading={loading} />
      </Modal>
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Category">
        {editTarget && <CategoryForm initial={editTarget} categories={categories} onSubmit={handleEdit} loading={loading} />}
      </Modal>
    </div>
  );
}
