import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useNotifications, notifDraftEmitido, notifDraftAprovado, notifFaturaEmitida, notifConfirmarEmissao, notifPagamentoEfectuado } from '../context/NotificationsContext';
import EntityAccessEditorModal from '../components/access/EntityAccessEditorModal.jsx';
import AdicionarDocumentoModal, { loadDocumentos, saveDocumentos, TIPOS_DOC } from '../components/shared/AdicionarDocumentoModal';
import NotifPanel from '../components/shared/NotifPanel';
import { canEditModule, canViewEntity, getModuleLevel } from '../context/PermissionsConfig';
import { withDemoSeed } from '../utils/deliveryMode';

const fmt = v => '€ ' + Number(v).toLocaleString('pt-PT');

// ─── FILE HELPERS ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:application/pdf;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadPdf(pdf) {
  if (!pdf?.base64) return;
  const a = document.createElement('a');
  a.href = pdf.base64;
  a.download = pdf.name || 'documento.pdf';
  a.click();
}

// Guarda um File como { name, size, base64 }
async function serializarFicheiro(file) {
  if (!file) return null;
  try {
    const base64 = await fileToBase64(file);
    return { name: file.name, size: file.size, base64 };
  } catch {
    return { name: file.name, size: file.size, base64: null };
  }
}


function getPerfisLista() {
  try {
    const saved = JSON.parse(localStorage.getItem('sis_perfis') || '[]');
    if (saved.length > 0) return saved;
  } catch {}
  return [
    { nome: 'Miguel Seabra', email: 'ms@novanor.pt',  initials: 'MS' },
    { nome: 'Leonor',         email: 'lg@novanor.pt',  initials: 'LG' },
    { nome: 'Carla',          email: 'ca@novanor.pt',  initials: 'CA' },
    { nome: 'Controller',     email: 'cg@novanor.pt',  initials: 'CG' },
    { nome: 'Dir. Produção',  email: 'dp@novanor.pt',  initials: 'DP' },
    { nome: 'Dir. Comercial', email: 'dc@novanor.pt',  initials: 'DC' },
  ];
}

const STORAGE_KEY = 'sis_clientes_extra';
function loadExtras() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveExtras(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

const FAT_KEY = 'sis_faturas_cli';
function loadFaturas(clienteId, defaultFaturas) {
  try {
    const all = JSON.parse(localStorage.getItem(FAT_KEY) || '{}');
    return all[clienteId] ?? defaultFaturas;
  } catch { return defaultFaturas; }
}
function saveFaturas(clienteId, faturas) {
  try {
    const all = JSON.parse(localStorage.getItem(FAT_KEY) || '{}');
    all[clienteId] = faturas;
    localStorage.setItem(FAT_KEY, JSON.stringify(all));
  } catch {}
}

export const CLIENTES_DATA = withDemoSeed([
  {
    id: 'c001', nome: 'Logicor Portugal SA', nif: '508 999 001',
    categoria: 'Logística e armazenagem', contacto: 'Paulo Rodrigues',
    email: 'prodrigues@logicor.pt', telefone: '+351 21 100 2000',
    morada: 'Av. Logística 1, Setúbal', obras: ['O142'],
    totalFaturas: 4, totalRecebido: 420000, pendente: 280000, estado: 'ativo',
    faturas: [
      { id: 'FT-2026-0045', obra: 'O142', valor: 280000, data: '02 Jan 2026', venc: '01 Fev', condPag: '30 dias', estado: 'vencida',  descricao: 'Medição nº1 — Fundações e estrutura', pdf: null },
      { id: 'FT-2025-0210', obra: 'O142', valor: 140000, data: '01 Out 2025', venc: '31 Out', condPag: '30 dias', estado: 'recebido', descricao: 'Adiantamento obra — 5%', pdf: null },
    ],
  },
  {
    id: 'c002', nome: 'Grupo LIDL Portugal', nif: '509 888 002',
    categoria: 'Retalho alimentar', contacto: 'Sara Moreira',
    email: 'smoreira@lidl.pt', telefone: '+351 21 200 3000',
    morada: 'Rua do Comércio 45, Lisboa', obras: ['O142'],
    totalFaturas: 3, totalRecebido: 132000, pendente: 132000, estado: 'ativo',
    faturas: [
      { id: 'FT-2026-0058', obra: 'O142', valor: 132000, data: '10 Jan 2026', venc: '10 Fev', condPag: '30 dias', estado: 'parcial', descricao: 'Medição nº2 — Instalações elétricas', pdf: null },
    ],
  },
  {
    id: 'c003', nome: 'Câmara Municipal Setúbal', nif: '510 777 003',
    categoria: 'Administração pública', contacto: 'Dr. Henrique Lopes',
    email: 'hlopes@cm-setubal.pt', telefone: '+351 265 100 000',
    morada: 'Praça do Bocage, Setúbal', obras: ['O143'],
    totalFaturas: 2, totalRecebido: 0, pendente: 67500, estado: 'ativo',
    faturas: [
      { id: 'FT-2026-0061', obra: 'O143', valor: 67500, data: '15 Jan 2026', venc: '28 Fev', condPag: '45 dias', estado: 'pendente', descricao: 'Medição nº1 — Fundações', pdf: null },
    ],
  },
  {
    id: 'c004', nome: 'Construtora LD Lda', nif: '511 666 004',
    categoria: 'Construção civil', contacto: 'Luís Duarte',
    email: 'lduarte@construtorald.pt', telefone: '+351 21 300 4000',
    morada: 'Zona Industrial, Almada', obras: ['O145'],
    totalFaturas: 1, totalRecebido: 94000, pendente: 0, estado: 'ativo',
    faturas: [
      { id: 'FT-2026-0072', obra: 'O145', valor: 94000, data: '01 Fev 2026', venc: '03 Mar', condPag: '30 dias', estado: 'recebido', descricao: 'Adiantamento — Início de obra', pdf: null },
    ],
  },
  {
    id: 'c005', nome: 'Promotor ABC Lda', nif: '512 555 005',
    categoria: 'Promoção imobiliária', contacto: 'Ana Bettencourt',
    email: 'abettencourt@abc.pt', telefone: '+351 21 400 5000',
    morada: 'Rua Nova 12, Lisboa', obras: ['O138'],
    totalFaturas: 3, totalRecebido: 720000, pendente: 210000, estado: 'ativo',
    faturas: [
      { id: 'FT-2026-0081', obra: 'O138', valor: 210000, data: '15 Fev 2026', venc: '17 Mar', condPag: '30 dias', estado: 'pendente', descricao: 'Medição nº5 — Acabamentos', pdf: null },
      { id: 'FT-2025-0190', obra: 'O138', valor: 360000, data: '01 Set 2025', venc: '01 Out', condPag: '30 dias', estado: 'recebido', descricao: 'Medições 1–3 consolidadas', pdf: null },
      { id: 'FT-2025-0240', obra: 'O138', valor: 360000, data: '01 Dez 2025', venc: '01 Jan', condPag: '30 dias', estado: 'recebido', descricao: 'Medição nº4', pdf: null },
    ],
  },
]);

const CATEGORIAS_CLI = ['Todas','Logística e armazenagem','Retalho alimentar','Administração pública','Construção civil','Promoção imobiliária','Indústria','Outro'];
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

function mergeClientesData(extras = []) {
  const extrasById = new Map((extras || []).map((cliente) => [cliente.id, cliente]));
  const obrasExtra = (() => {
    try { return JSON.parse(localStorage.getItem('sis_obras_extra') || '[]'); }
    catch { return []; }
  })();

  const enrichCliente = (clienteBase, extra = null) => {
    const merged = extra ? { ...clienteBase, ...extra } : { ...clienteBase };
    const obrasPorNome = obrasExtra
      .filter((obra) => (obra?.cliente || '').trim().toLowerCase() === (merged.nome || '').trim().toLowerCase())
      .map((obra) => obra.id);
    const faturas = loadFaturas(merged.id, merged.faturas || []);
    return {
      ...merged,
      obras: uniqueObras([...(clienteBase.obras || []), ...(extra?.obras || []), ...obrasPorNome, ...faturas.map((fatura) => fatura?.obra)]),
    };
  };

  const baseIds = new Set(CLIENTES_DATA.map((cliente) => cliente.id));
  const mergedBase = CLIENTES_DATA.map((cliente) => enrichCliente(cliente, extrasById.get(cliente.id)));
  const extrasOnly = (extras || [])
    .filter((cliente) => !baseIds.has(cliente.id))
    .map((cliente) => enrichCliente(cliente));

  return [...mergedBase, ...extrasOnly];
}

const ESTADO_CONFIG = {
  'ativo':   { label: 'Ativo',   cls: 'badge-s' },
  'inativo': { label: 'Inativo', cls: 'badge-n' },
};
export const FATURA_CONFIG_CLI = {
  'recebido':    { label: 'Recebido',         cls: 'badge-s' },
  'parcial':     { label: 'Parcial',           cls: 'badge-w' },
  'pendente':    { label: 'Pendente',          cls: 'badge-i' },
  'vencida':     { label: 'Vencida',           cls: 'badge-d' },
  'draft':       { label: 'Draft',             cls: 'badge-n' },
  'aprovado':    { label: 'Aprovado',          cls: 'badge-s' },
  'emitida':     { label: 'Emitida',           cls: 'badge-i' },
  'enviada':     { label: 'Enviada ao cliente',cls: 'badge-i' },
  'pendente_req':{ label: 'Aguarda Req.',      cls: 'badge-w' },
  'pendente_lg': { label: 'Aguarda LG',        cls: 'badge-w' },
  'pendente_ms': { label: 'Aguarda MS',        cls: 'badge-w' },
  'concluido':   { label: '🏁 Concluído',      cls: 'badge-s' },
};

const inp = err => ({
  width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
  padding: '7px 10px',
  border: `0.5px solid ${err ? 'var(--color-danger)' : 'var(--border-strong)'}`,
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
});

// ─── PAINEL DOCUMENTO 51 ─────────────────────────────────────────────────────
function Doc51Panel({ fatura, user, onAdicionado }) {
  const [uploading, setUploading] = useState(false);

  // Já tem doc51 — mostra concluído
  if (fatura.doc51) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🏁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, marginBottom: 1 }}>Processo concluído — {fatura.dataDoc51}</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{fatura.doc51.name}</div>
        </div>
        <button className="btn btn-sm" onClick={() => downloadPdf(fatura.doc51)} disabled={!fatura.doc51?.base64}>Descarregar</button>
      </div>
    );
  }

  // Só CA pode adicionar o doc51
  const lista = getPerfisLista();
  const perfilUser = lista.find(p => p.id === user?.id);
  const eCA = user?.id === 'ca' || user?.isAdmin || perfilUser?.acoes?.includes('emitir_fatura_cli');
  if (!eCA) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '1.5px dashed var(--border-strong)', marginBottom: 8 }}>
        <span style={{ fontSize: 18, opacity: 0.4 }}>🏁</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aguarda Documento 51 da área financeira</span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        border: '1.5px dashed var(--brand-primary)',
        background: 'var(--bg-info)', transition: 'all .15s',
      }}>
        <span style={{ fontSize: 18 }}>🏁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)' }}>
            {uploading ? 'A processar...' : 'Adicionar Documento 51'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Clica para seleccionar — conclui o processo</div>
        </div>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            const ser = await serializarFicheiro(file);
            onAdicionado(ser);
            setUploading(false);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

// ─── PAINEL CONFIRMAR PAGAMENTO ───────────────────────────────────────────────
function ConfirmarPagamentoPanel({ onConfirmar, valorFatura }) {
  const [tipoPag, setTipoPag]   = useState('total');
  const [valorParcial, setValorParcial] = useState('');
  const [aberto, setAberto]     = useState(false);
  const [data, setData]         = useState(new Date().toISOString().split('T')[0]);
  const [comprovativo, setComp] = useState(null);
  const [loading, setLoading]   = useState(false);

  if (!aberto) {
    return (
      <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Pagamento por confirmar</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tens permissão para registar o pagamento desta fatura</div>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setAberto(true)}>💰 Registar recebimento</button>
      </div>
    );
  }

  const handleConfirmar = async () => {
    setLoading(true);
    const compSer = comprovativo ? await serializarFicheiro(comprovativo) : null;
    const vp = tipoPag==='parcial' ? (parseFloat(valorParcial)||0) : null;
    onConfirmar(new Date(data).toLocaleDateString('pt-PT'), compSer, tipoPag, vp);
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 8, padding: '14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border-strong)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--brand-primary)' }}>💰 Registar recebimento</div>
      <div style={{ marginBottom: 12 }}>
        {/* Tipo */}
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {[{key:'total',label:'Total'},{key:'parcial',label:'Parcial'}].map(t => (
            <button key={t.key} onClick={() => setTipoPag(t.key)}
              style={{ flex:1, fontFamily:'var(--font-body)', fontSize:13, padding:'6px', borderRadius:7, cursor:'pointer',
                border:`1px solid ${tipoPag===t.key?'var(--brand-primary)':'var(--border)'}`,
                background:tipoPag===t.key?'var(--brand-primary)':'var(--bg-app)',
                color:tipoPag===t.key?'#fff':'var(--text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tipoPag==='parcial' && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>
              Valor recebido (€){valorFatura?<span style={{color:'var(--text-muted)',fontWeight:400}}> — total: {valorFatura.toLocaleString('pt-PT')} €</span>:''}
            </label>
            <input type="number" value={valorParcial} onChange={e=>setValorParcial(e.target.value)} placeholder="ex: 50000"
              style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
          </div>
        )}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data de recebimento</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{
          width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
          padding: '7px 10px', border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
        }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
          Comprovativo <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
        </label>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          border: `1.5px dashed ${comprovativo ? 'var(--color-success)' : 'var(--border-strong)'}`,
          background: comprovativo ? 'var(--bg-success)' : 'var(--bg-card)', transition: 'all .15s',
        }}>
          <span style={{ fontSize: 18 }}>{comprovativo ? '✅' : '📎'}</span>
          <div style={{ flex: 1 }}>
            {comprovativo
              ? <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{comprovativo.name}</div>
              : <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Selecciona o comprovativo</div>
            }
          </div>
          {comprovativo && (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setComp(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>✕</button>
          )}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setComp(f); e.target.value = ''; }} />
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

