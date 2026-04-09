import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { OBRAS_DATA } from './Obras';
import { FORNECEDORES_DATA } from './Fornecedores';
import { CLIENTES_DATA } from './Clientes';
import EntityAccessEditorModal from '../components/access/EntityAccessEditorModal.jsx';
import { canAccessObra, canEditEntitySection, canEditModule, canEditObra, canViewEntitySection } from '../context/PermissionsConfig';
import { syncProcessosEncomendaFromObra } from '../utils/encomendaWorkflow';

const fmt  = v => '€ ' + Number(v).toLocaleString('pt-PT');
const fmtK = v => { const n = Math.abs(v); return (n >= 1000000 ? (v/1000000).toFixed(1)+'M' : n >= 1000 ? (v/1000).toFixed(0)+'k' : v) + ' €'; };

const FASE_EST = {
  ok:       { label: 'OK',       cls: 'badge-s' },
  atencao:  { label: 'Atenção',  cls: 'badge-w' },
  alerta:   { label: 'Alerta',   cls: 'badge-w' },
  critico:  { label: 'Crítico',  cls: 'badge-d' },
  pendente: { label: 'Pendente', cls: 'badge-n' },
};

const JADO_STEPS = [
  { key: 'rascunho',       label: 'Rascunho',        cls: 'badge-n' },
  { key: 'aguarda-dp',     label: 'Aguarda DP',       cls: 'badge-i' },
  { key: 'aguarda-dir',    label: 'Aguarda Dir. Prod.',cls: 'badge-i' },
  { key: 'enviado-ms',     label: 'Enviado MS',       cls: 'badge-w' },
  { key: 'validado-ms',    label: 'Validado MS',      cls: 'badge-s' },
  { key: 'env-comercial',  label: 'Env. Comercial',   cls: 'badge-s' },
  { key: 'resolvido',      label: 'Resolvido',        cls: 'badge-s' },
];

const ALERTA_CONFIG = {
  atencao: { label: 'Atenção', bg: 'var(--bg-warning)', border: 'var(--color-warning)', text: '#7a4a0a', pct: '0–1%' },
  alerta:  { label: 'Alerta',  bg: '#FEF0E4',           border: '#C47A1A',              text: '#7a3a0a', pct: '1–2%' },
  critico: { label: 'Crítico', bg: 'var(--bg-danger)',  border: 'var(--color-danger)',  text: '#7a1a1a', pct: '>2%'  },
};

const JADO_VALIDATORS = [
  { id: 'miguel', nome: 'Miguel' },
  { id: 'pedro', nome: 'Pedro' },
  { id: 'ana', nome: 'Ana' },
];

function getJadoValidatorTarget(id) {
  if (id === 'miguel') return 'ms';
  if (id === 'pedro') return 'dp';
  if (id === 'ana') return 'lg';
  return 'dp';
}

// ─── PERSISTÊNCIA ─────────────────────────────────────────────────────────────
const LS_KEY = 'sis_obras_data';
const EXTRA_OBRAS_KEY = 'sis_obras_extra';
const ARTIGOS_CATALOGO_KEY = 'sis_catalogo_artigos';
const ARTIGOS_DB_NAME = 'novanor_sis_catalogo_db';
const ARTIGOS_DB_STORE = 'artigos_catalogo';
function loadObrasLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function loadObrasExtra() {
  try { return JSON.parse(localStorage.getItem(EXTRA_OBRAS_KEY) || '[]'); } catch { return []; }
}
function saveObraLS(id, campos) {
  const all = loadObrasLS();
  all[id] = { ...(all[id] || {}), ...campos };
  const json = JSON.stringify(all);
  localStorage.setItem(LS_KEY, json);
  window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: json }));
}
function getObraData(id) {
  const base = [...OBRAS_DATA, ...loadObrasExtra()].find(o => o.id === id);
  if (!base) return null;
  const extra = loadObrasLS()[id] || {};
  return { ...base, ...extra,
    fases:      extra.fases      || base.fases,
    jados:      extra.jados      || base.jados      || [],
    alertas:    extra.alertas    || base.alertas    || [],
    encomendas: extra.encomendas || base.encomendas || [],
    planoFaturacao: extra.planoFaturacao || base.planoFaturacao || [],
    thresholds: extra.thresholds || { atencao: 1, alerta: 2, critico: 2, dataLimite: '' },
  };
}

function parseExcelNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(/[€$]/g, '')
    .replace('%', '')
    .replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeArtigoCatalogo(raw = {}) {
  const descricao = String(raw.descricao || '').trim();
  const ref = String(raw.ref || '').trim();
  return {
    id: raw.id || `ART-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    descricao,
    ref,
    unidade: String(raw.unidade || 'Un.').trim() || 'Un.',
    preco: parseExcelNumber(raw.preco, 0),
    iva: parseExcelNumber(raw.iva, 23),
    desconto: parseExcelNumber(raw.desconto, 0),
    qtdDefault: parseExcelNumber(raw.qtdDefault ?? raw.qtd, 1) || 1,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function artigoCatalogoMatchKey(raw = {}) {
  const normalized = normalizeArtigoCatalogo(raw);
  return normalized.ref
    ? `ref:${normalized.ref.toLowerCase()}`
    : `desc:${normalized.descricao.toLowerCase()}`;
}

function openArtigosCatalogoDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('O browser não suporta armazenamento local avançado para o catálogo.'));
      return;
    }
    const request = window.indexedDB.open(ARTIGOS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARTIGOS_DB_STORE)) {
        db.createObjectStore(ARTIGOS_DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir a base local do catálogo.'));
  });
}

async function loadArtigosCatalogo() {
  try {
    const db = await openArtigosCatalogoDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(ARTIGOS_DB_STORE, 'readonly');
      const store = tx.objectStore(ARTIGOS_DB_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Falha ao ler o catálogo.'));
    });
    db.close();
    return Array.isArray(items) ? items.map(normalizeArtigoCatalogo).filter(item => item.descricao) : [];
  } catch {
    try {
      const raw = JSON.parse(localStorage.getItem(ARTIGOS_CATALOGO_KEY) || '[]');
      return Array.isArray(raw) ? raw.map(normalizeArtigoCatalogo).filter(item => item.descricao) : [];
    } catch {
      return [];
    }
  }
}

async function saveArtigosCatalogo(list) {
  const normalized = list.map(normalizeArtigoCatalogo);
  const db = await openArtigosCatalogoDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ARTIGOS_DB_STORE, 'readwrite');
    const store = tx.objectStore(ARTIGOS_DB_STORE);
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error || new Error('Falha ao limpar o catálogo local.'));
    clearRequest.onsuccess = () => {
      normalized.forEach(item => store.put(item));
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Falha ao guardar o catálogo.'));
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada ao guardar o catálogo.'));
  });
  db.close();
  try { localStorage.removeItem(ARTIGOS_CATALOGO_KEY); } catch {}
}

function mergeArtigosCatalogo(existing = [], incoming = []) {
  const map = new Map();
  existing.map(normalizeArtigoCatalogo).filter(item => item.descricao).forEach(item => {
    map.set(artigoCatalogoMatchKey(item), item);
  });
  incoming.map(normalizeArtigoCatalogo).filter(item => item.descricao).forEach(item => {
    const key = artigoCatalogoMatchKey(item);
    const prev = map.get(key);
    map.set(key, {
      ...(prev || {}),
      ...item,
      id: prev?.id || item.id,
      updatedAt: new Date().toISOString(),
    });
  });
  return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-PT'));
}

async function parseArtigosFromExcel(file) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headerRow = rows.findIndex(r =>
    r.some(c => /descri|artigo|material|item/i.test(String(c))) ||
    r.some(c => /qtd|quant/i.test(String(c))) ||
    r.some(c => /nome|nartigo|preço|preco/i.test(String(c)))
  );
  if (headerRow < 0) throw new Error('Não foi possível detectar cabeçalho. Use colunas: Descrição, Qtd, Preço, IVA');
  const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());
  const col = (keys) => {
    for (const key of keys) {
      const idx = headers.findIndex(h => h === key || h.includes(key));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const iDesc = col(['descrição', 'descricao', 'nome', 'designação', 'designacao', 'material', 'item', 'artigo']);
  const iRef = col(['nartigo', 'referência', 'referencia', 'ref', 'código', 'codigo', 'cod', 'sku', 'ref.']);
  const iQtd = col(['qtd', 'quant', 'quantidade']);
  const iUn = col(['un', 'unidade', 'unit']);
  const iPreco = col(['preço compra ult.', 'preco compra ult.', 'preço compra', 'preco compra', 'preço', 'preco', 'valor', 'price', 'unit price', 'pvp']);
  const iDescPct = col(['desc', 'desconto', 'discount']);
  const iIVA = col(['iva', 'vat', 'tax']);
  const parsedItens = rows
    .slice(headerRow + 1)
    .filter(r => r.some(c => String(c).trim()))
    .map(r => ({
      descricao: iDesc >= 0 ? String(r[iDesc] || '').trim() : '',
      ref: iRef >= 0 ? String(r[iRef] || '').trim() : '',
      qtd: iQtd >= 0 ? parseExcelNumber(r[iQtd], 1) || 1 : 1,
      unidade: iUn >= 0 ? String(r[iUn] || 'Un.').trim() : 'Un.',
      preco: iPreco >= 0 ? parseExcelNumber(r[iPreco], 0) : 0,
      desconto: iDescPct >= 0 ? parseExcelNumber(r[iDescPct], 0) : 0,
      iva: iIVA >= 0 ? parseExcelNumber(r[iIVA], 23) : 23,
    }))
    .filter(item => item.descricao);
  if (parsedItens.length === 0) throw new Error('Nenhum artigo encontrado. Verifique o ficheiro.');
  return parsedItens;
}

// ─── MINI LINE CHART (SVG) ────────────────────────────────────────────────────
function LineChart({ dados, height = 120 }) {
  if (!dados || dados.length === 0) return null;
  const W = 420, H = height, pad = { t: 10, r: 20, b: 30, l: 50 };
  const valid = dados.filter(d => d.real !== null && d.real !== undefined);
  const allY = [...dados.map(d => d.previsto), ...valid.map(d => d.real)];
  const minY = Math.min(...allY) * 0.95, maxY = Math.max(...allY) * 1.02;
  const xDiv = Math.max(dados.length - 1, 1);
  const ySpan = Math.max(maxY - minY, 1);
  const xScale = i => pad.l + (i / xDiv) * (W - pad.l - pad.r);
  const yScale = v => H - pad.b - ((v - minY) / ySpan) * (H - pad.t - pad.b);
  const pathD = arr => arr.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <polyline points={dados.map((d, i) => `${xScale(i)},${yScale(d.previsto)}`).join(' ')} fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="4 3" />
      {valid.length > 1 && <path d={pathD(valid.map(d => d.real))} fill="none" stroke="var(--brand-primary)" strokeWidth="2" />}
      {valid.map((d, i) => <circle key={i} cx={xScale(dados.indexOf(d))} cy={yScale(d.real)} r="3" fill="var(--brand-primary)" />)}
      {dados.map((d, i) => (
        <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{d.mes}</text>
      ))}
    </svg>
  );
}

function CashflowBarChart({ dados, height = 140 }) {
  if (!dados || dados.length === 0) return null;
  const W = 420, H = height, pad = { t: 10, r: 10, b: 30, l: 50 };
  const maxV = Math.max(1, Math.max(...dados.flatMap(d => [d.recebimentos, d.pagamentos])) * 1.05);
  const bw = (W - pad.l - pad.r) / dados.length;
  const yScale = v => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const barH = v => (v / maxV) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      {dados.map((d, i) => {
        const x = pad.l + i * bw;
        const bwInner = bw * 0.38;
        return (
          <g key={i}>
            <rect x={x + bw * 0.08} y={yScale(d.recebimentos)} width={bwInner} height={barH(d.recebimentos)} fill="var(--color-success)" opacity="0.75" rx="2" />
            <rect x={x + bw * 0.08 + bwInner + 2} y={yScale(d.pagamentos)} width={bwInner} height={barH(d.pagamentos)} fill="var(--color-danger)" opacity="0.65" rx="2" />
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{d.mes}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ProgressBar({ prevista, real, label }) {
  const diff = real - prevista;
  const cor = Math.abs(diff) > 10 ? (diff > 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--brand-primary)';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: cor }}>{real}% <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(prev. {prevista}%)</span></span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', height: '100%', width: `${prevista}%`, background: 'var(--border-strong)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', height: '100%', width: `${real}%`, background: cor, borderRadius: 3, opacity: 0.9 }} />
      </div>
    </div>
  );
}

// ─── MODAL EMITIR JADO ────────────────────────────────────────────────────────
function EmitirJadoModal({ obra, alerta, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    fase:        alerta?.fase || (obra.fases?.[0]?.nome || ''),
    descricao:   alerta ? `Desvio detectado: ${alerta.descricao}` : '',
    desvio:      alerta?.desvio || '',
    nivel:       alerta?.nivel || 'alerta',
    validador:   alerta?.validador || 'miguel',
    contexto:    '',
    planoAcao:   '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle = { width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5, marginTop: 12 };

  const handleSave = () => {
    const num = `JADO #${String((obra.jados?.length || 0) + 1).padStart(3, '0')}`;
    const novo = {
      num, obra: obra.id, fase: form.fase, desvio: parseFloat(form.desvio) || 0,
      nivel: form.nivel, descricao: form.descricao, contexto: form.contexto,
      planoAcao: form.planoAcao, estado: 'aguarda-dp',
      data: new Date().toLocaleDateString('pt-PT'),
      emitidoPor: user?.nome || 'CG', respostaDP: '', comentarios: [],
      validador: form.validador,
      validadorNome: JADO_VALIDATORS.find(v => v.id === form.validador)?.nome || form.validador,
    };
    onSave(novo);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Emitir JADO</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Justificação e Análise de Desvio de Obra — {obra.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <label style={labelStyle}>Fase de Custo</label>
          <select value={form.fase} onChange={e => set('fase', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {obra.fases?.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Desvio (%)</label>
              <input type="number" step="0.1" value={form.desvio} onChange={e => set('desvio', e.target.value)} style={inputStyle} placeholder="ex: 2.5" />
            </div>
            <div>
              <label style={labelStyle}>Nível</label>
              <select value={form.nivel} onChange={e => set('nivel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="atencao">Atenção (0–1%)</option>
                <option value="alerta">Alerta (1–2%)</option>
                <option value="critico">Crítico (&gt;2%)</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>Quem vai validar</label>
          <select value={form.validador} onChange={e => set('validador', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {JADO_VALIDATORS.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>

          <label style={labelStyle}>Descrição do Desvio</label>
          <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Descreve o desvio detectado..." />

          <label style={labelStyle}>Contexto e Análise de Causa</label>
          <textarea value={form.contexto} onChange={e => set('contexto', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Análise da causa do desvio..." />

          <label style={labelStyle}>Plano de Acção</label>
          <textarea value={form.planoAcao} onChange={e => set('planoAcao', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Acções correctivas previstas..." />
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Emitir JADO → DP</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL RESPOSTA DP ────────────────────────────────────────────────────────
function RespostaJadoModal({ jado, onClose, onSave }) {
  const [resposta, setResposta] = useState(jado.respostaDP || '');
  const [avancar, setAvancar] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 480, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Resposta ao {jado.num}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 500 }}>{jado.fase} — Desvio {jado.desvio}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{jado.descricao}</div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Resposta / Comentário DP</label>
          <textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={4}
            style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            placeholder="Adiciona o teu comentário sobre o desvio..." />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={avancar} onChange={e => setAvancar(e.target.checked)} />
            Avançar para Diretor de Produção
          </label>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(resposta, avancar); onClose(); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL THRESHOLDS ─────────────────────────────────────────────────────────
function ThresholdModal({ thresholds, onClose, onSave }) {
  const [form, setForm] = useState({ ...thresholds });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle = { fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 7, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Configurar Thresholds</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Define os limiares de desvio que activam cada nível de alerta. O sistema gera JADO automaticamente quando ultrapassados.</div>
          {[
            { key: 'atencao', label: 'Atenção', color: 'var(--color-warning)', desc: 'Notificação ao Controller' },
            { key: 'alerta',  label: 'Alerta',  color: '#C47A1A',              desc: 'Notificação + rascunho JADO + email DP' },
            { key: 'critico', label: 'Crítico', color: 'var(--color-danger)',   desc: 'JADO automático + email Dir. Produção + MS' },
          ].map(({ key, label, color, desc }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {desc}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Desvio &gt;</span>
                <input type="number" step="0.1" min="0" value={form[key]} onChange={e => set(key, parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 70 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data limite para revisão</label>
            <input type="date" value={form.dataLimite || ''} onChange={e => set('dataLimite', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(form); onClose(); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL RELATÓRIO ──────────────────────────────────────────────────────────
function RelatorioModal({ obra, tipo, onClose }) {
  const now = new Date().toLocaleDateString('pt-PT');
  const isWeekly = tipo === 'semanal';
  const isMonthly = tipo === 'mensal';
  const isFecho = tipo === 'fecho';

  const handlePrint = async () => {
    const now = new Date().toLocaleDateString('pt-PT');
    const totalExec = obra.fases.reduce((s, f) => s + (f.executado || 0), 0);
    const totalRoc  = obra.fases.reduce((s, f) => s + (f.roc || f.orc || 0), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório ${tipo} — ${obra.id}</title><style>
      @page{margin:15mm} body{font-family:Arial,sans-serif;font-size:11px;margin:0;color:#1a1a1a}
      h1{color:#1C3A5E;font-size:18px;margin:0 0 4px} h2{color:#1C3A5E;font-size:13px;margin:20px 0 8px;border-bottom:1px solid #CBD5E0;padding-bottom:4px}
      .sub{color:#718096;font-size:10px;margin:0 0 20px} .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px}
      .kpi{background:#F0F4F8;padding:10px;border-radius:6px} .kpi-label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px}
      .kpi-value{font-size:16px;font-weight:700;color:#1C3A5E} table{border-collapse:collapse;width:100%;margin-bottom:16px}
      th{background:#1C3A5E;color:#fff;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase}
      td{padding:4px 8px;border-bottom:0.5px solid #CBD5E0;font-size:10px} tr:nth-child(even){background:#F0F4F8}
      .badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600}
      .ok{background:#E8F5E9;color:#2E7D52} .warn{background:#FFF8E1;color:#C47A1A} .crit{background:#FDF3F3;color:#B83232}
      @media print{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body>
      <h1>NOVANOR — Relatório ${tipo.charAt(0).toUpperCase()+tipo.slice(1)}</h1>
      <p class="sub">${obra.id} · ${obra.nome} · Gerado em ${now}</p>
      <div class="grid">
        <div class="kpi"><div class="kpi-label">Valor de Venda</div><div class="kpi-value">${fmt(obra.valorVenda)}</div></div>
        <div class="kpi"><div class="kpi-label">Margem Prevista</div><div class="kpi-value">${obra.margemPrevista}%</div></div>
        <div class="kpi"><div class="kpi-label">Execução Física</div><div class="kpi-value">${obra.execFisicaReal}%</div></div>
        <div class="kpi"><div class="kpi-label">Faturação Emitida</div><div class="kpi-value">${fmt(obra.faturacaoEmitida)}</div></div>
      </div>
      <h2>Custo por Fase</h2>
      <table><thead><tr><th>Fase</th><th>Orçamento</th><th>Executado</th><th>Desvio €</th><th>Desvio %</th><th>Estado</th></tr></thead>
      <tbody>${obra.fases.map(f => `<tr>
        <td>${f.nome}</td><td style="text-align:right">${fmtK(f.roc || f.orc || 0)}</td>
        <td style="text-align:right">${f.executado?fmtK(f.executado):'—'}</td>
        <td style="text-align:right;color:${f.desvioEur>0?'#B83232':f.desvioEur<0?'#2E7D52':'#718096'}">${f.desvioEur!==0?(f.desvioEur>0?'+':'')+fmtK(f.desvioEur):'—'}</td>
        <td style="text-align:right;font-weight:600;color:${f.desvioPct>2?'#B83232':f.desvioPct>1?'#C47A1A':f.desvioPct<0?'#2E7D52':'#718096'}">${f.desvioPct!==0?(f.desvioPct>0?'+':'')+f.desvioPct+'%':'—'}</td>
        <td><span class="badge ${f.estado==='ok'?'ok':f.estado==='critico'?'crit':'warn'}">${FASE_EST[f.estado]?.label||f.estado}</span></td>
      </tr>`).join('')}
      <tr style="font-weight:700;background:#F0F4F8"><td>TOTAL</td><td style="text-align:right">${fmtK(totalRoc)}</td><td style="text-align:right">${fmtK(totalExec)}</td>
        <td style="text-align:right;color:${totalExec-totalRoc>0?'#B83232':'#2E7D52'}">${totalExec-totalRoc>0?'+':''}${fmtK(totalExec-totalRoc)}</td><td></td><td></td></tr>
      </tbody></table>
      ${obra.alertas?.length?`<h2>Alertas Activos</h2>${obra.alertas.map(a=>`<p><strong>[${ALERTA_CONFIG[a.nivel]?.label}]</strong> ${a.descricao} <em>(${a.data})</em></p>`).join('')}`:''}
      ${obra.jados?.length?`<h2>JADOs Emitidos</h2><table><thead><tr><th>Nº</th><th>Fase</th><th>Data</th><th>Desvio</th><th>Estado</th></tr></thead><tbody>${obra.jados.map(j=>`<tr><td>${j.num}</td><td>${j.fase}</td><td>${j.data}</td><td>${j.desvio}%</td><td>${JADO_STEPS.find(s=>s.key===j.estado)?.label||j.estado}</td></tr>`).join('')}</tbody></table>`:''}
      ${isFecho?`<h2>Análise Final</h2><p>Resultado final: margem de ${obra.margemPrevista}% vs inicial de ${obra.margemInicial}%. Desvio: ${obra.desvioMargem>0?'+':''}${obra.desvioMargem}%.</p>`:''}
    </body></html>`;
    const { downloadPdf } = await import('../utils/downloadPdf.js');
    await downloadPdf(html, `Relatorio_${tipo}_${obra.id}_${new Date().toLocaleDateString('pt-PT').replace(/\//g,'-')}`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Relatório {tipo.charAt(0).toUpperCase()+tipo.slice(1)} — {obra.id}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Obra', value: obra.id },
              { label: 'Gerado em', value: now },
              { label: 'DP', value: obra.dp },
              { label: 'Controller', value: obra.controller },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            O relatório inclui: resumo financeiro, custo por fase, alertas activos, histórico de JADOs{isFecho ? ' e análise final da obra' : ''}.
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handlePrint}>⬇ Descarregar Relatório</button>
        </div>
      </div>
    </div>
  );
}

// ─── ENCOMENDAS TAB ───────────────────────────────────────────────────────────
const calcEncItemLiquido = (item) => ((item.qtd || 0) * (item.preco || 0)) * (1 - ((item.desconto || 0) / 100));
const calcEncItemIVA = (item) => calcEncItemLiquido(item) * ((item.iva || 0) / 100);

function recalcFaseEstado(fase) {
  const roc = Number(fase.roc ?? fase.orc) || 0;
  const executado = Number(fase.executado) || 0;
  const previstoAtual = Number(fase.previsto) || 0;
  const previsto = Math.max(previstoAtual, executado, roc);
  const desvioEur = previsto - roc;
  const desvioPct = roc > 0 ? +(((desvioEur) / roc) * 100).toFixed(1) : 0;
  const absPct = Math.abs(desvioPct);
  const estado = absPct > 2 ? 'critico' : absPct > 1 ? 'alerta' : absPct > 0 ? 'atencao' : 'ok';
  return { ...fase, roc, orc: Number(fase.orc ?? roc) || 0, executado, previsto, desvioEur, desvioPct, estado };
}

function deriveObraFinancialSnapshot(obra, fases) {
  const normalizedFases = (fases || []).map(recalcFaseEstado);
  const totalRoc = normalizedFases.reduce((sum, fase) => sum + (Number(fase.roc ?? fase.orc) || 0), 0);
  const totalPrevisto = normalizedFases.reduce((sum, fase) => sum + (Number(fase.previsto) || 0), 0);
  const totalExecutado = normalizedFases.reduce((sum, fase) => sum + (Number(fase.executado) || 0), 0);
  const margemPrevista = obra.valorVenda > 0 ? +(((obra.valorVenda - totalPrevisto) / obra.valorVenda) * 100).toFixed(1) : 0;
  const execFinanceiraPrevista = totalRoc > 0 ? +((totalPrevisto / totalRoc) * 100).toFixed(1) : 0;
  const execFinanceiraReal = totalRoc > 0 ? +((totalExecutado / totalRoc) * 100).toFixed(1) : 0;

  return {
    fases: normalizedFases,
    custoPrevAtualizado: totalPrevisto,
    margemPrevista,
    desvioMargem: +(margemPrevista - (obra.margemInicial || 0)).toFixed(1),
    execFinanceiraPrevista,
    execFinanceiraReal,
  };
}

function getEncItemState(enc, item) {
  if (enc.estado === 'draft') return 'draft';
  return (enc.satisfiedItemIds || []).includes(item.itemId) ? 'satisfeito' : 'pendente';
}

function buildFaseEncomendaResumo(obra, encomendas) {
  const fasesBase = (obra.fases || []).map(f => f.nome);
  const fasesExtra = [...new Set(
    (encomendas || [])
      .flatMap(enc => (enc.itens || []).map(item => item.fase || enc.fase).filter(Boolean))
      .filter(nome => !fasesBase.includes(nome))
  )];

  return [...fasesBase, ...fasesExtra].map(nome => {
    const faseMeta = (obra.fases || []).find(f => f.nome === nome) || {};
    const codigo = faseMeta.codigoCliente || `${(fasesBase.indexOf(nome) >= 0 ? fasesBase.indexOf(nome) + 1 : fasesBase.length + fasesExtra.indexOf(nome) + 1) * 100}`;
    const items = (encomendas || []).flatMap(enc =>
      (enc.itens || [])
        .filter(item => (item.fase || enc.fase || 'Sem fase') === nome)
        .map(item => {
          const estado = getEncItemState(enc, item);
          const valorLiquido = calcEncItemLiquido(item);
          const valorTotal = valorLiquido + calcEncItemIVA(item);
          return {
            itemId: item.itemId,
            encomendaId: enc.id,
            fornecedor: enc.fornecedor,
            descricao: item.descricao,
            unidade: item.unidade,
            qtd: item.qtd,
            precoUnit: Number(item.preco) || 0,
            valorLiquido,
            valorTotal,
            estado,
            data: enc.criadaEm,
          };
        })
    );
    const totalQtd = items.reduce((sum, item) => sum + (Number(item.qtd) || 0), 0);
    const custoAlvoUn = totalQtd > 0 ? ((faseMeta.orc || faseMeta.roc || 0) / totalQtd) : 0;

    return {
      nome,
      codigo,
      orc: faseMeta.orc || faseMeta.roc || 0,
      previsto: faseMeta.previsto || 0,
      executado: faseMeta.executado || 0,
      items,
      totalQtd,
      custoAlvoUn,
      totalEncomendado: items.reduce((sum, item) => sum + item.valorLiquido, 0),
      totalEncomendadoTotal: items.reduce((sum, item) => sum + item.valorTotal, 0),
      totalSatisfeito: items.filter(item => item.estado === 'satisfeito').reduce((sum, item) => sum + item.valorLiquido, 0),
    };
  }).map(fase => ({
    ...fase,
    totalPendente: fase.totalEncomendado - fase.totalSatisfeito,
  }));
}

function flattenEncomendaItemsForObra(encomendas = [], options = {}) {
  const { includeStandby = false } = options;
  return (encomendas || [])
    .filter(enc => includeStandby || enc.estado !== 'standby-jado')
    .flatMap(enc => (enc.itens || []).map(item => ({
      itemId: item.itemId,
      encomendaId: enc.id,
      descricao: item.descricao,
      fase: item.fase || '—',
      valor: calcEncItemLiquido(item),
      pctExec: (enc.satisfiedItemIds || []).includes(item.itemId) ? 100 : 0,
      estado: enc.estado,
      documentoGerado: !!enc.documentoGeradoEm,
    })));
}

function FichaObraModal({ obra, loadEnc, saveEnc, updateObra, fornecedores, podeGerir, onClose }) {
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const encomendas = loadEnc();
  const [fullTableView, setFullTableView] = useState(false);
  const [detailMode, setDetailMode] = useState('completo');
  const [collapsedFases, setCollapsedFases] = useState({});
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [editingDraftFromFicha, setEditingDraftFromFicha] = useState(null);
  const [draftSeedItems, setDraftSeedItems] = useState(null);
  const [showGeneratedDoc, setShowGeneratedDoc] = useState(null);
  const fasesResumo = buildFaseEncomendaResumo(obra, encomendas);
  const draftOrders = encomendas.filter(enc => enc.estado === 'draft');
  const totalEncomendado = fasesResumo.reduce((sum, fase) => sum + fase.totalEncomendado, 0);
  const totalSatisfeito = fasesResumo.reduce((sum, fase) => sum + fase.totalSatisfeito, 0);
  const totalPendente = totalEncomendado - totalSatisfeito;
  const totalOrc = fasesResumo.reduce((sum, fase) => sum + (fase.orc || 0), 0);
  const totalPrevisto = fasesResumo.reduce((sum, fase) => sum + (fase.previsto || 0), 0);
  const totalExecutado = fasesResumo.reduce((sum, fase) => sum + (fase.executado || 0), 0);
  const totalQtd = fasesResumo.reduce((sum, fase) => sum + (fase.totalQtd || 0), 0);
  const totalCustoAlvoUn = totalQtd > 0 ? totalOrc / totalQtd : 0;
  const fmtCell = (v, digits = 2) => Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtQty = (v) => Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const showArticles = detailMode === 'completo';
  const toggleFase = (faseNome) => setCollapsedFases(prev => ({ ...prev, [faseNome]: !prev[faseNome] }));
  const setAllFases = (collapsed) => setCollapsedFases(Object.fromEntries(fasesResumo.map(fase => [fase.nome, collapsed])));
  const abrirCriacaoEncomenda = (seedItems = null) => {
    setFullTableView(false);
    setDraftSeedItems(seedItems && seedItems.length ? seedItems : null);
    setEditingDraftFromFicha(null);
    setShowDraftModal(true);
  };
  const abrirDraftExistente = (draft, seedItems = null) => {
    setFullTableView(false);
    const appendedItems = seedItems?.length
      ? [...(draft.itens || []), ...seedItems.map(item => ({ ...item }))]
      : draft.itens;
    setEditingDraftFromFicha({ ...draft, itens: appendedItems });
    setDraftSeedItems(null);
    setShowDraftModal(true);
  };
  const iniciarEncomendaParaFase = (fase) => {
    setCollapsedFases(prev => ({ ...prev, [fase]: false }));
    abrirCriacaoEncomenda([{ descricao:'', ref:'', fase, qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'' }]);
  };
  const getDraftsForFase = (fase) => draftOrders.filter(enc => (enc.itens || []).some(item => (item.fase || enc.fase) === fase));
  const createEncomendaFromFicha = (enc) => {
    const atuais = loadEnc();
    const draftMode = enc.saveMode === 'draft';
    const itens = (enc.itens || []).map((item, idx) => ({
      ...item,
      itemId: item.itemId || `ITEM-${Date.now().toString().slice(-6)}-${idx}`,
      fase: item.fase || obra.fases?.[0]?.nome || '',
    }));
    const nova = {
      id: `ENC-${obra.id}-${Date.now().toString().slice(-6)}`,
      obraId: obra.id,
      criadaEm: new Date().toLocaleDateString('pt-PT'),
      estado: draftMode ? 'draft' : 'pendente',
      satisfeitaEm: null,
      satisfiedItemIds: [],
      documentoGeradoEm: draftMode ? null : new Date().toLocaleDateString('pt-PT'),
      ...enc,
      itens,
    };
    if (draftMode) {
      const updatedOrders = [nova, ...atuais];
      saveEnc(updatedOrders);
      updateObra({ encomendas: flattenEncomendaItemsForObra(updatedOrders) });
      setShowDraftModal(false);
      setDraftSeedItems(null);
      return;
    }
    const totaisExistentes = {};
    (obra.encomendas || []).forEach(item => {
      totaisExistentes[item.fase || '—'] = (totaisExistentes[item.fase || '—'] || 0) + (item.valor || 0);
    });
    const totaisNovos = {};
    itens.forEach(item => {
      const fase = item.fase || '—';
      totaisNovos[fase] = (totaisNovos[fase] || 0) + calcEncItemLiquido(item);
    });
    const overrunByFase = Object.entries(totaisNovos).map(([fase, valorNovo]) => {
      const faseMeta = (obra.fases || []).find(f => f.nome === fase);
      const orc = faseMeta?.orc || faseMeta?.roc || 0;
      const totalPosEncomenda = (totaisExistentes[fase] || 0) + valorNovo;
      return totalPosEncomenda > orc && orc > 0
        ? { fase, orc, totalPosEncomenda, excesso: +(totalPosEncomenda - orc).toFixed(2) }
        : null;
    }).filter(Boolean);

    if (overrunByFase.length > 0) {
      const fasePrincipal = overrunByFase[0];
      const totalExcesso = overrunByFase.reduce((sum, item) => sum + item.excesso, 0);
      const jado = {
        num: `JADO #${String((obra.jados?.length || 0) + 1).padStart(3, '0')}`,
        obra: obra.id,
        fase: fasePrincipal?.fase || obra.fases?.[0]?.nome || '',
        desvio: fasePrincipal?.orc > 0 ? +((totalExcesso / fasePrincipal.orc) * 100).toFixed(1) : 0,
        nivel: totalExcesso > 0 ? 'critico' : 'alerta',
        descricao: `Encomenda ${enc.fornecedor} excede o ROC em ${overrunByFase.map(item => `${item.fase}: ${fmt(item.excesso)}`).join(' · ')}`,
        contexto: `A encomenda ficou em stand-by porque o total previsto para a fase ultrapassa o ROC aprovado.`,
        planoAcao: `Validar exceção orçamental antes de libertar a encomenda ${nova.id}.`,
        estado: 'aguarda-dp',
        data: new Date().toLocaleDateString('pt-PT'),
        emitidoPor: user?.nome || 'CG',
        respostaDP: '',
        comentarios: [],
        validador: enc.jadoValidator || 'miguel',
        validadorNome: JADO_VALIDATORS.find(v => v.id === (enc.jadoValidator || 'miguel'))?.nome || 'Miguel',
        linkedEncomendaId: nova.id,
        origem: 'encomenda_bloqueada',
      };
      const blockedOrder = { ...nova, estado:'standby-jado', jadoId: jado.num, jadoValidator: jado.validador, jadoValidatorNome: jado.validadorNome };
      const updatedOrders = [blockedOrder, ...atuais];
      saveEnc(updatedOrders);
      updateObra({
        encomendas: flattenEncomendaItemsForObra(updatedOrders),
        jados: [...(obra.jados || []), jado],
      });
      if (addNotif) addNotif({
        tipo: 'alerta', alerta: true, icon: '📋',
        titulo: `JADO automático emitido — ${obra.id}`,
        sub: `${jado.num} · Validação: ${jado.validadorNome} · Encomenda ${nova.id} em stand-by`,
        path: `/obras/${obra.id}`, destinatario: getJadoValidatorTarget(jado.validador),
        meta: { obraId: obra.id, jadoNum: jado.num, alertKind: 'jado_validacao' },
      });
      setShowDraftModal(false);
      setDraftSeedItems(null);
      setShowGeneratedDoc(blockedOrder);
      return;
    }

    const updatedOrders = [nova, ...atuais];
    saveEnc(updatedOrders);
    updateObra({ encomendas: flattenEncomendaItemsForObra(updatedOrders) });
    if (addNotif) addNotif({
      tipo: 'info', icon: '📦',
      titulo: `Nova encomenda criada — ${obra.id}`,
      sub: `${nova.fornecedor} · ${nova.itens?.length || 0} artigos · ${nova.id}`,
      path: '/obras', destinatario: 'dp',
    });
    setShowDraftModal(false);
    setDraftSeedItems(null);
    setShowGeneratedDoc(nova);
  };
  const saveDraftFromFicha = (originalDraft, payload) => {
    const finalizeMode = payload.saveMode !== 'draft';
    const atuais = loadEnc();
    const itens = (payload.itens || []).map((item, idx) => ({
      ...item,
      itemId: item.itemId || originalDraft.itens?.[idx]?.itemId || `ITEM-${Date.now().toString().slice(-6)}-${idx}`,
      fase: item.fase || obra.fases?.[0]?.nome || '',
    }));
    const edited = {
      ...originalDraft,
      ...payload,
      itens,
      subtotal: payload.subtotal,
      ivaTotal: payload.ivaTotal,
      total: payload.total,
      documentoGeradoEm: finalizeMode ? new Date().toLocaleDateString('pt-PT') : null,
    };
    if (!finalizeMode) {
      const updatedOrders = atuais.map(enc => enc.id === originalDraft.id ? { ...edited, estado: 'draft' } : enc);
      saveEnc(updatedOrders);
      updateObra({ encomendas: flattenEncomendaItemsForObra(updatedOrders) });
      setEditingDraftFromFicha(null);
      setShowDraftModal(false);
      return;
    }

    const totaisExistentes = {};
    (obra.encomendas || [])
      .filter(item => item.encomendaId !== originalDraft.id)
      .forEach(item => {
        totaisExistentes[item.fase || '—'] = (totaisExistentes[item.fase || '—'] || 0) + (item.valor || 0);
      });
    const totaisNovos = {};
    itens.forEach(item => {
      const fase = item.fase || '—';
      totaisNovos[fase] = (totaisNovos[fase] || 0) + calcEncItemLiquido(item);
    });
    const overrunByFase = Object.entries(totaisNovos).map(([fase, valorNovo]) => {
      const faseMeta = (obra.fases || []).find(f => f.nome === fase);
      const orc = faseMeta?.orc || faseMeta?.roc || 0;
      const totalPosEncomenda = (totaisExistentes[fase] || 0) + valorNovo;
      return totalPosEncomenda > orc && orc > 0
        ? { fase, orc, totalPosEncomenda, excesso: +(totalPosEncomenda - orc).toFixed(2) }
        : null;
    }).filter(Boolean);

    if (overrunByFase.length > 0) {
      const fasePrincipal = overrunByFase[0];
      const totalExcesso = overrunByFase.reduce((sum, item) => sum + item.excesso, 0);
      const jado = {
        num: `JADO #${String((obra.jados?.length || 0) + 1).padStart(3, '0')}`,
        obra: obra.id,
        fase: fasePrincipal?.fase || obra.fases?.[0]?.nome || '',
        desvio: fasePrincipal?.orc > 0 ? +((totalExcesso / fasePrincipal.orc) * 100).toFixed(1) : 0,
        nivel: totalExcesso > 0 ? 'critico' : 'alerta',
        descricao: `Encomenda ${edited.fornecedor} excede o ROC em ${overrunByFase.map(item => `${item.fase}: ${fmt(item.excesso)}`).join(' · ')}`,
        contexto: `A encomenda ficou em stand-by porque o total previsto para a fase ultrapassa o ROC aprovado.`,
        planoAcao: `Validar exceção orçamental antes de libertar a encomenda ${edited.id}.`,
        estado: 'aguarda-dp',
        data: new Date().toLocaleDateString('pt-PT'),
        emitidoPor: user?.nome || 'CG',
        respostaDP: '',
        comentarios: [],
        validador: edited.jadoValidator || 'miguel',
        validadorNome: JADO_VALIDATORS.find(v => v.id === (edited.jadoValidator || 'miguel'))?.nome || 'Miguel',
        linkedEncomendaId: edited.id,
        origem: 'encomenda_bloqueada',
      };
      const blockedOrder = { ...edited, estado:'standby-jado', jadoId: jado.num, jadoValidatorNome: jado.validadorNome };
      const updatedOrders = atuais.map(enc => enc.id === originalDraft.id ? blockedOrder : enc);
      saveEnc(updatedOrders);
      updateObra({
        encomendas: flattenEncomendaItemsForObra(updatedOrders),
        jados: [...(obra.jados || []), jado],
      });
      if (addNotif) addNotif({
        tipo: 'alerta', alerta: true, icon: '📋',
        titulo: `JADO automático emitido — ${obra.id}`,
        sub: `${jado.num} · Validação: ${jado.validadorNome} · Encomenda ${blockedOrder.id} em stand-by`,
        path: `/obras/${obra.id}`, destinatario: getJadoValidatorTarget(jado.validador),
        meta: { obraId: obra.id, jadoNum: jado.num, alertKind: 'jado_validacao' },
      });
      setEditingDraftFromFicha(null);
      setDraftSeedItems(null);
      setShowDraftModal(false);
      setShowGeneratedDoc(blockedOrder);
      return;
    }

    const updatedOrders = atuais.map(enc => enc.id === originalDraft.id ? { ...edited, estado:'pendente' } : enc);
    saveEnc(updatedOrders);
    updateObra({ encomendas: flattenEncomendaItemsForObra(updatedOrders) });
    setEditingDraftFromFicha(null);
    setDraftSeedItems(null);
    setShowDraftModal(false);
    setShowGeneratedDoc({ ...edited, estado:'pendente', documentoGeradoEm: new Date().toLocaleDateString('pt-PT') });
  };
  const renderTabelaCustos = () => (
    <div style={{ overflow:'auto', background:'linear-gradient(180deg, #f6f7f3 0%, #ffffff 12%)', flex:1, minHeight:0 }}>
      <table style={{ width:'100%', minWidth:1240, borderCollapse:'separate', borderSpacing:0, fontSize:12 }}>
        <thead>
          <tr>
            <th colSpan={2} style={{ background:'#ecebe7', borderRight:'1px solid #d7d5cd', borderBottom:'1px solid #d7d5cd', padding:'8px 10px', fontSize:11, fontWeight:700, color:'#525252', textTransform:'uppercase', letterSpacing:'0.04em' }}>Articulado</th>
            <th colSpan={1} style={{ background:'#f3f0e6', borderRight:'1px solid #d7d5cd', borderBottom:'1px solid #d7d5cd', padding:'8px 10px', fontSize:11, fontWeight:700, color:'#6b5f3e', textTransform:'uppercase', letterSpacing:'0.04em' }}>Classificadores</th>
            <th colSpan={7} style={{ background:'#eef4ea', borderBottom:'1px solid #d7d5cd', padding:'8px 10px', fontSize:11, fontWeight:700, color:'#4c6651', textTransform:'uppercase', letterSpacing:'0.04em' }}>Dados de Custo</th>
          </tr>
          <tr>
            {[
              ['Descrição', 'left'],
              ['Cód. Cliente', 'left'],
              ['Fases de Obra', 'left'],
              ['Quantidade', 'right'],
              ['Unid.', 'left'],
              ['Pr. Custo Forçado', 'right'],
              ['Preço Unit.', 'right'],
              ['Preço Seco', 'right'],
              ['Custo Alvo Un.', 'right'],
              ['Custo Alvo', 'right'],
            ].map(([label, align]) => (
              <th key={label} style={{ background:'#faf9f6', borderBottom:'1px solid #d7d5cd', padding:'10px 10px', textAlign:align, fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background:'#fff5ae' }}>
            <td style={{ padding:'11px 10px', fontWeight:700, borderBottom:'1px solid #e8e1ab' }}>{obra.id} - {obra.nome}</td>
            <td style={{ padding:'11px 10px', borderBottom:'1px solid #e8e1ab' }}>Obra</td>
            <td style={{ padding:'11px 10px', borderBottom:'1px solid #e8e1ab' }}>Todas as fases</td>
            <td style={{ padding:'11px 10px', textAlign:'right', borderBottom:'1px solid #e8e1ab' }}>{fmtQty(totalQtd)}</td>
            <td style={{ padding:'11px 10px', borderBottom:'1px solid #e8e1ab' }}>vg.</td>
            <td style={{ padding:'11px 10px', textAlign:'right', borderBottom:'1px solid #e8e1ab' }}>{fmtCell(totalPrevisto)}</td>
            <td style={{ padding:'11px 10px', textAlign:'right', borderBottom:'1px solid #e8e1ab' }}>{fmtCell(totalExecutado)}</td>
            <td style={{ padding:'11px 10px', textAlign:'right', borderBottom:'1px solid #e8e1ab' }}>{fmtCell(totalEncomendado)}</td>
            <td style={{ padding:'11px 10px', textAlign:'right', borderBottom:'1px solid #e8e1ab' }}>{fmtCell(totalCustoAlvoUn, 5)}</td>
            <td style={{ padding:'11px 10px', textAlign:'right', fontWeight:700, borderBottom:'1px solid #e8e1ab' }}>{fmtCell(totalOrc)}</td>
          </tr>

          {fasesResumo.map((fase, idx) => {
            return [
                <tr key={`${fase.nome}-fase`} style={{ background:idx % 2 === 0 ? '#dcefd5' : '#e7f4e1' }}>
                  <td style={{ padding:'10px', fontWeight:700, borderBottom:'1px solid #d7e5d0' }}>
                    <button
                      type="button"
                      onClick={() => toggleFase(fase.nome)}
                      style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, marginRight:8, color:'#567057', fontSize:12, fontWeight:700 }}
                      title={collapsedFases[fase.nome] ? 'Mostrar detalhe' : 'Esconder detalhe'}
                    >
                      {collapsedFases[fase.nome] || !showArticles ? '▸' : '▾'}
                    </button>
                    {String(idx + 1).padStart(2, '0')} - {fase.nome}
                  </td>
                  <td style={{ padding:'10px', borderBottom:'1px solid #d7e5d0' }}>{fase.codigo}</td>
                  <td style={{ padding:'10px', borderBottom:'1px solid #d7e5d0' }}>{fase.nome}</td>
                  <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #d7e5d0' }}>{fmtQty(fase.totalQtd)}</td>
                  <td style={{ padding:'10px', borderBottom:'1px solid #d7e5d0' }}>vg.</td>
                  <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #d7e5d0' }}>{fmtCell(fase.previsto)}</td>
                  <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #d7e5d0' }}>{fmtCell(fase.executado)}</td>
                  <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #d7e5d0' }}>{fmtCell(fase.totalEncomendado)}</td>
                  <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #d7e5d0' }}>{fmtCell(fase.custoAlvoUn, 5)}</td>
                  <td style={{ padding:'10px', textAlign:'right', fontWeight:700, borderBottom:'1px solid #d7e5d0' }}>{fmtCell(fase.orc)}</td>
                </tr>,
                ...(showArticles && !collapsedFases[fase.nome] ? fase.items.map((item, itemIdx) => (
                  <tr key={item.itemId} style={{ background:item.estado === 'satisfeito' ? '#fafcf8' : item.estado === 'draft' ? '#f6f7fb' : '#fffdf8' }}>
                    <td style={{ padding:'10px 10px 10px 26px', borderBottom:'1px solid #eceae2' }}>
                      <div style={{ fontWeight:600 }}>{item.descricao}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.fornecedor} · {item.encomendaId} · {item.data}</div>
                    </td>
                    <td style={{ padding:'10px', borderBottom:'1px solid #eceae2' }}>{fase.codigo}.{String(itemIdx + 1).padStart(2, '0')}</td>
                    <td style={{ padding:'10px', borderBottom:'1px solid #eceae2' }}>{fase.nome}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2' }}>{fmtQty(item.qtd)}</td>
                    <td style={{ padding:'10px', borderBottom:'1px solid #eceae2' }}>{item.unidade || 'Un.'}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2' }}>{fmtCell(item.precoUnit)}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2' }}>{fmtCell(item.precoUnit)}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2', fontWeight:600 }}>{fmtCell(item.valorLiquido)}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2' }}>{fmtCell(fase.custoAlvoUn, 5)}</td>
                    <td style={{ padding:'10px', textAlign:'right', borderBottom:'1px solid #eceae2' }}>
                      <div style={{ fontWeight:600 }}>{fmtCell(item.estado === 'satisfeito' ? item.valorLiquido : 0)}</div>
                      <div style={{ fontSize:11, color:item.estado === 'satisfeito' ? 'var(--color-success)' : item.estado === 'draft' ? '#4c5a85' : 'var(--color-warning)' }}>
                        {item.estado === 'satisfeito' ? 'Satisfeito' : item.estado === 'draft' ? 'Draft' : 'Pendente'}
                      </div>
                    </td>
                  </tr>
                )) : []),
                ...(showArticles && !collapsedFases[fase.nome] && podeGerir ? [
                  <tr key={`draft-action-${fase.nome}`} style={{ background:'#f8faf6' }}>
                    <td colSpan={10} style={{ padding:'8px 12px', borderBottom:'1px solid #e4ebe1' }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <button className="btn btn-sm" onClick={() => iniciarEncomendaParaFase(fase.nome)}>+ Criar encomenda em {fase.nome}</button>
                        {getDraftsForFase(fase.nome).map(draft => (
                          <button
                            key={draft.id}
                            className="btn btn-sm"
                            onClick={() => abrirDraftExistente(
                              draft,
                              [{ descricao:'', ref:'', fase:fase.nome, qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'' }]
                            )}
                            title={`Adicionar artigo ao draft ${draft.id}`}
                          >
                            + Adicionar ao draft {draft.id}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>,
                ] : []),
              ];
          }).flat()}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:580, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'min(1680px, 100%)', height:'min(94vh, 1100px)', display:'flex', flexDirection:'column', boxShadow:'0 20px 56px rgba(0,0,0,0.25)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Ficha de Obra</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{obra.id} · {obra.nome} · gestão por fase com encomendas sincronizadas</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding:'18px 20px', overflow:'hidden', display:'flex', flexDirection:'column', gap:18, flex:1, minHeight:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:10 }}>
            {[
              { label:'Fases', value:fasesResumo.length, tone:'var(--text-primary)' },
              { label:'Encomendado', value:fmt(totalEncomendado), tone:'var(--brand-primary)' },
              { label:'Satisfeito', value:fmt(totalSatisfeito), tone:'var(--color-success)' },
              { label:'Pendente', value:fmt(totalPendente), tone:'var(--color-warning)' },
            ].map(card => (
              <div key={card.label} style={{ background:'var(--bg-app)', border:'0.5px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', marginBottom:5 }}>{card.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:card.tone }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden', flex:'1 1 auto', minHeight:0, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'14px 16px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Tabela de custos da obra</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Estrutura por fases e artigos, com orçamento, esperado, executado e encomendas</div>
                <button className="btn btn-sm" onClick={() => setFullTableView(true)}>Janela completa</button>
              </div>
            </div>
            <div style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', background:'var(--bg-app)' }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { key:'completo', label:'Vista completa' },
                  { key:'fases', label:'Só fases' },
                ].map(mode => (
                  <button
                    key={mode.key}
                    className="btn btn-sm"
                    onClick={() => setDetailMode(mode.key)}
                    style={{
                      borderColor: detailMode === mode.key ? 'var(--brand-primary)' : undefined,
                      color: detailMode === mode.key ? 'var(--brand-primary)' : undefined,
                      fontWeight: detailMode === mode.key ? 700 : 500,
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn btn-sm" onClick={() => setAllFases(false)}>Expandir fases</button>
                <button className="btn btn-sm" onClick={() => setAllFases(true)}>Esconder detalhe</button>
                {podeGerir && <button className="btn btn-sm" onClick={() => abrirCriacaoEncomenda()}>Importar Excel / proposta</button>}
                {podeGerir && <button className="btn btn-sm btn-primary" onClick={() => abrirCriacaoEncomenda()}>Criar encomenda</button>}
                {podeGerir && draftOrders.map(draft => (
                  <button key={draft.id} className="btn btn-sm" onClick={() => abrirDraftExistente(draft)}>
                    Continuar draft {draft.id}
                  </button>
                ))}
              </div>
            </div>
            {renderTabelaCustos()}
          </div>

          <div style={{ flex:'0 0 auto', maxHeight:'28vh', overflow:'auto', borderTop:'0.5px solid var(--border)', paddingTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Gestão de encomendas</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>As novas encomendas são preparadas na ficha de obra e ficam depois disponíveis na vista de encomendas com documento e detalhe.</div>
              </div>
              {!podeGerir && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Modo de consulta</div>}
            </div>
            <EncomendasTab obra={obra} loadEnc={loadEnc} saveEnc={saveEnc} updateObra={updateObra} fornecedores={fornecedores} />
          </div>
        </div>
      </div>

      {fullTableView && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.62)', zIndex:760, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ width:'98vw', height:'96vh', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'0 20px 60px rgba(0,0,0,0.28)', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>Tabela de custos da obra</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{obra.id} · {obra.nome} · vista em janela completa</div>
              </div>
              <button className="btn btn-sm" onClick={() => setFullTableView(false)}>Fechar</button>
            </div>
            <div style={{ padding:'16px', minHeight:0, flex:1, display:'flex' }}>
              <div className="card" style={{ padding:0, overflow:'hidden', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
                {renderTabelaCustos()}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDraftModal && (
        <NovaEncomendaModal
          obra={obra}
          fornecedores={fornecedores}
          onClose={() => { setShowDraftModal(false); setDraftSeedItems(null); setEditingDraftFromFicha(null); }}
          onSave={editingDraftFromFicha ? (payload) => saveDraftFromFicha(editingDraftFromFicha, payload) : createEncomendaFromFicha}
          initialItens={draftSeedItems}
          initialData={editingDraftFromFicha}
          existingOrderItems={obra.encomendas || []}
          submitLabel={editingDraftFromFicha ? 'Finalizar e gerar documento' : 'Criar encomenda e gerar documento'}
          draftLabel="Guardar draft"
        />
      )}
      {showGeneratedDoc && <DocEncomendaModal enc={showGeneratedDoc} obra={obra} onClose={() => setShowGeneratedDoc(null)} />}
    </div>
  );
}

function EncomendasTab({ obra, loadEnc, saveEnc, updateObra, fornecedores, forcePodeGerir = null }) {
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const navigate = useNavigate();

  const [encomendas, setEncomendas]     = useState(loadEnc);
  const [showEdit, setShowEdit]         = useState(null);
  const [showSatisf, setShowSatisf]     = useState(null); // encomenda a satisfazer
  const [showDoc, setShowDoc]           = useState(null);  // encomenda para gerar doc
  const [search, setSearch]             = useState('');

  const persist = (list, extraObraFields = null) => {
    saveEnc(list);
    setEncomendas(list);
    updateObra({
      encomendas: flattenEncomendaItemsForObra(list),
      ...(extraObraFields || {}),
    });
  };

  const apagarEncomenda = (enc) => {
    if (!window.confirm(`Apagar a encomenda ${enc.id}?`)) return;
    const updatedOrders = encomendas.filter((item) => item.id !== enc.id);
    persist(updatedOrders, {
      jados: (obra.jados || []).filter((jado) => jado.num !== enc.jadoId),
    });
    try {
      const raw = JSON.parse(localStorage.getItem('sis_faturas_forn') || '{}');
      let changed = false;
      Object.keys(raw).forEach((fornId) => {
        const filtered = (raw[fornId] || []).filter((fatura) => fatura.encomendaId !== enc.id);
        if (filtered.length !== (raw[fornId] || []).length) {
          raw[fornId] = filtered;
          changed = true;
        }
      });
      if (changed) {
        const json = JSON.stringify(raw);
        localStorage.setItem('sis_faturas_forn', json);
        window.dispatchEvent(new StorageEvent('storage', { key: 'sis_faturas_forn', newValue: json }));
      }
    } catch {}
  };

  useEffect(() => {
    setEncomendas(loadEnc());
  }, [obra.id, obra.jados?.length, obra.encomendas?.length]);

  const buildJadoFromOverrun = (enc, overrunByFase) => {
    const fasePrincipal = overrunByFase[0];
    const totalExcesso = overrunByFase.reduce((sum, item) => sum + item.excesso, 0);
    return {
      num: `JADO #${String((obra.jados?.length || 0) + 1).padStart(3, '0')}`,
      obra: obra.id,
      fase: fasePrincipal?.fase || obra.fases?.[0]?.nome || '',
      desvio: fasePrincipal?.orc > 0 ? +((totalExcesso / fasePrincipal.orc) * 100).toFixed(1) : 0,
      nivel: totalExcesso > 0 ? 'critico' : 'alerta',
      descricao: `Encomenda ${enc.fornecedor} excede o ROC em ${overrunByFase.map(item => `${item.fase}: ${fmt(item.excesso)}`).join(' · ')}`,
      contexto: `A encomenda ficou em stand-by porque o total previsto para a fase ultrapassa o ROC aprovado.`,
      planoAcao: `Validar exceção orçamental antes de libertar a encomenda ${enc.id}.`,
      estado: 'aguarda-dp',
      data: new Date().toLocaleDateString('pt-PT'),
      emitidoPor: user?.nome || 'CG',
      respostaDP: '',
      comentarios: [],
      validador: enc.jadoValidator || 'miguel',
      validadorNome: JADO_VALIDATORS.find(v => v.id === (enc.jadoValidator || 'miguel'))?.nome || 'Miguel',
      linkedEncomendaId: enc.id,
      origem: 'encomenda_bloqueada',
      overrunByFase,
    };
  };

  const calcOverrunByFase = (itens, excludedEncomendaId = null) => {
    const totaisExistentes = {};
    (obra.encomendas || [])
      .filter(item => !excludedEncomendaId || item.encomendaId !== excludedEncomendaId)
      .forEach(item => {
        totaisExistentes[item.fase || '—'] = (totaisExistentes[item.fase || '—'] || 0) + (item.valor || 0);
      });
    const totaisNovos = {};
    itens.forEach(item => {
      const fase = item.fase || '—';
      totaisNovos[fase] = (totaisNovos[fase] || 0) + calcEncItemLiquido(item);
    });
    return Object.entries(totaisNovos).map(([fase, valorNovo]) => {
      const faseMeta = (obra.fases || []).find(f => f.nome === fase);
      const orc = faseMeta?.orc || faseMeta?.roc || 0;
      const totalPosEncomenda = (totaisExistentes[fase] || 0) + valorNovo;
      return totalPosEncomenda > orc && orc > 0
        ? { fase, orc, totalPosEncomenda, excesso: +(totalPosEncomenda - orc).toFixed(2) }
        : null;
    }).filter(Boolean);
  };

  const saveEditedEncomenda = (originalEnc, payload) => {
    const finalizeMode = payload.saveMode !== 'draft';
    const itens = (payload.itens || []).map((item, idx) => ({
      ...item,
      itemId: item.itemId || originalEnc.itens?.[idx]?.itemId || `ITEM-${Date.now().toString().slice(-6)}-${idx}`,
      fase: item.fase || obra.fases?.[0]?.nome || '',
    }));
    const edited = {
      ...originalEnc,
      ...payload,
      itens,
      subtotal: payload.subtotal,
      ivaTotal: payload.ivaTotal,
      total: payload.total,
      jadoValidator: payload.jadoValidator || originalEnc.jadoValidator,
      documentoGeradoEm: finalizeMode ? new Date().toLocaleDateString('pt-PT') : null,
    };
    if (!finalizeMode) {
      const updatedOrders = encomendas.map(e =>
        e.id === originalEnc.id
          ? {
              ...edited,
              estado: 'draft',
              jadoId: null,
              jadoValidatorNome: '',
              motivoStandby: '',
            }
          : e
      );
      persist(updatedOrders);
      setShowEdit(null);
      return;
    }
    const overrunByFase = calcOverrunByFase(itens, originalEnc.id);

    if (overrunByFase.length === 0) {
      const updatedOrders = encomendas.map(e =>
        e.id === originalEnc.id
          ? {
              ...edited,
              estado: 'pendente',
              jadoResolvidoEm: new Date().toLocaleDateString('pt-PT'),
              motivoStandby: '',
            }
          : e
      );
      persist(updatedOrders, {
        jados: (obra.jados || []).map(j =>
          j.num === originalEnc.jadoId
            ? {
                ...j,
                estado: 'resolvido',
                resolvidoEm: new Date().toLocaleDateString('pt-PT'),
                resolvidoPor: user?.nome || 'SIS',
                descricao: `${j.descricao} — resolvido após edição da encomenda ${originalEnc.id}`,
              }
            : j
        ),
      });
      setShowEdit(null);
      setShowDoc({ ...edited, estado: 'pendente', documentoGeradoEm: new Date().toLocaleDateString('pt-PT') });
      return;
    }

    const fasePrincipal = overrunByFase[0];
    const totalExcesso = overrunByFase.reduce((sum, item) => sum + item.excesso, 0);
    const nextJado = originalEnc.jadoId ? null : buildJadoFromOverrun(edited, overrunByFase);
    const updatedOrders = encomendas.map(e =>
      e.id === originalEnc.id
        ? {
            ...edited,
            estado: 'standby-jado',
            jadoId: originalEnc.jadoId || nextJado?.num || null,
            jadoValidatorNome: JADO_VALIDATORS.find(v => v.id === edited.jadoValidator)?.nome || edited.jadoValidatorNome || 'Miguel',
            motivoStandby: `Ultrapassa o ROC em ${overrunByFase.map(item => `${item.fase} (${fmt(item.excesso)})`).join(', ')}`,
          }
        : e
    );
    persist(updatedOrders, {
      jados: originalEnc.jadoId
        ? (obra.jados || []).map(j =>
            j.num === originalEnc.jadoId
              ? {
                  ...j,
                  fase: fasePrincipal?.fase || j.fase,
                  desvio: fasePrincipal?.orc > 0 ? +((totalExcesso / fasePrincipal.orc) * 100).toFixed(1) : j.desvio,
                  descricao: `Encomenda ${edited.fornecedor} excede o ROC em ${overrunByFase.map(item => `${item.fase}: ${fmt(item.excesso)}`).join(' · ')}`,
                  estado: 'aguarda-dp',
                }
              : j
          )
        : [...(obra.jados || []), nextJado].filter(Boolean),
    });
    setShowEdit(null);
  };

  const satisfazerEncomenda = (enc, payload) => {
    const { dataSatisf, obs, itemIds } = payload;
    const selectedIds = new Set(itemIds || []);
    const prevSatisfeitos = new Set(enc.satisfiedItemIds || []);
    const itensSelecionados = (enc.itens || []).filter(item => selectedIds.has(item.itemId));
    if (itensSelecionados.length === 0) return;
    const allSatisfiedIds = [...new Set([...(enc.satisfiedItemIds || []), ...itemIds])];
    const allItemIds = (enc.itens || []).map(item => item.itemId);
    const estado = allItemIds.every(itemId => allSatisfiedIds.includes(itemId)) ? 'satisfeita' : 'parcial';
    const updated = encomendas.map(e => e.id === enc.id
      ? {
          ...e,
          estado,
          satisfeitaEm: estado === 'satisfeita' ? dataSatisf : e.satisfeitaEm,
          obsSatisfacao: obs,
          satisfiedItemIds: allSatisfiedIds,
        }
      : e
    );
    persist(updated, {
      fases: obra.fases.map(fase => {
        const delta = itensSelecionados
          .filter(item => (item.fase || enc.fase) === fase.nome && !prevSatisfeitos.has(item.itemId))
          .reduce((sum, item) => sum + calcEncItemLiquido(item), 0);
        return delta > 0 ? recalcFaseEstado({ ...fase, executado: (fase.executado || 0) + delta }) : fase;
      }),
      encomendas: (obra.encomendas || []).map(item =>
        selectedIds.has(item.itemId)
          ? { ...item, pctExec: 100 }
          : item
      ),
    });
    // Create supplier invoice entry in fornecedores
    const FAT_KEY = 'sis_faturas_forn';
    try {
      const fornId = fornecedores.find(f => f.nome === enc.fornecedor)?.id || enc.fornecedorId;
      if (fornId) {
        const all = JSON.parse(localStorage.getItem(FAT_KEY) || '{}');
        const subtotal = itensSelecionados.reduce((sum, item) => sum + calcEncItemLiquido(item), 0);
        const ivaTotal = itensSelecionados.reduce((sum, item) => sum + calcEncItemIVA(item), 0);
        const nova = {
          id: `FT-FORN-${Date.now().toString().slice(-6)}`,
          nFatura: `${enc.id}-${estado === 'parcial' ? 'PARC' : 'FINAL'}`,
          obra: enc.obraId,
          valor: subtotal + ivaTotal,
          data: dataSatisf,
          venc: enc.condPagamento === 'Pronto pagamento' ? dataSatisf : null,
          condPag: enc.condPagamento || '30 dias',
          estado: 'pending-dp',
          validDP: 'Pendente',
          descricao: `Encomenda ${enc.id} — ${itensSelecionados.map(i=>i.descricao).join(', ').slice(0,80) || ''}`,
          encomendaId: enc.id,
          itens: itensSelecionados,
        };
        all[fornId] = [nova, ...(all[fornId] || [])];
        localStorage.setItem(FAT_KEY, JSON.stringify(all));
        window.dispatchEvent(new StorageEvent('storage', { key: FAT_KEY, newValue: JSON.stringify(all) }));
      }
    } catch {}
    // Notify
    if (addNotif) addNotif({
      tipo: 'acao_dp', icon: '✅', accionavel: true,
      titulo: `Encomenda satisfeita — validar fatura`,
      sub: `${enc.fornecedor} · ${enc.id} · ${enc.obraId}`,
      path: '/fornecedores', destinatario: 'dp',
      meta: { encomendaId: enc.id },
      acao: 'Validar fatura',
    });
    setShowSatisf(null);
  };

  const filtered = encomendas.filter(e =>
    !search || e.fornecedor?.toLowerCase().includes(search.toLowerCase()) ||
    e.id?.toLowerCase().includes(search.toLowerCase()) ||
    e.itens?.some(i => i.descricao?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPendente  = filtered.filter(e=>['pendente', 'draft'].includes(e.estado)).reduce((s,e)=>s+(e.total||0),0);
  const totalSatisfeita = filtered.filter(e=>e.estado==='satisfeita').reduce((s,e)=>s+(e.total||0),0);
  const totalStandBy = filtered.filter(e=>e.estado==='standby-jado').reduce((s,e)=>s+(e.total||0),0);

  const ini = (user?.initials||'').toUpperCase();
  const podeGerir = forcePodeGerir ?? (user?.isAdmin || ['MS','LG','DP','PS','CG'].includes(ini) ||
    (() => { try { const { loadPerfis } = require('../context/PermissionsConfig'); const p = loadPerfis().find(x=>x.id===user?.id); return p?.acoes?.includes('criar_encomenda') || p?.isAdmin; } catch { return false; } })());

  return (
    <div>
      {/* Modais */}
      {showEdit && <NovaEncomendaModal obra={obra} fornecedores={fornecedores} onClose={() => setShowEdit(null)} onSave={(payload) => saveEditedEncomenda(showEdit, payload)} initialData={showEdit} draftLabel="Guardar draft" submitLabel={showEdit.estado === 'draft' ? 'Finalizar e gerar documento' : 'Guardar e gerar novo documento'} />}
      {showSatisf && <SatisfazerModal enc={showSatisf} onClose={() => setShowSatisf(null)} onSatisfazer={satisfazerEncomenda} />}
      {showDoc && <DocEncomendaModal enc={showDoc} obra={obra} onClose={() => setShowDoc(null)} />}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:16 }}>
          <div style={{ background:'var(--bg-warning)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#7a4a0a', textTransform:'uppercase', letterSpacing:'0.05em' }}>Por satisfazer</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#7a4a0a' }}>{fmt(totalPendente)}</div>
          </div>
          <div style={{ background:'var(--bg-success)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--color-success)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Satisfeitas</div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--color-success)' }}>{fmt(totalSatisfeita)}</div>
          </div>
          <div style={{ background:'#eef3ff', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#3451a3', textTransform:'uppercase', letterSpacing:'0.05em' }}>Stand-by JADO</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#3451a3' }}>{fmt(totalStandBy)}</div>
          </div>
          <div style={{ background:'var(--bg-app)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Total</div>
            <div style={{ fontSize:16, fontWeight:700 }}>{filtered.length}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar..."
            style={{ fontFamily:'var(--font-body)', fontSize:13, padding:'6px 12px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-app)', color:'var(--text-primary)', outline:'none', width:200 }} />
        </div>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📦</div>
            <div style={{ fontSize:14, fontWeight:500 }}>Sem encomendas{search ? ` para "${search}"` : ''}</div>
            {podeGerir && <div style={{ fontSize:12, marginTop:10 }}>A criação de novas encomendas é feita na ficha de obra.</div>}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
                {['Nº Encomenda','Fornecedor','Artigos','Fase','Cond. Pag.','Total c/IVA','Data','Estado','Ações'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--brand-primary)', fontWeight:600 }}>{e.id}</td>
                  <td style={{ padding:'10px 12px', fontWeight:500 }}>{e.fornecedor}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)', fontSize:12 }}>
                    {(e.itens||[]).length} art.
                    <div style={{ fontSize:11, color:'var(--text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {(e.itens||[]).map(i=>i.descricao).join(' · ').slice(0,60)}
                    </div>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <span className="badge badge-n">
                      {[...new Set((e.itens || []).map(i => i.fase || e.fase).filter(Boolean))].join(', ') || '—'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)' }}>{e.condPagamento||'—'}</td>
                  <td style={{ padding:'10px 12px', fontWeight:700 }}>{fmt(e.total||0)}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{e.criadaEm}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span className={`badge ${e.estado==='satisfeita'?'badge-s':e.estado==='parcial'?'badge-w':e.estado==='draft'?'badge-n':e.estado==='standby-jado'?'badge-i':'badge-i'}`}>
                      {e.estado==='satisfeita'?'✓ Satisfeita':e.estado==='parcial'?'Parcial':e.estado==='draft'?'Draft':e.estado==='standby-jado'?'Stand-by JADO':'Pendente'}
                    </span>
                    {e.estado === 'standby-jado' && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{e.jadoId} · {e.jadoValidatorNome || 'Validação pendente'}</div>}
                    {e.estado === 'draft' && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Sem documento final ainda</div>}
                    {e.satisfeitaEm && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{e.satisfeitaEm}</div>}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {e.documentoGeradoEm && <button className="btn btn-sm" title="Ver documento" onClick={() => setShowDoc(e)}>📄</button>}
                      {e.estado !== 'satisfeita' && podeGerir && (
                        <button className="btn btn-sm" title="Editar encomenda" onClick={() => setShowEdit(e)}>✏ Editar</button>
                      )}
                      {e.estado !== 'satisfeita' && e.estado !== 'standby-jado' && e.estado !== 'draft' && podeGerir && (
                        <button
                          className="btn btn-sm btn-primary"
                          title={e.estado === 'parcial' ? 'Concluir satisfação da encomenda' : 'Satisfazer encomenda'}
                          onClick={() => setShowSatisf(e)}
                        >
                          {e.estado === 'parcial' ? '✓ Concluir' : '✓ Satisfazer'}
                        </button>
                      )}
                      {podeGerir && (
                        <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} title="Apagar encomenda" onClick={() => apagarEncomenda(e)}>Apagar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── MODAL NOVA ENCOMENDA ─────────────────────────────────────────────────────
function NovaEncomendaModal({ obra, fornecedores, onClose, onSave, initialItens = null, initialData = null, existingOrderItems = null, submitLabel = null, draftLabel = null }) {
  const normalizeIsoDate = (value) => {
    if (!value) return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };
  const isEditing = Boolean(initialData);
  const [fornecedor, setFornecedor]     = useState(initialData?.fornecedor || '');
  const [condPag, setCondPag]           = useState(initialData?.condPagamento || '30 dias');
  const [jadoValidator, setJadoValidator] = useState(initialData?.jadoValidator || 'miguel');
  const [obs, setObs]                   = useState(initialData?.observacoes || '');
  const [dataPrevista, setDataPrevista] = useState(normalizeIsoDate(initialData?.dataPrevista));
  const [itens, setItens]               = useState(() => (
    initialData?.itens?.length
      ? initialData.itens.map(item => ({ descricao:'', ref:'', fase: obra.fases?.[0]?.nome || '', qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'', ...item }))
      : initialItens?.length
      ? initialItens.map(item => ({ descricao:'', ref:'', fase: obra.fases?.[0]?.nome || '', qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'', ...item }))
      : [{ descricao:'', ref:'', fase: obra.fases?.[0]?.nome || '', qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'' }]
  ));
  const [catalogoArtigos, setCatalogoArtigos] = useState([]);
  const [catalogImporting, setCatalogImporting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFeedback, setCatalogFeedback] = useState('');
  const [activeCatalogRow, setActiveCatalogRow] = useState(null);
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState('');
  const fileRef = useRef(null);
  const catalogFileRef = useRef(null);
  const catalogInputRefs = useRef([]);
  const effectiveExistingOrderItems = existingOrderItems || obra.encomendas || [];
  const isMeaningfulItem = (item) => Boolean(
    item?.descricao?.trim()
    || item?.ref?.trim()
    || Number(item?.qtd) > 0
    || Number(item?.preco) > 0
  );
  const finalizeItems = itens.filter(item => item.descricao?.trim());
  const draftItems = itens.filter(isMeaningfulItem);

  const setItem = (i, k, v) => setItens(prev => prev.map((x, j) => j===i ? {...x, [k]:v} : x));
  const addItem = () => setItens(p => [...p, { descricao:'', ref:'', fase: obra.fases?.[0]?.nome || '', qtd:1, unidade:'Un.', preco:0, iva:23, desconto:0, catalogoId:'', catalogoQuery:'' }]);
  const remItem = (i) => setItens(p => p.filter((_,j) => j!==i));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadArtigosCatalogo();
        if (!cancelled) setCatalogoArtigos(loaded);
      } catch (err) {
        if (!cancelled) setImportError('Erro ao carregar catálogo: ' + err.message);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistCatalogo = async (list) => {
    const merged = mergeArtigosCatalogo([], list);
    setCatalogoArtigos(merged);
    await saveArtigosCatalogo(merged);
    return merged;
  };
  const mergeIntoCatalogo = async (incoming, baseCatalogo = catalogoArtigos) => {
    const merged = mergeArtigosCatalogo(baseCatalogo, incoming);
    setCatalogoArtigos(merged);
    await saveArtigosCatalogo(merged);
    return merged;
  };
  const applyCatalogoItem = (index, catalogoId) => {
    if (!catalogoId) {
      setItens(prev => prev.map((item, i) => i === index ? { ...item, catalogoId: '', catalogoQuery: '' } : item));
      return;
    }
    const artigo = catalogoArtigos.find(item => item.id === catalogoId);
    if (!artigo) return;
    setItens(prev => prev.map((item, i) => (
      i !== index ? item : {
        ...item,
        catalogoId: artigo.id,
        catalogoQuery: `${artigo.ref ? `${artigo.ref} · ` : ''}${artigo.descricao}`,
        descricao: artigo.descricao,
        ref: artigo.ref,
        unidade: artigo.unidade || item.unidade || 'Un.',
        preco: artigo.preco ?? item.preco ?? 0,
        desconto: artigo.desconto ?? item.desconto ?? 0,
        iva: artigo.iva ?? item.iva ?? 23,
        qtd: item.qtd || artigo.qtdDefault || 1,
      }
    )));
    setActiveCatalogRow(null);
  };
  const updateCatalogoQuery = (index, value) => {
    setItens(prev => prev.map((item, i) => (
      i === index ? { ...item, catalogoQuery: value, catalogoId: '' } : item
    )));
  };
  const getCatalogoMatches = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];
    return catalogoArtigos
      .filter(item => `${item.ref || ''} ${item.descricao || ''}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  };
  const getCatalogDropdownStyle = (index) => {
    const fallback = {
      position: 'fixed',
      top: 120,
      left: 24,
      width: 320,
      maxHeight: 360,
      zIndex: 2000,
      background: 'var(--bg-card)',
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
      overflowY: 'auto',
    };
    if (typeof window === 'undefined') return fallback;
    const input = catalogInputRefs.current[index];
    if (!input) return fallback;
    const rect = input.getBoundingClientRect();
    const top = Math.min(rect.bottom + 4, window.innerHeight - 240);
    const availableHeight = Math.max(180, window.innerHeight - top - 20);
    return {
      position: 'fixed',
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: availableHeight,
      zIndex: 2000,
      background: 'var(--bg-card)',
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
      overflowY: 'auto',
    };
  };
  const guardarItemNoCatalogo = async (item) => {
    if (!item?.descricao?.trim()) return null;
    const normalized = normalizeArtigoCatalogo({
      ...item,
      id: item.catalogoId || undefined,
      qtdDefault: item.qtd || 1,
    });
    const merged = await mergeIntoCatalogo([normalized]);
    return merged.find(entry => artigoCatalogoMatchKey(entry) === artigoCatalogoMatchKey(normalized)) || normalized;
  };
  const persistItensNoCatalogo = async (itemsList) => {
    const validos = itemsList.filter(item => item.descricao?.trim());
    if (!validos.length) return itemsList;
    const merged = await mergeIntoCatalogo(validos.map(item => ({
      ...item,
      id: item.catalogoId || undefined,
      qtdDefault: item.qtd || 1,
    })));
    return itemsList.map(item => {
      if (!item.descricao?.trim()) return item;
      const found = merged.find(entry => artigoCatalogoMatchKey(entry) === artigoCatalogoMatchKey(item));
      return found ? { ...item, catalogoId: found.id } : item;
    });
  };

  const calcLiquido = (item) => {
    const bruto = (item.qtd||0) * (item.preco||0);
    return bruto * (1 - (item.desconto||0)/100);
  };
  const calcIVA = (item) => calcLiquido(item) * ((item.iva||0)/100);
  const subtotal   = finalizeItems.reduce((s,i) => s + calcLiquido(i), 0);
  const totalIVA   = finalizeItems.reduce((s,i) => s + calcIVA(i), 0);
  const totalGeral = subtotal + totalIVA;
  const itensValidos = finalizeItems.filter(item => item.fase);
  const canSaveDraft = Boolean(
    fornecedor
    || obs.trim()
    || itens.some(item => item.descricao?.trim() || item.ref?.trim() || Number(item.qtd) > 0 || Number(item.preco) > 0)
  );
  const canFinalize = Boolean(
    fornecedor
    && finalizeItems.length > 0
    && !finalizeItems.some(i => !i.fase)
  );
  const overrunByFase = Object.entries(
    itensValidos.reduce((acc, item) => {
      const fase = item.fase || '—';
      acc[fase] = (acc[fase] || 0) + calcLiquido(item);
      return acc;
    }, {})
  ).map(([fase, valorNovo]) => {
    const faseMeta = (obra.fases || []).find(f => f.nome === fase);
    const orc = faseMeta?.orc || faseMeta?.roc || 0;
    const totalExistente = effectiveExistingOrderItems
      .filter(item => item.fase === fase && (!initialData?.id || item.encomendaId !== initialData.id))
      .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    const totalPosEncomenda = totalExistente + valorNovo;
    return totalPosEncomenda > orc && orc > 0
      ? { fase, orc, totalExistente, totalPosEncomenda, excesso: +(totalPosEncomenda - orc).toFixed(2) }
      : null;
  }).filter(Boolean);
  const nextJadoNum = `JADO #${String((obra.jados?.length || 0) + 1).padStart(3, '0')}`;

  const handleImportExcel = async (file) => {
    setImporting(true); setImportError('');
    try {
      const parsedItens = await parseArtigosFromExcel(file);
      setItens(parsedItens);
    } catch(err) {
      setImportError('Erro ao ler ficheiro: ' + err.message);
    }
    setImporting(false);
  };
  const handleImportCatalogoExcel = async (file) => {
    setCatalogImporting(true);
    setCatalogFeedback('');
    setImportError('');
    try {
      const parsedItens = await parseArtigosFromExcel(file);
      const merged = await mergeIntoCatalogo(parsedItens.map(item => ({
        ...item,
        qtdDefault: item.qtd || 1,
      })));
      setCatalogFeedback(`${parsedItens.length} artigo(s) importado(s). Catálogo disponível com ${merged.length} registo(s).`);
    } catch (err) {
      setImportError('Erro ao importar catálogo: ' + err.message);
    }
    setCatalogImporting(false);
  };

  const IS = { fontFamily:'var(--font-body)', fontSize:12, padding:'5px 8px', border:'0.5px solid var(--border-strong)', borderRadius:6, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:900, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px rgba(0,0,0,0.2)', overflowX:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>{isEditing ? 'Editar Encomenda' : 'Proposta de Encomenda'} — {obra.id}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {isEditing ? 'Ajusta a encomenda em stand-by e volta a submeter para validação' : 'Importa o Excel, revê a proposta e cria a encomenda a partir da ficha de obra'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
          {/* Meta */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px 16px', marginBottom:20 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Fornecedor *</label>
              <select value={fornecedor} onChange={e=>setFornecedor(e.target.value)} style={{ ...IS, width:'100%' }}>
                <option value="">Seleccionar...</option>
                {fornecedores.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Condições de pagamento</label>
              <select value={condPag} onChange={e=>setCondPag(e.target.value)} style={{ ...IS, width:'100%' }}>
                {['Pronto pagamento','15 dias','30 dias','45 dias','60 dias','90 dias','Acordado'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Validador JADO</label>
              <select value={jadoValidator} onChange={e=>setJadoValidator(e.target.value)} style={{ ...IS, width:'100%' }}>
                {JADO_VALIDATORS.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Data prevista entrega</label>
              <input type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)} style={{ ...IS, width:'100%' }} />
            </div>
            <div style={{ gridColumn:'span 3' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Observações</label>
              <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="ex: Resp. AP" style={{ ...IS, width:'100%' }} />
            </div>
          </div>

          {/* Import Excel */}
          <div style={{ marginBottom:16, padding:'10px 14px', background:'var(--bg-app)', borderRadius:8, border:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ minWidth:260 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>Importar artigos via Excel/CSV</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Detecção automática de colunas: Descrição, Qtd, Preço, IVA, Desconto, Referência</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                {catalogLoading ? 'A carregar catálogo...' : `Catálogo guardado no browser: ${catalogoArtigos.length} artigo(s)`}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <label style={{ cursor:'pointer' }}>
                <input ref={catalogFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f) handleImportCatalogoExcel(f); e.target.value=''; }} />
                <span className="btn btn-sm">{catalogImporting ? '⏳ A importar...' : '📚 Importar catálogo'}</span>
              </label>
              <label style={{ cursor:'pointer' }}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f) handleImportExcel(f); e.target.value=''; }} />
                <span className="btn btn-sm">{importing ? '⏳ A processar...' : '📂 Importar encomenda'}</span>
              </label>
            </div>
          </div>
          {catalogFeedback && <div style={{ color:'var(--color-success)', fontSize:12, marginBottom:12, padding:'8px 12px', background:'var(--bg-success)', borderRadius:6 }}>{catalogFeedback}</div>}
	          {importError && <div style={{ color:'var(--color-danger)', fontSize:12, marginBottom:12, padding:'8px 12px', background:'var(--bg-danger)', borderRadius:6 }}>⚠ {importError}</div>}
	          {overrunByFase.length > 0 && (
	          <div style={{ marginBottom:16, padding:'12px 14px', background:'var(--bg-warning)', borderRadius:8, border:'0.5px solid var(--color-warning)' }}>
	            <div style={{ fontSize:13, fontWeight:700, color:overrunByFase.length ? '#7a4a0a' : 'var(--color-success)' }}>
	              Alerta de orçamento antes de criar a encomenda
	            </div>
	            <div style={{ fontSize:12, marginTop:4, color:'#7a4a0a' }}>
	              {`Ao criar esta encomenda será emitido o ${nextJadoNum} e a encomenda ficará em stand-by até validação.`}
	            </div>
	              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:8 }}>
	                {overrunByFase.map(item => (
	                  <div key={item.fase} style={{ fontSize:11, padding:'6px 8px', borderRadius:999, background:'rgba(255,255,255,0.55)', color:'#7a4a0a' }}>
	                    {item.fase}: excesso {fmt(item.excesso)} sobre {fmt(item.orc)}
	                  </div>
	                ))}
	              </div>
	          </div>
	          )}

	          {/* Tabela de artigos */}
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:8 }}>
            Artigos ({itens.length})
          </div>
          <div style={{ overflowX:'auto', marginBottom:12 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
                  {['Pesquisar catálogo','Descrição *','Ref.','Fase','Qtd','Un.','Preço unit.','Desc. %','IVA %','Líquido',''].map((h,i) => (
                    <th key={i} style={{ padding:'7px 8px', textAlign:i>=4?'right':'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i} style={{ borderBottom:'0.5px solid var(--border)' }}>
                    <td style={{ padding:'5px 6px', minWidth:240, position:'relative', verticalAlign:'top' }}>
                      <input
                        ref={el => { catalogInputRefs.current[i] = el; }}
                        value={item.catalogoQuery || ''}
                        onFocus={() => setActiveCatalogRow(i)}
                        onBlur={() => setTimeout(() => setActiveCatalogRow(current => current === i ? null : current), 120)}
                        onChange={e => updateCatalogoQuery(i, e.target.value)}
                        placeholder="Pesquisar por código ou nome..."
                        style={{ ...IS, width:'100%' }}
                      />
                      {activeCatalogRow === i && !catalogLoading && (item.catalogoQuery || '').trim() && (
                        <div style={getCatalogDropdownStyle(i)}>
                          {getCatalogoMatches(item.catalogoQuery).length > 0 ? getCatalogoMatches(item.catalogoQuery).map(artigo => (
                            <button
                              key={artigo.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applyCatalogoItem(i, artigo.id);
                              }}
                              style={{ width:'100%', textAlign:'left', border:'none', background:'transparent', padding:'9px 10px', cursor:'pointer', borderBottom:'0.5px solid var(--border)' }}
                            >
                              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{artigo.descricao}</div>
                              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                                {artigo.ref || 'Sem ref.'} · {fmt(artigo.preco || 0)}
                              </div>
                            </button>
                          )) : (
                            <div style={{ padding:'10px', fontSize:11, color:'var(--text-muted)' }}>
                              Sem resultados. Escreve a descrição ao lado para criar um artigo novo.
                            </div>
                          )}
                        </div>
                      )}
                      {item.catalogoId && <div style={{ fontSize:10, color:'var(--color-success)', marginTop:4 }}>Artigo do catálogo seleccionado</div>}
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:180 }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={item.descricao} onChange={e=>setItem(i,'descricao',e.target.value)} placeholder="Descrição do artigo ou novo artigo" style={{ ...IS, width:'100%' }} />
                        <button
                          type="button"
                          className="btn btn-sm"
                          title="Guardar este artigo no catálogo"
                          onClick={async () => {
                            try {
                              const saved = await guardarItemNoCatalogo(item);
                              if (saved) {
                                setItens(prev => prev.map((row, rowIndex) => rowIndex === i ? { ...row, catalogoId: saved.id, catalogoQuery: `${saved.ref ? `${saved.ref} · ` : ''}${saved.descricao}` } : row));
                                setCatalogFeedback(`Artigo "${saved.descricao}" guardado no catálogo.`);
                              }
                            } catch (err) {
                              setImportError('Erro ao guardar artigo no catálogo: ' + err.message);
                            }
                          }}
                        >
                          Guardar
                        </button>
                      </div>
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:80 }}>
                      <input value={item.ref} onChange={e=>setItem(i,'ref',e.target.value)} placeholder="—" style={{ ...IS, width:'100%' }} />
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:130 }}>
                      <select value={item.fase || ''} onChange={e=>setItem(i,'fase',e.target.value)} style={{ ...IS, width:'100%' }}>
                        <option value="">Seleccionar...</option>
                        {(obra.fases||[]).map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:60 }}>
                      <input type="number" value={item.qtd} onChange={e=>setItem(i,'qtd',parseFloat(e.target.value)||0)} style={{ ...IS, width:'100%', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:60 }}>
                      <select value={item.unidade} onChange={e=>setItem(i,'unidade',e.target.value)} style={{ ...IS, width:'100%' }}>
                        {['Un.','m','m²','m³','kg','L','h','vg.','cx.','rl.'].map(u=><option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:90 }}>
                      <input type="number" value={item.preco} onChange={e=>setItem(i,'preco',parseFloat(e.target.value)||0)} style={{ ...IS, width:'100%', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:60 }}>
                      <input type="number" value={item.desconto} onChange={e=>setItem(i,'desconto',parseFloat(e.target.value)||0)} min={0} max={100} style={{ ...IS, width:'100%', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'5px 6px', minWidth:60 }}>
                      <input type="number" value={item.iva} onChange={e=>setItem(i,'iva',parseFloat(e.target.value)||0)} style={{ ...IS, width:'100%', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:600, whiteSpace:'nowrap', color:'var(--text-primary)' }}>
                      {fmt(calcLiquido(item))}
                    </td>
                    <td style={{ padding:'5px 4px', textAlign:'center' }}>
                      {itens.length > 1 && <button onClick={()=>remItem(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:14, padding:'2px 6px' }}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-sm" onClick={addItem}>+ Adicionar artigo</button>

          {/* Totais */}
          <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end' }}>
            <div style={{ background:'var(--bg-app)', borderRadius:10, padding:'14px 20px', minWidth:240 }}>
              {[['Subtotal',subtotal],['IVA',totalIVA]].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span style={{ color:'var(--text-muted)' }}>{l}:</span>
                  <span style={{ fontWeight:500 }}>{fmt(v)}</span>
                </div>
              ))}
              <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:8, display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700 }}>
                <span>Total:</span><span style={{ color:'var(--brand-primary)' }}>{fmt(totalGeral)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8, flexShrink:0 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn"
            disabled={!canSaveDraft}
            onClick={async () => {
              try {
                const itensComCatalogo = await persistItensNoCatalogo(itens);
                onSave({ fornecedor, fornecedorId: '', condPagamento:condPag, observacoes:obs, dataPrevista, itens: itensComCatalogo.filter(isMeaningfulItem), subtotal, ivaTotal:totalIVA, total:totalGeral, jadoValidator, saveMode: 'draft' });
              } catch (err) {
                setImportError('Erro ao guardar catálogo: ' + err.message);
              }
            }}
          >
            {draftLabel || 'Guardar draft'}
          </button>
	          <button className="btn btn-primary"
	            disabled={!canFinalize}
	            onClick={async () => {
                try {
                  const itensComCatalogo = await persistItensNoCatalogo(itens);
                  onSave({ fornecedor, fornecedorId: '', condPagamento:condPag, observacoes:obs, dataPrevista, itens: itensComCatalogo.filter(item => item.descricao?.trim()), subtotal, ivaTotal:totalIVA, total:totalGeral, jadoValidator, saveMode: 'final' });
                } catch (err) {
                  setImportError('Erro ao guardar catálogo: ' + err.message);
                }
              }}>
	            {submitLabel || (isEditing ? 'Guardar alterações' : 'Criar encomenda')}
	          </button>
	        </div>
	      </div>
    </div>
  );
}

// ─── MODAL SATISFAZER ENCOMENDA ───────────────────────────────────────────────
function SatisfazerModal({ enc, onClose, onSatisfazer }) {
  const [data, setData]   = useState(new Date().toISOString().split('T')[0]);
  const [obs, setObs]     = useState('');
  const [selectedIds, setSelectedIds] = useState(() => (enc.itens || []).filter(item => !(enc.satisfiedItemIds || []).includes(item.itemId)).map(item => item.itemId));
  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };
  const itensPendentes = (enc.itens || []).filter(item => !(enc.satisfiedItemIds || []).includes(item.itemId));
  const totalSelecionado = itensPendentes
    .filter(item => selectedIds.includes(item.itemId))
    .reduce((sum, item) => sum + calcEncItemLiquido(item) + calcEncItemIVA(item), 0);
  const isConclusao = enc.estado === 'parcial';
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:440, boxShadow:'0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:15 }}>{isConclusao ? 'Concluir satisfação' : 'Satisfazer encomenda'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding:'20px' }}>
          <div style={{ padding:'12px 14px', background:'var(--bg-app)', borderRadius:8, marginBottom:16, fontSize:13 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>{enc.id} — {enc.fornecedor}</div>
            <div style={{ color:'var(--text-muted)', fontSize:12 }}>{itensPendentes.length} artigos pendentes · Seleccionado: <strong>{fmt(totalSelecionado || 0)}</strong></div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:6 }}>Artigos a satisfazer</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:220, overflowY:'auto', paddingRight:4 }}>
              {itensPendentes.map(item => {
                const checked = selectedIds.includes(item.itemId);
                return (
                  <label key={item.itemId} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:8, background: checked ? 'var(--bg-info)' : 'var(--bg-app)', cursor:'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, item.itemId] : prev.filter(id => id !== item.itemId))}
                    />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.descricao}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.fase || enc.fase || '—'} · {item.qtd} {item.unidade || 'Un.'} · {fmt(calcEncItemLiquido(item) + calcEncItemIVA(item))}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Data de satisfação</label>
            <input type="date" value={data} onChange={e=>setData(e.target.value)} style={IS} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Observações</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2} placeholder="Notas sobre a entrega..." style={{ ...IS, resize:'vertical' }} />
          </div>
          <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg-warning)', borderRadius:8, fontSize:12, color:'#7a4a0a' }}>
            ℹ Ao satisfazer, será criada automaticamente uma fatura de fornecedor no estado "Aguarda validação DP" e o DP será notificado.
          </div>
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={selectedIds.length === 0} onClick={() => onSatisfazer(enc, { dataSatisf: new Date(data).toLocaleDateString('pt-PT'), obs, itemIds: selectedIds })}>
            {isConclusao ? '✓ Concluir satisfação' : '✓ Confirmar satisfação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DOCUMENTO ENCOMENDA (igual ao PECOMARK) ────────────────────────────
function DocEncomendaModal({ enc, obra, onClose }) {
  const novanor = { nome:'NOVANOR - ENGENHARIA, GESTÃO E EQUIPAMENTOS, LDA', rua:'RUA CHEN HE 1 PISO 5º', cp:'1990-513 - LISBOA - Portugal', cs:'€ 500.000', nif:'514392843' };
  const today   = new Date().toLocaleDateString('pt-PT');
  const calcLiq = (i) => (i.qtd||0)*(i.preco||0)*(1-(i.desconto||0)/100);
  const calcIVA = (i) => calcLiq(i)*(i.iva||23)/100;
  const subtotal = (enc.itens||[]).reduce((s,i)=>s+calcLiq(i),0);
  const ivaTotal = (enc.itens||[]).reduce((s,i)=>s+calcIVA(i),0);
  const total    = subtotal+ivaTotal;

  const handlePrint = async () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${enc.id}</title><style>
      @page{margin:15mm} * {box-sizing:border-box} body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0}
      .logo{font-size:22px;font-weight:900;color:#1C3A5E;letter-spacing:-1px} .logo span{color:#2E7D52}
      .header{display:flex;justify-content:space-between;margin-bottom:20px}
      .enc-box{background:#1C3A5E;color:#fff;padding:10px 18px;border-radius:4px;text-align:center;min-width:160px}
      .enc-box .label{font-size:14px;font-weight:700;letter-spacing:2px;margin-bottom:4px}
      .enc-box .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px}
      .enc-box .grid div{background:rgba(255,255,255,0.15);padding:3px 6px;border-radius:3px}
      .meta-bar{background:#f5f7fa;border:1px solid #e2e8f0;border-radius:4px;padding:8px 14px;display:flex;gap:24px;margin-bottom:16px;font-size:11px}
      .meta-bar strong{color:#1C3A5E}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      thead tr{background:#1C3A5E;color:#fff}
      th,td{padding:5px 8px;font-size:10px} th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.04em}
      tbody tr:nth-child(even){background:#f9fafb}
      .totals{display:flex;justify-content:flex-end} .totals table{width:240px}
      .totals td{padding:4px 8px} .totals .total-row{font-weight:700;font-size:12px;border-top:1.5px solid #1C3A5E}
      .footer{margin-top:20px;font-size:9px;color:#666;border-top:1px solid #e2e8f0;padding-top:8px}
      @media print{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body>
    <div class="header">
      <div>
        <div class="logo">NOV<span>AN</span>OR</div>
        <div style="margin-top:6px;font-size:10px;color:#666">
          ${novanor.nome}<br>${novanor.rua}<br>${novanor.cp}<br>
          Capital Social: (€) ${novanor.cs} &nbsp;|&nbsp; NIF: ${novanor.nif}
        </div>
      </div>
      <div class="enc-box">
        <div class="label">ENCOM. A</div>
        <div class="grid">
          <div>VIA<br><strong>Original</strong></div>
          <div>NÚMERO<br><strong>${enc.id}</strong></div>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:10px;color:#666">
        <strong style="font-size:13px;color:#111">${enc.fornecedor}</strong><br>
        ${enc.obraId} — ${obra.nome}
      </div>
      <div style="font-size:10px;text-align:right;color:#666">
        <strong>Data emissão:</strong> ${today}<br>
        <strong>Data prevista:</strong> ${enc.dataPrevista ? new Date(enc.dataPrevista).toLocaleDateString('pt-PT') : today}<br>
        <strong>Resp.:</strong> ${enc.observacoes||'—'}
      </div>
    </div>
    <div class="meta-bar">
      <span><strong>Cond. Pagamento:</strong> ${enc.condPagamento||'—'}</span>
      <span><strong>Obra:</strong> ${enc.obraId}</span>
      <span><strong>Fases:</strong> ${[...new Set((enc.itens||[]).map(i => i.fase || enc.fase).filter(Boolean))].join(', ') || '—'}</span>
      <span><strong>Data Vencimento:</strong> ${enc.condPagamento==='Pronto pagamento'?today:'—'}</span>
    </div>
    <table>
      <thead><tr><th>Obra</th><th>Fase</th><th>Data Prevista</th><th>Descrição</th><th>Ref.</th><th style="text-align:right">Qtd</th><th>Un.</th><th style="text-align:right">Preço</th><th style="text-align:right">Desc.</th><th style="text-align:right">Líquido</th><th>IVA</th></tr></thead>
      <tbody>
        ${(enc.itens||[]).map(i=>`<tr>
          <td>${enc.obraId}</td><td>${i.fase || enc.fase || '—'}</td><td>${enc.dataPrevista?new Date(enc.dataPrevista).toLocaleDateString('pt-PT'):today}</td>
          <td>${i.descricao}</td><td style="color:#666">${i.ref||'—'}</td>
          <td style="text-align:right">${i.qtd}</td><td>${i.unidade||'Un.'}</td>
          <td style="text-align:right">${Number(i.preco).toFixed(2)}</td>
          <td style="text-align:right">${i.desconto?i.desconto+'%':'—'}</td>
          <td style="text-align:right;font-weight:600">${calcLiq(i).toFixed(2)}</td>
          <td>${i.iva||23}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals"><table>
      <tr><td>Subtotal:</td><td style="text-align:right;font-weight:600">${subtotal.toFixed(2)} €</td></tr>
      <tr><td>IVA (23%):</td><td style="text-align:right">${ivaTotal.toFixed(2)} €</td></tr>
      <tr class="total-row"><td>Total EUR:</td><td style="text-align:right">${total.toFixed(2)} €</td></tr>
    </table></div>
    <div class="footer">
      <div style="display:flex;gap:40px">
        <span><strong>Ilíquido:</strong> ${subtotal.toFixed(2)}</span>
        <span><strong>IVA:</strong> ${ivaTotal.toFixed(2)}</span>
        <span><strong>Tx IVA:</strong> 23%</span>
      </div>
      <div style="margin-top:6px">Este documento não serve de fatura &nbsp;|&nbsp; No caso de litígio o foro competente será o da comarca de LISBOA</div>
    </div>
    </body></html>`;
    const { downloadPdf } = await import('../utils/downloadPdf.js');
    await downloadPdf(html, `Encomenda_${enc.id}`);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:640, boxShadow:'0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:15 }}>Documento de Encomenda — {enc.id}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding:'20px' }}>
          {/* Preview */}
          <div style={{ background:'var(--bg-app)', borderRadius:10, padding:'16px', marginBottom:16, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'var(--brand-primary)' }}>NOVANOR</div>
              <div style={{ background:'var(--brand-primary)', color:'#fff', padding:'6px 14px', borderRadius:6, textAlign:'center' }}>
                <div style={{ fontSize:10, letterSpacing:'2px' }}>ENCOM. A</div>
                <div style={{ fontSize:13, fontWeight:700 }}>{enc.id}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Fornecedor</div><div style={{ fontWeight:600 }}>{enc.fornecedor}</div></div>
              <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Obra</div><div style={{ fontWeight:600 }}>{enc.obraId}</div></div>
              <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Cond. Pagamento</div><div>{enc.condPagamento}</div></div>
              <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Total</div><div style={{ fontWeight:700, color:'var(--brand-primary)', fontSize:15 }}>{fmt(total)}</div></div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{(enc.itens||[]).length} artigos · IVA incluído</div>
          </div>
          <div style={{ padding:'10px 14px', background:'var(--bg-info)', borderRadius:8, fontSize:12, color:'#0a3a6a', marginBottom:16 }}>
            ℹ O documento gerado segue o formato da encomenda a fornecedor da NOVANOR e pode ser impresso ou guardado como PDF.
          </div>
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={handlePrint}>⬇ Descarregar Documento</button>
        </div>
      </div>
    </div>
  );
}

// ─── DETALHE DA OBRA ──────────────────────────────────────────────────────────
export default function ObraDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const initials = (user?.initials || '').toUpperCase();
  const isMS  = initials === 'MS';
  const isCG  = initials === 'CG' || user?.role?.toLowerCase().includes('controller');
  const isDP  = initials === 'DP';

  const baseObra = getObraData(id);
  const [obra, setObra] = useState(baseObra);
  const [tab, setTab] = useState('resumo');
  const [showJadoModal, setShowJadoModal]         = useState(false);
  const [showJadoAlerta, setShowJadoAlerta]       = useState(null); // alerta que originou
  const [showRespostaModal, setShowRespostaModal] = useState(null); // jado a responder
  const [showThreshold, setShowThreshold]         = useState(false);
  const [showRelatorio, setShowRelatorio]         = useState(null); // tipo: semanal|mensal|fecho
  const [showFichaObra, setShowFichaObra]         = useState(false);
  const [editFases, setEditFases]                 = useState(false);
  const [fasesEdit, setFasesEdit]                 = useState([]);
  const [showAccessManager, setShowAccessManager] = useState(false);
  const allObras = [...OBRAS_DATA, ...loadObrasExtra()];
  const canViewCurrentObra = canAccessObra(user, id, allObras);
  const canEditCurrentObra = canEditObra(user, id, allObras) || canEditModule(user, 'obras');
  const canManageAccess = user?.isAdmin || canEditModule(user, 'perfil');
  const canViewResumo = canViewEntitySection(user, 'obras', id, 'resumo_financeiro', canViewCurrentObra ? 'view' : 'none');
  const canEditResumo = canEditEntitySection(user, 'obras', id, 'resumo_financeiro', (isCG || isMS) ? 'edit' : (canViewCurrentObra ? 'view' : 'none'));
  const canViewGraficos = canViewEntitySection(user, 'obras', id, 'graficos_cg', canViewCurrentObra ? 'view' : 'none');
  const canViewEncomendasArea = canViewEntitySection(user, 'obras', id, 'encomendas', canViewCurrentObra ? 'view' : 'none');
  const canEditEncomendasArea = canEditEntitySection(user, 'obras', id, 'encomendas', canEditCurrentObra ? 'edit' : (canViewCurrentObra ? 'view' : 'none'));
  const canViewJadoArea = canViewEntitySection(user, 'obras', id, 'jado', canViewCurrentObra ? 'view' : 'none');
  const canViewFaturasArea = canViewEntitySection(user, 'obras', id, 'faturas', canViewCurrentObra ? 'view' : 'none');
  const canViewRelatoriosArea = canViewEntitySection(user, 'obras', id, 'faturas', canViewCurrentObra ? 'view' : 'none');

  useEffect(() => {
    if (!obra || !canViewCurrentObra) navigate('/obras');
  }, [obra, canViewCurrentObra, navigate]);
  if (!obra) return null;

  // Persistir alterações
  const updateObra = (campos) => {
    if (!canEditCurrentObra) return;
    const derived = campos.fases ? deriveObraFinancialSnapshot({ ...obra, ...campos }, campos.fases) : {};
    const novo = { ...obra, ...campos, ...derived };
    setObra(novo);
    saveObraLS(id, { ...campos, ...derived });
  };

  const ENC_KEY = `sis_encomendas_${obra.id}`;
  const loadEnc = () => { try { return JSON.parse(localStorage.getItem(ENC_KEY) || '[]'); } catch { return []; } };
  const saveEnc = (list) => {
    localStorage.setItem(ENC_KEY, JSON.stringify(list));
    syncProcessosEncomendaFromObra({ obra, encomendas: list });
  };
  const removeJado = (jadoNum) => {
    if (!window.confirm(`Apagar ${jadoNum}?`)) return;
    const encomendasAtualizadas = loadEnc().map((enc) => (
      enc.jadoId === jadoNum
        ? {
            ...enc,
            jadoId: null,
            jadoValidatorNome: '',
            motivoStandby: '',
            estado: enc.estado === 'standby-jado' ? 'draft' : enc.estado,
          }
        : enc
    ));
    saveEnc(encomendasAtualizadas);
    updateObra({
      jados: (obra.jados || []).filter((j) => j.num !== jadoNum),
      encomendas: flattenEncomendaItemsForObra(encomendasAtualizadas),
    });
  };
  const libertarEncomendasStandby = (jado) => {
    const existentes = loadEnc();
    const alvo = existentes.filter(enc => enc.estado === 'standby-jado' && enc.jadoId === jado.num);
    if (alvo.length === 0) return;
    const atualizadas = existentes.map(enc =>
      enc.estado === 'standby-jado' && enc.jadoId === jado.num
        ? { ...enc, estado: 'pendente', jadoAprovadoEm: new Date().toLocaleDateString('pt-PT') }
        : enc
    );
    saveEnc(atualizadas);
    const novosItems = alvo.flatMap(enc => (enc.itens || []).map(item => ({
      itemId: item.itemId,
      encomendaId: enc.id,
      descricao: item.descricao,
      fase: item.fase || '—',
      valor: calcEncItemLiquido(item),
      pctExec: 0,
    })));
    updateObra({ encomendas: [...(obra.encomendas || []), ...novosItems] });
    if (addNotif) addNotif({
      tipo: 'info', icon: '📦',
      titulo: `Encomenda libertada após aprovação do JADO`,
      sub: `${jado.num} · ${alvo.map(enc => enc.id).join(', ')}`,
      path: `/obras/${id}`, destinatario: 'dp',
    });
  };

  useEffect(() => {
    syncProcessosEncomendaFromObra({ obra, encomendas: loadEnc() });
  }, [obra.id]);

  // Adicionar JADO
  const addJado = (novoJado) => {
    const jados = [...(obra.jados || []), novoJado];
    updateObra({ jados });
    addNotif({
      tipo: 'alerta',
      alerta: true,
      icon: '📋',
      titulo: `${novoJado.num} emitido — ${obra.id}`,
      sub: `${novoJado.fase} · Desvio ${novoJado.desvio}% · Valida: ${novoJado.validadorNome || 'Miguel'}`,
      path: `/obras/${id}`,
      destinatario: getJadoValidatorTarget(novoJado.validador),
      meta: { obraId: obra.id, jadoNum: novoJado.num, alertKind: 'jado_validacao' },
    });
  };

  // Avançar JADO
  const avancarJado = (idx, respostaDP, skipDP) => {
    const jados = [...obra.jados];
    const j = { ...jados[idx] };
    const stepIdx = JADO_STEPS.findIndex(s => s.key === j.estado);
    if (respostaDP !== undefined) j.respostaDP = respostaDP;
    const nextStep = skipDP ? 'aguarda-dir' : JADO_STEPS[stepIdx + 1]?.key;
    if (nextStep) j.estado = nextStep;
    jados[idx] = j;
    updateObra({ jados });
    if (['validado-ms', 'env-comercial'].includes(j.estado)) libertarEncomendasStandby(j);
    addNotif({ tipo: 'info', icon: '📋', titulo: `${j.num} avançou — ${JADO_STEPS.find(s=>s.key===j.estado)?.label}`, sub: `${obra.id} · ${j.fase}`, path: `/obras/${id}`, destinatario: nextStep === 'enviado-ms' ? 'ms' : nextStep === 'aguarda-dir' ? 'dp' : 'cg' });
  };

  // Calcular alertas automáticos com base em thresholds
  const alertasAuto = obra.fases.filter(f => {
    const pct = Math.abs(f.desvioPct);
    return pct >= (obra.thresholds?.atencao ?? 1);
  }).map(f => {
    const pct = Math.abs(f.desvioPct);
    const nivel = pct >= (obra.thresholds?.critico ?? 2) ? 'critico' : pct >= (obra.thresholds?.alerta ?? 1) ? 'alerta' : 'atencao';
    return { nivel, fase: f.nome, descricao: `Desvio de ${f.desvioPct > 0 ? '+' : ''}${f.desvioPct}% na fase ${f.nome}`, data: new Date().toLocaleDateString('pt-PT'), jado: null, desvio: Math.abs(f.desvioPct) };
  });
  const todosAlertas = [...(obra.alertas || []), ...alertasAuto.filter(a => !(obra.alertas||[]).some(x => x.fase === a.fase))];
  const visibleTabs = [
    canViewResumo && { key: 'resumo', label: 'Resumo & Fases' },
    canViewGraficos && { key: 'graficos', label: 'Gráficos' },
    canViewResumo && { key: 'faturacao', label: 'Faturação & Encomendas' },
    canViewEncomendasArea && { key: 'encomendas', label: `Encomendas (${(obra.encomendas||[]).length})` },
    canViewFaturasArea && { key: 'faturas', label: 'Faturas' },
    canViewJadoArea && { key: 'jado', label: `Alertas & JADO (${todosAlertas.length + obra.jados.length})` },
    canViewRelatoriosArea && { key: 'relatorios', label: 'Relatórios' },
  ].filter(Boolean);
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(item => item.key === tab)) {
      setTab(visibleTabs[0].key);
    }
  }, [tab, visibleTabs]);

  const totalExec = obra.fases.reduce((s, f) => s + (f.executado || 0), 0);
  const totalRoc  = obra.fases.reduce((s, f) => s + (f.roc || f.orc || 0), 0);

  const SEMAFORO = { ok: '#2E7D52', atencao: '#C47A1A', critico: '#B83232' };

  return (
    <div>
      {/* Modais */}
      {showJadoModal && <EmitirJadoModal obra={obra} alerta={showJadoAlerta} onClose={() => { setShowJadoModal(false); setShowJadoAlerta(null); }} onSave={addJado} />}
      {showRespostaModal !== null && <RespostaJadoModal jado={obra.jados[showRespostaModal]} onClose={() => setShowRespostaModal(null)} onSave={(resp, skip) => { avancarJado(showRespostaModal, resp, skip); setShowRespostaModal(null); }} />}
      {showThreshold && <ThresholdModal thresholds={obra.thresholds} onClose={() => setShowThreshold(false)} onSave={t => { updateObra({ thresholds: t }); }} />}
      {showRelatorio && <RelatorioModal obra={obra} tipo={showRelatorio} onClose={() => setShowRelatorio(null)} />}
      {showFichaObra && <FichaObraModal obra={obra} loadEnc={loadEnc} saveEnc={saveEnc} updateObra={updateObra} fornecedores={FORNECEDORES_DATA} podeGerir={canEditEncomendasArea} onClose={() => setShowFichaObra(false)} />}
      {showAccessManager && (
        <EntityAccessEditorModal
          entityType="obras"
          entityId={obra.id}
          title={`Acessos — ${obra.id} · ${obra.nome}`}
          subtitle={obra.cliente}
          sections={[
            { key: 'resumo_financeiro', label: 'Resumo financeiro e indicadores', description: 'KPIs, custo previsto, tesouraria da obra e tabela de fases.' },
            { key: 'graficos_cg', label: 'Gráficos de controlo de gestão', description: 'Evolução financeira, cashflow e desvios por fase.' },
            { key: 'encomendas', label: 'Encomendas e ficha de obra', description: 'Criação, satisfação e ficha de obra.' },
            { key: 'jado', label: 'Alertas e JADO', description: 'Alertas, histórico JADO e ações de validação.' },
            { key: 'faturas', label: 'Faturas e relatórios', description: 'Faturas ligadas à obra e relatórios PDF.' },
          ]}
          onClose={() => setShowAccessManager(false)}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>← Obras</button>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: SEMAFORO[obra.estado] || '#718096', display: 'inline-block' }} />
            <div className="page-title" style={{ fontSize: 17 }}>{obra.id} — {obra.nome}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {obra.cliente} · DP: {obra.dp} · Controller: {obra.controller} · {obra.dataInicio} → {obra.dataFimContratual}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canViewEncomendasArea && <button className="btn" onClick={() => setShowFichaObra(true)}>Ficha de Obra</button>}
          {canManageAccess && <button className="btn" onClick={() => setShowAccessManager(true)}>Gerir acessos</button>}
          {isMS && <button className="btn" style={{ fontSize: 12 }} onClick={() => setShowThreshold(true)}>⚙ Thresholds</button>}
          {canViewRelatoriosArea && <div style={{ position: 'relative' }}>
            <select onChange={e => { if (e.target.value) { setShowRelatorio(e.target.value); e.target.value = ''; } }}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
              <option value="">📄 Relatório...</option>
              <option value="semanal">Relatório Semanal</option>
              <option value="mensal">Relatório Mensal</option>
              <option value="fecho">Relatório de Fecho</option>
            </select>
          </div>}
          {canViewJadoArea && (isCG || isMS) && <button className="btn btn-primary" onClick={() => setShowJadoModal(true)}>+ Emitir JADO</button>}
        </div>
      </div>

      {/* Thresholds activos */}
      {obra.thresholds?.dataLimite && (
        <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--bg-warning)', border: '0.5px solid var(--color-warning)', borderRadius: 8, fontSize: 12, color: '#7a4a0a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⏱</span>
          <span>Revisão limite: <strong>{new Date(obra.thresholds.dataLimite).toLocaleDateString('pt-PT')}</strong> · Thresholds: atenção &gt;{obra.thresholds.atencao}% · alerta &gt;{obra.thresholds.alerta}% · crítico &gt;{obra.thresholds.critico}%</span>
        </div>
      )}

      {/* KPIs cabeçalho */}
      {canViewResumo && (() => {
        // PFO = custo executado até agora + custo previsto das fases ainda não iniciadas
        const pfo = obra.fases.reduce((s, f) => {
          const exec = f.executado || 0;
          const prev = f.previsto || f.roc || 0;
          return s + (exec > 0 ? Math.max(exec, prev) : prev);
        }, 0);
        const margemPFO = obra.valorVenda > 0 ? +((( obra.valorVenda - pfo) / obra.valorVenda) * 100).toFixed(1) : 0;
        const kpis = [
          { label: 'Valor de venda',      value: fmt(obra.valorVenda),          delta: null },
          { label: 'Custo prev. inicial', value: fmt(obra.custoPrevInicial),     delta: null },
          { label: 'PFO',                 value: fmt(pfo),                       delta: pfo > obra.custoPrevInicial ? `+${fmtK(pfo - obra.custoPrevInicial)} vs ROC` : `${fmtK(pfo - obra.custoPrevInicial)} vs ROC`, up: pfo <= obra.custoPrevInicial, tooltip: 'Previsão de Fecho de Obra' },
          { label: 'Margem inicial',      value: `${obra.margemInicial}%`,       delta: null },
          { label: 'Margem PFO',          value: `${margemPFO}%`,                delta: `${(margemPFO - obra.margemInicial) > 0 ? '+' : ''}${(margemPFO - obra.margemInicial).toFixed(1)}% vs inicial`, up: margemPFO >= obra.margemInicial },
          { label: 'Execução física',     value: `${obra.execFisicaReal}%`,      delta: `prev. ${obra.execFisicaPrevista}%`, up: obra.execFisicaReal >= obra.execFisicaPrevista },
          { label: 'Execução financeira', value: `${obra.execFinanceiraReal}%`,  delta: `prev. ${obra.execFinanceiraPrevista}%`, up: obra.execFinanceiraReal >= obra.execFinanceiraPrevista },
          { label: 'Faturação emitida',   value: fmt(obra.faturacaoEmitida),     delta: `${obra.pctFaturacao}% do total`, up: true },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
            {kpis.map(k => (
              <div key={k.label} className="kpi-card" title={k.tooltip || ''}>
                <div className="kpi-label">{k.label}{k.tooltip ? ' ⓘ' : ''}</div>
                <div className="kpi-value" style={{ fontSize: 14 }}>{k.value}</div>
                {k.delta && <div className={`kpi-delta ${k.up ? 'up' : 'down'}`}>{k.delta}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {visibleTabs.map(t => (
          <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB RESUMO ── */}
      {tab === 'resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
          {/* Execução + Financeiro + Tesouraria */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 14 }}>Execução</div>
            <ProgressBar prevista={obra.execFisicaPrevista}     real={obra.execFisicaReal}       label="Execução física" />
            <ProgressBar prevista={obra.execFinanceiraPrevista} real={obra.execFinanceiraReal}   label="Execução financeira" />
            <ProgressBar prevista={obra.tempoDecorrido}         real={obra.tempoDecorrido}       label="Tempo decorrido" />

            <div style={{ height: '0.5px', background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Custo previsto actualizado</div>
            {canEditResumo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>€</span>
                <input type="number"
                  defaultValue={obra.custoPrevAtualizado}
                  onBlur={e => {
                    const v = Number(e.target.value) || 0;
                    const novaMargem = obra.valorVenda > 0 ? +((( obra.valorVenda - v) / obra.valorVenda) * 100).toFixed(1) : 0;
                    updateObra({ custoPrevAtualizado: v, margemPrevista: novaMargem, desvioMargem: +(novaMargem - obra.margemInicial).toFixed(1) });
                  }}
                  style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 7, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>← Tab para guardar</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{fmt(obra.custoPrevAtualizado)}</div>
            )}

            <div style={{ height: '0.5px', background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Indicadores de Tesouraria</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Faturado',    v: fmt(obra.faturacaoEmitida),  color: 'var(--text-primary)' },
                { label: 'Recebido',    v: fmt(obra.faturacaoRecebida), color: 'var(--color-success)' },
                { label: 'Por faturar', v: fmt(obra.saldoFaturar),      color: 'var(--color-warning)' },
                { label: '% Faturação', v: `${obra.pctFaturacao}%`,     color: 'var(--brand-primary)' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--bg-app)', borderRadius: 7, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.v}</div>
                </div>
              ))}
            </div>

            {obra.observacoes && (
              <>
                <div style={{ height: '0.5px', background: 'var(--border)', margin: '14px 0' }} />
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Observações</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{obra.observacoes}</div>
              </>
            )}
          </div>

          {/* Fases */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Custo por Fase</div>
              {canEditResumo && (
                <button className="btn btn-sm" onClick={() => { setEditFases(!editFases); setFasesEdit(obra.fases.map(f => ({ ...f }))); }}>
                  {editFases ? '✕ Cancelar' : '✏ Editar execução'}
                </button>
              )}
            </div>
            <table className="sis-table">
              <thead>
                <tr>
                  <th>Fase</th>
                  <th style={{ textAlign: 'right' }}>ROC
                  </th>
                  <th style={{ textAlign: 'right' }}>Executado</th>
                  <th style={{ textAlign: 'right' }}>Previsto</th>
                  <th style={{ textAlign: 'right' }}>Desvio €</th>
                  <th style={{ textAlign: 'right' }}>Desvio %</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(editFases ? fasesEdit : obra.fases).map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{f.nome}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{fmtK(f.roc || f.orc || 0)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                      {editFases ? (
                        <input type="number" value={fasesEdit[i].executado} onChange={e => {
                          const nv = [...fasesEdit];
                          nv[i] = recalcFaseEstado({ ...nv[i], executado: parseFloat(e.target.value) || 0 });
                          setFasesEdit(nv);
                        }} style={{ width: 90, fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 6px', border: '0.5px solid var(--border-strong)', borderRadius: 5, background: 'var(--bg-card)', textAlign: 'right', outline: 'none' }} />
                      ) : f.executado > 0 ? fmtK(f.executado) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{f.previsto > 0 ? fmtK(f.previsto) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: f.desvioEur > 0 ? 'var(--color-danger)' : f.desvioEur < 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      {f.desvioEur !== 0 ? `${f.desvioEur > 0 ? '+' : ''}${fmtK(f.desvioEur)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: Math.abs(f.desvioPct) > 2 ? 'var(--color-danger)' : Math.abs(f.desvioPct) > 1 ? 'var(--color-warning)' : f.desvioPct < 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      {f.desvioPct !== 0 ? `${f.desvioPct > 0 ? '+' : ''}${f.desvioPct}%` : '—'}
                    </td>
                    <td>
                      {editFases ? (
                        <select value={fasesEdit[i].estado} onChange={e => { const nv = [...fasesEdit]; nv[i] = { ...nv[i], estado: e.target.value }; setFasesEdit(nv); }}
                          style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 6px', border: '0.5px solid var(--border)', borderRadius: 5, background: 'var(--bg-card)', cursor: 'pointer', outline: 'none' }}>
                          {Object.entries(FASE_EST).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : (
                        <span className={`badge ${FASE_EST[f.estado]?.cls || 'badge-n'}`}>{FASE_EST[f.estado]?.label}</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-app)', fontWeight: 700 }}>
                  <td style={{ fontSize: 12 }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtK(totalRoc)}</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtK(totalExec)}</td>
                  <td />
                  <td style={{ textAlign: 'right', fontSize: 12, color: totalExec - totalRoc > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {totalExec - totalRoc !== 0 ? `${totalExec - totalRoc > 0 ? '+' : ''}${fmtK(totalExec - totalRoc)}` : '—'}
                  </td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
            {editFases && (
              <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn" onClick={() => setEditFases(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => { updateObra({ fases: fasesEdit }); setEditFases(false); }}>Guardar alterações</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB GRÁFICOS ── */}
      {tab === 'graficos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Execução financeira — esperada vs real</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 16, height: 2, background: 'var(--border-strong)', display: 'inline-block', borderRadius: 1 }} />Previsto</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 16, height: 2, background: 'var(--brand-primary)', display: 'inline-block', borderRadius: 1 }} />Real</span>
            </div>
            <LineChart dados={obra.graficoCustos} />
          </div>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Cashflow da obra</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'var(--color-success)', display: 'inline-block', borderRadius: 2, opacity: 0.75 }} />Recebimentos</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'var(--color-danger)', display: 'inline-block', borderRadius: 2, opacity: 0.65 }} />Pagamentos</span>
            </div>
            <CashflowBarChart dados={obra.graficoCashflow} />
          </div>
          {/* Gráfico de desvios por fase */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Desvio por fase vs orçamento</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
              {obra.fases.map((f, i) => {
                const pct = Math.abs(f.desvioPct);
                const maxH = 100;
                const h = Math.min(pct * 20, maxH);
                const cor = f.desvioPct > 2 ? 'var(--color-danger)' : f.desvioPct > 1 ? 'var(--color-warning)' : f.desvioPct < 0 ? 'var(--color-success)' : 'var(--border-strong)';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: cor }}>{f.desvioPct !== 0 ? `${f.desvioPct > 0 ? '+' : ''}${f.desvioPct}%` : '—'}</div>
                    <div style={{ width: '100%', background: cor, borderRadius: '4px 4px 0 0', height: h || 4, opacity: 0.8, transition: 'height .3s' }} />
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{f.nome.split(' ')[0]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB FATURAÇÃO ── */}
      {tab === 'faturacao' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 14 }}>Faturação e Tesouraria</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Faturação emitida',  value: fmt(obra.faturacaoEmitida),  color: 'var(--text-primary)' },
                { label: 'Faturação recebida', value: fmt(obra.faturacaoRecebida), color: 'var(--color-success)' },
                { label: 'Saldo a faturar',    value: fmt(obra.saldoFaturar),      color: 'var(--color-warning)' },
                { label: '% de faturação',     value: `${obra.pctFaturacao}%`,     color: 'var(--brand-primary)' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            {[
              { label: 'Faturação emitida vs total', pct: obra.pctFaturacao, cor: 'var(--brand-primary)' },
              { label: 'Recebido vs emitido', pct: obra.faturacaoEmitida > 0 ? (obra.faturacaoRecebida / obra.faturacaoEmitida * 100).toFixed(1) : 0, cor: 'var(--color-success)' },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
                  <span style={{ fontWeight: 600 }}>{b.pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${b.pct}%`, background: b.cor, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Encomendas</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>% custo: <strong style={{ color: 'var(--brand-primary)' }}>{totalRoc > 0 ? Math.round(totalExec / totalRoc * 100) : 0}%</strong></span>
                <span>·</span>
                <span>% física: <strong style={{ color: 'var(--color-success)' }}>{obra.execFisicaReal}%</strong></span>
              </div>
            </div>
            <table className="sis-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Fase</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'right' }}>% Exec.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {obra.encomendas.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: 13 }}>Sem encomendas registadas</td></tr>
                ) : obra.encomendas.map((e, i) => {
                  const pctExec = e.pctExec ?? (e.valor > 0 ? Math.round(Math.random() * 60 + 20) : 0);
                  const fase = e.fase || (obra.fases[i % obra.fases.length]?.nome) || '—';
                  return (
                    <tr key={i}>
                      <td style={{ fontSize: 13 }}>{e.descricao}</td>
                      <td><span className="badge badge-n">{fase}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmt(e.valor)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctExec}%`, background: pctExec > 80 ? 'var(--color-success)' : 'var(--brand-primary)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{pctExec}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${pctExec >= 100 ? 'badge-s' : pctExec > 0 ? 'badge-i' : 'badge-n'}`}>
                          {pctExec >= 100 ? 'Concluída' : pctExec > 0 ? 'Em curso' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {obra.encomendas.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-app)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 12px', fontSize: 12 }}>TOTAL</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12 }}>{fmt(obra.encomendas.reduce((s, e) => s + (e.valor || 0), 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── TAB ALERTAS & JADO ── */}
      {tab === 'jado' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14 }}>
          {/* Alertas */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 14 }}>
              Alertas activos ({todosAlertas.length})
            </div>
            {todosAlertas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>✓ Sem alertas activos</div>
            ) : todosAlertas.map((a, i) => {
              const cfg = ALERTA_CONFIG[a.nivel];
              return (
                <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ background: cfg.border, color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>{cfg.label}</span>
                    <span style={{ fontSize: 11, color: cfg.text, opacity: 0.7 }}>{cfg.pct}</span>
                    {a.jado && <span style={{ fontSize: 11, color: cfg.text, fontWeight: 600 }}>{a.jado}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: cfg.text, fontWeight: 500, lineHeight: 1.4, marginBottom: 6 }}>{a.descricao}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: cfg.text, opacity: 0.7 }}>{a.data}</span>
                    {(isCG || isMS) && (
                      <button className="btn btn-sm" style={{ fontSize: 10 }}
                        onClick={() => { setShowJadoAlerta(a); setShowJadoModal(true); }}>
                        + JADO
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* JADOs */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Histórico JADOs ({obra.jados.length})
              </div>
              {(isCG || isMS) && <button className="btn btn-sm btn-primary" onClick={() => setShowJadoModal(true)}>+ Emitir JADO</button>}
            </div>

            {/* Pipeline visual */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14, fontSize: 10, flexWrap: 'wrap' }}>
              {JADO_STEPS.filter(s => s.key !== 'rascunho').map((s, i, arr) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ background: 'var(--bg-app)', border: '0.5px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{i+1}. {s.label}</span>
                  {i < arr.length - 1 && <span style={{ color: 'var(--text-muted)' }}>›</span>}
                </div>
              ))}
            </div>

            {obra.jados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Sem JADOs emitidos</div>
            ) : obra.jados.map((j, i) => {
              const stepInfo = JADO_STEPS.find(s => s.key === j.estado);
              const canAct = (j.estado === 'aguarda-dp' && (isDP || isMS)) ||
                             (j.estado === 'aguarda-dir' && (isDP || isMS)) ||
                             (j.estado === 'enviado-ms' && isMS) ||
                             (j.estado === 'validado-ms' && (isCG || isMS));
              return (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < obra.jados.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{j.num} — {j.fase}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Emitido {j.data} · Desvio {j.desvio > 0 ? '+' : ''}{j.desvio}%
                        {j.emitidoPor && ` · por ${j.emitidoPor}`}
                        {j.validadorNome && ` · valida ${j.validadorNome}`}
                      </div>
                      {j.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{j.descricao}</div>}
                      {j.respostaDP && <div style={{ fontSize: 11, color: 'var(--brand-primary)', marginTop: 4, fontStyle: 'italic' }}>💬 DP: {j.respostaDP}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span className={`badge ${stepInfo?.cls || 'badge-n'}`}>{stepInfo?.label}</span>
                      {canAct && j.estado === 'aguarda-dp' && (
                        <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowRespostaModal(i)}>Responder</button>
                      )}
                      {canAct && j.estado !== 'aguarda-dp' && j.estado !== 'env-comercial' && (
                        <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => avancarJado(i)}>Avançar →</button>
                      )}
                      {(isCG || isMS) && (
                        <button className="btn btn-sm" style={{ fontSize: 10, color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={() => removeJado(j.num)}>Apagar</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB ENCOMENDAS ── */}
      {tab === 'encomendas' && (() => {
        return <EncomendasTab obra={obra} loadEnc={loadEnc} saveEnc={saveEnc} updateObra={updateObra} fornecedores={FORNECEDORES_DATA} forcePodeGerir={canEditEncomendasArea} />;
      })()}

      {/* ── TAB FATURAS ── */}
      {tab === 'faturas' && (() => {
        // Load invoices for this obra from localStorage
        const FAT_FORN_KEY = 'sis_faturas_forn';
        const FAT_CLI_KEY  = 'sis_faturas_cli';
        let fatForn = [], fatCli = [];
        try {
          const rawF = JSON.parse(localStorage.getItem(FAT_FORN_KEY) || '{}');
          Object.entries(rawF).forEach(([fornId, fats]) => {
            (fats || []).forEach(fat => {
              if (fat.obra === obra.id) {
                const forn = FORNECEDORES_DATA?.find(f => f.id === fornId);
                fatForn.push({ ...fat, fornecedor: forn?.nome || fornId, fornId });
              }
            });
          });
        } catch {}
        try {
          const rawC = JSON.parse(localStorage.getItem(FAT_CLI_KEY) || '{}');
          Object.entries(rawC).forEach(([cliId, fats]) => {
            (fats || []).forEach(fat => {
              if (fat.obra === obra.id) {
                const cli = CLIENTES_DATA?.find(c => c.id === cliId);
                fatCli.push({ ...fat, cliente: cli?.nome || cliId, cliId });
              }
            });
          });
        } catch {}

        const fmt2 = v => '€ ' + Number(v).toLocaleString('pt-PT');
        const EST_FORN = { 'pending-dp':'Aguarda DP','pending-lg':'Aguarda LG','pending-ms':'Aguarda MS','autorizado':'Autorizado','pago':'Pago' };
        const EST_CLI  = { 'pendente_req':'Aguarda Req.','pendente_lg':'Aguarda LG','emitida':'Emitida','recebido':'Recebido','parcial':'Parcial' };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Faturas Fornecedores */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Faturas de Fornecedores</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Total: <strong>{fmt2(fatForn.reduce((s,f)=>s+(f.valor||0),0))}</strong></span>
                  <span>· Pago: <strong style={{ color:'var(--color-success)' }}>{fmt2(fatForn.filter(f=>f.estado==='pago').reduce((s,f)=>s+(f.valor||0),0))}</strong></span>
                  <span>· Pendente: <strong style={{ color:'var(--color-warning)' }}>{fmt2(fatForn.filter(f=>f.estado!=='pago').reduce((s,f)=>s+(f.valor||0),0))}</strong></span>
                </div>
              </div>
              {fatForn.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:13 }}>Sem faturas de fornecedores para esta obra</div>
              ) : (
                <table className="sis-table">
                  <thead><tr><th>Nº Fatura</th><th>Fornecedor</th><th style={{textAlign:'right'}}>Valor</th><th>Data</th><th>Vencimento</th><th>Cond. Pag.</th><th>Estado</th></tr></thead>
                  <tbody>
                    {fatForn.map((f,i) => (
                      <tr key={i} style={{ cursor:'pointer' }} onClick={() => navigate('/fornecedores', { state: { abrirFaturaForn: { faturaId: f.id, fornecedorId: f.fornId } } })}>
                        <td style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--brand-primary)' }}>{f.nFatura||f.id}</td>
                        <td style={{ fontWeight:500 }}>{f.fornecedor}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{fmt2(f.valor)}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{f.data}</td>
                        <td style={{ fontSize:12, color: f.estado!=='pago'&&f.venc ? 'var(--color-danger)' : 'var(--text-muted)' }}>{f.venc||'—'}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{f.condPag||'—'}</td>
                        <td><span className={`badge ${f.estado==='pago'?'badge-s':f.estado==='autorizado'?'badge-s':f.estado?.includes('pending')?'badge-w':'badge-n'}`}>{EST_FORN[f.estado]||f.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Faturas Clientes */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Faturas de Clientes</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Total: <strong>{fmt2(fatCli.reduce((s,f)=>s+(f.valor||0),0))}</strong></span>
                  <span>· Recebido: <strong style={{ color:'var(--color-success)' }}>{fmt2(fatCli.filter(f=>f.estado==='recebido').reduce((s,f)=>s+(f.valor||0),0))}</strong></span>
                </div>
              </div>
              {fatCli.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:13 }}>Sem faturas de clientes para esta obra</div>
              ) : (
                <table className="sis-table">
                  <thead><tr><th>Nº Fatura</th><th>Cliente</th><th style={{textAlign:'right'}}>Valor</th><th>Data</th><th>Prev. Recebimento</th><th>Cond. Pag.</th><th>Estado</th></tr></thead>
                  <tbody>
                    {fatCli.map((f,i) => (
                      <tr key={i} style={{ cursor:'pointer' }} onClick={() => navigate('/clientes', { state: { abrirFatura: { faturaId: f.id, clienteId: f.cliId, clienteNome: f.cliente } } })}>
                        <td style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--brand-primary)' }}>{f.id}</td>
                        <td style={{ fontWeight:500 }}>{f.cliente}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{fmt2(f.valor)}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{f.data}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{f.venc||'—'}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{f.condPag||'—'}</td>
                        <td><span className={`badge ${f.estado==='recebido'?'badge-s':f.estado?.includes('pendente')?'badge-w':'badge-i'}`}>{EST_CLI[f.estado]||f.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {tab === 'relatorios' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { tipo: 'semanal', icon: '📅', label: 'Relatório Semanal', desc: 'Indicadores da semana, movimentos, encomendas Top 5, alertas activos, próximas datas críticas.', dest: 'CG', freq: 'Sexta-feira' },
            { tipo: 'mensal',  icon: '📆', label: 'Relatório Mensal',  desc: 'Revisão do mês vs anterior, evolução de margens, histórico de JADOs emitidos.', dest: 'CG', freq: 'Dia 5 do mês seguinte' },
            { tipo: 'fecho',   icon: '🏁', label: 'Relatório de Fecho', desc: 'Resultado final da obra, custo real vs orçamento, cashflow total, lições aprendidas.', dest: 'CG', freq: 'Após conclusão' },
          ].map(r => (
            <div key={r.tipo} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: 14 }}>{r.desc}</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 11, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className="badge badge-n">Dest: {r.dest}</span>
                <span className="badge badge-i">{r.freq}</span>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowRelatorio(r.tipo)}>
                🖨 Gerar PDF
              </button>
            </div>
          ))}
          {/* Info sobre relatórios automáticos */}
          <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--bg-app)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ℹ Relatórios automáticos</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Os relatórios semanais são gerados automaticamente às sextas-feiras e enviados por notificação ao Controller.
              Os relatórios mensais são gerados no dia 5 de cada mês. O relatório de fecho é gerado quando a obra é marcada como concluída.
              Todos os relatórios ficam disponíveis para download no <strong>Arquivo</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
