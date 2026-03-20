/**
 * CSVImporter — Full column-mapper UI for bulk transaction import.
 * Steps:
 * 1. Upload CSV file
 * 2. Auto-detect columns (date/amount/description/payee/type)
 * 3. Manual column reassignment via dropdowns
 * 4. Preview first 5 rows
 * 5. Confirm import → POST /transactions/import/csv
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check, AlertCircle, ArrowRight, FileText, X } from 'lucide-react';
import Papa from 'papaparse';
import api from '../../services/api';
import Modal from './Modal';
import Button from './Button';

const FIELD_DEFS = [
  { key: 'date',        label: 'Date *',       required: true,  aliases: ['date','transaction date','txn date','value date','posting date','trans date'] },
  { key: 'amount',      label: 'Amount *',      required: true,  aliases: ['amount','debit','credit','sum','value','inr','rs'] },
  { key: 'description', label: 'Description',  required: false, aliases: ['description','desc','narration','particulars','remarks','memo','details'] },
  { key: 'payee',       label: 'Payee',         required: false, aliases: ['payee','merchant','vendor','to','name','beneficiary'] },
  { key: 'type',        label: 'Type',          required: false, aliases: ['type','dr/cr','category','debit/credit','d/c'] },
];

function autoDetect(headers) {
  const map = {};
  headers.forEach(h => {
    const low = h.toLowerCase().trim();
    for (const field of FIELD_DEFS) {
      if (!map[field.key] && field.aliases.some(a => low.includes(a))) {
        map[field.key] = h;
      }
    }
  });
  return map;
}

function parseRow(row, mapping) {
  const get  = (key) => mapping[key] ? row[mapping[key]] : '';
  const rawAmount = get('amount')?.toString().replace(/[₹,\s]/g, '');
  const amount    = parseFloat(rawAmount) || 0;
  const rawType   = get('type')?.toLowerCase() || '';
  const type      = rawType.includes('cr') || rawType.includes('income') ? 'income' : 'expense';
  return {
    date:        get('date'),
    amount:      Math.abs(amount),
    type,
    description: get('description'),
    payee:       get('payee'),
  };
}

export default function CSVImporter({ open, onClose, onImported }) {
  const fileRef  = useRef(null);
  const [step, setStep]         = useState('upload');  // upload | map | preview | importing | done
  const [headers, setHeaders]   = useState([]);
  const [rows, setRows]         = useState([]);
  const [mapping, setMapping]   = useState({});
  const [preview, setPreview]   = useState([]);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setPreview([]); setResult(null); setError(''); setFileName('');
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const hdrs = meta.fields || [];
        setHeaders(hdrs);
        setRows(data);
        const detected = autoDetect(hdrs);
        setMapping(detected);
        setStep('map');
      },
      error: (e) => setError(e.message),
    });
  };

  const handlePreview = () => {
    if (!mapping.date || !mapping.amount) {
      setError('Date and Amount columns are required.'); return;
    }
    setError('');
    setPreview(rows.slice(0, 5).map(r => parseRow(r, mapping)));
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const transactions = rows.map(r => parseRow(r, mapping)).filter(t => t.amount > 0);
      const resp = await api.post('/transactions/import/csv', { transactions });
      setResult(resp.data);
      setStep('done');
      onImported?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Import failed');
      setStep('preview');
    }
  };

  return (
    <Modal isOpen={open} onClose={() => { reset(); onClose(); }} title="📂 Import CSV Transactions" width={560}>
      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              style={{
                border: '2px dashed var(--bg-border)', borderRadius: 16, padding: '40px 32px',
                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--bg-border)'; handleFile(e.dataTransfer.files[0]); }}
            >
              <Upload size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop your CSV here</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>or click to browse · Supports bank statement CSVs</div>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
              💡 Supports HDFC, SBI, Axis, ICICI and most bank exports. Duplicates are detected automatically.
            </div>
          </motion.div>
        )}

        {/* STEP 2: Column Mapper */}
        {step === 'map' && (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              <FileText size={14} /> {fileName} · {rows.length} rows detected
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FIELD_DEFS.map(field => (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, fontSize: 13, fontWeight: 500 }}>
                    {field.label}
                    {mapping[field.key] && <span style={{ marginLeft: 4, color: 'var(--success)' }}>✓</span>}
                  </div>
                  <ArrowRight size={14} color="var(--text-tertiary)" />
                  <select className="input" style={{ flex: 1 }}
                    value={mapping[field.key] || ''}
                    onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value || undefined }))}>
                    <option value="">— Skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>← Back</button>
              <Button style={{ flex: 1 }} onClick={handlePreview}>Preview Import →</Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Importing <strong>{rows.length}</strong> rows — preview (first 5):
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bg-border)', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Date','Amount','Type','Description','Payee'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td style={{ padding: '8px 10px' }}>{row.date}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: row.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                        {row.type === 'income' ? '+' : '-'}₹{row.amount?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 10px' }}><span className={`badge badge-${row.type === 'income' ? 'up' : 'down'}`} style={{ fontSize: 10 }}>{row.type}</span></td>
                      <td style={{ padding: '8px 10px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</td>
                      <td style={{ padding: '8px 10px' }}>{row.payee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} />{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('map')}>← Edit Mapping</button>
              <Button style={{ flex: 1 }} onClick={handleImport}>Import {rows.length} Transactions</Button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Importing */}
        {step === 'importing' && (
          <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 2s linear infinite', display: 'inline-block' }}>⟳</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Importing transactions…</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Deduplicating and saving {rows.length} rows</div>
          </motion.div>
        )}

        {/* STEP 5: Done */}
        {step === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={28} color="var(--success)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import Complete!</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--success)' }}>{result.imported}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Imported</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--warning)' }}>{result.skipped}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Skipped (dupes)</div>
              </div>
            </div>
            <Button onClick={() => { reset(); onClose(); }}>Close</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