// ─── MODAL DETALHE FATURA (exportado para usar no Arquivo) ────────────────────
// ─── APROVAR/REJEITAR PANEL (local copy for client workflow) ─────────────────
function AprovarRejeitarPanel({ titulo, descricao, cor, aprovLabel, rejeitarLabel, anteriorLabel, onAprovar, onRejeitar, loading }) {
  const [comentario, setComentario] = useState('');
  const [confirmRejeitar, setConfirmRejeitar] = useState(false);
  const corBg  = cor === 'warning' ? 'var(--bg-warning)' : cor === 'info' ? 'var(--bg-info)' : 'var(--bg-app)';
  const corBdr = cor === 'warning' ? 'var(--color-warning)' : cor === 'info' ? 'var(--color-info)' : 'var(--border)';
  const corTxt = cor === 'warning' ? 'var(--color-warning)' : 'var(--color-info)';
  return (
    <div style={{ marginTop: 16, padding: 14, background: corBg, borderRadius: 8, border: `0.5px solid ${corBdr}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: corTxt, marginBottom: 4 }}>{titulo}</div>
      {descricao && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{descricao}</div>}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
          Comentário <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>opcional</span>
        </label>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder={anteriorLabel ? `Deixa uma nota para ${anteriorLabel}...` : 'Deixa uma nota...'}
          rows={2}
          style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
      {!confirmRejeitar ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => onAprovar(comentario.trim())} disabled={!!loading}>
            {loading || aprovLabel || '✓ Aprovar'}
          </button>
          <button className="btn" style={{ flex: 1, fontSize: 12, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            onClick={() => setConfirmRejeitar(true)} disabled={!!loading}>
            ✕ {rejeitarLabel || 'Rejeitar'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--color-danger)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600, marginBottom: 8 }}>
            Devolver{anteriorLabel ? ` a ${anteriorLabel}` : ''}?
            {comentario.trim() ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> Com comentário.</span>
              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> Sem comentário.</span>}
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

export function FaturaDetalheModal({ fatura: faturaInicial, cliente, onClose, onUpdate }) {
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [fatura, setFatura] = useState(faturaInicial);
  const [toast, setToast]   = useState('');
  const [loading, setLoading] = useState('');
  // Para emitir fatura final após aprovação
  const [showEmitirFinal, setShowEmitirFinal] = useState(false);
  const pdfRef = useRef(null);

  if (!fatura) return null;

  const FATURA_CONFIG = FATURA_CONFIG_CLI;
  const est = FATURA_CONFIG[fatura.estado] || { label: fatura.estado, cls: 'badge-n' };
  const nomeCliente = typeof cliente === 'string' ? cliente : cliente?.nome;

  const showToast = (msg, dur = 4000) => {
    setToast(msg);
    setTimeout(() => setToast(''), dur);
  };

  // Utilizador é o requerente desta fatura?
  const euSouRequerente = user && fatura.requerente &&
    (user.nome === fatura.requerente || user.initials === fatura.requerente);

  // Utilizador é quem criou o draft?
  const euSouCriador = user && fatura.criadoPor &&
    (user.nome === fatura.criadoPor || user.initials === fatura.criadoPor);

  // Actualiza a fatura local + propaga para o modal pai
  const actualizarFatura = (campos) => {
    const updated = { ...fatura, ...campos };
    setFatura(updated);
    if (onUpdate) onUpdate(updated);
    return updated;
  };

  // ─── HELPERS ────────────────────────────────────────────────────────────────
  const cliNome = typeof cliente === 'object' ? cliente?.nome : nomeCliente;
  const lista_ = getPerfisLista();

  const notifPara = (id, tipo, icon, titulo, sub, meta={}) =>
    addNotif({ tipo, icon, titulo, sub, path: '/clientes', destinatario: id,
      meta: { faturaId: fatura.id, clienteId: typeof cliente === 'object' ? cliente?.id : null, clienteNome: cliNome, ...meta } });

  const resolveId = (nomeOuInitials) => {
    if (!nomeOuInitials) return null;
    const p = lista_.find(x => x.nome === nomeOuInitials || x.initials === nomeOuInitials);
    return p?.id || null;
  };

  // ── REQUERENTE: APROVAR/REJEITAR DRAFT ───────────────────────────────────
  const handleReqAprovar = async () => {
    setLoading('A aprovar...');
    const cliId = typeof cliente === 'object' ? cliente?.id : null;
    const updated = actualizarFatura({ estado: 'pendente_lg', aprovadoReq: true, aprovadoPorReq: user.nome, dataAprovacaoReq: new Date().toLocaleDateString('pt-PT') });
    // Marcar acção como feita para este utilizador
    if (marcarFeita) marcarFeita(fatura.id, '/clientes');
    // Notif accionável para LG
    addNotif({ tipo:'acao_lg', icon:'📋', accionavel:true, titulo:`Confirma a emissão da fatura — ${cliNome}`, sub:`${cliNome} · ${fatura.id} · aprovado pelo Gestor de Obra`, path:'/clientes', destinatario:'lg', meta:{ faturaId:fatura.id, clienteId:cliId, clienteNome:cliNome }, acao:'Confirmar emissão' });
    setLoading(''); showToast(`Draft aprovado ✓ — LG notificada`);
  };

  const handleReqRejeitar = async (comentario) => {
    setLoading('A rejeitar...');
    const updated = actualizarFatura({ estado: 'draft', rejeitadoPorReq: user.nome, comentarioReq: comentario, dataRejeicaoReq: new Date().toLocaleDateString('pt-PT') });
    const caId = resolveId('CA') || 'ca';
    notifPara(caId, 'info', '↩', `Draft rejeitado pelo Gestor de Obra`, `${cliNome} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`);
    setLoading(''); showToast('Draft rejeitado — CA notificada');
  };

  // ── LG: APROVAR/REJEITAR ──────────────────────────────────────────────────
  const handleLGAprovar = async (comentario) => {
    setLoading('A confirmar...');
    const updated = actualizarFatura({ estado: 'pendente_ms', confirmedByLG: true, aprovadoPorLG: user.nome, dataAprovacaoLG: new Date().toLocaleDateString('pt-PT'), comentarioLG: comentario });
    // Marcar acção LG como feita
    if (marcarFeita) marcarFeita(fatura.id, '/clientes');
    // Notif accionável para MS
    addNotif({ tipo:'acao_ms', icon:'✅', accionavel:true, titulo:`Aprova a fatura — ${cliNome}`, sub:`${cliNome} · ${fatura.id} · confirmado por LG`, path:'/clientes', destinatario:'ms', meta:{ faturaId:updated.id, clienteId:typeof cliente==='object'?cliente?.id:null, clienteNome:cliNome }, acao:'Aprovar fatura' });
    setLoading(''); showToast('Aprovado ✓ — MS notificado');
  };

  const handleLGRejeitar = async (comentario) => {
    setLoading('A rejeitar...');
    const reqId = resolveId(fatura.requerente);
    actualizarFatura({ estado: 'pendente_req', rejeitadoPorLG: user.nome, comentarioLG: comentario, dataRejeicaoLG: new Date().toLocaleDateString('pt-PT') });
    if (reqId) notifPara(reqId, 'info', '↩', `Fatura devolvida pelo Gestor de Obra`, `${cliNome} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`);
    setLoading(''); showToast('Devolvida ao Gestor de Obra');
  };

  // ── MS: APROVAR/REJEITAR ──────────────────────────────────────────────────
  const handleMSAprovar = async (comentario) => {
    setLoading('A aprovar...');
    const updated = actualizarFatura({ estado: 'enviada', aprovadoMS: true, aprovadoPorMS: user.nome, dataAprovacaoMS: new Date().toLocaleDateString('pt-PT'), comentarioMS: comentario });
    // Marcar acção MS como feita
    if (marcarFeita) marcarFeita(fatura.id, '/clientes');
    const cliId2 = typeof cliente === 'object' ? cliente?.id : null;
    // Notif info para CA (enviar ao cliente) + accionável LG (registar recebimento quando vier)
    addNotif({ tipo:'info', icon:'📤', accionavel:false, titulo:`Fatura aprovada — enviar ao cliente`, sub:`${cliNome} · ${updated.id}`, path:'/clientes', destinatario:'ca', meta:{ faturaId:updated.id, clienteId:cliId2, clienteNome:cliNome } });
    addNotif({ tipo:'acao_lg', icon:'💰', accionavel:true, titulo:`Regista o recebimento quando o cliente pagar — ${cliNome}`, sub:`${cliNome} · ${updated.id} · aprovado por MS`, path:'/clientes', destinatario:'lg', meta:{ faturaId:updated.id, clienteId:cliId2, clienteNome:cliNome }, acao:'Registar recebimento' });
    setLoading(''); showToast('Aprovado ✓ — CA notificada para enviar ao cliente');
  };

  const handleMSRejeitar = async (comentario) => {
    setLoading('A rejeitar...');
    actualizarFatura({ estado: 'pendente_lg', rejeitadoPorMS: user.nome, comentarioMS: comentario, dataRejeicaoMS: new Date().toLocaleDateString('pt-PT') });
    notifPara('lg', 'info', '↩', `Fatura devolvida pelo MS`, `${cliNome} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,50) : ''}`);
    setLoading(''); showToast('Devolvida à LG');
  };

  // ── LG/MS: REGISTAR RECEBIMENTO ──────────────────────────────────────────
  const handleRegistarRecebimento = async (dataPag, compSer, tipoPag, valorParcial) => {
    const updated = actualizarFatura({
      pago: tipoPag !== 'parcial',
      dataPagamento: dataPag,
      comprovativoPagamento: compSer,
      estado: tipoPag === 'parcial' ? 'parcial' : 'recebido',
      valorRecebido: valorParcial || fatura.valor,
      registadoPorRecebimento: user?.nome,
      dataRegistoRecebimento: dataPag,
    });
    // Notif MS + CA
    if (marcarFeita) marcarFeita(fatura.id, '/clientes');
    const cliId3 = typeof cliente === 'object' ? cliente?.id : null;
    // Informativa para MS
    addNotif({ tipo:'info', icon:'💰', accionavel:false, titulo:`Recebimento registado — ${cliNome}`, sub:`${fatura.id} · ${dataPag} · por ${user?.nome||'LG'}`, path:'/clientes', destinatario:'ms', meta:{ faturaId:fatura.id, clienteId:cliId3, clienteNome:cliNome } });
    // Accionável para CA — Doc. 51
    addNotif({ tipo:'acao_ca', icon:'🏁', accionavel:true, titulo:`Actualiza Centralgest e emite Doc. 51 — ${cliNome}`, sub:`${cliNome} · ${fatura.id} · Recebimento por ${user?.nome||'LG'}`, path:'/clientes', destinatario:'ca', meta:{ faturaId:fatura.id, clienteId:cliId3, clienteNome:cliNome }, acao:'Emitir Doc. 51' });
    showToast('Recebimento registado ✓ — MS e CA notificados');
  };

  // ── EMITIR FATURA FINAL ────────────────────────────────────────────────────
  const handleEmitirFinal = async (pdfFile) => {
    if (!euSouCriador && !((user?.initials||'').toUpperCase() === 'CA')) return;
    setLoading('A emitir fatura...');
    const nomeCliente_ = typeof cliente === 'object' ? cliente.nome : nomeCliente;
    const pdfSer = pdfFile ? await serializarFicheiro(pdfFile) : null;
    const nextEstado = fatura.requerente ? 'pendente_req' : 'pendente_lg';
    const updated = actualizarFatura({
      estado: nextEstado,
      pdfFinal: pdfSer,
      dataEmissaoFinal: new Date().toLocaleDateString('pt-PT'),
      criadoPor: fatura.criadoPor || user?.nome,
    });

    const cliId = typeof cliente === 'object' ? cliente?.id : null;
    const meta  = { faturaId: updated.id, clienteId: cliId, clienteNome: nomeCliente_ };

    if (fatura.requerente) {
      // Notif para o requerente validar
      const reqId = resolveId(fatura.requerente);
      if (reqId) addNotif({ tipo: 'draft_emitido', icon: '📄', titulo: `Nova fatura para validar — ${nomeCliente_}`, sub: `${nomeCliente_} · ${updated.id} · ${updated.obra}`, path: '/clientes', destinatario: reqId, meta });
      setShowEmitirFinal(false); setLoading('');
      showToast(`Fatura emitida ✓ — ${fatura.requerente} notificado para validar`);
    } else {
      // Sem requerente — vai directamente para LG
      const lgId = resolveId('LG') || 'lg';
      addNotif({ tipo: 'draft_emitido', icon: '📋', titulo: `Fatura para confirmar — ${nomeCliente_}`, sub: `${nomeCliente_} · ${updated.id}`, path: '/clientes', destinatario: lgId, meta });
      setShowEmitirFinal(false); setLoading('');
      showToast('Fatura emitida ✓ — LG notificada');
    }
  };


  return (
    <div onClick={undefined} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)', width: '100%', maxWidth: 720,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)', position: 'relative',
      }}>
        {/* Toast */}
        {(toast || loading) && (
          <div style={{
            position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
            background: loading ? 'var(--brand-primary)' : 'var(--color-success)',
            color: '#fff', padding: '8px 18px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10,
          }}>{loading || toast}</div>
        )}

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>{fatura.id}</span>
              <span className={`badge ${est.cls}`}>{est.label}</span>
              {fatura.concluido && <span className="badge badge-s">🏁 Concluído</span>}
              {fatura.estado === 'aprovado' && !fatura.concluido && <span className="badge badge-s">✓ Aprovado por {fatura.aprovadoPor}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: {nomeCliente}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Valor */}
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-app)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Valor da fatura</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(fatura.valor)}</div>
          </div>

          {/* Campos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 20 }}>
            {[
              { label: 'Obra',            value: fatura.obra },
              { label: 'Data de emissão', value: fatura.data },
              { label: 'Vencimento',      value: fatura.venc || '—' },
              { label: 'Condições pag.',  value: fatura.condPag || '—' },
              { label: 'Descrição',       value: fatura.descricao, full: true },
              { label: 'Gestor de Obra',      value: fatura.requerente || '—', full: true },
              ...(fatura.criadoPor ? [{ label: 'Criado por', value: fatura.criadoPor, full: false }] : []),
              ...(fatura.dataAprovacao ? [{ label: 'Aprovado em', value: fatura.dataAprovacao, full: false }] : []),
            ].map(item => (
              <div key={item.label} style={{ gridColumn: item.full ? 'span 2' : 'span 1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: item.label === 'Obra' ? 600 : 400 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Documentos & Pagamento */}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Pasta da fatura</div>

            {/* PDF draft */}
            {fatura.pdf ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 1 }}>Draft original</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fatura.pdf.name || fatura.pdf}</div>
                </div>
                <button className="btn btn-sm" onClick={() => downloadPdf(fatura.pdf)} disabled={!fatura.pdf?.base64}>Descarregar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '1.5px dashed var(--border-strong)', marginBottom: 8 }}>
                <span style={{ fontSize: 18, opacity: 0.4 }}>📎</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sem documento de draft</span>
              </div>
            )}

            {/* PDF fatura final */}
            {fatura.pdfFinal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-info)', borderRadius: 8, border: '0.5px solid var(--color-info)', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🧾</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-info)', marginBottom: 1 }}>Fatura final</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fatura.pdfFinal.name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => downloadPdf(fatura.pdfFinal)} disabled={!fatura.pdfFinal?.base64}>Descarregar</button>
              </div>
            )}

            {/* Comprovativo de pagamento */}
            {fatura.pago && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-success)', marginBottom: 1 }}>
                    Pago em {fatura.dataPagamento}
                  </div>
                  {fatura.comprovativoPagamento ? (
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{fatura.comprovativoPagamento.name}</div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--color-success)', opacity: 0.7 }}>Sem comprovativo anexado</div>
                  )}
                </div>
                {fatura.comprovativoPagamento && (
                  <button className="btn btn-sm" onClick={() => downloadPdf(fatura.comprovativoPagamento)} disabled={!fatura.comprovativoPagamento?.base64}>Descarregar</button>
                )}
                {(() => {
                  const perfis = getPerfisLista();
                  const perfilUser = perfis.find(p => p.id === user?.id);
                  const podeConfirmar = user?.isAdmin || perfilUser?.acoes?.includes('confirmar_pagamento');
                  return podeConfirmar ? (
                    <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', marginLeft: 4 }}
                      onClick={() => actualizarFatura({ pago: false, dataPagamento: null, comprovativoPagamento: null })}>
                      Reverter
                    </button>
                  ) : null;
                })()}
              </div>
            )}

            {/* Documento 51 — CA adiciona após pagamento */}
            {fatura.pago && (
              <Doc51Panel
                fatura={fatura}
                user={user}
                onAdicionado={(doc51Ser) => {
                  actualizarFatura({
                    doc51: doc51Ser,
                    dataDoc51: new Date().toLocaleDateString('pt-PT'),
                    concluido: true,
                    estado: 'concluido',
                  });
                  showToast('Documento 51 adicionado — processo concluído ✓');
                }}
              />
            )}
            {!fatura.pago && ['emitida','pendente','parcial','vencida'].includes(fatura.estado) && fatura.confirmedByLG && (() => {
              const _ini = (user?.initials || '').toUpperCase();
              const eLG_ = _ini === 'LG' || user?.id === 'lg';
              const eMS_ = _ini === 'MS' || user?.id === 'ms';
              const perfis = getPerfisLista();
              const perfilUser = perfis.find(p => p.id === user?.id);
              const podeConfirmar = eLG_ || eMS_ || user?.isAdmin || perfilUser?.acoes?.includes('confirmar_pagamento');
              if (!podeConfirmar) return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 O registo de recebimento é efectuado pela Leonor Gomes ou pelo Miguel Seabra.
                </div>
              );
              return (
                <ConfirmarPagamentoPanel
                  valorFatura={fatura.valor}
                  onConfirmar={async (dataPag, compSer, tipoPag, valorParcial) => {
                    const nomeCliente_ = typeof cliente === 'object' ? cliente.nome : nomeCliente;
                    const updated = actualizarFatura({
                      pago: tipoPag !== 'parcial',
                      dataPagamento: dataPag,
                      comprovativoPagamento: compSer,
                      estado: tipoPag === 'parcial' ? 'parcial' : 'recebido',
                      valorRecebido: valorParcial || fatura.valor,
                    });

                    // Notificação SIS para CA
                    addNotif(notifPagamentoEfectuado({
                      fatura: { ...updated, dataPagamento: dataPag },
                      cliente: nomeCliente_,
                      registadoPor: user?.nome || 'SIS',
                    }));

                    showToast('Pagamento confirmado ✓ — Carla notificada para adicionar Documento 51');
                  }}
                />
              );
            })()}
          </div>

          {/* ── ÁREA DE ACÇÕES POR PERFIL ── */}
          {(() => {
            const _ini = (user?.initials || '').toUpperCase();
            const eCA = _ini === 'CA' || user?.id === 'ca';
            const eLG = _ini === 'LG' || user?.id === 'lg';
            const eMS = _ini === 'MS' || user?.id === 'ms';
            const eReq = euSouRequerente;
            const eCriador = euSouCriador;
            const est = fatura.estado;

            // ── ESTADO: draft — aguarda requerente ──────────────────────────
            if (est === 'draft') {
              if (eReq) return (
                <AprovarRejeitarPanel
                  titulo="⏳ Aguarda a tua validação"
                  descricao={`Foste indicado como Gestor de Obra. Podes aprovar ou rejeitar com comentário.`}
                  cor="warning"
                  aprovLabel="✓ Aprovar draft"
                  rejeitarLabel="✕ Rejeitar com comentário"
                  anteriorLabel="CA (emissor)"
                  loading={loading}
                  onAprovar={handleReqAprovar}
                  onRejeitar={handleReqRejeitar}
                />
              );
              if (eCriador) return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ⏳ Draft enviado para <strong>{fatura.requerente}</strong> validar.
                  {fatura.comentarioReq && <div style={{ marginTop: 6, color: 'var(--color-danger)' }}>💬 Rejeitado: "{fatura.comentarioReq}"</div>}
                </div>
              );
              return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 Aguarda validação do Gestor de Obra <strong>{fatura.requerente}</strong>.
                </div>
              );
            }

            // ── ESTADO: pendente_req — Gestor de Obra aprovou, aguarda emissão ──
            if (est === 'pendente_req') {
              if (eCriador || eCA) return (
                <div style={{ marginTop: 16, padding: '14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)', marginBottom: 4 }}>✓ Aprovado por {fatura.aprovadoPorReq}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Podes agora emitir a fatura final e fazer upload do PDF.</div>
                  {!showEmitirFinal ? (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowEmitirFinal(true)}>📄 Emitir fatura final</button>
                  ) : (
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `1.5px dashed ${pdfRef.current?.files?.[0] ? 'var(--color-success)' : 'var(--border-strong)'}`, background: 'var(--bg-card)', marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>📎</span>
                        <div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Selecciona o PDF da fatura emitida</div></div>
                        <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={() => setFatura(f => ({ ...f, _pdfTemp: pdfRef.current?.files?.[0] }))} />
                      </label>
                      {fatura._pdfTemp && <div style={{ fontSize: 12, color: 'var(--color-success)', marginBottom: 10 }}>✓ {fatura._pdfTemp.name}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => setShowEmitirFinal(false)}>Cancelar</button>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={!fatura._pdfTemp || !!loading} onClick={() => handleEmitirFinal(fatura._pdfTemp)}>{loading || '✓ Confirmar emissão'}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
              return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ✓ Aprovado pelo Gestor de Obra — aguarda emissão pela CA.
                </div>
              );
            }

            // ── ESTADO: pendente_lg — aguarda confirmação LG ─────────────────
            if (est === 'pendente_lg' || (est === 'emitida' && !fatura.confirmedByLG)) {
              if (eLG) return (
                <AprovarRejeitarPanel
                  titulo="📋 Aguarda a tua aprovação"
                  descricao={`Fatura emitida por ${fatura.criadoPor}${fatura.comentarioMS ? ` — devolvida pelo MS: "${fatura.comentarioMS}"` : ''}. Confirma ou rejeita.`}
                  cor="info"
                  aprovLabel="✓ Aprovar e enviar para MS"
                  rejeitarLabel="↩ Devolver ao Gestor de Obra"
                  anteriorLabel="Gestor de Obra"
                  loading={loading}
                  onAprovar={handleLGAprovar}
                  onRejeitar={handleLGRejeitar}
                />
              );
              if (eMS) return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ⏳ Aguarda aprovação da Leonor Gomes.
                </div>
              );
              return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ⏳ A fatura está a ser revista pela Diretora Financeira.
                </div>
              );
            }

            // ── ESTADO: pendente_ms — aguarda aprovação MS ───────────────────
            if (est === 'pendente_ms' || (est === 'emitida' && fatura.confirmedByLG && !fatura.aprovadoMS)) {
              if (eMS) return (
                <AprovarRejeitarPanel
                  titulo="📋 Aguarda a tua aprovação"
                  descricao={`Fatura confirmada por ${fatura.aprovadoPorLG || 'LG'}${fatura.comentarioLG ? ` — comentário: "${fatura.comentarioLG}"` : ''}. Aprova para enviar ao cliente.`}
                  cor="warning"
                  aprovLabel="✓ Aprovar — enviar ao cliente"
                  rejeitarLabel="↩ Devolver à LG"
                  anteriorLabel="Leonor Gomes"
                  loading={loading}
                  onAprovar={handleMSAprovar}
                  onRejeitar={handleMSRejeitar}
                />
              );
              return (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  ⏳ Aguarda aprovação de Miguel Seabra.{fatura.aprovadoPorLG && <span> Aprovado por LG em {fatura.dataAprovacaoLG}.</span>}
                </div>
              );
            }

            // ── ESTADO: enviada / emitida aprovada — aguarda recebimento ─────
            if (est === 'enviada' || (est === 'emitida' && fatura.aprovadoMS)) {
              const podeRegistar = eLG || eMS;
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', fontSize: 12, color: 'var(--color-success)', fontWeight: 500, marginBottom: 12 }}>
                    ✓ Aprovado por {fatura.aprovadoPorMS || 'MS'} em {fatura.dataAprovacaoMS} — fatura enviada ao cliente
                    {fatura.comentarioMS && <div style={{ fontWeight: 400, marginTop: 4 }}>💬 "{fatura.comentarioMS}"</div>}
                  </div>
                  {podeRegistar ? (
                    <ConfirmarPagamentoPanel
                      valorFatura={fatura.valor}
                      onConfirmar={handleRegistarRecebimento}
                    />
                  ) : (
                    <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                      🔒 O registo de recebimento é efectuado pela Leonor Gomes ou Miguel Seabra.
                    </div>
                  )}
                </div>
              );
            }

            // ── ESTADO: recebido / parcial — aguarda Doc. 51 ─────────────────
            if (est === 'recebido' || est === 'parcial') {
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', fontSize: 12, marginBottom: est === 'parcial' ? 12 : 0 }}>
                    <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                      {est === 'parcial' ? '📊 Recebimento parcial' : '💰 Recebimento confirmado'} — {fatura.dataPagamento}
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Registado por {fatura.registadoPorRecebimento || 'LG'}</div>
                  </div>
                  {est === 'parcial' && (eLG || eMS) && (
                    <ConfirmarPagamentoPanel
                      valorFatura={fatura.valor}
                      onConfirmar={handleRegistarRecebimento}
                    />
                  )}
                </div>
              );
            }

            return null;
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-sm">Descarregar</button>
          <button className="btn btn-sm btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETALHE CLIENTE (exportado para usar no Arquivo) ───────────────────
export function ClienteModal({ c, onClose, onDelete, abrirFaturaId, onManageAccess, canManageAccess }) {
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [tab, setTab]               = useState('faturas');
  const [showEmitir, setShowEmitir] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [faturas, setFaturas]       = useState(() => loadFaturas(c.id, c.faturas));
  const [documentos, setDocumentos] = useState(() => loadDocumentos(c.id));
  const [faturaAberta, setFaturaAberta] = useState(null);
  const [toast, setToast]           = useState('');

  // Abre automaticamente a fatura indicada via notificação
  useEffect(() => {
    if (!abrirFaturaId) return;
    const fatura = faturas.find(f => f.id === abrirFaturaId);
    if (fatura) setFaturaAberta(fatura);
  }, [abrirFaturaId, faturas]);

  // Sync with Tesouraria in real time
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== FAT_KEY) return;
      const novas = loadFaturas(c.id, c.faturas);
      setFaturas(novas);
      setFaturaAberta(prev => prev ? (novas.find(x => x.id === prev.id) || prev) : prev);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [c.id]); // eslint-disable-line

  const recebido = faturas.filter(x => x.estado === 'recebido').reduce((s, x) => s + x.valor, 0);
  const pendente = faturas.filter(x => x.estado !== 'recebido').reduce((s, x) => s + x.valor, 0);

  const handleEmitir = async (dados) => {
    const pdfSer = dados.pdf ? await serializarFicheiro(dados.pdf) : null;
    const nova = {
      id: `FT-${Date.now()}`,
      obra: dados.obra, valor: dados.valor,
      data: dados.dataEmissao, venc: '—',
      condPag: dados.condPag,
      estado: dados.tipo === 'draft' ? 'draft' : 'pendente_lg',
      descricao: dados.descricao,
      requerente: dados.requerente,
      criadoPor: user?.nome || 'SIS',
      pdf: pdfSer,
    };
    const updated = [nova, ...faturas];
    setFaturas(updated);
    saveFaturas(c.id, updated);
    setShowEmitir(false);

    if (dados.tipo === 'draft' && dados.requerente) {
      // Notificação SIS para o requerente
      const lista = getPerfisLista();
      const perfilReq = lista.find(p => p.nome === dados.requerente);
      addNotif(notifDraftEmitido({
        fatura: nova,
        cliente: c.nome,
        requerente: dados.requerente,
        criadoPor: user?.nome || 'SIS',
        requerenteId: perfilReq?.id,
      }));
      setToast(`Draft guardado — ${dados.requerente} notificado ✓`);
    } else {
      setToast(dados.tipo === 'draft' ? 'Draft guardado — sem Gestor de Obra para notificar' : 'Fatura emitida com sucesso');
    }
    setTimeout(() => setToast(''), 5000);
  };

  // Quando FaturaDetalheModal actualiza uma fatura (aprovação, emissão final)
  const handleFaturaUpdate = (faturaActualizada) => {
    const updated = faturas.map(f => f.id === faturaActualizada.id ? faturaActualizada : f);
    setFaturas(updated);
    saveFaturas(c.id, updated);
  };

  const handleAddDoc = (doc, isFatura) => {
    if (isFatura) {
      const nova = { id: doc.id, obra: doc.obra, valor: doc.valor, data: doc.data, venc: doc.venc, condPag: doc.condPag, estado: doc.estado, descricao: doc.descricao, pdf: doc.ficheiro };
      const updated = [nova, ...faturas];
      setFaturas(updated);
      saveFaturas(c.id, updated);
    } else {
      const updated = [doc, ...documentos];
      setDocumentos(updated);
      saveDocumentos(c.id, updated);
    }
    setShowAddDoc(false);
    setToast('Documento adicionado com sucesso');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <>
      {showEmitir && <EmitirFaturaModal cliente={c} onClose={() => setShowEmitir(false)} onEmitir={handleEmitir} />}
      {showAddDoc && <AdicionarDocumentoModal entidade={c} tipoEntidade="cliente" onClose={() => setShowAddDoc(false)} onSave={handleAddDoc} />}
      {faturaAberta && <FaturaDetalheModal fatura={faturaAberta} cliente={c} onClose={() => setFaturaAberta(null)} onUpdate={handleFaturaUpdate} />}

      <div onClick={undefined} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--border)', width: '100%', maxWidth: 720,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)', position: 'relative',
        }}>
          {toast && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--color-success)', color: '#fff',
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, whiteSpace: 'nowrap',
            }}>{toast}</div>
          )}
          <div style={{ padding: '18px 22px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.nome.charAt(0)}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.categoria} · NIF {c.nif}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {canManageAccess && <button className="btn btn-sm" onClick={onManageAccess}>Gerir acessos</button>}
              <button className="btn btn-sm" onClick={() => setShowAddDoc(true)}>+ Documento</button>
              <button className="btn btn-sm btn-primary" onClick={() => setShowEmitir(true)}>+ Emitir fatura</button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--border)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            {[
              { label: 'Total faturas',  value: faturas.length },
              { label: 'Total recebido', value: fmt(recebido), color: 'var(--color-success)' },
              { label: 'Por receber',    value: fmt(pendente),  color: pendente > 0 ? 'var(--color-warning)' : undefined },
              { label: 'Obras',          value: c.obras.length > 0 ? c.obras.join(', ') : '—' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-app)', padding: '10px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: k.color || 'var(--text-primary)' }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 22px' }}>
            {[
              { key: 'faturas',    label: `Faturas (${faturas.length})` },
              { key: 'documentos', label: `Documentos (${documentos.length})` },
              { key: 'info',       label: 'Informações' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                padding: '10px 16px', border: 'none', background: 'none',
                color: tab === t.key ? 'var(--brand-primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
                marginBottom: -1, cursor: 'pointer', transition: 'all .15s',
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'faturas' && (
              faturas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sem faturas. <span style={{ color: 'var(--brand-primary)', cursor: 'pointer' }} onClick={() => setShowEmitir(true)}>Emitir agora?</span>
                </div>
              ) : (
                <table className="sis-table">
                  <thead><tr><th>Nº Fatura</th><th>Descrição</th><th>Obra</th><th style={{ textAlign: 'right' }}>Valor</th><th>Data</th><th>Estado</th><th>PDF</th></tr></thead>
                  <tbody>
                    {faturas.map(fat => (
                      <tr key={fat.id} onClick={() => setFaturaAberta(fat)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-primary)', fontWeight: 500 }}>{fat.id}</td>
                        <td style={{ fontSize: 13, maxWidth: 180 }}>{fat.descricao}</td>
                        <td><span className="badge badge-n">{fat.obra}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fat.valor)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fat.data}</td>
                        <td><span className={`badge ${FATURA_CONFIG_CLI[fat.estado]?.cls || 'badge-n'}`}>{FATURA_CONFIG_CLI[fat.estado]?.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {fat.pdf      && <span title="Draft">📄</span>}
                            {fat.pdfFinal && <span title="Fatura final">🧾</span>}
                            {fat.comprovativoPagamento && <span title="Comprovativo">✅</span>}
                            {fat.doc51    && <span title="Documento 51">🏁</span>}
                            {!fat.pdf && !fat.pdfFinal && !fat.doc51 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
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
                  Sem documentos.{' '}
                  <span style={{ color: 'var(--brand-primary)', cursor: 'pointer' }} onClick={() => setShowAddDoc(true)}>Adicionar agora?</span>
                </div>
              ) : (
                <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documentos.map(doc => {
                    const tipoInfo = TIPOS_DOC.find(t => t.value === doc.tipo) || { icon: '📄', label: 'Documento' };
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 20 }}>{tipoInfo.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{doc.descricao}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {tipoInfo.label} · {doc.data}
                            {doc.ficheiro && ` · 📎 ${doc.ficheiro.name}`}
                          </div>
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
                  { label: 'Razão social', value: c.nome }, { label: 'NIF', value: c.nif },
                  { label: 'Sector', value: c.categoria }, { label: 'Contacto', value: c.contacto },
                  { label: 'Email', value: c.email }, { label: 'Telefone', value: c.telefone },
                  { label: 'Morada', value: c.morada }, { label: 'Obras', value: c.obras.join(', ') || '—' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 22px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {c._userCreated ? <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => onDelete(c.id)}>Remover cliente</button> : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm">Exportar histórico</button>
              <button className="btn btn-sm btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── REQUERENTE PICKER ────────────────────────────────────────────────────────
function RequerentePicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // Lê perfis do localStorage (compatível com PermissionsConfig)
  const perfis = (() => {
    try { return JSON.parse(localStorage.getItem('sis_perfis') || '[]'); }
    catch { return []; }
  })();

  // Perfis default se localStorage vazio
  const DEFAULTS = [
    { id: 'ms', initials: 'MS', nome: 'Miguel Seabra', role: 'Direção',             cor: '#1C3A5E' },
    { id: 'lg', initials: 'LG', nome: 'Leonor',         role: 'Diretora Financeira', cor: '#2E7D52' },
    { id: 'ca', initials: 'CA', nome: 'Carla',           role: 'Área Financeira',     cor: '#1C5F9A' },
    { id: 'cg', initials: 'CG', nome: 'Controller',      role: 'Controller de Gestão',cor: '#6B2E7A' },
    { id: 'dp', initials: 'DP', nome: 'Dir. Produção',   role: 'Produção',            cor: '#8B4A12' },
    { id: 'dc', initials: 'DC', nome: 'Dir. Comercial',  role: 'Comercial',           cor: '#0F766E' },
  ];
  const lista = perfis.length > 0 ? perfis : DEFAULTS;

  const filtrados = lista.filter(p =>
    !search || p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.initials.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  const selecionado = lista.find(p => p.id === value || p.nome === value);

  const selecionar = (p) => {
    onChange(p.nome);
    setSearch('');
    setOpen(false);
  };

  const limpar = (e) => { e.stopPropagation(); onChange(''); setSearch(''); };

  return (
    <div style={{ position: 'relative' }}>
      {/* Campo principal */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          border: `0.5px solid ${open ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
          background: 'var(--bg-card)', cursor: 'pointer',
          minHeight: 34, transition: 'border-color .15s',
        }}
      >
        {selecionado ? (
          <>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: selecionado.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {selecionado.initials}
            </div>
            <span style={{ fontSize: 13, flex: 1, color: 'var(--text-primary)' }}>{selecionado.nome}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selecionado.role}</span>
            <button onClick={limpar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 2px', lineHeight: 1 }}>✕</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>Selecciona Gestor de Obra...</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>▾</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 50, overflow: 'hidden',
        }}>
          {/* Pesquisa */}
          <div style={{ padding: '8px', borderBottom: '0.5px solid var(--border)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtrados.length === 0 ? (
              <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum resultado</div>
            ) : filtrados.map(p => (
              <div
                key={p.id}
                onClick={() => selecionar(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', cursor: 'pointer',
                  background: value === p.nome ? 'var(--bg-info)' : 'transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (value !== p.nome) e.currentTarget.style.background = 'var(--bg-app)'; }}
                onMouseLeave={e => { if (value !== p.nome) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {p.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                </div>
                {value === p.nome && <span style={{ fontSize: 14, color: 'var(--color-info)' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODAL EMITIR FATURA ──────────────────────────────────────────────────────
function EmitirFaturaModal({ cliente, onClose, onEmitir }) {
  const [tipoDraft, setTipoDraft] = useState(true);
  const [form, setForm] = useState({ obra: '', valor: '', descricao: '', requerente: '', dataEmissao: new Date().toISOString().split('T')[0], condPag: '30 dias', pdf: null });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    if (!form.obra) e.obra = 'Selecciona uma obra';
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido';
    if (!form.descricao.trim()) e.descricao = 'Campo obrigatório';
    return e;
  };
  const handleEmitir = () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } onEmitir({ ...form, valor: Number(form.valor), tipo: tipoDraft ? 'draft' : 'final', cliente: cliente.nome }); };

  return (
    <div onClick={undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 720, boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 600, fontSize: 15 }}>Emitir fatura</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Cliente: {cliente.nome}</div></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Tipo de fatura</div>
            <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 8, padding: 3, gap: 3 }}>
              {[{ val: true, label: 'Draft', sub: 'Para validação do Gestor de Obra' }, { val: false, label: 'Fatura final', sub: 'Emissão imediata' }].map(opt => (
                <button key={String(opt.val)} onClick={() => setTipoDraft(opt.val)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: tipoDraft === opt.val ? '1px solid var(--brand-primary)' : '1px solid transparent', background: tipoDraft === opt.val ? 'var(--bg-card)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left', transition: 'all .15s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: tipoDraft === opt.val ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: tipoDraft ? 'var(--bg-warning)' : 'var(--bg-info)', color: tipoDraft ? '#7a4a0a' : '#0a3a6a', borderLeft: `3px solid ${tipoDraft ? 'var(--color-warning)' : 'var(--color-info)'}` }}>
              {tipoDraft ? '⏳ O Gestor de Obra receberá notificação para validar o draft.' : '✓ A fatura será emitida imediatamente e o Gestor de Obra notificado.'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
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
              <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="ex: 50000" style={inp(errors.valor)} />
              {errors.valor && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.valor}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data de emissão</label>
              <input type="date" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} style={inp(false)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Condições de pagamento</label>
              <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={inp(false)}>
                {['15 dias','30 dias','45 dias','60 dias','90 dias'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Gestor de Obra</label>
              <RequerentePicker value={form.requerente} onChange={v => set('Gestor de Obra', v)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Descrição <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="ex: Medição nº3 — Fase estrutura" style={inp(errors.descricao)} />
              {errors.descricao && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.descricao}</div>}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Documento (PDF) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: `1.5px dashed ${form.pdf ? 'var(--color-success)' : 'var(--border-strong)'}`, background: form.pdf ? 'var(--bg-success)' : 'var(--bg-app)', cursor: 'pointer', transition: 'all .15s' }}>
                <span style={{ fontSize: 20 }}>{form.pdf ? '✅' : '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {form.pdf ? (
                    <><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{form.pdf.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(form.pdf.size / 1024).toFixed(0)} KB</div></>
                  ) : (
                    <><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Clica para seleccionar um PDF</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fatura, medição, contrato...</div></>
                  )}
                </div>
                {form.pdf && <button onClick={e => { e.preventDefault(); e.stopPropagation(); set('pdf', null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px' }}>✕</button>}
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) set('pdf', f); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleEmitir} style={{ background: tipoDraft ? 'var(--color-warning)' : 'var(--brand-primary)' }}>
            {tipoDraft ? '💾 Guardar draft' : '📄 Emitir fatura'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL NOVO CLIENTE ───────────────────────────────────────────────────────
const CAMPOS = [
  { key: 'nome', label: 'Razão social', required: true, half: false },
  { key: 'nif', label: 'NIF', required: true, half: true },
  { key: 'categoria', label: 'Sector', required: true, half: true, type: 'select' },
  { key: 'contacto', label: 'Contacto', required: false, half: true },
  { key: 'email', label: 'Email', required: false, half: true },
  { key: 'telefone', label: 'Telefone', required: false, half: true },
  { key: 'morada', label: 'Morada', required: false, half: false },
];

function NovoClienteModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nome:'', nif:'', categoria:'', contacto:'', email:'', telefone:'', morada:'' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Campo obrigatório';
    if (!form.nif.trim()) e.nif = 'Campo obrigatório';
    else if (!/^\d{9}$/.test(form.nif.replace(/[\s\-]/g, ''))) e.nif = 'NIF inválido';
    if (!form.categoria) e.categoria = 'Selecciona um sector';
    return e;
  };
  const handleSave = () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } onSave(form); };

  return (
    <div onClick={undefined} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><div style={{ fontWeight:600, fontSize:15 }}>Novo cliente</div><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>* campos obrigatórios</div></div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)', padding:'4px 8px' }}>✕</button>
        </div>
        <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 16px' }}>
          {CAMPOS.map(c => (
            <div key={c.key} style={{ gridColumn: c.half ? 'span 1' : 'span 2' }}>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>
                {c.label}{c.required && <span style={{ color:'var(--color-danger)', marginLeft:3 }}>*</span>}
              </label>
              {c.type === 'select' ? (
                <select value={form[c.key]} onChange={e => set(c.key, e.target.value)} style={inp(errors[c.key])}>
                  <option value="">Selecciona...</option>
                  {CATEGORIAS_CLI.filter(x => x !== 'Todas').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              ) : (
                <input value={form[c.key]} onChange={e => set(c.key, e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} style={inp(errors[c.key])} />
              )}
              {errors[c.key] && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors[c.key]}</div>}
            </div>
          ))}
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar cliente</button>
        </div>
      </div>
    </div>
  );
}

// ─── GALERIA ──────────────────────────────────────────────────────────────────
// ─── EMITIR FATURA GLOBAL (com selector de cliente) ──────────────────────────
function EmitirFaturaGlobalModal({ clientes, onClose, onEmitir }) {
  const { user } = useAuth();
  const perfis = getPerfisLista ? getPerfisLista() : [];
  const [cliId, setCliId] = useState('');
  const [tipoDraft, setTipoDraft] = useState(true);
  const [form, setForm] = useState({ obra:'', valor:'', descricao:'', requerente: user?.nome || '', dataEmissao: new Date().toISOString().split('T')[0], condPag:'30 dias', pdf:null });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({...f,[k]:v})); setErrors(e => ({...e,[k]:''})); };
  const validate = () => {
    const e = {};
    if (!cliId) e.cli = 'Selecciona um cliente';
    if (!form.obra) e.obra = 'Selecciona uma obra';
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido';
    if (!form.descricao.trim()) e.descricao = 'Campo obrigatório';
    return e;
  };
  const handleEmitir = () => {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return; }
    onEmitir(cliId, { ...form, valor: Number(form.valor), tipo: tipoDraft ? 'draft' : 'final' });
  };
  const cliSel = clientes.find(c => c.id === cliId);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><div style={{ fontWeight:600, fontSize:15 }}>Emitir fatura</div><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>O Gestor de Obra receberá notificação para validar</div></div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>
          {/* Cliente selector */}
          <div style={{ gridColumn:'span 2' }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Cliente <span style={{ color:'var(--color-danger)' }}>*</span></label>
            <select value={cliId} onChange={e => { setCliId(e.target.value); setErrors(er => ({...er, cli:''})); }} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:`0.5px solid ${errors.cli ? 'var(--color-danger)' : 'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
              <option value="">Selecciona o cliente...</option>
              {[...clientes].sort((a,b) => a.nome.localeCompare(b.nome)).map(c => <option key={c.id} value={c.id}>{c.nome} — {c.sector}</option>)}
            </select>
            {errors.cli && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors.cli}</div>}
          </div>
          {/* Tipo */}
          <div style={{ gridColumn:'span 2' }}>
            <div style={{ display:'flex', background:'var(--bg-app)', borderRadius:8, padding:3, gap:3 }}>
              {[{val:true,label:'Draft',sub:'Para validação'},{val:false,label:'Fatura final',sub:'Emissão imediata'}].map(opt => (
                <button key={String(opt.val)} onClick={() => setTipoDraft(opt.val)} style={{ flex:1, padding:'8px 12px', borderRadius:6, border:tipoDraft===opt.val?'1px solid var(--brand-primary)':'1px solid transparent', background:tipoDraft===opt.val?'var(--bg-card)':'transparent', cursor:'pointer', fontFamily:'var(--font-body)', textAlign:'left' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:tipoDraft===opt.val?'var(--brand-primary)':'var(--text-secondary)' }}>{opt.label}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Obra */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Obra <span style={{ color:'var(--color-danger)' }}>*</span></label>
            <select value={form.obra} onChange={e => set('obra', e.target.value)} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:`0.5px solid ${errors.obra?'var(--color-danger)':'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
              <option value="">Selecciona...</option>
              {getObrasLista().map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.obra && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors.obra}</div>}
          </div>
          {/* Valor */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Valor (€) <span style={{ color:'var(--color-danger)' }}>*</span></label>
            <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="ex: 50000" style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:`0.5px solid ${errors.valor?'var(--color-danger)':'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
            {errors.valor && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors.valor}</div>}
          </div>
          {/* Data emissão */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Data emissão</label>
            <input type="date" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
          </div>
          {/* Condições */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Condições pag.</label>
            <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
              {['15 dias','30 dias','45 dias','60 dias','90 dias','acordado'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          {/* Descrição */}
          <div style={{ gridColumn:'span 2' }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>Descrição <span style={{ color:'var(--color-danger)' }}>*</span></label>
            <input value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="ex: Medição nº3 — Fase estrutura" style={{ width:'100%', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:`0.5px solid ${errors.descricao?'var(--color-danger)':'var(--border-strong)'}`, borderRadius:'var(--radius-sm)', background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
            {errors.descricao && <div style={{ fontSize:11, color:'var(--color-danger)', marginTop:4 }}>{errors.descricao}</div>}
          </div>
          {/* Gestor de Obra */}
          <div style={{ gridColumn:'span 2' }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 }}>
              Gestor de Obra <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>— quem aprova o draft</span>
            </label>
            <RequerentePicker value={form.requerente} onChange={v => set('Gestor de Obra', v)} />
          </div>
          {/* Info tipo */}
          <div style={{ gridColumn:'span 2', padding:'8px 12px', borderRadius:6, fontSize:12, background: tipoDraft ? 'var(--bg-warning)' : 'var(--bg-info)', color: tipoDraft ? '#7a4a0a' : '#0a3a6a', borderLeft:`3px solid ${tipoDraft ? 'var(--color-warning)' : 'var(--color-info)'}` }}>
            {tipoDraft
              ? form.requerente
                ? `⏳ ${form.requerente} receberá notificação para validar o draft.`
                : '⏳ O draft aguardará validação — indica um Gestor de Obra acima.'
              : '✓ A fatura será emitida imediatamente e a LG notificada.'}
          </div>
        </div>
        <div style={{ padding:'14px 20px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleEmitir}>📤 {tipoDraft ? 'Guardar draft' : 'Emitir fatura'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const location = useLocation();
  const { user } = useAuth();
  const { addNotif, marcarFeita } = useNotifications();
  const [search, setSearch]       = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [extras, setExtras]       = useState(loadExtras);
  const [showNovo, setShowNovo]   = useState(false);
  const [showEmitirGlobal, setShowEmitirGlobal] = useState(false);
  const [vistaCli, setVistaCli]   = useState('galeria');
  const [selected, setSelected]   = useState(null);
  const [abrirFaturaId, setAbrirFaturaId] = useState(null);
  const [toast, setToast]         = useState('');
  const [accessTarget, setAccessTarget] = useState(null);
  const canEditClientes = canEditModule(user, 'clientes');

  const allCli = mergeClientesData(extras);
  const clientesFallbackLevel = getModuleLevel(user, 'clientes');
  const visibleCli = allCli.filter(c => canViewEntity(user, 'clientes', c.id, clientesFallbackLevel));

  // Ao chegar via notificação, abre automaticamente o cliente e a fatura certos
  useEffect(() => {
    const meta = location.state?.abrirFatura;
    const clienteId = location.state?.abrirCliente;
    if (clienteId) {
      const cliente = visibleCli.find(c => c.id === clienteId);
      if (cliente) {
        setSelected(cliente);
        setAbrirFaturaId(null);
      }
      window.history.replaceState({}, '');
      return;
    }
    if (!meta?.faturaId) return;
    // Try to find by clienteId first, then by nome
    const cliente = visibleCli.find(c => c.id === meta.clienteId) || visibleCli.find(c => c.nome === meta.clienteNome);
    if (cliente) {
      setSelected(cliente);
      setAbrirFaturaId(meta.faturaId);
    } else if (meta.clienteId || meta.clienteNome) {
      // Cliente exists in faturas localStorage but not in list — reload extras
      try {
        const raw = JSON.parse(localStorage.getItem('sis_faturas_cli') || '{}');
        const extrasCli = JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]');
        const toSearch = [...CLIENTES_DATA, ...extrasCli].filter(c => canViewEntity(user, 'clientes', c.id, clientesFallbackLevel));
        const found = toSearch.find(c => c.id === meta.clienteId || c.nome === meta.clienteNome);
        if (found) { setSelected(found); setAbrirFaturaId(meta.faturaId); }
      } catch {}
    }
    window.history.replaceState({}, '');
  }, [location.state]);

  const handleSave = (form) => {
    if (!canEditClientes) return;
    const novo = { id: 'u_' + Date.now(), nome: form.nome, nif: form.nif, categoria: form.categoria, contacto: form.contacto || '—', email: form.email || '—', telefone: form.telefone || '—', morada: form.morada || '—', obras: [], totalFaturas: 0, totalRecebido: 0, pendente: 0, estado: 'ativo', faturas: [], _userCreated: true };
    const updated = [...extras, novo];
    setExtras(updated); saveExtras(updated);
    setShowNovo(false);
    setToast(`"${novo.nome}" adicionado`);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = (id) => {
    if (!canEditClientes) return;
    if (!window.confirm('Remover este cliente?')) return;
    const updated = extras.filter(c => c.id !== id);
    setExtras(updated); saveExtras(updated);
    setSelected(null);
  };

  const filtered = visibleCli.filter(c => {
    const s = search.toLowerCase();
    return (c.nome.toLowerCase().includes(s) || c.categoria.toLowerCase().includes(s) || c.nif.includes(search)) && (categoria === 'Todas' || c.categoria === categoria);
  });

  const totalRecebido = visibleCli.reduce((s, c) => s + c.totalRecebido, 0);
  const totalPendente = visibleCli.reduce((s, c) => s + c.pendente, 0);
  const comPendente   = visibleCli.filter(c => c.pendente > 0).length;

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:700, background:'var(--color-success)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:500, boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>{toast}</div>}
      {showNovo && canEditClientes && <NovoClienteModal onClose={() => setShowNovo(false)} onSave={handleSave} />}
      {accessTarget && (
        <EntityAccessEditorModal
          entityType="clientes"
          entityId={accessTarget.id}
          title={`Acessos — ${accessTarget.nome}`}
          subtitle={[accessTarget.id, accessTarget.categoria].filter(Boolean).join(' · ')}
          onClose={() => setAccessTarget(null)}
        />
      )}
      {selected && (
        <ClienteModal
          c={selected}
          abrirFaturaId={abrirFaturaId}
          onClose={() => { setSelected(null); setAbrirFaturaId(null); }}
          onDelete={handleDelete}
          canManageAccess={canEditClientes}
          onManageAccess={() => setAccessTarget(selected)}
        />
      )}
      {showEmitirGlobal && canEditClientes && (
        <EmitirFaturaGlobalModal
          clientes={visibleCli}
          onClose={() => setShowEmitirGlobal(false)}
          onEmitir={(cliId, dadosFatura) => {
            const cli = visibleCli.find(c => c.id === cliId);
            if (!cli) return;
            const all = JSON.parse(localStorage.getItem(FAT_KEY) || '{}');
            const faturas = all[cliId] || cli.faturas || [];
            const nova = {
              id: `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              nFatura: `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              descricao: dadosFatura.descricao, obra: dadosFatura.obra,
              valor: dadosFatura.valor, data: new Date(dadosFatura.dataEmissao).toLocaleDateString('pt-PT'),
              condPag: dadosFatura.condPag, requerente: dadosFatura.requerente,
              estado: dadosFatura.tipo === 'draft' ? 'draft' : (dadosFatura.requerente ? 'draft' : 'pendente_lg'),
              criadoPor: user?.nome || user?.initials || 'CA',
              tipo: dadosFatura.tipo, dataEmissao: dadosFatura.dataEmissao,
            };
            all[cliId] = [...faturas, nova];
            const json = JSON.stringify(all);
            localStorage.setItem(FAT_KEY, json);
            window.dispatchEvent(new StorageEvent('storage', { key: FAT_KEY, newValue: json }));
            // Resolve requerente name → user id for notification routing
            const listaP = getPerfisLista();
            const reqPerfil = listaP.find(p => p.nome === dadosFatura.requerente || p.initials === dadosFatura.requerente);
            const reqId = reqPerfil?.id || dadosFatura.requerente || 'lg';
            addNotif({ tipo: 'draft_emitido', icon: '📄', titulo: `Nova fatura para validar — ${cli.nome}`, sub: `${cli.nome} · ${nova.id} · ${nova.obra}`, path: '/clientes', destinatario: reqId, meta: { faturaId: nova.id, clienteId: cliId, clienteNome: cli.nome } });
            setShowEmitirGlobal(false);
            setSelected(cli);
          }}
        />
      )}

      <div className="page-header">
        <div><div className="page-title">Clientes</div><div className="page-subtitle">{visibleCli.length} clientes visíveis · Gestão de faturas e recebimentos</div></div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', background:'var(--bg-app)', borderRadius:8, border:'0.5px solid var(--border)', overflow:'hidden' }}>
            <button onClick={() => setVistaCli('galeria')} style={{ padding:'6px 10px', border:'none', cursor:'pointer', fontSize:14, background:vistaCli==='galeria'?'var(--brand-primary)':'transparent', color:vistaCli==='galeria'?'#fff':'var(--text-muted)' }} title="Vista galeria">⊞</button>
            <button onClick={() => setVistaCli('tabela')} style={{ padding:'6px 10px', border:'none', cursor:'pointer', fontSize:14, background:vistaCli==='tabela'?'var(--brand-primary)':'transparent', color:vistaCli==='tabela'?'#fff':'var(--text-muted)' }} title="Vista tabela">☰</button>
          </div>
          {canEditClientes && <button className="btn" onClick={() => setShowEmitirGlobal(true)}>📤 Emitir fatura</button>}
          {canEditClientes && <button className="btn btn-primary" onClick={() => setShowNovo(true)}>+ Novo cliente</button>}
        </div>
      </div>

      <NotifPanel
        tiposFiltro={['draft_emitido', 'draft_aprovado', 'fatura_emitida']}
        titulo="Notificações de faturas"
        max={4}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
        <div className="kpi-card"><div className="kpi-label">Total clientes</div><div className="kpi-value">{visibleCli.length}</div><div className="kpi-delta up">{comPendente} com pendentes</div></div>
        <div className="kpi-card"><div className="kpi-label">Total recebido</div><div className="kpi-value" style={{ color:'var(--color-success)' }}>{fmt(totalRecebido)}</div><div className="kpi-delta up">Confirmado</div></div>
        <div className="kpi-card"><div className="kpi-label">Por receber</div><div className="kpi-value" style={{ color:'var(--color-warning)' }}>{fmt(totalPendente)}</div><div className="kpi-delta dn">Aguarda recebimento</div></div>
        <div className="kpi-card"><div className="kpi-label">Faturas vencidas</div><div className="kpi-value" style={{ color:'var(--color-danger)' }}>1</div><div className="kpi-delta dn">Logicor Portugal</div></div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input className="sis-input" placeholder="Pesquisar por nome, sector ou NIF..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:300 }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {CATEGORIAS_CLI.map(c => (
            <button key={c} onClick={() => setCategoria(c)} style={{ fontFamily:'var(--font-body)', fontSize:12, padding:'5px 12px', borderRadius:20, border:'0.5px solid', borderColor: categoria === c ? 'var(--brand-primary)' : 'var(--border)', background: categoria === c ? 'var(--brand-primary)' : 'var(--bg-card)', color: categoria === c ? '#fff' : 'var(--text-secondary)', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
          Nenhum cliente encontrado. {canEditClientes && <span style={{ color:'var(--brand-primary)', cursor:'pointer' }} onClick={() => setShowNovo(true)}>Adicionar novo?</span>}
        </div>
      ) : vistaCli === 'galeria' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:12 }}>
          {filtered.map(c => {
            const est = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG['ativo'];
            return (
              <div key={c.id} className="card" onClick={() => setSelected(c)} style={{ cursor:'pointer', transition:'border-color .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand-primary)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(28,58,94,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.boxShadow=''; }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'var(--bg-success)', border:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--color-success)', flexShrink:0 }}>{c.nome.charAt(0)}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:14 }}>{c.nome}</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>{c.categoria}</div></div>
                  <span className={`badge ${est.cls}`} style={{ flexShrink:0 }}>{est.label}</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-muted)', marginBottom:10, flexWrap:'wrap' }}>
                  <span>NIF {c.nif}</span><span>·</span><span>{c.obras.length} obra{c.obras.length !== 1 ? 's' : ''}</span><span>·</span><span>{c.totalFaturas} faturas</span>
                </div>
                {c.obras.length > 0 && <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>{c.obras.map(o => <span key={o} className="badge badge-n">{o}</span>)}</div>}
                <div style={{ height:'0.5px', background:'var(--border)', margin:'10px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                  <div><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Total recebido</div><div style={{ fontSize:15, fontWeight:600, color:'var(--color-success)' }}>{fmt(c.totalRecebido)}</div></div>
                  {c.pendente > 0 ? <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Por receber</div><div style={{ fontSize:15, fontWeight:600, color:'var(--color-warning)' }}>{fmt(c.pendente)}</div></div> : <span className="badge badge-s">Tudo recebido</span>}
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
                {['Cliente','Sector','NIF','Obras','Faturas','Total recebido','Por receber','Estado'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const est = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG['ativo'];
                return (
                  <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor:'pointer', borderBottom:'0.5px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-app)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:7, background:'var(--bg-success)', border:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--color-success)', flexShrink:0 }}>{c.nome.charAt(0)}</div>
                        {c.nome}
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px', color:'var(--text-muted)' }}>{c.categoria}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:12 }}>{c.nif}</td>
                    <td style={{ padding:'10px 14px' }}>{c.obras.map(o => <span key={o} className="badge badge-n" style={{ marginRight:4 }}>{o}</span>)}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>{c.totalFaturas}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, textAlign:'right', color:'var(--color-success)' }}>{fmt(c.totalRecebido)}</td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: c.pendente > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>{c.pendente > 0 ? fmt(c.pendente) : '—'}</td>
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
