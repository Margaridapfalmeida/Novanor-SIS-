import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useLocation } from 'react-router-dom';
import AdicionarDocumentoModal, { loadDocumentos, saveDocumentos, TIPOS_DOC } from '../components/shared/AdicionarDocumentoModal';
import { canEditModule } from '../context/PermissionsConfig';
import { withDemoSeed } from '../utils/deliveryMode';

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sis_fornecedores_extra';
function loadExtras() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveExtras(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

const FAT_KEY_FORN = 'sis_faturas_forn';
function loadFaturasForn(fornId, defaultFaturas) {
  try {
    const all = JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
    return all[fornId] ?? defaultFaturas;
  } catch { return defaultFaturas; }
}
function saveFaturasForn(fornId, faturas) {
  try {
    const all = JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
    all[fornId] = faturas;
    const json = JSON.stringify(all);
    localStorage.setItem(FAT_KEY_FORN, json);
    // Notify Tesouraria in real time (same tab)
    window.dispatchEvent(new StorageEvent('storage', { key: FAT_KEY_FORN, newValue: json }));
  } catch {}
}

const PASTA_KEY = 'sis_pasta_fatura_forn';
function loadPastaFatura(faturaId) {
  if (!faturaId) return [];
  try { return JSON.parse(localStorage.getItem(PASTA_KEY) || '{}')[faturaId] || []; }
  catch { return []; }
}
function savePastaFatura(faturaId, docs) {
  if (!faturaId) return;
  try {
    const all = JSON.parse(localStorage.getItem(PASTA_KEY) || '{}');
    all[faturaId] = docs;
    localStorage.setItem(PASTA_KEY, JSON.stringify(all));
  } catch {}
}

// ─── FILE HELPERS ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function serializarFicheiro(file) {
  if (!file) return null;
  try {
    const base64 = await fileToBase64(file);
    return { name: file.name, size: file.size, base64 };
  } catch {
    return { name: file.name, size: file.size, base64: null };
  }
}
function downloadPdf(pdf) {
  if (!pdf?.base64) return;
  const a = document.createElement('a');
  a.href = pdf.base64;
  a.download = pdf.name || 'documento.pdf';
  a.click();
}

// ─── PERFIS ───────────────────────────────────────────────────────────────────
function getPerfisLista() {
  try {
    const saved = JSON.parse(localStorage.getItem('sis_perfis') || '[]');
    if (saved.length > 0) return saved;
  } catch {}
  return [
    { id: 'ms', nome: 'Miguel Seabra',  email: 'ms@novanor.pt',  initials: 'MS', role: 'Direção' },
    { id: 'lg', nome: 'Leonor Gomes',   email: 'lg@novanor.pt',  initials: 'LG', role: 'Diretora Financeira' },
    { id: 'ca', nome: 'Carla',          email: 'ca@novanor.pt',  initials: 'CA', role: 'Área Financeira' },
    { id: 'cg', nome: 'Controller',     email: 'cg@novanor.pt',  initials: 'CG', role: 'Controller de Gestão' },
    { id: 'dp', nome: 'Dir. Produção',  email: 'dp@novanor.pt',  initials: 'DP', role: 'Departamento de Produção' },
    { id: 'dc', nome: 'Dir. Comercial', email: 'dc@novanor.pt',  initials: 'DC', role: 'Departamento Comercial' },
  ];
}

export const FORNECEDORES_DATA = withDemoSeed([
  {
    id: 'f001', nome: 'Metalúrgica SA', nif: '508 123 456',
    categoria: 'Estruturas metálicas', contacto: 'João Ferreira',
    email: 'jferreira@metalurgica.pt', telefone: '+351 21 345 6789',
    morada: 'Rua Industrial 45, Setúbal', obras: ['O142', 'O138'],
    totalFaturas: 12, totalPago: 148200, pendente: 12400, estado: 'ativo',
    faturas: [
      { id: 'F-2024-0891', obra: 'O142', valor: 12400, data: '10 Mar 2024', venc: '18 Mar', condPag: '30 dias', estado: 'pending-ms', validDP: 'Pendente', descricao: 'Perfis HEA 200 — Fase Estrutura', pdf: null },
      { id: 'F-2024-0842', obra: 'O138', valor: 31200, data: '20 Fev 2024', venc: '20 Mar', condPag: '30 dias', estado: 'pago',       validDP: 'Validada', descricao: 'Chapa galvanizada 3mm', pdf: null },
      { id: 'F-2024-0801', obra: 'O142', valor: 18600, data: '05 Fev 2024', venc: '05 Mar', condPag: '30 dias', estado: 'pago',       validDP: 'Validada', descricao: 'Vigas IPE 300 — Fundações', pdf: null },
    ],
  },
  {
    id: 'f002', nome: 'Elétrica Norte Lda', nif: '509 234 567',
    categoria: 'Instalações elétricas', contacto: 'Ana Costa',
    email: 'ana.costa@eletricanorte.pt', telefone: '+351 22 456 7890',
    morada: 'Av. da República 12, Porto', obras: ['O143', 'O145'],
    totalFaturas: 8, totalPago: 67400, pendente: 8750, estado: 'ativo',
    faturas: [
      { id: 'F-2024-0892', obra: 'O143', valor:  8750, data: '08 Mar 2024', venc: '20 Mar', condPag: '30 dias', estado: 'autorizado', validDP: 'Validada', descricao: 'Quadro elétrico principal', pdf: null },
      { id: 'F-2024-0845', obra: 'O145', valor: 14200, data: '22 Fev 2024', venc: '22 Mar', condPag: '30 dias', estado: 'pago',       validDP: 'Validada', descricao: 'Cabos BT 35mm²', pdf: null },
    ],
  },
  {
    id: 'f003', nome: 'Construções RJ Unipessoal', nif: '510 345 678',
    categoria: 'Subempreitada geral', contacto: 'Rui Jesus',
    email: 'rj@construcoesrj.pt', telefone: '+351 21 567 8901',
    morada: 'Zona Industrial, Almada', obras: ['O138'],
    totalFaturas: 5, totalPago: 124000, pendente: 31200, estado: 'pendente-dp',
    faturas: [
      { id: 'F-2024-0888', obra: 'O138', valor: 31200, data: '05 Mar 2024', venc: '22 Mar', condPag: '30 dias', estado: 'pending-dp', validDP: 'Pendente', descricao: 'Mão de obra — Fase Cobertura', pdf: null },
      { id: 'F-2024-0820', obra: 'O138', valor: 28400, data: '12 Fev 2024', venc: '12 Mar', condPag: '30 dias', estado: 'pago',       validDP: 'Validada', descricao: 'Subempreitada estrutura betão', pdf: null },
    ],
  },
  {
    id: 'f004', nome: 'AVAC Systems Portugal', nif: '511 456 789',
    categoria: 'AVAC e climatização', contacto: 'Pedro Alves',
    email: 'pedro@avacsystems.pt', telefone: '+351 21 678 9012',
    morada: 'Parque Empresarial, Sintra', obras: ['O143'],
    totalFaturas: 3, totalPago: 42000, pendente: 0, estado: 'ativo',
    faturas: [
      { id: 'F-2024-0830', obra: 'O143', valor: 18500, data: '20 Fev 2024', venc: '20 Mar', condPag: '30 dias', estado: 'pago', validDP: 'Validada', descricao: 'UTA industrial — Zona produção', pdf: null },
    ],
  },
  {
    id: 'f005', nome: 'Betões Lisboa SA', nif: '512 567 890',
    categoria: 'Betão e prefabricados', contacto: 'Marta Silva',
    email: 'msilva@betoeslisboa.pt', telefone: '+351 21 789 0123',
    morada: 'EN 10 km 45, Loures', obras: ['O142', 'O145'],
    totalFaturas: 9, totalPago: 198000, pendente: 0, estado: 'ativo',
    faturas: [
      { id: 'F-2024-0860', obra: 'O142', valor: 48200, data: '28 Fev 2024', venc: '28 Mar', condPag: '30 dias', estado: 'pago', validDP: 'Validada', descricao: 'Betão C30/37 — Fundações', pdf: null },
    ],
  },
  {
    id: 'f006', nome: 'IsolTec Unipessoal', nif: '513 678 901',
    categoria: 'Isolamentos e impermeabilização', contacto: 'Carlos Nunes',
    email: 'cnunes@isoltec.pt', telefone: '+351 21 890 1234',
    morada: 'Zona Industrial, Montijo', obras: ['O138', 'O142'],
    totalFaturas: 4, totalPago: 28600, pendente: 5200, estado: 'ativo',
    faturas: [
      { id: 'F-2024-0895', obra: 'O142', valor:  5200, data: '12 Mar 2024', venc: '25 Mar', condPag: '30 dias', estado: 'pending-ms', validDP: 'Validada', descricao: 'Impermeabilização cobertura', pdf: null },
    ],
  },
]);

const CATS = ['Estruturas metálicas','Instalações elétricas','Subempreitada geral','AVAC e climatização','Betão e prefabricados','Isolamentos e impermeabilização','Serralharia','Carpintaria','Pintura','Outro'];
const CATEGORIAS = ['Todas', ...CATS];
// ─── UTILITÁRIOS DE DATA ─────────────────────────────────────────────────────
function calcularDataPrevisao(condPag, dataEmissao, dataVencimento) {
  try {
    if (condPag === 'acordado') {
      if (!dataVencimento) return null;
      const d = dataVencimento.includes('/')
        ? new Date(dataVencimento.split('/').reverse().join('-'))
        : new Date(dataVencimento);
      return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
    const dias = parseInt(condPag);
    if (!dias || !dataEmissao) return null;
    const base = dataEmissao.includes('/')
      ? new Date(dataEmissao.split('/').reverse().join('-'))
      : new Date(dataEmissao);
    if (isNaN(base)) return null;
    base.setDate(base.getDate() + dias);
    return base.toISOString().split('T')[0];
  } catch { return null; }
}
function fmtDataPrev(iso) {
  if (!iso) return null;
  if (iso.includes('/')) return iso;
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const OBRAS_BASE_LISTA = ['O138','O142','O143','O145'];
const normalizeObraId = (value) => String(value || '').trim().toUpperCase();
const uniqueObras = (list = []) => [...new Set((list || []).map(normalizeObraId).filter(Boolean))];

function loadObrasExtraIds() {
  try {
    return JSON.parse(localStorage.getItem('sis_obras_extra') || '[]')
      .map((obra) => normalizeObraId(obra?.id))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getObrasLista() {
  return uniqueObras([...OBRAS_BASE_LISTA, ...loadObrasExtraIds()]).sort((a, b) => a.localeCompare(b));
}

function mergeFornecedoresData(extras = []) {
  const extrasById = new Map((extras || []).map((fornecedor) => [fornecedor.id, fornecedor]));

  const enrichFornecedor = (fornecedorBase, extra = null) => {
    const merged = extra ? { ...fornecedorBase, ...extra } : { ...fornecedorBase };
    const faturas = loadFaturasForn(merged.id, merged.faturas || []);
    return {
      ...merged,
      faturas,
      obras: uniqueObras([...(fornecedorBase.obras || []), ...(extra?.obras || []), ...faturas.map((fatura) => fatura?.obra)]),
    };
  };

  const baseIds = new Set(FORNECEDORES_DATA.map((fornecedor) => fornecedor.id));
  const mergedBase = FORNECEDORES_DATA.map((fornecedor) => enrichFornecedor(fornecedor, extrasById.get(fornecedor.id)));
  const extrasOnly = (extras || [])
    .filter((fornecedor) => !baseIds.has(fornecedor.id))
    .map((fornecedor) => enrichFornecedor(fornecedor));

  return [...mergedBase, ...extrasOnly];
}

const ESTADO_CONFIG = {
  'ativo':       { label: 'Ativo',       cls: 'badge-s' },
  'pendente-dp': { label: 'Pendente DP', cls: 'badge-w' },
  'inativo':     { label: 'Inativo',     cls: 'badge-n' },
};
export const FATURA_CONFIG_FORN = {
  'pago':       { label: 'Pago',        cls: 'badge-s' },
  'concluido':  { label: '🏁 Concluído', cls: 'badge-s' },
  'autorizado': { label: 'Autorizado',  cls: 'badge-s' },
  'pending-ms': { label: 'Aguarda MS',  cls: 'badge-w' },
  'pending-lg': { label: 'Aguarda LG',  cls: 'badge-w' },
  'standby-lg': { label: 'Standby LG',  cls: 'badge-n' },
  'pending-dp': { label: 'Aguarda DP',  cls: 'badge-i' },
  'vencida':    { label: 'Vencida',     cls: 'badge-d' },
  'recebida':   { label: 'Recebida',    cls: 'badge-n' },
  'rejeitado_dp': { label: '↩ Devolvida',  cls: 'badge-d' },
};

const fmt = v => '€ ' + Number(v).toLocaleString('pt-PT');
const inp = err => ({
  width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
  padding: '7px 10px',
  border: `0.5px solid ${err ? 'var(--color-danger)' : 'var(--border-strong)'}`,
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
});

// ─── MODAL REGISTAR FATURA FORNECEDOR ────────────────────────────────────────
// ─── PAINEL DOC 51 FORNECEDOR ─────────────────────────────────────────────────
function Doc51FornPanel({ fatura, user, onAdicionado }) {
  const [uploading, setUploading] = useState(false);
  const lista = getPerfisLista();
  const perfilUser = lista.find(p => p.id === user?.id);
  const _ini = (user?.initials || '').toUpperCase();
  const eCA = _ini === 'CA' || user?.id === 'ca' || user?.isAdmin || perfilUser?.acoes?.includes('emitir_fatura_cli');

  if (fatura.doc51) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>🏁</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--color-success)', fontWeight: 600, marginBottom: 1 }}>Processo concluído — {fatura.dataDoc51}</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{fatura.doc51.name || 'Doc. 51'}</div>
        </div>
        <button className="btn btn-sm" onClick={() => downloadPdf(fatura.doc51)} disabled={!fatura.doc51?.base64}>Descarregar</button>
      </div>
    );
  }

  if (!eCA) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '1.5px dashed var(--border-strong)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ opacity: 0.4 }}>🏁</span> Aguarda Documento 51 da Carla Almeida
      </div>
    );
  }

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 14px', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', border: '1.5px dashed var(--brand-primary)', background: 'var(--bg-info)', transition: 'all .15s' }}>
      <span style={{ fontSize: 18 }}>🏁</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)' }}>
          {uploading ? 'A processar...' : 'Adicionar Documento 51'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Clica para seleccionar — conclui o processo</div>
      </div>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          setUploading(true);
          try {
            const ser = await serializarFicheiro(file);
            await onAdicionado(ser);
          } catch (err) { console.error(err); }
          setUploading(false);
        }}
      />
    </label>
  );
}

function RegistarFaturaModal({ fornecedor, onClose, onRegistar }) {
  const [form, setForm] = useState({
    nFatura: '', obra: '', valor: '', descricao: '',
    data: new Date().toISOString().split('T')[0],
    venc: '', condPag: '30 dias', pdf: null,
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.obra) e.obra = 'Selecciona uma obra';
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido';
    if (!form.descricao.trim()) e.descricao = 'Campo obrigatório';
    return e;
  };

  const handleRegistar = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const pdfSer = form.pdf ? await serializarFicheiro(form.pdf) : null;
    const dataPrevisaoISO = calcularDataPrevisao(form.condPag, form.data, form.venc);
    onRegistar({ ...form, valor: Number(form.valor), pdf: pdfSer, dataPrevisaoPagamento: dataPrevisaoISO ? fmtDataPrev(dataPrevisaoISO) : null });
  };

  return (
    <div onClick={undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Registar fatura</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Fornecedor: {fornecedor.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Info sobre o fluxo */}
        <div style={{ margin: '16px 20px 0', padding: '10px 12px', background: 'var(--bg-info)', borderRadius: 8, borderLeft: '3px solid var(--color-info)', fontSize: 12, color: '#0a3a6a' }}>
          📋 Ao registar, o Diretor de Produção receberá notificação por email para validar esta fatura.
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            {/* Nº fatura fornecedor */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Nº Fatura do fornecedor</label>
              <input value={form.nFatura} onChange={e => set('nFatura', e.target.value)} placeholder="ex: 2024/0891" style={inp(false)} />
            </div>

            {/* Obra */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Obra <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <select value={form.obra} onChange={e => set('obra', e.target.value)} style={inp(errors.obra)}>
                <option value="">Selecciona...</option>
                {getObrasLista().map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.obra && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.obra}</div>}
            </div>

            {/* Valor */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Valor (€) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="ex: 12400" style={inp(errors.valor)} />
              {errors.valor && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.valor}</div>}
            </div>

            {/* Data */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data da fatura</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inp(false)} />
            </div>

            {/* Vencimento */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data de vencimento</label>
              <input type="date" value={form.venc} onChange={e => set('venc', e.target.value)} style={inp(false)} />
            </div>

            {/* Condições */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Condições de pagamento</label>
              <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={inp(false)}>
                {['15 dias','30 dias','45 dias','60 dias','90 dias','acordado'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            {/* Descrição */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Descrição <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="ex: Fornecimento de perfis HEA — Fase Estrutura" style={inp(errors.descricao)} />
              {errors.descricao && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.descricao}</div>}
            </div>

            {/* PDF */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Fatura PDF <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1.5px dashed ${form.pdf ? 'var(--color-success)' : 'var(--border-strong)'}`, background: form.pdf ? 'var(--bg-success)' : 'var(--bg-app)', transition: 'all .15s' }}>
                <span style={{ fontSize: 20 }}>{form.pdf ? '✅' : '📎'}</span>
                <div style={{ flex: 1 }}>
                  {form.pdf ? (
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{form.pdf.name}</div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Anexa a fatura do fornecedor</div>
                  )}
                </div>
                {form.pdf && <button onClick={e => { e.preventDefault(); e.stopPropagation(); set('pdf', null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px' }}>✕</button>}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) set('pdf', f); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleRegistar}>📥 Registar fatura</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAINEL EDITAR FATURA (após devolução) ───────────────────────────────────
function EditarFaturaPanel({ fatura, titulo, descricao, reenviarLabel, onReenviar, loading }) {
  const [form, setForm] = useState({
    nFatura:   fatura.nFatura || fatura.id || '',
    obra:      fatura.obra || '',
    valor:     String(fatura.valor || ''),
    descricao: fatura.descricao || '',
    data:      fatura.data ? fatura.data.split('/').reverse().join('-') : new Date().toISOString().split('T')[0],
    venc:      fatura.venc ? fatura.venc.split('/').reverse().join('-') : '',
    condPag:   fatura.condPag || '30 dias',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ marginTop: 16, padding: '14px', background: 'rgba(184,50,50,0.06)', borderRadius: 8, border: '1px solid var(--color-danger)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 4 }}>{titulo}</div>
      {descricao && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{descricao}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 14 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Nº Fatura</label>
          <input value={form.nFatura} onChange={e => set('nFatura', e.target.value)} style={inp(false)} placeholder="ex: 2024/0891" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Obra</label>
          <select value={form.obra} onChange={e => set('obra', e.target.value)} style={inp(false)}>
            <option value="">Selecciona...</option>
            {getObrasLista().map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Valor (€)</label>
          <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} style={inp(false)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Data fatura</label>
          <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inp(false)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Vencimento</label>
          <input type="date" value={form.venc} onChange={e => set('venc', e.target.value)} style={inp(false)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Condições</label>
          <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={inp(false)}>
            {['15 dias','30 dias','45 dias','60 dias','90 dias','acordado'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Descrição</label>
          <input value={form.descricao} onChange={e => set('descricao', e.target.value)} style={inp(false)} />
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => onReenviar({
          ...form,
          valor: Number(form.valor),
          data: form.data ? new Date(form.data).toLocaleDateString('pt-PT') : fatura.data,
          venc: form.venc ? new Date(form.venc).toLocaleDateString('pt-PT') : fatura.venc,
          nFatura: form.nFatura || fatura.nFatura,
        })}
        disabled={!!loading}>
        {loading || reenviarLabel || '✓ Reenviar para validação'}
      </button>
    </div>
  );
}

// ─── MODAL DETALHE FATURA FORNECEDOR ─────────────────────────────────────────
export function FaturaFornDetalheModal({ fatura: faturaInicial, fornecedor, onClose, onUpdate }) {
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [fatura, setFatura] = useState(faturaInicial);
  const [toast, setToast]   = useState('');
  const [loading, setLoading] = useState('');
  const [pasta, setPasta]   = useState(() => loadPastaFatura(faturaInicial?.id));
  const [showAddDoc, setShowAddDoc] = useState(false);

  if (!fatura) return null;

  const est = FATURA_CONFIG_FORN[fatura.estado] || { label: fatura.estado, cls: 'badge-n' };
  const nomeForn = typeof fornecedor === 'string' ? fornecedor : fornecedor?.nome;
  const VAL_CLS = { 'Validada': 'badge-s', 'Pendente': 'badge-w', 'Atrasada': 'badge-d' };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const actualizarFatura = (campos) => {
    const updated = { ...fatura, ...campos };
    setFatura(updated);
    if (onUpdate) onUpdate(updated);
    return updated;
  };

  // Permissões
  const lista = getPerfisLista();
  const perfilUser = lista.find(p => p.id === user?.id);
  const _ini = (user?.initials || '').toUpperCase();
  const eDP  = _ini === 'DP' || user?.id === 'dp' || user?.isAdmin || perfilUser?.acoes?.includes('validar_fatura_forn');
  const eLG  = _ini === 'LG' || user?.id === 'lg' || perfilUser?.role?.toLowerCase().includes('financeira') || perfilUser?.role?.toLowerCase().includes('tesouraria');
  const eMS  = _ini === 'MS' || user?.id === 'ms' || user?.isAdmin;
  const eCA  = _ini === 'CA' || user?.id === 'ca';
  const podePagar = eLG || eMS || user?.isAdmin || perfilUser?.acoes?.includes('confirmar_pagamento');
  const podeEditarDataPrev = eMS || eLG || user?.isAdmin || perfilUser?.acoes?.includes('editar_data_previsao_pag');

  // PASSO 1: DP valida → notifica LG
  const handleValidarDP = async () => {
    const updated = actualizarFatura({
      validDP: 'Validada',
      estado: 'pending-lg',
      dataValidacaoDP: new Date().toLocaleDateString('pt-PT'),
    });
    setLoading('A notificar Leonor Gomes...');
    addNotif({
      tipo: 'confirmar_emissao',
      icon: '📋',
      titulo: `Fatura validada pelo DP — aguarda aprovação`,
      sub: `${nomeForn} · ${fatura.id} · ${fatura.obra}`,
      path: '/fornecedores',
      destinatario: 'lg',
      meta: { faturaId: fatura.id, fornecedorNome: nomeForn },
    });
    setLoading('');
    showToast('Validado ✓ — Leonor Gomes notificada');
  };

  // PASSO 2: LG aprova → notifica MS
  const handleAprovarLG = async (dataPrevisao) => {
    if (marcarFeita) marcarFeita(fatura.id, '/fornecedores');
    const updated = actualizarFatura({
      estado: 'pending-ms',
      aprovadoLG: true,
      dataAprovacaoLG: new Date().toLocaleDateString('pt-PT'),
      dataPrevisaoPagamento: dataPrevisao,
    });
    setLoading('A notificar MS...');
    addNotif({
      tipo: 'confirmar_emissao',
      icon: '💶',
      titulo: `Fatura aprovada — aguarda autorização de pagamento`,
      sub: `${nomeForn} · ${fatura.id} · ${fatura.obra} · Previsão: ${dataPrevisao}`,
      path: '/fornecedores',
      destinatario: 'ms',
      meta: { faturaId: fatura.id, fornecedorNome: nomeForn },
    });
    setLoading('');
    showToast('Aprovado ✓ — MS notificado para autorizar pagamento');
  };

  // PASSO 3: MS autoriza → notifica LG para pagar
  const handleAutorizarMS = async () => {
    const updated = actualizarFatura({
      estado: 'autorizado',
      autorizadoMS: true,
      dataAutorizacaoMS: new Date().toLocaleDateString('pt-PT'),
    });
    setLoading('A notificar Leonor Gomes...');
    addNotif({
      tipo: 'confirmar_emissao',
      icon: '✅',
      titulo: `Pagamento autorizado — podes efectuar o pagamento`,
      sub: `${nomeForn} · ${fatura.id} · ${fatura.obra} · Autorizado por ${user?.nome}`,
      path: '/fornecedores',
      destinatario: 'lg',
      meta: { faturaId: fatura.id, fornecedorNome: nomeForn },
    });
    setLoading('');
    showToast('Autorizado ✓ — Leonor notificada para efectuar pagamento');
  };

  // MS devolve fatura para LG ou DP
  const handleDevolverMS = async (estadoDestino) => {
    const campos = {
      estado: estadoDestino,
      autorizadoMS: false,
      ...(estadoDestino === 'pending-dp' ? { validDP: 'Pendente', aprovadoLG: false } : {}),
    };
    actualizarFatura(campos);
    const destId = estadoDestino === 'pending-dp' ? 'dp' : 'lg';
    const destLabel = estadoDestino === 'pending-dp' ? 'Diretor de Produção' : 'Leonor Gomes';
    addNotif({ tipo: 'confirmar_emissao', icon: '↩', titulo: `Fatura devolvida por MS — aguarda ${destLabel}`,
      sub: `${nomeForn} · ${fatura.id} · ${fatura.obra}`, path: '/fornecedores',
      destinatario: destId, meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
    showToast(`Fatura devolvida a ${destLabel} ✓`);
  };

  return (
    <div onClick={undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '96vw', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.25)', position: 'relative', overflowX: 'hidden' }}>
        {(toast || loading) && (
          <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', background: loading ? 'var(--brand-primary)' : 'var(--color-success)', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', zIndex: 10 }}>
            {loading || toast}
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>{fatura.id}</span>
              <span className={`badge ${est.cls}`}>{est.label}</span>
              {fatura.validDP && fatura.estado === 'pending-dp' && <span className={`badge ${VAL_CLS[fatura.validDP] || 'badge-n'}`}>DP: {fatura.validDP}</span>}
              {fatura.autorizadoMS && !fatura.concluido && <span className="badge badge-s">✓ Autorizado MS</span>}
              {fatura.concluido && <span className="badge badge-s">🏁 Concluído</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fornecedor: {nomeForn}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Editar dados — botão e painel inline */}
          <EditarFaturaInlinePanel
            fatura={fatura}
            podeEditar={eCA || eLG || eMS}
            onSave={(campos) => {
              actualizarFatura(campos);
              showToast('Dados guardados ✓');
            }}
          />

          {/* Valor */}
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-app)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Valor da fatura</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(fatura.valor)}</div>
          </div>

          {/* Campos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 20 }}>
            {[
              { label: 'Obra',            value: fatura.obra },
              { label: 'Data da fatura',  value: fatura.data },
              { label: 'Vencimento',      value: fatura.venc || '—' },
              { label: 'Condições pag.',  value: fatura.condPag || '—' },
              ...(fatura.nFatura ? [{ label: 'Nº Fatura fornecedor', value: fatura.nFatura }] : []),
              ...(fatura.registadoPor ? [{ label: 'Registado por', value: fatura.registadoPor }] : []),
              ...(fatura.dataValidacaoDP ? [{ label: 'Validado DP em', value: fatura.dataValidacaoDP }] : []),
              ...(fatura.dataAprovacaoLG ? [{ label: 'Aprovado LG em', value: fatura.dataAprovacaoLG }] : []),
              ...(fatura.dataAutorizacaoMS ? [{ label: 'Autorizado MS em', value: fatura.dataAutorizacaoMS }] : []),
              { label: 'Descrição', value: fatura.descricao, full: true },
            ].map(item => (
              <div key={item.label} style={{ gridColumn: item.full ? 'span 2' : 'span 1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: item.label === 'Obra' ? 600 : 400 }}>{item.value}</div>
              </div>
            ))}

            {/* Previsão de pagamento — LG pode editar em qualquer estado */}
            <div style={{ gridColumn: 'span 2', borderTop: '0.5px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Previsão de pagamento
                {eLG && <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', marginLeft: 6, color: 'var(--brand-primary)' }}>— editável por LG</span>}
              </div>
              {eLG ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="date"
                    defaultValue={fatura.dataPrevisaoPagamento ? fatura.dataPrevisaoPagamento.split('/').reverse().join('-') : fatura.venc || ''}
                    id={`prev_pag_${fatura.id}`}
                    style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <button className="btn btn-sm"
                    onClick={() => {
                      const el = document.getElementById(`prev_pag_${fatura.id}`);
                      if (!el?.value) return;
                      const dataFmt = new Date(el.value).toLocaleDateString('pt-PT');
                      actualizarFatura({ dataPrevisaoPagamento: dataFmt });
                      showToast(`Previsão de pagamento actualizada: ${dataFmt}`);
                    }}>
                    Guardar
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {fatura.dataPrevisaoPagamento || '—'}
                </div>
              )}
          </div>

          {/* Pasta */}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                📁 Pasta da fatura <span style={{ fontWeight:400 }}>({pasta.length + (fatura.pdf ? 1 : 0) + (fatura.comprovativoPagamento ? 1 : 0) + (fatura.doc51 ? 1 : 0)})</span>
              </div>
              {(eCA || eLG || eMS) && (
                <button className="btn btn-sm" style={{ fontSize:11 }} onClick={() => setShowAddDoc(true)}>+ Adicionar doc.</button>
              )}
            </div>
            {fatura.pdf ? (
              <DocPastaItem
                doc={{ tipo:'fatura', nome: fatura.pdf.name || 'Fatura', base64: fatura.pdf.base64 }}
                podeRemover={eCA || eMS}
                onDownload={() => downloadPdf(fatura.pdf)}
                onRemover={() => { actualizarFatura({ pdf: null }); showToast('Documento removido'); }}
              />
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--bg-app)', borderRadius:8, border:'1.5px dashed var(--border-strong)', marginBottom:6 }}>
                <span style={{ fontSize:16, opacity:0.4 }}>📎</span>
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>Sem fatura anexada</span>
              </div>
            )}
            {fatura.comprovativoPagamento && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-success)', marginBottom: 1 }}>Pago em {fatura.dataPagamento}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{fatura.comprovativoPagamento.name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => downloadPdf(fatura.comprovativoPagamento)} disabled={!fatura.comprovativoPagamento?.base64}>Descarregar</button>
              </div>
            )}
            {/* Documento 51 */}
            {fatura.doc51 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🏁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, marginBottom: 1 }}>Processo concluído — {fatura.dataDoc51}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fatura.doc51.name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => downloadPdf(fatura.doc51)} disabled={!fatura.doc51?.base64}>Descarregar</button>
              </div>
            )}
          </div>

          {/* ── ACÇÕES ── */}

          {/* PASSO 1 — DP valida */}
          {fatura.validDP === 'Pendente' && eDP && (
            <AprovarRejeitarPanel
              titulo="⏳ Aguarda a tua validação"
              descricao="Confirma que os bens/serviços foram recebidos e a fatura está correcta."
              cor="warning"
              aprovLabel="✓ Validar fatura"
              rejeitarLabel="Não validar"
              anteriorLabel="Carla Almeida"
              loading={loading}
              onAprovar={async (comentario) => {
                if (comentario) actualizarFatura({ observacaoDP: comentario, dataObservacaoDP: new Date().toLocaleDateString('pt-PT') });
                await handleValidarDP();
              }}
              onRejeitar={async (comentario) => {
                actualizarFatura({ estado: 'rejeitado_dp', validDP: 'Rejeitada', observacaoDP: comentario, dataObservacaoDP: new Date().toLocaleDateString('pt-PT') });
                addNotif({ tipo: 'info', icon: '↩', titulo: `Fatura não validada pelo DP`, sub: `${nomeForn} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`, path: '/fornecedores', destinatario: 'ca', meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                showToast('Fatura devolvida — Carla notificada');
              }}
            />
          )}
          {fatura.validDP === 'Pendente' && !eDP && !fatura.estado?.includes('rejeit') && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              🔒 Aguarda validação pelo Diretor de Produção.
              {fatura.observacaoDP && <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--color-danger)' }}>💬 Nota DP: {fatura.observacaoDP}</div>}
            </div>
          )}

          {/* DEVOLVIDA AO CA — editar e reenviar */}
          {fatura.estado === 'rejeitado_dp' && (eCA || eMS || eLG) && (
            <EditarFaturaPanel
              fatura={fatura}
              titulo="↩ Fatura devolvida — corrige e reenvia ao DP"
              descricao={fatura.observacaoDP ? `Motivo: "${fatura.observacaoDP}"` : 'O DP não validou esta fatura. Corrige os campos e reenvia.'}
              reenviarLabel="📤 Reenviar ao DP para validação"
              loading={loading}
              onReenviar={(campos) => {
                actualizarFatura({ ...campos, estado: 'pending-dp', validDP: 'Pendente', observacaoDP: null });
                addNotif({ tipo: 'confirmar_emissao', icon: '📋', titulo: `Fatura corrigida — aguarda validação DP`,
                  sub: `${nomeForn} · ${campos.nFatura || fatura.id}`, path: '/fornecedores',
                  destinatario: 'dp', meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                showToast('Fatura reenviada ao DP ✓');
              }}
            />
          )}
          {fatura.estado === 'rejeitado_dp' && !eCA && !eMS && !eLG && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(184,50,50,0.06)', borderRadius: 8, border: '1px solid var(--color-danger)', fontSize: 12, color: 'var(--color-danger)' }}>
              ↩ Fatura devolvida.{fatura.observacaoDP ? ` Motivo: "${fatura.observacaoDP}"` : ''} Aguarda correcção pela área financeira.
            </div>
          )}

          {/* PASSO 2 — LG aprova */}
          {(fatura.estado === 'pending-lg' || fatura.estado === 'standby-lg') && eLG && (
            <AprovarRejeitarPanel
              titulo="📋 Aguarda a tua decisão"
              descricao={`Fatura validada pelo DP em ${fatura.dataValidacaoDP}. A data de previsão de pagamento pode ser editada acima.`}
              cor="info"
              aprovLabel="✓ Aprovar e notificar MS"
              rejeitarLabel="Não aprovar"
              anteriorLabel="Diretor de Produção"
              loading={loading}
              onAprovar={async (comentario) => {
                const dataPrevisao = fatura.dataPrevisaoPagamento;
                if (comentario) actualizarFatura({ observacaoLG: comentario });
                await handleAprovarLG(dataPrevisao);
              }}
              onRejeitar={async (comentario) => {
                actualizarFatura({ estado: 'pending-dp', validDP: 'Pendente', aprovadoLG: false, observacaoLG: comentario, dataObservacaoLG: new Date().toLocaleDateString('pt-PT') });
                addNotif({ tipo: 'info', icon: '↩', titulo: `Fatura não aprovada pela LG`, sub: `${nomeForn} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`, path: '/fornecedores', destinatario: 'dp', meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                showToast('Fatura devolvida ao DP — notificado');
              }}
            />
          )}
          {(fatura.estado === 'pending-lg' || fatura.estado === 'standby-lg') && !eLG && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              🔒 Aguarda decisão da Diretora Financeira.
              {fatura.dataPrevisaoPagamento && <span> Previsão: <strong>{fatura.dataPrevisaoPagamento}</strong>.</span>}
              {fatura.observacaoLG && <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--color-danger)' }}>💬 Nota LG: {fatura.observacaoLG}</div>}
            </div>
          )}

          {/* DEVOLVIDA AO DP pela LG — DP pode aprovar directamente ou rejeitar de volta à CA */}
          {fatura.estado === 'pending-dp' && fatura.observacaoLG && eDP && (
            <div>
              {fatura.observacaoLG && (
                <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(184,50,50,0.06)', borderRadius: 8, border: '1px solid var(--color-danger)', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>↩ Devolvida pela LG</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{fatura.observacaoLG}</span>
                </div>
              )}
              <AprovarRejeitarPanel
                titulo="⏳ Aguarda a tua validação"
                descricao="A LG devolveu esta fatura. Podes aprovar directamente ou devolver à CA."
                cor="warning"
                aprovLabel="✓ Validar e enviar à LG"
                rejeitarLabel="Devolver à CA"
                anteriorLabel="Carla Almeida"
                loading={loading}
                onAprovar={async (comentario) => {
                  if (comentario) actualizarFatura({ observacaoDP: comentario });
                  const updated = actualizarFatura({ validDP: 'Validada', estado: 'pending-lg', dataValidacaoDP: new Date().toLocaleDateString('pt-PT'), observacaoLG: null });
                  addNotif({ tipo: 'confirmar_emissao', icon: '📋', titulo: `Fatura validada pelo DP — aguarda aprovação LG`, sub: `${nomeForn} · ${fatura.id}`, path: '/fornecedores', destinatario: 'lg', meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                  showToast('Validado ✓ — LG notificada');
                }}
                onRejeitar={async (comentario) => {
                  actualizarFatura({ estado: 'rejeitado_dp', validDP: 'Rejeitada', observacaoDP: comentario, dataObservacaoDP: new Date().toLocaleDateString('pt-PT') });
                  addNotif({ tipo: 'info', icon: '↩', titulo: `Fatura não validada pelo DP`, sub: `${nomeForn} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`, path: '/fornecedores', destinatario: 'ca', meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                  showToast('Fatura devolvida — Carla notificada');
                }}
              />
            </div>
          )}

          {/* PASSO 3 — MS autoriza */}
          {fatura.estado === 'pending-ms' && fatura.aprovadoLG && eMS && (
            <AprovarRejeitarPanel
              titulo="💶 Aguarda a tua autorização de pagamento"
              descricao={`Aprovado por Leonor Gomes em ${fatura.dataAprovacaoLG}.${fatura.dataPrevisaoPagamento ? ' Previsão: ' + fatura.dataPrevisaoPagamento + '.' : ''}`}
              cor="warning"
              aprovLabel="✓ Autorizar pagamento"
              rejeitarLabel="Não autorizar"
              anteriorLabel="Leonor Gomes (ou DP)"
              loading={loading}
              extraContent={fatura.observacaoMS && (
                <div style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--bg-app)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  💬 Nota anterior: {fatura.observacaoMS} ({fatura.dataObservacaoMS})
                </div>
              )}
              onAprovar={async (comentario) => {
                if (comentario) actualizarFatura({ observacaoMS: comentario, dataObservacaoMS: new Date().toLocaleDateString('pt-PT') });
                await handleAutorizarMS();
              }}
              onRejeitar={(comentario, destino) => {
                const dest = destino || 'pending-lg';
                const campos = { estado: dest, autorizadoMS: false, observacaoMS: comentario || fatura.observacaoMS, dataObservacaoMS: new Date().toLocaleDateString('pt-PT'), ...(dest === 'pending-dp' ? { validDP:'Pendente', aprovadoLG:false } : {}) };
                actualizarFatura(campos);
                const destId = dest === 'pending-dp' ? 'dp' : 'lg';
                const destLabel = dest === 'pending-dp' ? 'Diretor de Produção' : 'Leonor Gomes';
                addNotif({ tipo: 'info', icon: '↩', titulo: `Fatura devolvida por MS — aguarda ${destLabel}`, sub: `${nomeForn} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`, path: '/fornecedores', destinatario: destId, meta: { faturaId: fatura.id, fornecedorNome: nomeForn } });
                showToast(`Fatura devolvida a ${destLabel} ✓`);
              }}
            />
          )}
          {/* DEVOLVIDA PELA MS À LG — LG edita/justifica e reenvia */}
          {fatura.estado === 'pending-lg' && fatura.observacaoMS && eLG && (
            <EditarFaturaPanel
              fatura={fatura}
              titulo="↩ Fatura devolvida pelo MS — revê e reenvia"
              descricao={fatura.observacaoMS ? `Nota do MS: "${fatura.observacaoMS}"` : 'O MS devolveu esta fatura. Faz as alterações necessárias e reenvia.'}
              reenviarLabel="✓ Aprovar e reenviar ao MS"
              loading={loading}
              onReenviar={async (campos) => {
                const dataEl = document.getElementById(`previsao_ms_${fatura.id}`);
                const dataPrevisao = dataEl?.value ? new Date(dataEl.value).toLocaleDateString('pt-PT') : fatura.dataPrevisaoPagamento;
                await handleAprovarLG(dataPrevisao);
                actualizarFatura({ ...campos });
                showToast('Fatura corrigida e reenviada ao MS ✓');
              }}
            />
          )}

          {fatura.estado === 'pending-ms' && fatura.aprovadoLG && !eMS && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              🔒 Aguarda autorização de pagamento pela Direção.
              {fatura.observacaoMS && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-warning)', borderRadius: 6, color: '#7a4a0a', fontStyle: 'italic' }}>
                  💬 MS: "{fatura.observacaoMS}"
                </div>
              )}
            </div>
          )}

          {/* Observação MS visível para LG após envio */}
          {fatura.observacaoMS && fatura.estado !== 'pending-ms' && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>💬 Observação MS ({fatura.dataObservacaoMS}): </span>
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{fatura.observacaoMS}</span>
            </div>
          )}

          {/* PASSO 4 — LG efectua pagamento */}
          {fatura.estado === 'autorizado' && !fatura.comprovativoPagamento && eLG && (
            <RegistarPagamentoFornPanel
              onConfirmar={async (dataPag, compSer) => {
                const updated = actualizarFatura({ comprovativoPagamento: compSer, dataPagamento: dataPag, estado: 'pago' });
                // Mark LG payment action as done
                if (marcarFeita) marcarFeita(fatura.id, '/fornecedores');
                // Accionável para CA — Doc. 51
                addNotif({
                  tipo: 'acao_ca', icon: '🏁', accionavel: true,
                  titulo: `Actualiza Centralgest e emite Doc. 51 — ${nomeForn}`,
                  sub: `${nomeForn} · ${fatura.id} · Pagamento efectuado em ${dataPag}`,
                  path: '/fornecedores',
                  destinatario: 'ca',
                  meta: { faturaId: fatura.id, fornecedorNome: nomeForn },
                  acao: 'Emitir Doc. 51',
                });
                // Informativa para MS
                addNotif({
                  tipo: 'info', icon: '💶', accionavel: false,
                  titulo: `Pagamento efectuado — ${nomeForn}`,
                  sub: `${fatura.id} · ${fatura.obra} · ${dataPag}`,
                  path: '/fornecedores',
                  destinatario: 'ms',
                  meta: { faturaId: fatura.id, fornecedorNome: nomeForn },
                });
                showToast('Pagamento registado ✓ — Carla notificada para Doc. 51');
              }}
            />
          )}
          {fatura.estado === 'autorizado' && !fatura.comprovativoPagamento && !eLG && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', fontSize: 12, color: 'var(--color-success)', fontWeight: 500 }}>
              ✓ Pagamento autorizado — aguarda execução pela Diretora Financeira.
            </div>
          )}

          {/* Doc 51 na pasta (CA adiciona após pagamento) */}
          {fatura.comprovativoPagamento && (
            <Doc51FornPanel
              fatura={fatura}
              user={user}
              onAdicionado={async (doc51Ser) => {
                actualizarFatura({ doc51: doc51Ser, dataDoc51: new Date().toLocaleDateString('pt-PT'), concluido: true, estado: 'concluido' });
                showToast('Documento 51 adicionado — processo concluído ✓');
              }}
            />
          )}

          {/* Pago sem doc51 ainda */}
          {fatura.estado === 'pago' && !fatura.comprovativoPagamento && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', fontSize: 12, color: 'var(--color-success)', fontWeight: 500 }}>
              ✓ Pago em {fatura.dataPagamento}
            </div>
          )}
        </div>

        </div>{/* end scrollable content */}

        {/* ── PASTA DA FATURA ── */}
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📁 Pasta da fatura <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pasta.length})</span>
            </div>
            <button className="btn btn-sm" onClick={() => setShowAddDoc(true)} style={{ fontSize: 11 }}>+ Documento</button>
          </div>

          {pasta.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem documentos. Adiciona contratos, comprovativos ou outros ficheiros.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pasta.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-app)', borderRadius: 6, border: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>{doc.icon || '📄'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.tipo} · {doc.data}</div>
                  </div>
                  {doc.base64 && (
                    <button className="btn btn-sm" onClick={() => downloadPdf(doc)} style={{ fontSize: 11 }}>↓</button>
                  )}
                  <button onClick={() => {
                    const updated = pasta.filter((_, j) => j !== i);
                    setPasta(updated);
                    savePastaFatura(fatura.id, updated);
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px', flexShrink: 0 }} title="Remover">✕</button>
                </div>
              ))}
            </div>
          )}

          {showAddDoc && (
            <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-card)', borderRadius: 8, border: '0.5px solid var(--border-strong)' }}>
              <AddDocPastaForm
                onSave={async (doc) => {
                  const updated = [...pasta, doc];
                  setPasta(updated);
                  savePastaFatura(fatura.id, updated);
                  setShowAddDoc(false);
                }}
                onCancel={() => setShowAddDoc(false)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-sm btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAINEL EDITAR FATURA INLINE ─────────────────────────────────────────────
function EditarFaturaInlinePanel({ fatura, podeEditar, onSave }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nFatura: fatura.nFatura || '',
    obra: fatura.obra || '',
    valor: fatura.valor || '',
    data: fatura.data ? (fatura.data.includes('/') ? fatura.data.split('/').reverse().join('-') : fatura.data) : '',
    venc: fatura.venc ? (fatura.venc.includes('/') ? fatura.venc.split('/').reverse().join('-') : fatura.venc) : '',
    condPag: fatura.condPag || '30 dias',
    descricao: fatura.descricao || '',
    dataPrevisaoPagamento: fatura.dataPrevisaoPagamento ? (fatura.dataPrevisaoPagamento.includes('/') ? fatura.dataPrevisaoPagamento.split('/').reverse().join('-') : fatura.dataPrevisaoPagamento) : '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    let prevISO = form.dataPrevisaoPagamento;
    if (form.condPag === 'acordado' && form.venc) prevISO = form.venc;
    else if (form.condPag !== 'acordado' && form.data) prevISO = calcularDataPrevisao(form.condPag, form.data, form.venc) || prevISO;
    const campos = {
      nFatura: form.nFatura,
      obra: form.obra,
      valor: Number(form.valor) || fatura.valor,
      data: form.data ? new Date(form.data).toLocaleDateString('pt-PT') : fatura.data,
      venc: form.venc ? new Date(form.venc).toLocaleDateString('pt-PT') : fatura.venc,
      condPag: form.condPag,
      descricao: form.descricao,
      dataPrevisaoPagamento: prevISO ? fmtDataPrev(prevISO) : fatura.dataPrevisaoPagamento,
    };
    onSave(campos);
    setEditando(false);
  };

  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'6px 8px', border:'0.5px solid var(--border-strong)', borderRadius:6, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };

  if (!editando) {
    return podeEditar ? (
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
        <button className="btn btn-sm" onClick={() => setEditando(true)} style={{ fontSize:11 }}>✏ Editar dados</button>
      </div>
    ) : null;
  }

  return (
    <div style={{ marginBottom:16, padding:'14px', background:'var(--bg-app)', borderRadius:10, border:'0.5px solid var(--border)' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Editar dados da fatura</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
        <div style={{ gridColumn:'span 2' }}>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Nº Fatura</label>
          <input value={form.nFatura} onChange={e => set('nFatura', e.target.value)} style={IS} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Obra</label>
          <select value={form.obra} onChange={e => set('obra', e.target.value)} style={IS}>
            {getObrasLista().map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Valor (€)</label>
          <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} style={IS} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Data emissão</label>
          <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={IS} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Vencimento</label>
          <input type="date" value={form.venc} onChange={e => set('venc', e.target.value)} style={IS} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Condições pag.</label>
          <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={IS}>
            {['15 dias','30 dias','45 dias','60 dias','90 dias','acordado'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Previsão pagamento</label>
          <input type="date" value={form.dataPrevisaoPagamento} onChange={e => set('dataPrevisaoPagamento', e.target.value)} style={IS} />
        </div>
        <div style={{ gridColumn:'span 2' }}>
          <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>Descrição</label>
          <input value={form.descricao} onChange={e => set('descricao', e.target.value)} style={IS} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
        <button className="btn" onClick={() => setEditando(false)}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave}>Guardar alterações</button>
      </div>
    </div>
  );
}

// ─── ITEM DE DOCUMENTO NA PASTA ──────────────────────────────────────────────
function DocPastaItem({ doc, podeRemover, onRemover, onDownload }) {
  const ICONS = { fatura:'🧾', contrato:'📋', proposta:'📝', comp:'✅', relatorio:'📊', outro:'📄' };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--bg-app)', borderRadius:8, border:'0.5px solid var(--border)', marginBottom:6 }}>
      <span style={{ fontSize:16 }}>{ICONS[doc.tipo] || '📄'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:1 }}>{doc.tipoLabel || doc.tipo}</div>
        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nome || doc.name || 'Documento'}</div>
        {doc.descricao && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{doc.descricao}</div>}
      </div>
      {onDownload && <button className="btn btn-sm" onClick={onDownload} disabled={!doc.base64}>⬇ Ver</button>}
      {podeRemover && (
        <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }}
          onClick={onRemover}>✕</button>
      )}
    </div>
  );
}

function AprovarRejeitarPanel({ titulo, descricao, cor, aprovLabel, rejeitarLabel, anteriorLabel, onAprovar, onRejeitar, loading, extraContent, rejeitarDestinos }) {
  const [comentario, setComentario] = useState('');
  const [confirmRejeitar, setConfirmRejeitar] = useState(false);
  const [destinoSel, setDestinoSel] = useState(null);

  return (
    <div style={{ marginTop: 16, padding: '14px', background: cor === 'warning' ? 'var(--bg-warning)' : cor === 'info' ? 'var(--bg-info)' : 'var(--bg-app)', borderRadius: 8, border: `0.5px solid var(--color-${cor === 'warning' ? 'warning' : cor === 'info' ? 'info' : 'border'})` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: cor === 'warning' ? 'var(--color-warning)' : 'var(--color-info)', marginBottom: 4 }}>{titulo}</div>
      {descricao && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{descricao}</div>}

      {extraContent}

      {/* Comentário */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
          Comentário <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>opcional</span>
        </label>
        <textarea
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder={`Deixa uma nota${anteriorLabel ? ` para ${anteriorLabel}` : ''}...`}
          rows={2}
          style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Botões principais */}
      {!confirmRejeitar ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}
            onClick={() => onAprovar(comentario.trim())} disabled={!!loading}>
            {loading || aprovLabel || '✓ Aprovar'}
          </button>
          <button className="btn" style={{ flex: 1, fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            onClick={() => setConfirmRejeitar(true)} disabled={!!loading}>
            ✕ {rejeitarLabel || 'Não aprovar'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--color-danger)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600, marginBottom: 8 }}>
            Devolver{anteriorLabel ? ` a ${anteriorLabel}` : ''}?
            {comentario.trim() && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> Com comentário.</span>}
            {!comentario.trim() && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> Sem comentário.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1, fontSize: 12, background: 'var(--color-danger)', color: '#fff', border: 'none' }}
              onClick={() => { onRejeitar(comentario.trim()); setConfirmRejeitar(false); }} disabled={!!loading}>
              Confirmar
            </button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setConfirmRejeitar(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AprovarLGPanel({ fatura, onAprovar, onActualizarData, onDevolver, loading }) {
  const [dataPrevisao, setDataPrevisao] = useState(
    fatura.dataPrevisaoPagamento
      ? fatura.dataPrevisaoPagamento.split('/').reverse().join('-') // pt-PT → ISO
      : fatura.venc || new Date().toISOString().split('T')[0]
  );
  const [modoData, setModoData] = useState(false);

  return (
    <div style={{ marginTop: 16, padding: '14px', background: 'var(--bg-info)', borderRadius: 8, border: '0.5px solid var(--color-info)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info)', marginBottom: 4 }}>📋 Aguarda a tua decisão</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Fatura validada pelo DP em {fatura.dataValidacaoDP}. Escolhe uma das opções abaixo.
      </div>

      {/* Opção 1 — Mudar data de previsão (standby) */}
      <div style={{ marginBottom: 12, padding: '12px', background: 'var(--bg-card)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          📅 Opção 1 — Adiar pagamento
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Define uma data de previsão. A fatura fica em standby até aprovares.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={dataPrevisao}
            onChange={e => setDataPrevisao(e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button
            className="btn btn-sm"
            onClick={() => onActualizarData(new Date(dataPrevisao).toLocaleDateString('pt-PT'))}
            disabled={!!loading}
          >
            Guardar data
          </button>
        </div>
        {fatura.dataPrevisaoPagamento && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            ✓ Previsão guardada: <strong>{fatura.dataPrevisaoPagamento}</strong>
          </div>
        )}
      </div>

      {/* Opção 2 — Aprovar agora */}
      <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          ✓ Opção 2 — Aprovar para pagamento
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Aprova a fatura agora. O MS receberá notificação para autorizar o pagamento.
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => onAprovar(new Date(dataPrevisao).toLocaleDateString('pt-PT'))}
          disabled={!!loading}
        >
          {loading || '✓ Aprovar e notificar MS'}
        </button>
      </div>
    </div>
  );
}

// ─── PAINEL REGISTAR PAGAMENTO FORNECEDOR ─────────────────────────────────────
function RegistarPagamentoFornPanel({ onConfirmar }) {
  const [aberto, setAberto]     = useState(false);
  const [data, setData]         = useState(new Date().toISOString().split('T')[0]);
  const [comp, setComp]         = useState(null);
  const [loading, setLoading]   = useState(false);

  if (!aberto) return (
    <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Pagamento por registar</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Fatura validada pelo DP — podes registar o pagamento</div>
      </div>
      <button className="btn btn-sm btn-primary" onClick={() => setAberto(true)}>Registar pagamento</button>
    </div>
  );

  const handleConfirmar = async () => {
    setLoading(true);
    const compSer = comp ? await serializarFicheiro(comp) : null;
    onConfirmar(new Date(data).toLocaleDateString('pt-PT'), compSer);
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 16, padding: '14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border-strong)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Registar pagamento</div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data de pagamento</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
          Comprovativo <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1.5px dashed ${comp ? 'var(--color-success)' : 'var(--border-strong)'}`, background: comp ? 'var(--bg-success)' : 'var(--bg-card)', transition: 'all .15s' }}>
          <span style={{ fontSize: 18 }}>{comp ? '✅' : '📎'}</span>
          <div style={{ flex: 1 }}>
            {comp ? <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{comp.name}</div>
                   : <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Selecciona o comprovativo</div>}
          </div>
          {comp && <button onClick={e => { e.preventDefault(); e.stopPropagation(); setComp(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>✕</button>}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setComp(f); e.target.value = ''; }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" onClick={() => { setAberto(false); setComp(null); }}>Cancelar</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={loading} onClick={handleConfirmar}>
          {loading ? 'A guardar...' : '✓ Confirmar pagamento'}
        </button>
      </div>
    </div>
  );
}

// ─── MODAL DETALHE FORNECEDOR ─────────────────────────────────────────────────
// ─── FORMULÁRIO MINI PARA ADICIONAR DOC À PASTA DA FATURA ───────────────────
const TIPOS_PASTA = [
  { value: 'fatura',      label: 'Fatura',             icon: '🧾' },
  { value: 'contrato',    label: 'Contrato',           icon: '📋' },
  { value: 'proposta',    label: 'Proposta/Orçamento', icon: '📝' },
  { value: 'comprovativo',label: 'Comprovativo',       icon: '✅' },
  { value: 'outro',       label: 'Outro',              icon: '📄' },
];
function AddDocPastaForm({ onSave, onCancel }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('outro');
  const [ficheiro, setFicheiro] = useState(null);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!nome.trim()) { setErr('Nome obrigatório'); return; }
    const t = TIPOS_PASTA.find(x => x.value === tipo);
    let base64 = null;
    if (ficheiro) base64 = await fileToBase64(ficheiro);
    onSave({
      nome: nome.trim(), tipo: t?.label || tipo, icon: t?.icon || '📄',
      data: new Date().toLocaleDateString('pt-PT'),
      ficheiro: ficheiro ? { name: ficheiro.name, type: ficheiro.type } : null,
      base64,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)}
          style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
          {TIPOS_PASTA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <input value={nome} onChange={e => { setNome(e.target.value); setErr(''); }} placeholder="Nome do documento"
          style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', border: `0.5px solid ${err ? 'var(--color-danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', border: `1.5px dashed ${ficheiro ? 'var(--color-success)' : 'var(--border-strong)'}`, background: ficheiro ? 'var(--bg-success)' : 'var(--bg-app)' }}>
        <span>{ficheiro ? '✅' : '📎'}</span>
        <span style={{ fontSize: 12, color: ficheiro ? 'var(--color-success)' : 'var(--text-muted)', flex: 1 }}>{ficheiro ? ficheiro.name : 'Anexar ficheiro (opcional)'}</span>
        {ficheiro && <button onClick={e => { e.preventDefault(); e.stopPropagation(); setFicheiro(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>✕</button>}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setFicheiro(f); e.target.value = ''; }} />
      </label>
      {err && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" style={{ fontSize: 12 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSave}>+ Adicionar</button>
      </div>
    </div>
  );
}

export function FornecedorModal({ f, onClose, onDelete, abrirFaturaId }) {
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [tab, setTab]               = useState('faturas');
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showRegistar, setShowRegistar] = useState(false);
  const [faturas, setFaturas]       = useState(() => loadFaturasForn(f.id, f.faturas));
  const [documentos, setDocumentos] = useState(() => loadDocumentos(f.id));
  const [faturaAberta, setFaturaAberta] = useState(null);
  const [toast, setToast]           = useState('');

  useEffect(() => {
    if (!abrirFaturaId) return;
    const fat = faturas.find(x => x.id === abrirFaturaId);
    if (fat) setFaturaAberta(fat);
  }, [abrirFaturaId, faturas]);

  // Sincronização em tempo real — quando Tesouraria actualiza sis_faturas_forn, recarrega aqui
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== FAT_KEY_FORN) return;
      const novasFaturas = loadFaturasForn(f.id, f.faturas);
      setFaturas(novasFaturas);
      // Se há fatura aberta, actualiza-a também
      setFaturaAberta(prev => {
        if (!prev) return prev;
        return novasFaturas.find(x => x.id === prev.id) || prev;
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [f.id]); // eslint-disable-line

  const pago    = faturas.filter(x => x.estado === 'pago').reduce((s, x) => s + x.valor, 0);
  const pendente = faturas.filter(x => x.estado !== 'pago').reduce((s, x) => s + x.valor, 0);

  const handleFaturaUpdate = (faturaActualizada) => {
    const updated = faturas.map(x => x.id === faturaActualizada.id ? faturaActualizada : x);
    setFaturas(updated);
    saveFaturasForn(f.id, updated);
  };

  const handleRegistar = async (dados) => {
    const nova = {
      id: `F-SIS-${Date.now()}`,
      nFatura: dados.nFatura,
      obra: dados.obra, valor: dados.valor,
      data: new Date(dados.data).toLocaleDateString('pt-PT'),
      venc: dados.venc ? new Date(dados.venc).toLocaleDateString('pt-PT') : '—',
      condPag: dados.condPag,
      estado: 'pending-dp',
      validDP: 'Pendente',
      descricao: dados.descricao,
      pdf: dados.pdf,
      dataPrevisaoPagamento: dados.dataPrevisaoPagamento || null,
      registadoPor: user?.nome || 'SIS',
      dataRegisto: new Date().toLocaleDateString('pt-PT'),
    };
    const updated = [nova, ...faturas];
    setFaturas(updated);
    saveFaturasForn(f.id, updated);
    setShowRegistar(false);

    // Notificação SIS para DP
    addNotif({
      tipo: 'confirmar_emissao',
      icon: '📋',
      titulo: `Nova fatura para validação — ${f.nome}`,
      sub: `${f.nome} · ${nova.id} · ${nova.obra} · Registada por ${user?.nome}`,
      path: '/fornecedores',
      destinatario: 'dp',
      meta: { faturaId: nova.id, fornecedorNome: f.nome },
    });

    setToast('A notificar o Diretor de Produção...');
    setToast('Fatura registada ✓ — DP notificado');
    setTimeout(() => setToast(''), 5000);
  };

  const handleAddDoc = (doc, isFatura) => {
    if (isFatura) {
      const nova = { id: doc.id, obra: doc.obra, valor: doc.valor, data: doc.data, venc: doc.venc, condPag: doc.condPag, estado: doc.estado, validDP: doc.validDP, descricao: doc.descricao, pdf: doc.ficheiro };
      const updated = [nova, ...faturas];
      setFaturas(updated);
      saveFaturasForn(f.id, updated);
    } else {
      const updated = [doc, ...documentos];
      setDocumentos(updated);
      saveDocumentos(f.id, updated);
    }
    setShowAddDoc(false);
    setToast('Documento adicionado');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <>
      {showRegistar && <RegistarFaturaModal fornecedor={f} onClose={() => setShowRegistar(false)} onRegistar={handleRegistar} />}
      {showAddDoc && <AdicionarDocumentoModal entidade={f} tipoEntidade="fornecedor" onClose={() => setShowAddDoc(false)} onSave={handleAddDoc} />}
      {faturaAberta && <FaturaFornDetalheModal fatura={faturaAberta} fornecedor={f} onClose={() => setFaturaAberta(null)} onUpdate={handleFaturaUpdate} />}

      <div onClick={undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', position: 'relative' }}>
          {toast && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-success)', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, whiteSpace: 'nowrap' }}>{toast}</div>
          )}

          {/* Header */}
          <div style={{ padding: '18px 22px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{f.nome.charAt(0)}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{f.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.categoria} · NIF {f.nif}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${ESTADO_CONFIG[f.estado]?.cls}`}>{ESTADO_CONFIG[f.estado]?.label}</span>
              <button className="btn btn-sm" onClick={() => setShowAddDoc(true)}>+ Documento</button>
              <button className="btn btn-sm btn-primary" onClick={() => setShowRegistar(true)}>+ Registar fatura</button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--border)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            {[
              { label: 'Total faturas', value: faturas.length },
              { label: 'Total pago',    value: fmt(pago),     color: 'var(--color-success)' },
              { label: 'Pendente',      value: fmt(pendente), color: pendente > 0 ? 'var(--color-warning)' : undefined },
              { label: 'Obras',         value: f.obras.length > 0 ? f.obras.join(', ') : '—' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-app)', padding: '10px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: k.color || 'var(--text-primary)' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 22px' }}>
            {[
              { key: 'faturas',    label: `Faturas (${faturas.length})` },
              { key: 'documentos', label: `Documentos (${documentos.length})` },
              { key: 'info',       label: 'Informações' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 16px', border: 'none', background: 'none', color: tab === t.key ? 'var(--brand-primary)' : 'var(--text-muted)', borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent', marginBottom: -1, cursor: 'pointer', transition: 'all .15s' }}>{t.label}</button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'faturas' && (
              faturas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sem faturas. <span style={{ color: 'var(--brand-primary)', cursor: 'pointer' }} onClick={() => setShowRegistar(true)}>Registar agora?</span>
                </div>
              ) : (
                <table className="sis-table">
                  <thead>
                    <tr><th>Nº Fatura</th><th>Descrição</th><th>Obra</th><th style={{ textAlign: 'right' }}>Valor</th><th>Data</th><th>Valid. DP</th><th>Estado</th><th>Docs</th></tr>
                  </thead>
                  <tbody>
                    {faturas.map(fat => (
                      <tr key={fat.id} onClick={() => setFaturaAberta(fat)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-primary)', fontWeight: 500 }}>{fat.id}</td>
                        <td style={{ fontSize: 13, maxWidth: 160 }}>{fat.descricao}</td>
                        <td><span className="badge badge-n">{fat.obra}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fat.valor)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fat.data}</td>
                        <td>
                          {fat.validDP && <span className={`badge ${fat.validDP === 'Validada' ? 'badge-s' : fat.validDP === 'Atrasada' ? 'badge-d' : 'badge-w'}`}>{fat.validDP}</span>}
                        </td>
                        <td><span className={`badge ${FATURA_CONFIG_FORN[fat.estado]?.cls || 'badge-n'}`}>{FATURA_CONFIG_FORN[fat.estado]?.label}</span></td>
                        <td style={{ fontSize: 15 }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {fat.pdf && <span title="Fatura">📄</span>}
                            {fat.comprovativoPagamento && <span title="Comprovativo">✅</span>}
                            {!fat.pdf && !fat.comprovativoPagamento && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {tab === 'documentos' && (
              documentos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sem documentos. <span style={{ color: 'var(--brand-primary)', cursor: 'pointer' }} onClick={() => setShowAddDoc(true)}>Adicionar agora?</span>
                </div>
              ) : (
                <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documentos.map(doc => {
                    const tipoInfo = TIPOS_DOC.find(t => t.value === doc.tipo) || { icon: '📄', label: 'Documento' };
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 20 }}>{tipoInfo.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.descricao}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tipoInfo.label} · {doc.data}{doc.ficheiro && ` · 📎 ${doc.ficheiro.name}`}</div>
                        </div>
                        <button className="btn btn-sm">Ver</button>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === 'info' && (
              <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                {[
                  { label: 'Razão social', value: f.nome }, { label: 'NIF', value: f.nif },
                  { label: 'Categoria', value: f.categoria }, { label: 'Contacto', value: f.contacto },
                  { label: 'Email', value: f.email }, { label: 'Telefone', value: f.telefone },
                  { label: 'Morada', value: f.morada }, { label: 'Obras', value: f.obras.join(', ') || '—' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 22px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {f._userCreated ? <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => onDelete && onDelete(f.id)}>Remover fornecedor</button> : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── MODAL NOVO FORNECEDOR ────────────────────────────────────────────────────
const CAMPOS = [
  { key: 'nome', label: 'Razão social', required: true, half: false },
  { key: 'nif', label: 'NIF', required: true, half: true },
  { key: 'categoria', label: 'Categoria', required: true, half: true, type: 'select' },
  { key: 'contacto', label: 'Contacto', required: false, half: true },
  { key: 'email', label: 'Email', required: false, half: true },
  { key: 'telefone', label: 'Telefone', required: false, half: true },
  { key: 'morada', label: 'Morada', required: false, half: false },
];

// ─── NOVA FATURA GLOBAL (com selector de fornecedor) ─────────────────────────
function NovaFaturaGlobalModal({ fornecedores, onClose, onRegistar, addNotif }) {
  const [fornId, setFornId] = useState('');
  const [form, setForm] = useState({
    nFatura: '', obra: '', valor: '', descricao: '',
    data: new Date().toISOString().split('T')[0],
    venc: '', condPag: '30 dias', pdf: null,
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!fornId) e.forn = 'Selecciona um fornecedor';
    if (!form.obra) e.obra = 'Selecciona uma obra';
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido';
    if (!form.descricao.trim()) e.descricao = 'Campo obrigatório';
    return e;
  };

  const handleRegistar = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const pdfSer = form.pdf ? await serializarFicheiro(form.pdf) : null;
    const dataPrevisaoISO = calcularDataPrevisao(form.condPag, form.data, form.venc);
    onRegistar(fornId, { ...form, valor: Number(form.valor), pdf: pdfSer, dataPrevisaoPagamento: dataPrevisaoISO ? fmtDataPrev(dataPrevisaoISO) : null });
  };

  const fornSel = fornecedores.find(f => f.id === fornId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Nova fatura</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>O DP receberá notificação para validar</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Selector de fornecedor */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
              Fornecedor <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select value={fornId} onChange={e => { setFornId(e.target.value); setErrors(er => ({ ...er, forn: '' })); }}
              style={{ ...inp(errors.forn), width: '100%' }}>
              <option value="">Selecciona o fornecedor...</option>
              {[...fornecedores].sort((a,b) => a.nome.localeCompare(b.nome)).map(f => (
                <option key={f.id} value={f.id}>{f.nome} — {f.categoria}</option>
              ))}
            </select>
            {errors.forn && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.forn}</div>}
          </div>

          {/* Formulário (igual ao RegistarFaturaModal) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Nº Fatura do fornecedor</label>
              <input value={form.nFatura} onChange={e => set('nFatura', e.target.value)} placeholder="ex: 2024/0891" style={inp(false)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Obra <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <select value={form.obra} onChange={e => set('obra', e.target.value)} style={inp(errors.obra)}>
                <option value="">Selecciona...</option>
                {getObrasLista().map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.obra && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.obra}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Valor (€) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="ex: 12400" style={inp(errors.valor)} />
              {errors.valor && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.valor}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data da fatura</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inp(false)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data de vencimento</label>
              <input type="date" value={form.venc} onChange={e => set('venc', e.target.value)} style={inp(false)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Condições de pagamento</label>
              <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={inp(false)}>
                {['15 dias','30 dias','45 dias','60 dias','90 dias','acordado'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Descrição <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="ex: Fornecimento de perfis HEA — Fase Estrutura" style={inp(errors.descricao)} />
              {errors.descricao && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.descricao}</div>}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Fatura PDF <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1.5px dashed ${form.pdf ? 'var(--color-success)' : 'var(--border-strong)'}`, background: form.pdf ? 'var(--bg-success)' : 'var(--bg-app)', transition: 'all .15s' }}>
                <span style={{ fontSize: 20 }}>{form.pdf ? '✅' : '📎'}</span>
                <div style={{ flex: 1 }}>
                  {form.pdf ? <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{form.pdf.name}</div>
                    : <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Anexa a fatura do fornecedor</div>}
                </div>
                {form.pdf && <button onClick={e => { e.preventDefault(); e.stopPropagation(); set('pdf', null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px' }}>✕</button>}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) set('pdf', f); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleRegistar}>📥 Registar fatura</button>
        </div>
      </div>
    </div>
  );
}

function NovoFornecedorModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nome:'', nif:'', categoria:'', contacto:'', email:'', telefone:'', morada:'' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Campo obrigatório';
    if (!form.nif.trim()) e.nif = 'Campo obrigatório';
    else if (!/^\d{9}$/.test(form.nif.replace(/[\s\-]/g, ''))) e.nif = 'NIF inválido';
    if (!form.categoria) e.categoria = 'Selecciona uma categoria';
    return e;
  };
  const handleSave = () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } onSave(form); };

  return (
    <div onClick={undefined} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><div style={{ fontWeight:600, fontSize:15 }}>Novo fornecedor</div><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>* campos obrigatórios</div></div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)', padding:'4px 8px' }}>✕</button>
        </div>
        <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 16px' }}>
          {CAMPOS.map(c => (
            <div key={c.key} style={{ gridColumn: c.half ? 'span 1' : 'span 2' }}>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>
                {c.label}{c.required && <span style={{ color:'var(--color-danger)', marginLeft:3 }}>*</span>}
              </label>
              {c.type === 'select' ? (
                <select value={form[c.key]} onChange={e => set(c.key, e.target.value)} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:`0.5px solid ${errors[c.key] ? 'var(--color-danger)' : 'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
                  <option value="">Selecciona...</option>
                  {CATS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              ) : (
                <input value={form[c.key]} onChange={e => set(c.key, e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:`0.5px solid ${errors[c.key] ? 'var(--color-danger)' : 'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
              )}
              {errors[c.key] && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors[c.key]}</div>}
            </div>
          ))}
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar fornecedor</button>
        </div>
      </div>
    </div>
  );
}

// ─── GALERIA ──────────────────────────────────────────────────────────────────
export default function FornecedoresPage() {
  const location = useLocation();
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [search, setSearch]       = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [extras, setExtras]       = useState(loadExtras);
  const [showNovo, setShowNovo]   = useState(false);
  const [showNovaFatura, setShowNovaFatura] = useState(false);
  const [vistaForn, setVistaForn] = useState('galeria'); // 'galeria' | 'tabela'
  const [selected, setSelected]   = useState(null);
  const [abrirFaturaId, setAbrirFaturaId] = useState(null);
  const [toast, setToast]         = useState('');
  const canEditFornecedores = canEditModule(user, 'fornecedores');

  const allForn = mergeFornecedoresData(extras);

  // Ao chegar via notificação, abre automaticamente o fornecedor e a fatura certos
  useEffect(() => {
    const fornecedorId = location.state?.abrirFornecedor;
    const meta = location.state?.abrirFaturaForn;
    if (fornecedorId) {
      const forn = allForn.find(f => f.id === fornecedorId);
      if (forn) {
        setSelected(forn);
        setAbrirFaturaId(null);
      }
      window.history.replaceState({}, '');
      return;
    }
    if (!meta?.faturaId) return;
    const forn = allForn.find(f => f.id === meta.fornecedorId) || allForn.find(f => f.nome === meta.fornecedorNome);
    if (forn) {
      setSelected(forn);
      setAbrirFaturaId(meta.faturaId);
    }
    window.history.replaceState({}, '');
  }, [location.state]);

  const handleSave = (form) => {
    if (!canEditFornecedores) return;
    const novo = { id: 'u_' + Date.now(), nome: form.nome, nif: form.nif, categoria: form.categoria, contacto: form.contacto || '—', email: form.email || '—', telefone: form.telefone || '—', morada: form.morada || '—', obras: [], totalFaturas: 0, totalPago: 0, pendente: 0, estado: 'ativo', faturas: [], _userCreated: true };
    const updated = [...extras, novo];
    setExtras(updated); saveExtras(updated);
    setShowNovo(false);
    setToast(`"${novo.nome}" adicionado`);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = (id) => {
    if (!canEditFornecedores) return;
    if (!window.confirm('Remover este fornecedor?')) return;
    const updated = extras.filter(f => f.id !== id);
    setExtras(updated); saveExtras(updated);
    setSelected(null);
  };

  const filtered = allForn.filter(f => {
    const s = search.toLowerCase();
    return (f.nome.toLowerCase().includes(s) || f.categoria.toLowerCase().includes(s) || f.nif.includes(search)) && (categoria === 'Todas' || f.categoria === categoria);
  });

  const totalPendente = allForn.reduce((s, f) => s + f.pendente, 0);
  const totalFaturas  = allForn.reduce((s, f) => s + f.totalFaturas, 0);
  const comPendente   = allForn.filter(f => f.pendente > 0).length;

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:600, background:'var(--color-success)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:500, boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>{toast}</div>}
      {showNovo && canEditFornecedores && <NovoFornecedorModal onClose={() => setShowNovo(false)} onSave={handleSave} />}
      {showNovaFatura && canEditFornecedores && (
        <NovaFaturaGlobalModal
          fornecedores={allForn}
          addNotif={addNotif}
          onClose={() => setShowNovaFatura(false)}
          onRegistar={async (fornId, fatData) => {
            const forn = allForn.find(f => f.id === fornId);
            if (!forn) return;
            const all = JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
            const faturas = all[fornId] || forn.faturas || [];
            const nova = {
              id: fatData.nFatura || `F-${Date.now()}`,
              nFatura: fatData.nFatura || '',
              obra: fatData.obra, valor: fatData.valor,
              data: new Date(fatData.data).toLocaleDateString('pt-PT'),
              venc: fatData.venc ? new Date(fatData.venc).toLocaleDateString('pt-PT') : '',
              condPag: fatData.condPag, descricao: fatData.descricao,
              estado: 'pending-dp', validDP: 'Pendente',
              dataPrevisaoPagamento: fatData.dataPrevisaoPagamento || null,
              fluxoVal: 'pendente_dp', pdf: fatData.pdf,
            };
            all[fornId] = [...faturas, nova];
            localStorage.setItem(FAT_KEY_FORN, JSON.stringify(all));
            // Notif SIS → DP
            addNotif({ tipo: 'confirmar_emissao', icon: '📋', titulo: `Nova fatura — aguarda validação`,
              sub: `${forn.nome} · ${nova.id} · ${nova.obra}`, path: '/fornecedores',
              destinatario: 'dp', meta: { faturaId: nova.id, fornecedorNome: forn.nome } });
            setShowNovaFatura(false);
            setSelected(forn);
          }}
        />
      )}
      {selected && <FornecedorModal f={selected} abrirFaturaId={abrirFaturaId} onClose={() => { setSelected(null); setAbrirFaturaId(null); }} onDelete={handleDelete} />}

      <div className="page-header">
        <div><div className="page-title">Fornecedores</div><div className="page-subtitle">{allForn.length} fornecedores · Gestão de faturas e pagamentos</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <button onClick={() => setVistaForn('galeria')} style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 14, background: vistaForn === 'galeria' ? 'var(--brand-primary)' : 'transparent', color: vistaForn === 'galeria' ? '#fff' : 'var(--text-muted)' }} title="Vista galeria">⊞</button>
            <button onClick={() => setVistaForn('tabela')} style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 14, background: vistaForn === 'tabela' ? 'var(--brand-primary)' : 'transparent', color: vistaForn === 'tabela' ? '#fff' : 'var(--text-muted)' }} title="Vista tabela">☰</button>
          </div>
          {canEditFornecedores && <button className="btn" onClick={() => setShowNovaFatura(true)}>📥 Nova fatura</button>}
          {canEditFornecedores && <button className="btn btn-primary" onClick={() => setShowNovo(true)}>+ Novo fornecedor</button>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
        <div className="kpi-card"><div className="kpi-label">Total fornecedores</div><div className="kpi-value">{allForn.length}</div><div className="kpi-delta up">{comPendente} com pendentes</div></div>
        <div className="kpi-card"><div className="kpi-label">Total em aberto</div><div className="kpi-value" style={{ color:'var(--color-warning)' }}>{fmt(totalPendente)}</div><div className="kpi-delta dn">Aguarda pagamento</div></div>
        <div className="kpi-card"><div className="kpi-label">Faturas registadas</div><div className="kpi-value">{totalFaturas}</div><div className="kpi-delta up">Todas as obras</div></div>
        <div className="kpi-card"><div className="kpi-label">Pendentes valid. DP</div><div className="kpi-value" style={{ color:'var(--color-danger)' }}>1</div><div className="kpi-delta dn">Construções RJ · +5 dias</div></div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input className="sis-input" placeholder="Pesquisar por nome, categoria ou NIF..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:300 }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setCategoria(c)} style={{ fontFamily:'var(--font-body)', fontSize:12, padding:'5px 12px', borderRadius:20, border:'0.5px solid', borderColor: categoria === c ? 'var(--brand-primary)' : 'var(--border)', background: categoria === c ? 'var(--brand-primary)' : 'var(--bg-card)', color: categoria === c ? '#fff' : 'var(--text-secondary)', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
          Nenhum fornecedor encontrado. {canEditFornecedores && <span style={{ color:'var(--brand-primary)', cursor:'pointer' }} onClick={() => setShowNovo(true)}>Adicionar novo?</span>}
        </div>
      ) : vistaForn === 'galeria' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:12 }}>
          {filtered.map(f => {
            const est = ESTADO_CONFIG[f.estado] || ESTADO_CONFIG['ativo'];
            return (
              <div key={f.id} className="card" onClick={() => setSelected(f)} style={{ cursor:'pointer', transition:'border-color .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand-primary)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(28,58,94,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.boxShadow=''; }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'var(--bg-app)', border:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--brand-primary)', flexShrink:0 }}>{f.nome.charAt(0)}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:14 }}>{f.nome}</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>{f.categoria}</div></div>
                  <span className={`badge ${est.cls}`} style={{ flexShrink:0 }}>{est.label}</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-muted)', marginBottom:10, flexWrap:'wrap' }}>
                  <span>NIF {f.nif}</span><span>·</span><span>{f.obras.length} obra{f.obras.length !== 1 ? 's' : ''}</span><span>·</span><span>{f.totalFaturas} faturas</span>
                </div>
                {f.obras.length > 0 && <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>{f.obras.map(o => <span key={o} className="badge badge-n">{o}</span>)}</div>}
                <div style={{ height:'0.5px', background:'var(--border)', margin:'10px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                  <div><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Total pago</div><div style={{ fontSize:15, fontWeight:600 }}>{fmt(f.totalPago)}</div></div>
                  {f.pendente > 0 ? <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Pendente</div><div style={{ fontSize:15, fontWeight:600, color:'var(--color-warning)' }}>{fmt(f.pendente)}</div></div>
                    : <span className="badge badge-s">Sem pendentes</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista tabela */
        <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
                {['Fornecedor','Categoria','NIF','Obras','Faturas','Total pago','Pendente','Estado'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const est = ESTADO_CONFIG[f.estado] || ESTADO_CONFIG['ativo'];
                return (
                  <tr key={f.id} onClick={() => setSelected(f)} style={{ cursor:'pointer', borderBottom:'0.5px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-app)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:7, background:'var(--bg-app)', border:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--brand-primary)', flexShrink:0 }}>{f.nome.charAt(0)}</div>
                        {f.nome}
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px', color:'var(--text-muted)' }}>{f.categoria}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:12 }}>{f.nif}</td>
                    <td style={{ padding:'10px 14px' }}>{f.obras.map(o => <span key={o} className="badge badge-n" style={{ marginRight:4 }}>{o}</span>)}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>{f.totalFaturas}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, textAlign:'right' }}>{fmt(f.totalPago)}</td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: f.pendente > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>{f.pendente > 0 ? fmt(f.pendente) : '—'}</td>
                    <td style={{ padding:'10px 14px' }}><span className={`badge ${est.cls}`}>{est.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
