import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaturaDetalheModal, ClienteModal, CLIENTES_DATA, FATURA_CONFIG_CLI } from './Clientes';
import { FaturaFornDetalheModal, FornecedorModal, FORNECEDORES_DATA, FATURA_CONFIG_FORN } from './Fornecedores';
import { useAuth } from '../context/AuthContext';
import { canViewModule, loadPerfis } from '../context/PermissionsConfig';
import { withDemoSeed } from '../utils/deliveryMode';
import { RH_DOCS_VENC_PING_KEY, addDocVencimento, canAccessVencDocs, downloadStoredFile, formatCompetencia, loadDocsVencimento, removeDocVencimento } from '../utils/rhDocsVencimento';

// ─── LER FATURAS DO LOCALSTORAGE ─────────────────────────────────────────────
function loadFaturasCli() {
  try {
    const raw = JSON.parse(localStorage.getItem('sis_faturas_cli') || '{}');
    const result = [];
    // Para cada cliente, combina dados do cliente com as faturas guardadas
    const todosClientes = [
      ...CLIENTES_DATA,
      ...JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]'),
    ];
    todosClientes.forEach(cliente => {
      const faturas = raw[cliente.id] ?? cliente.faturas ?? [];
      faturas.forEach(fat => {
        result.push({
          ...fat,
          tipo: 'cliente',
          entidade: cliente.nome,
          clienteId: cliente.id,
          // docs dinâmicos baseados nos PDFs reais
          docs: [
            fat.pdf        && 'draft.pdf',
            fat.pdfFinal   && 'fatura_final.pdf',
            fat.comprovativoPagamento && 'comprovativo.pdf',
          ].filter(Boolean),
        });
      });
    });
    return result;
  } catch { return []; }
}

function loadFaturasForn() {
  try {
    const raw = JSON.parse(localStorage.getItem('sis_faturas_forn') || '{}');
    const result = [];
    const todosForn = [
      ...FORNECEDORES_DATA,
      ...JSON.parse(localStorage.getItem('sis_fornecedores_extra') || '[]'),
    ];
    todosForn.forEach(forn => {
      const faturas = raw[forn.id] ?? forn.faturas ?? [];
      faturas.forEach(fat => {
        result.push({
          ...fat,
          tipo: 'fornecedor',
          entidade: forn.nome,
          fornecedorId: forn.id,
          docs: [
            fat.pdf && 'fatura.pdf',
            fat.comprovativoPagamento && 'comprovativo.pdf',
          ].filter(Boolean),
        });
      });
    });
    return result;
  } catch { return []; }
}

function loadLogisticaDocs() {
  const flatten = (arr, area, getRef) =>
      (arr || []).flatMap(r =>
      (r.docs || []).map((d, i) => ({
        id: `${area}-${r.id}-${i}`,
        area,
        referencia: getRef(r),
        titulo: d.titulo || d.name,
        descricao: d.descricao || '',
        nome: d.name,
        dataUpload: d.uploadedAt || '',
        pdf: { name: d.name, base64: d.base64 },
      })),
    );

  try {
    const frota = JSON.parse(localStorage.getItem('sis_logistica_frota') || '[]');
    const imoveis = JSON.parse(localStorage.getItem('sis_logistica_imoveis') || '[]');
    const contratos = JSON.parse(localStorage.getItem('sis_logistica_contratos') || '[]');

    return [
      ...flatten(frota, 'Frota', r => `${r.matricula || '—'} · ${r.marcaModelo || '—'}`),
      ...flatten(imoveis, 'Imóveis', r => r.nome || '—'),
      ...flatten(contratos, 'Contratos', r => `${r.servico || '—'} · ${r.imovel || '—'}`),
    ];
  } catch {
    return [];
  }
}

// ─── DADOS ESTÁTICOS (JADOs e Relatórios) ────────────────────────────────────
const JADOS = withDemoSeed([
  { id: 'JADO-O142-001', obra: 'O142', fase: 'Fundações',   data: '12 Fev 2026', desvio: 1.8, estado: 'validado-ms',      fornecedor: 'Metalúrgica SA',     docs: ['jado.pdf', 'analise.pdf'] },
  { id: 'JADO-O142-002', obra: 'O142', fase: 'Estrutura',   data: '28 Fev 2026', desvio: 1.2, estado: 'env-comercial',    fornecedor: 'Construções RJ',     docs: ['jado.pdf'] },
  { id: 'JADO-O142-003', obra: 'O142', fase: 'Fundações',   data: '07 Mar 2026', desvio: 2.5, estado: 'aguarda-dp',       fornecedor: 'Betões Lisboa SA',   docs: ['jado.pdf'] },
  { id: 'JADO-O142-004', obra: 'O142', fase: 'Estrutura',   data: '10 Mar 2026', desvio: 2.4, estado: 'aguarda-dir-prod', fornecedor: 'Metalúrgica SA',     docs: ['jado.pdf'] },
  { id: 'JADO-O138-001', obra: 'O138', fase: 'Acabamentos', data: '08 Mar 2026', desvio: 6.3, estado: 'aguarda-dp',       fornecedor: 'IsolTec Unipessoal', docs: ['jado.pdf', 'relatorio.pdf'] },
  { id: 'JADO-O145-001', obra: 'O145', fase: 'Fundações',   data: '14 Mar 2026', desvio: 4.8, estado: 'aguarda-dp',       fornecedor: 'Betões Lisboa SA',   docs: ['jado.pdf'] },
]);

const RELATORIOS = withDemoSeed([
  { id: 'REL-001', tipo: 'semanal', obra: 'O142', titulo: 'Relatório Semanal — 10 Mar 2026',   data: '10 Mar 2026', destinatario: 'CG', docs: ['relatorio_semanal_O142_10mar.pdf'] },
  { id: 'REL-002', tipo: 'semanal', obra: 'O143', titulo: 'Relatório Semanal — 10 Mar 2026',   data: '10 Mar 2026', destinatario: 'CG', docs: ['relatorio_semanal_O143_10mar.pdf'] },
  { id: 'REL-003', tipo: 'semanal', obra: 'O138', titulo: 'Relatório Semanal — 10 Mar 2026',   data: '10 Mar 2026', destinatario: 'CG', docs: ['relatorio_semanal_O138_10mar.pdf'] },
  { id: 'REL-004', tipo: 'mensal',  obra: 'O142', titulo: 'Relatório Mensal — Fevereiro 2026', data: '05 Mar 2026', destinatario: 'CG', docs: ['relatorio_mensal_O142_fev.pdf', 'historico_jados.pdf'] },
  { id: 'REL-005', tipo: 'mensal',  obra: 'O143', titulo: 'Relatório Mensal — Fevereiro 2026', data: '05 Mar 2026', destinatario: 'CG', docs: ['relatorio_mensal_O143_fev.pdf'] },
  { id: 'REL-006', tipo: 'mensal',  obra: 'O138', titulo: 'Relatório Mensal — Fevereiro 2026', data: '05 Mar 2026', destinatario: 'CG', docs: ['relatorio_mensal_O138_fev.pdf'] },
  { id: 'REL-007', tipo: 'fecho',   obra: 'O135', titulo: 'Relatório de Fecho — Obra O135',    data: '15 Jan 2026', destinatario: 'CG', docs: ['relatorio_fecho_O135.pdf', 'cashflow_final.pdf', 'licoes_aprendidas.pdf'] },
]);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = v => '€ ' + Number(v).toLocaleString('pt-PT');

const ESTADO_JADO = {
  'aguarda-dp':       { label: 'Aguarda DP',         cls: 'badge-i' },
  'aguarda-dir-prod': { label: 'Aguarda Dir. Prod.',  cls: 'badge-i' },
  'enviado-ms':       { label: 'Enviado MS',          cls: 'badge-w' },
  'validado-ms':      { label: 'Validado MS',         cls: 'badge-s' },
  'env-comercial':    { label: 'Env. Comercial',      cls: 'badge-s' },
};
const TIPO_REL = {
  'semanal': { label: 'Semanal',       cls: 'badge-i', icon: '📅' },
  'mensal':  { label: 'Mensal',        cls: 'badge-w', icon: '📊' },
  'fecho':   { label: 'Fecho de obra', cls: 'badge-s', icon: '✓'  },
};

function downloadPdf(pdf) {
  if (!pdf?.base64) return;
  const a = document.createElement('a');
  a.href = pdf.base64;
  a.download = pdf.name || 'documento.pdf';
  a.click();
}

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function parseLooseDateParts(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, date: value };
  }
  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : { year, month, date };
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : { year, month, date };
  }

  const monthMap = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
  const namedMatch = str.toLowerCase().match(/(\d{1,2})\s+([a-zçé]+)\s+(\d{4})/i);
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const month = monthMap[namedMatch[2].slice(0, 3)] || null;
    const year = Number(namedMatch[3]);
    if (month) {
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : { year, month, date };
    }
  }

  return null;
}

function classifyFinanceKind(doc) {
  const text = `${doc.entidade || ''} ${doc.descricao || ''} ${doc.descricaoFatura || ''} ${doc.id || ''}`.toLowerCase();
  if (doc.tipo === 'cliente') return 'Clientes';
  if (/(banco|bank|bcp|millennium|cgd|caixa geral|santander|novo banco|bpi)/i.test(text)) return 'Bancos';
  if (/(caixa|cash)/i.test(text)) return 'Caixa';
  if (/(interno|interna|internas|documento interno)/i.test(text)) return 'Documentos internos';
  return 'Fornecedores';
}

function getFinanceDocs(faturasCli, faturasForn) {
  return [...faturasCli, ...faturasForn].map(doc => {
    const parsed = parseLooseDateParts(doc.data) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    return {
      ...doc,
      area: 'financeiro',
      kind: classifyFinanceKind(doc),
      year: parsed.year,
      month: parsed.month,
      monthLabel: NOMES_MES[(parsed.month || 1) - 1] || 'Sem mês',
    };
  });
}

const ARQUIVO_DOCS_EXTRA_KEY = 'sis_arquivo_docs_extra';
const ARQUIVO_FOLDERS_KEY = 'sis_arquivo_folders';
const ARQUIVO_AREAS_KEY = 'sis_arquivo_areas';

function loadArquivoExtraDocs() {
  try {
    const raw = JSON.parse(localStorage.getItem(ARQUIVO_DOCS_EXTRA_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveArquivoExtraDocs(list) {
  localStorage.setItem(ARQUIVO_DOCS_EXTRA_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('sis_arquivo_docs_extra_updated'));
}

function loadArquivoFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem(ARQUIVO_FOLDERS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveArquivoFolders(list) {
  localStorage.setItem(ARQUIVO_FOLDERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('sis_arquivo_folders_updated'));
}

function loadArquivoAreas() {
  try {
    const raw = JSON.parse(localStorage.getItem(ARQUIVO_AREAS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveArquivoAreas(list) {
  localStorage.setItem(ARQUIVO_AREAS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('sis_arquivo_areas_updated'));
}

function canAccessArquivoArea(user, areaKey, docsCount = 0) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const dept = String(user.departamento || '').toLowerCase();
  if (areaKey === 'financeiro') return canViewModule(user, 'tesouraria') || canViewModule(user, 'clientes') || canViewModule(user, 'fornecedores') || dept === 'financeiro';
  if (areaKey === 'comercial') return canViewModule(user, 'clientes') || dept === 'comercial';
  if (areaKey === 'recursos-humanos') return canViewModule(user, 'rh') || dept === 'rh' || docsCount > 0;
  if (areaKey === 'producao') return canViewModule(user, 'obras') || dept === 'producao';
  if (areaKey === 'producao-eletrica') return canViewModule(user, 'logistica') || dept === 'projeto_el';
  if (areaKey === 'gestao') return canViewModule(user, 'tesouraria') || canViewModule(user, 'obras') || dept === 'direcao';
  if (areaKey === 'projetos') return canViewModule(user, 'obras') || ['projeto', 'projeto_el', 'tecnico'].includes(dept);
  if (areaKey === 'obras') return canViewModule(user, 'obras');
  return canViewModule(user, 'arquivo');
}

function canAccessCustomArquivoItem(user, item) {
  if (!item) return false;
  if (user?.isAdmin) return true;
  if (item.visibility === 'private') return item.createdBy === user?.id;
  return true;
}

function canManageArquivo(user) {
  if (!user) return false;
  return Boolean(user.isAdmin || canViewModule(user, 'arquivo') && ((user.acoes || []).includes('adicionar_doc_pasta') || canViewModule(user, 'perfil')));
}

// ─── PASTA MODAL ──────────────────────────────────────────────────────────────
function PastaModal({ item, onClose }) {
  if (!item) return null;

  // Documentos reais da fatura (com base64 para download)
  const docsReais = [
    item.pdf        && { label: 'Draft original',           icon: '📄', pdf: item.pdf },
    item.pdfFinal   && { label: 'Fatura final',             icon: '🧾', pdf: item.pdfFinal },
    item.comprovativoPagamento && { label: 'Comprovativo de pagamento', icon: '✅', pdf: item.comprovativoPagamento },
    item.doc51      && { label: 'Documento 51',             icon: '🏁', pdf: item.doc51 },
  ].filter(Boolean);

  // Se não tem docs reais, usa docs estáticos (JADOs, relatórios)
  const temDocsReais = docsReais.length > 0;

  return (
    <div onClick={undefined} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Pasta digital</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {temDocsReais ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
                {docsReais.length} documento{docsReais.length > 1 ? 's' : ''} associado{docsReais.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docsReais.map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{doc.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 1 }}>{doc.label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{doc.pdf.name}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => downloadPdf(doc.pdf)}
                      disabled={!doc.pdf?.base64}
                      title={!doc.pdf?.base64 ? 'Ficheiro não disponível para download (sessão anterior)' : 'Descarregar'}
                    >
                      {doc.pdf?.base64 ? 'Descarregar' : 'Indisponível'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
                {(item.docs || []).length} documento{(item.docs || []).length !== 1 ? 's' : ''} associado{(item.docs || []).length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(item.docs || []).map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{doc}</span>
                    </div>
                    <button className="btn btn-sm" disabled>Indisponível</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagamento */}
          {item.pago && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-success)', borderRadius: 8, border: '0.5px solid var(--color-success)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Pago em {item.dataPagamento}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA ARQUIVO ───────────────────────────────────────────────────────────


export default function ArquivoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vistaArq, setVistaArq] = useState('galeria');
  const [search, setSearch] = useState('');
  const [pastaAberta, setPastaAberta] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [financePath, setFinancePath] = useState([]);
  const [rhPath, setRhPath] = useState([]);
  const [faturasCli, setFaturasCli] = useState([]);
  const [faturasForn, setFaturasForn] = useState([]);
  const [logisticaDocs, setLogisticaDocs] = useState([]);
  const [docsVencimento, setDocsVencimento] = useState([]);
  const [extraDocs, setExtraDocs] = useState([]);
  const [customFolders, setCustomFolders] = useState([]);
  const [customAreas, setCustomAreas] = useState([]);
  const [perfis, setPerfis] = useState(() => loadPerfis().filter(p => p.isColaborador));
  const [faturaCliAberta, setFaturaCliAberta] = useState(null);
  const [faturaFornAberta, setFaturaFornAberta] = useState(null);
  const [clienteAberto, setClienteAberto] = useState(null);
  const [fornecedorAberto, setFornecedorAberto] = useState(null);
  const [abrirFaturaId, setAbrirFaturaId] = useState(null);
  const [genericPath, setGenericPath] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const uploadInputRef = useRef(null);

  useEffect(() => {
    setFaturasCli(loadFaturasCli());
    setFaturasForn(loadFaturasForn());
    setLogisticaDocs(loadLogisticaDocs());
    loadDocsVencimento().then(setDocsVencimento);
    setExtraDocs(loadArquivoExtraDocs());
    setCustomFolders(loadArquivoFolders());
    setCustomAreas(loadArquivoAreas());
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'sis_faturas_cli') setFaturasCli(loadFaturasCli());
      if (e.key === 'sis_faturas_forn') setFaturasForn(loadFaturasForn());
      if (e.key === 'sis_logistica_frota' || e.key === 'sis_logistica_imoveis' || e.key === 'sis_logistica_contratos') setLogisticaDocs(loadLogisticaDocs());
      if (e.key === RH_DOCS_VENC_PING_KEY) loadDocsVencimento().then(setDocsVencimento);
      if (e.key === ARQUIVO_DOCS_EXTRA_KEY) setExtraDocs(loadArquivoExtraDocs());
      if (e.key === ARQUIVO_FOLDERS_KEY) setCustomFolders(loadArquivoFolders());
      if (e.key === ARQUIVO_AREAS_KEY) setCustomAreas(loadArquivoAreas());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const hDocs = () => loadDocsVencimento().then(setDocsVencimento);
    const hLog = () => setLogisticaDocs(loadLogisticaDocs());
    const hPerfis = () => setPerfis(loadPerfis().filter(p => p.isColaborador));
    const hExtra = () => setExtraDocs(loadArquivoExtraDocs());
    const hFolders = () => setCustomFolders(loadArquivoFolders());
    const hAreas = () => setCustomAreas(loadArquivoAreas());
    window.addEventListener('sis_rh_docs_vencimento_updated', hDocs);
    window.addEventListener('sis_logistica_docs_updated', hLog);
    window.addEventListener('sis_perfis_updated', hPerfis);
    window.addEventListener('sis_arquivo_docs_extra_updated', hExtra);
    window.addEventListener('sis_arquivo_folders_updated', hFolders);
    window.addEventListener('sis_arquivo_areas_updated', hAreas);
    return () => {
      window.removeEventListener('sis_rh_docs_vencimento_updated', hDocs);
      window.removeEventListener('sis_logistica_docs_updated', hLog);
      window.removeEventListener('sis_perfis_updated', hPerfis);
      window.removeEventListener('sis_arquivo_docs_extra_updated', hExtra);
      window.removeEventListener('sis_arquivo_folders_updated', hFolders);
      window.removeEventListener('sis_arquivo_areas_updated', hAreas);
    };
  }, []);

  const findCliente = nome => [...CLIENTES_DATA, ...JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]')].find(c => c.nome === nome);
  const findFornecedor = nome => [...FORNECEDORES_DATA, ...JSON.parse(localStorage.getItem('sis_fornecedores_extra') || '[]')].find(f => f.nome === nome);
  const abrirCliente = (nome, faturaId, e) => {
    e?.stopPropagation();
    const c = findCliente(nome);
    if (c) { setClienteAberto(c); setAbrirFaturaId(faturaId || null); }
  };
  const abrirFornecedor = (nome, e) => {
    e?.stopPropagation();
    const f = findFornecedor(nome);
    if (f) setFornecedorAberto(f);
  };

  const ObraLink = ({ obra }) => (
    <span
      onClick={e => { e.stopPropagation(); navigate(`/obras/${obra}`); }}
      style={{ color: 'var(--brand-primary)', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
    >
      {obra}
    </span>
  );

  const docsVencAcessiveis = docsVencimento
    .filter(doc => canAccessVencDocs(user, doc.colaboradorId))
    .map(doc => ({
      ...doc,
      area: 'recursos-humanos',
      colaboradorNome: perfis.find(p => p.id === doc.colaboradorId)?.nome || doc.colaboradorId,
    }));
  const extraDocsByArea = extraDocs.filter(doc => canAccessCustomArquivoItem(user, doc)).reduce((acc, doc) => {
    const area = doc.area || 'diversos';
    acc[area] = [...(acc[area] || []), doc];
    return acc;
  }, {});

  const docsFinanceiros = getFinanceDocs(faturasCli, faturasForn);
  const areaDocs = {
    financeiro: [...docsFinanceiros, ...(extraDocsByArea.financeiro || [])],
    comercial: [...JADOS.map(j => ({ ...j, area: 'comercial' })), ...(extraDocsByArea.comercial || [])],
    'recursos-humanos': [...docsVencAcessiveis, ...(extraDocsByArea['recursos-humanos'] || [])],
    producao: [...RELATORIOS.map(r => ({ ...r, area: 'producao' })), ...(extraDocsByArea.producao || [])],
    'producao-eletrica': [...logisticaDocs.map(d => ({ ...d, area: 'producao-eletrica' })), ...(extraDocsByArea['producao-eletrica'] || [])],
    gestao: [...RELATORIOS.filter(r => r.tipo === 'mensal' || r.tipo === 'fecho').map(r => ({ ...r, area: 'gestao' })), ...(extraDocsByArea.gestao || [])],
    projetos: [...JADOS.filter(j => j.fase?.toLowerCase().includes('estrutura') || j.fase?.toLowerCase().includes('funda')).map(j => ({ ...j, area: 'projetos' })), ...(extraDocsByArea.projetos || [])],
    obras: [...docsFinanceiros.filter(d => d.obra), ...JADOS.map(j => ({ ...j, area: 'obras' })), ...RELATORIOS.map(r => ({ ...r, area: 'obras' })), ...(extraDocsByArea.obras || [])],
  };
  customAreas
    .filter(area => canAccessCustomArquivoItem(user, area))
    .forEach(area => {
      areaDocs[area.key] = extraDocsByArea[area.key] || [];
    });

  const areaConfigs = [
    { key: 'financeiro', label: 'Financeiro', icon: '€', desc: 'Faturas organizadas em pasta por ano, mês e tipo documental.' },
    { key: 'comercial', label: 'Comercial', icon: '◌', desc: 'JADOs e documentação comercial ligada a fornecedores.' },
    { key: 'recursos-humanos', label: 'Recursos Humanos', icon: 'RH', desc: 'Documentos de vencimento e documentação do colaborador.' },
    { key: 'producao', label: 'Produção', icon: 'PR', desc: 'Relatórios, controlo e documentação de execução.' },
    { key: 'producao-eletrica', label: 'Produção Elétrica', icon: 'PE', desc: 'Documentos operacionais e logística técnica.' },
    { key: 'gestao', label: 'Gestão', icon: 'GE', desc: 'Relatórios de gestão e fechos relevantes.' },
    { key: 'projetos', label: 'Projetos', icon: 'PJ', desc: 'Documentação técnica associada a desenvolvimento e preparação.' },
    { key: 'obras', label: 'Obras', icon: 'OB', desc: 'Visão transversal dos documentos ligados às obras.' },
    ...customAreas
      .filter(area => canAccessCustomArquivoItem(user, area))
      .map(area => ({ key: area.key, label: area.label, icon: area.icon || 'AR', desc: area.desc || 'Área personalizada do Arquivo.' })),
  ];

  const areaCards = areaConfigs
    .map(area => ({ ...area, total: (areaDocs[area.key] || []).length }))
    .filter(area => canAccessArquivoArea(user, area.key, area.total))
    .filter(area => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return area.label.toLowerCase().includes(s) || area.desc.toLowerCase().includes(s);
    });

  const currentAreaDocs = selectedArea ? (areaDocs[selectedArea] || []) : [];
  const areaSearch = search.toLowerCase();
  const filteredAreaDocs = currentAreaDocs.filter(item => {
    if (!areaSearch) return true;
    return [
      item.id,
      item.nFatura,
      item.entidade,
      item.titulo,
      item.nome,
      item.obra,
      item.fase,
      item.descricao,
      item.colaboradorNome,
      item.kind,
      item.monthLabel,
      item.year,
    ].some(v => String(v || '').toLowerCase().includes(areaSearch));
  });

  let financeFolders = [];
  let financeDocsVisible = [];
  if (selectedArea === 'financeiro') {
    const extraFinanceFolders = customFolders.filter(folder =>
      canAccessCustomArquivoItem(user, folder) &&
      folder.area === 'financeiro' &&
      JSON.stringify(folder.path || []) === JSON.stringify(financePath),
    );
    if (financePath.length === 0) {
      financeFolders = [
        ...[...new Set(filteredAreaDocs.map(d => d.year))].sort((a, b) => b - a).map(year => ({
          key: String(year),
          title: String(year),
          subtitle: `${filteredAreaDocs.filter(d => d.year === year).length} documentos`,
        })),
        ...extraFinanceFolders.map(folder => ({
          key: folder.title,
          title: folder.title,
          subtitle: 'Pasta personalizada',
        })),
      ];
    } else if (financePath.length === 1) {
      const year = Number(financePath[0]);
      const docsYear = filteredAreaDocs.filter(d => d.year === year);
      financeFolders = [
        ...[...new Set(docsYear.map(d => d.month))].sort((a, b) => a - b).map(month => ({
          key: String(month),
          title: NOMES_MES[month - 1],
          subtitle: `${docsYear.filter(d => d.month === month).length} documentos`,
        })),
        ...extraFinanceFolders.map(folder => ({
          key: folder.title,
          title: folder.title,
          subtitle: 'Pasta personalizada',
        })),
      ];
    } else if (financePath.length === 2) {
      const [year, month] = financePath.map(Number);
      const docsMonth = filteredAreaDocs.filter(d => d.year === year && d.month === month);
      financeFolders = [
        ...[...new Set(docsMonth.map(d => d.kind))].sort((a, b) => a.localeCompare(b, 'pt-PT')).map(kind => ({
          key: kind,
          title: kind,
          subtitle: `${docsMonth.filter(d => d.kind === kind).length} documentos`,
        })),
        ...extraFinanceFolders.map(folder => ({
          key: folder.title,
          title: folder.title,
          subtitle: 'Pasta personalizada',
        })),
      ];
    } else {
      const [year, month] = financePath.slice(0, 2).map(Number);
      const kind = financePath[2];
      financeDocsVisible = filteredAreaDocs.filter(d => d.year === year && d.month === month && d.kind === kind);
    }
  }

  let rhFolders = [];
  let rhDocsVisible = [];
  if (selectedArea === 'recursos-humanos') {
    const currentRhPath = rhPath;
    const extraRhFolders = customFolders.filter(folder =>
      canAccessCustomArquivoItem(user, folder) &&
      folder.area === 'recursos-humanos' &&
      JSON.stringify(folder.path || []) === JSON.stringify(currentRhPath),
    );
    if (rhPath.length === 0) {
      const colaboradores = [...new Set(filteredAreaDocs.map(d => d.colaboradorNome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-PT'));
      rhFolders = [
        ...colaboradores.map(nome => ({
          key: nome,
          title: nome,
          subtitle: `${filteredAreaDocs.filter(d => d.colaboradorNome === nome).length} documentos`,
        })),
        {
          key: '__diversos__',
          title: 'Diversos',
          subtitle: `${filteredAreaDocs.filter(d => !d.colaboradorNome).length} documentos`,
        },
        ...extraRhFolders.map(folder => ({
          key: folder.title,
          title: folder.title,
          subtitle: 'Pasta personalizada',
        })),
      ];
    } else {
      const currentFolder = rhPath[0];
      const builtInRhFolder = currentFolder === '__diversos__' || perfis.some(p => p.nome === currentFolder);
      if (builtInRhFolder) {
        rhDocsVisible = currentFolder === '__diversos__'
        ? filteredAreaDocs.filter(d => !d.colaboradorNome)
        : filteredAreaDocs.filter(d => d.colaboradorNome === currentFolder);
      } else {
        const folderPath = ['custom', ...rhPath].join(' / ');
        const childFolders = customFolders.filter(folder =>
          folder.area === 'recursos-humanos' &&
          JSON.stringify(folder.path || []) === JSON.stringify(rhPath),
        );
        rhFolders = childFolders.map(folder => ({
          key: folder.title,
          title: folder.title,
          subtitle: 'Pasta personalizada',
        }));
        rhDocsVisible = filteredAreaDocs.filter(d => d.folder === folderPath);
      }
    }
  }

  let genericFolders = [];
  let genericDocsVisible = [];
  if (selectedArea && selectedArea !== 'financeiro' && selectedArea !== 'recursos-humanos') {
    const currentGenericPath = genericPath;
    const currentPathKey = ['custom', ...currentGenericPath].join(' / ');
    genericFolders = customFolders
      .filter(folder => canAccessCustomArquivoItem(user, folder))
      .filter(folder => folder.area === selectedArea && JSON.stringify(folder.path || []) === JSON.stringify(currentGenericPath))
      .map(folder => ({
        key: folder.title,
        title: folder.title,
        subtitle: 'Pasta personalizada',
      }));
    genericDocsVisible = genericPath.length === 0
      ? filteredAreaDocs.filter(d => !d.folder)
      : filteredAreaDocs.filter(d => d.folder === currentPathKey);
  }

  const breadcrumbs = selectedArea
    ? [
        { label: 'Áreas', action: () => { setSelectedArea(null); setFinancePath([]); setRhPath([]); } },
        { label: areaConfigs.find(a => a.key === selectedArea)?.label || selectedArea, action: () => { setFinancePath([]); setRhPath([]); } },
        ...financePath.map((part, idx) => ({
          label: idx === 1 ? NOMES_MES[Number(part) - 1] : String(part),
          action: () => setFinancePath(financePath.slice(0, idx + 1)),
        })),
        ...rhPath.map((part, idx) => ({
          label: part === '__diversos__' ? 'Diversos' : part,
          action: () => setRhPath(rhPath.slice(0, idx + 1)),
        })),
        ...genericPath.map((part, idx) => ({
          label: part,
          action: () => setGenericPath(genericPath.slice(0, idx + 1)),
        })),
      ]
    : [];

  const openArea = (key) => {
    if (!canAccessArquivoArea(user, key, (areaDocs[key] || []).length)) return;
    setSelectedArea(key);
    setFinancePath([]);
    setRhPath([]);
    setGenericPath([]);
    setMenuOpen(false);
  };
  const openFinanceFolder = (key) => setFinancePath(prev => [...prev, key]);
  const goBackFinance = () => setFinancePath(prev => prev.slice(0, -1));
  const openRhFolder = (key) => setRhPath(prev => [...prev, key]);
  const goBackRh = () => setRhPath(prev => prev.slice(0, -1));
  const openGenericFolder = (key) => setGenericPath(prev => [...prev, key]);
  const goBackGeneric = () => setGenericPath(prev => prev.slice(0, -1));

  const getCurrentUploadTarget = () => {
    if (!selectedArea) return { mode: 'arquivo-root', folder: '' };
    if (selectedArea === 'recursos-humanos') {
      if (rhPath.length === 0) return { mode: 'arquivo', folder: '' };
      const builtInRhFolder = rhPath[0] === '__diversos__' || perfis.some(p => p.nome === rhPath[0]);
      if (builtInRhFolder) return { mode: rhPath[0] === '__diversos__' ? 'arquivo' : 'rh-sync', folder: rhPath[0] };
      return { mode: 'arquivo', folder: ['custom', ...rhPath].join(' / ') };
    }
    if (selectedArea === 'financeiro') return { mode: 'arquivo', folder: financePath.join(' / ') };
    return { mode: 'arquivo', folder: genericPath.length ? ['custom', ...genericPath].join(' / ') : '' };
  };

  const handleUploadArquivo = async () => {
    const target = getCurrentUploadTarget();
    const file = uploadInputRef.current?.files?.[0];
    if (!target || !file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const baseDoc = {
        id: `arq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        titulo: file.name,
        nome: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: e.target?.result || '',
        dataUpload: new Date().toISOString(),
      };
      if (target.mode === 'rh-sync') {
        const perfil = perfis.find(p => p.nome === target.folder);
        if (!perfil) {
          window.alert('Não foi possível identificar o colaborador desta pasta.');
          return;
        }
        try {
          await addDocVencimento({
            colaboradorId: perfil.id,
            competencia: new Date().toISOString().slice(0, 7),
            titulo: baseDoc.titulo,
            nome: baseDoc.nome,
            mimeType: baseDoc.mimeType,
            base64: baseDoc.base64,
          });
        } catch (error) {
          window.alert(error?.message || 'Não foi possível guardar o documento.');
          return;
        }
      } else {
        let areaTarget = selectedArea;
        if (target.mode === 'arquivo-root') {
          const areas = areaConfigs.map(area => area.label).join('\n');
          const chosen = window.prompt(`Escolhe a área de destino:\n${areas}`, areaConfigs[0]?.label || '');
          if (!chosen) return;
          areaTarget = areaConfigs.find(area => area.label.toLowerCase() === chosen.trim().toLowerCase())?.key || areaConfigs[0]?.key;
        }
        const extra = loadArquivoExtraDocs();
        saveArquivoExtraDocs([
          {
            ...baseDoc,
            area: areaTarget,
            folder: target.folder,
            referencia: target.folder,
            pdf: { name: baseDoc.nome, base64: baseDoc.base64 },
            createdBy: user?.id || 'anon',
            visibility: 'private',
          },
          ...extra,
        ]);
      }
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const getCurrentFolderContext = () => {
    if (!selectedArea) return { area: null, path: [] };
    if (selectedArea === 'financeiro') return { area: selectedArea, path: financePath };
    if (selectedArea === 'recursos-humanos') return { area: selectedArea, path: rhPath };
    return { area: selectedArea, path: genericPath };
  };

  const handleCreateFolder = (folderName) => {
    const name = String(folderName || '').trim();
    const ctx = getCurrentFolderContext();
    if (!name || !ctx) return;
    let areaTarget = ctx.area;
    if (!areaTarget) {
      const areas = areaConfigs.map(area => area.label).join('\n');
      const chosen = window.prompt(`Criar pasta em que área?\n${areas}`, areaConfigs[0]?.label || '');
      if (!chosen) return;
      areaTarget = areaConfigs.find(area => area.label.toLowerCase() === chosen.trim().toLowerCase())?.key || areaConfigs[0]?.key;
    }
    const exists = customFolders.some(folder =>
      folder.area === areaTarget &&
      JSON.stringify(folder.path || []) === JSON.stringify(ctx.path || []) &&
      folder.title.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      window.alert('Já existe uma pasta com esse nome neste nível.');
      return;
    }
    saveArquivoFolders([
      {
        id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        area: areaTarget,
        path: ctx.path || [],
        title: name,
        createdBy: user?.id || 'anon',
        visibility: 'private',
      },
      ...customFolders,
    ]);
  };

  const renderAreaCards = () => {
    if (vistaArq === 'tabela') {
      return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="sis-table">
            <thead><tr><th>Área</th><th>Descrição</th><th>Documentos</th><th>Abrir</th></tr></thead>
            <tbody>
              {areaCards.map(area => (
                <tr key={area.key}>
                  <td style={{ fontWeight: 700 }}>{area.label}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{area.desc}</td>
                  <td><span className="badge badge-n">{area.total}</span></td>
                  <td><button className="btn btn-sm" onClick={() => openArea(area.key)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14 }}>
        {areaCards.map(area => (
          <button
            key={area.key}
            className="card"
            onClick={() => openArea(area.key)}
            style={{ textAlign: 'left', cursor: 'pointer', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-card)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{area.icon}</div>
              <span className="badge badge-i">{area.total}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{area.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{area.desc}</div>
          </button>
        ))}
      </div>
    );
  };

  const renderFolderGrid = (folders, onOpenFolder = openFinanceFolder) => {
    if (vistaArq === 'tabela') {
      return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="sis-table">
            <thead><tr><th>Pasta</th><th>Conteúdo</th><th>Abrir</th></tr></thead>
            <tbody>
              {folders.map(folder => (
                <tr key={folder.key}>
                  <td style={{ fontWeight: 700 }}>📁 {folder.title}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{folder.subtitle}</td>
                  <td><button className="btn btn-sm" onClick={() => onOpenFolder(folder.key)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14 }}>
        {folders.map(folder => (
          <button key={folder.key} className="card" onClick={() => onOpenFolder(folder.key)} style={{ textAlign: 'left', cursor: 'pointer', padding: 18 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📁</div>
            <div style={{ fontWeight: 700 }}>{folder.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{folder.subtitle}</div>
          </button>
        ))}
      </div>
    );
  };

  const renderDocsTable = (docs, areaKey) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {docs.length === 0 ? <Empty search={search} msg="Nenhum documento encontrado" /> : (
        <table className="sis-table">
          <thead>
            {areaKey === 'financeiro' && <tr><th>Nº</th><th>Entidade</th><th>Obra</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Detalhe</th></tr>}
            {areaKey === 'recursos-humanos' && <tr><th>Colaborador</th><th>Competência</th><th>Título</th><th>Ficheiro</th><th>Download</th></tr>}
            {areaKey === 'comercial' && <tr><th>Nº JADO</th><th>Obra</th><th>Fase</th><th>Fornecedor</th><th>Estado</th><th>Pasta</th></tr>}
            {areaKey !== 'financeiro' && areaKey !== 'recursos-humanos' && areaKey !== 'comercial' && <tr><th>ID</th><th>Título</th><th>Referência</th><th>Data</th><th>Ação</th></tr>}
          </thead>
          <tbody>
            {docs.map(doc => {
              if (areaKey === 'financeiro') {
                const isCliente = doc.tipo === 'cliente';
                const estadoCfg = isCliente ? FATURA_CONFIG_CLI[doc.estado] : FATURA_CONFIG_FORN[doc.estado];
                return (
                  <tr key={`${doc.tipo}-${doc.id}`}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontWeight: 600 }}>{doc.id}</td>
                    <td>
                      <span onClick={e => (isCliente ? abrirCliente(doc.entidade, doc.id, e) : abrirFornecedor(doc.entidade, e))} style={{ color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                        {doc.entidade}
                      </span>
                    </td>
                    <td>{doc.obra ? <ObraLink obra={doc.obra} /> : '—'}</td>
                    <td><span className="badge badge-n">{doc.kind}</span></td>
                    <td style={{ fontWeight: 700 }}>{fmt(doc.valor || 0)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{doc.data || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className={`badge ${estadoCfg?.cls || 'badge-n'}`}>{estadoCfg?.label || doc.estado || '—'}</span>
                        <button className="btn btn-sm" onClick={() => (isCliente ? setFaturaCliAberta(doc) : setFaturaFornAberta(doc))}>Abrir</button>
                        <button className="btn btn-sm" onClick={() => setPastaAberta(doc)}>Pasta</button>
                        {canManageArquivo(user) && doc.pdf?.base64 && <button className="btn btn-sm" onClick={() => moveArquivoDoc(doc)}>Mover</button>}
                      </div>
                    </td>
                  </tr>
                );
              }
              if (areaKey === 'recursos-humanos') {
                return (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: 700 }}>{doc.colaboradorNome || 'Diversos'}</td>
                    <td><span className="badge badge-n">{doc.competencia ? formatCompetencia(doc.competencia) : 'Arquivo'}</span></td>
                    <td>{doc.titulo || doc.nome || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{doc.nome}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => downloadStoredFile(doc.pdf || doc)}>Descarregar</button>
                        {canManageArquivo(user) && <button className="btn btn-sm" onClick={() => moveArquivoDoc(doc)}>Mover</button>}
                      </div>
                    </td>
                  </tr>
                );
              }
              if (areaKey === 'comercial') {
                return (
                  <tr key={doc.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontWeight: 600 }}>{doc.id}</td>
                    <td>{doc.obra ? <ObraLink obra={doc.obra} /> : '—'}</td>
                    <td>{doc.fase || '—'}</td>
                    <td>
                      {doc.fornecedor ? (
                        <span onClick={e => abrirFornecedor(doc.fornecedor, e)} style={{ color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                          {doc.fornecedor}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span className={`badge ${ESTADO_JADO[doc.estado]?.cls || 'badge-n'}`}>{ESTADO_JADO[doc.estado]?.label || doc.estado}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => doc.pdf?.base64 ? downloadPdf(doc.pdf) : setPastaAberta(doc)}>{doc.pdf?.base64 ? 'Descarregar' : 'Pasta'}</button>
                        {canManageArquivo(user) && doc.pdf?.base64 && <button className="btn btn-sm" onClick={() => moveArquivoDoc(doc)}>Mover</button>}
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={doc.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontWeight: 600 }}>{doc.id || doc.nome || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{doc.titulo || doc.referencia || doc.nome || '—'}</td>
                  <td>{doc.obra ? <ObraLink obra={doc.obra} /> : (doc.referencia || doc.entidade || '—')}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{doc.data || (doc.dataUpload ? new Date(doc.dataUpload).toLocaleString('pt-PT') : '—')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {doc.pdf?.base64
                        ? <button className="btn btn-sm" onClick={() => downloadPdf(doc.pdf)}>Descarregar</button>
                        : <button className="btn btn-sm" onClick={() => setPastaAberta(doc)}>Pasta</button>}
                      {canManageArquivo(user) && doc.pdf?.base64 && <button className="btn btn-sm" onClick={() => moveArquivoDoc(doc)}>Mover</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const uploadTarget = getCurrentUploadTarget();
  const openDocumentPicker = () => {
    setMenuOpen(false);
    uploadInputRef.current?.click();
  };

  const promptCreateFolder = () => {
    setMenuOpen(false);
    const nome = window.prompt('Nome da nova pasta:');
    if (!nome) return;
    handleCreateFolder(nome);
  };

  const promptCreateArea = () => {
    setMenuOpen(false);
    const nome = window.prompt('Nome da nova área:');
    if (!nome) return;
    const label = nome.trim();
    const key = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!key) return;
    if (areaConfigs.some(area => area.key === key) || customAreas.some(area => area.key === key)) {
      window.alert('Já existe uma área com esse nome.');
      return;
    }
    saveArquivoAreas([
      {
        id: `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        key,
        label,
        icon: label.slice(0, 2).toUpperCase(),
        desc: 'Área personalizada do Arquivo.',
        createdBy: user?.id || 'anon',
        visibility: 'private',
      },
      ...customAreas,
    ]);
  };

  const buildMoveTargets = (areaKey) => {
    if (areaKey === 'financeiro') {
      const builtIn = docsFinanceiros.map(doc => `${doc.year} / ${doc.monthLabel} / ${doc.kind}`);
      const custom = customFolders.filter(folder => canAccessCustomArquivoItem(user, folder) && folder.area === 'financeiro').map(folder => ['custom', ...(folder.path || []), folder.title].join(' / '));
      return ['Raiz', ...new Set([...builtIn, ...custom])];
    }
    if (areaKey === 'recursos-humanos') {
      const builtIn = ['Diversos', ...perfis.map(p => p.nome)];
      const custom = customFolders.filter(folder => canAccessCustomArquivoItem(user, folder) && folder.area === 'recursos-humanos').map(folder => ['custom', ...(folder.path || []), folder.title].join(' / '));
      return [...new Set([...builtIn, ...custom])];
    }
    const custom = customFolders.filter(folder => canAccessCustomArquivoItem(user, folder) && folder.area === areaKey).map(folder => ['custom', ...(folder.path || []), folder.title].join(' / '));
    return ['Raiz', ...new Set(custom)];
  };

  const moveArquivoDoc = async (doc) => {
    if (!canManageArquivo(user)) return;
    const options = buildMoveTargets(doc.area || selectedArea);
    const suggestion = window.prompt(`Mover para:\n${options.join('\n')}`, options[0] || 'Raiz');
    if (!suggestion) return;
    const destino = suggestion.trim();
    if (!destino) return;

    if (doc.colaboradorId) {
      if (destino === 'Diversos' || destino.startsWith('custom /')) {
        await removeDocVencimento(doc.id);
        saveArquivoExtraDocs([
          {
            id: `arq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            area: 'recursos-humanos',
            folder: destino === 'Diversos' ? '' : destino,
            titulo: doc.titulo,
            nome: doc.nome,
            mimeType: doc.mimeType,
            base64: doc.base64,
            dataUpload: new Date().toISOString(),
            pdf: { name: doc.nome, base64: doc.base64 },
            createdBy: user?.id || 'anon',
            visibility: 'private',
          },
          ...loadArquivoExtraDocs(),
        ]);
        return;
      }
      const perfil = perfis.find(p => p.nome === destino);
      if (!perfil) return;
      await addDocVencimento({ ...doc, colaboradorId: perfil.id });
      return;
    }

    const docs = loadArquivoExtraDocs();
    saveArquivoExtraDocs(docs.map(item => item.id === doc.id ? {
      ...item,
      area: doc.area || selectedArea,
      folder: destino === 'Raiz' ? '' : destino,
      referencia: destino === 'Raiz' ? '' : destino,
    } : item));
  };

  return (
    <div>
      <input
        ref={uploadInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={() => { handleUploadArquivo(); }}
      />
      {faturaCliAberta && <FaturaDetalheModal fatura={faturaCliAberta} cliente={faturaCliAberta.entidade} onClose={() => setFaturaCliAberta(null)} />}
      {faturaFornAberta && <FaturaFornDetalheModal fatura={faturaFornAberta} fornecedor={faturaFornAberta.entidade} onClose={() => setFaturaFornAberta(null)} />}
      {clienteAberto && <ClienteModal c={clienteAberto} abrirFaturaId={abrirFaturaId} onClose={() => { setClienteAberto(null); setAbrirFaturaId(null); }} />}
      {fornecedorAberto && <FornecedorModal f={fornecedorAberto} onClose={() => setFornecedorAberto(null)} />}
      <PastaModal item={pastaAberta} onClose={() => setPastaAberta(null)} />

      <div className="page-header">
        <div>
          <div className="page-title">Arquivo</div>
          <div className="page-subtitle">
            {selectedArea
              ? `Área ${areaConfigs.find(a => a.key === selectedArea)?.label || selectedArea}`
              : 'Entrada por áreas: financeiro, comercial, RH, produção, gestão, projetos e obras'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canManageArquivo(user) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                title="Mais opções"
                style={{
                  width: 44,
                  height: 34,
                  borderRadius: 8,
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, lineHeight: 1 }}>
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: 'currentColor', display: 'block', opacity: 0.7 }} />
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: 'currentColor', display: 'block', opacity: 0.7 }} />
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: 'currentColor', display: 'block', opacity: 0.7 }} />
                </span>
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 40, minWidth: 180, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 6, zIndex: 30 }}>
                  <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={openDocumentPicker}>Adicionar documento</button>
                  <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={promptCreateFolder}>Criar pasta</button>
                  {!selectedArea && <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={promptCreateArea}>Criar área</button>}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <button onClick={() => setVistaArq('galeria')} style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 14, background: vistaArq === 'galeria' ? 'var(--brand-primary)' : 'transparent', color: vistaArq === 'galeria' ? '#fff' : 'var(--text-muted)' }} title="Vista galeria">⊞</button>
            <button onClick={() => setVistaArq('tabela')} style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 14, background: vistaArq === 'tabela' ? 'var(--brand-primary)' : 'transparent', color: vistaArq === 'tabela' ? '#fff' : 'var(--text-muted)' }} title="Vista tabela">☰</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 360px' }}>
          <input
            className="sis-input"
            placeholder={selectedArea === 'financeiro' ? 'Pesquisar pasta, entidade, obra ou fatura...' : selectedArea ? 'Pesquisar documentos desta área...' : 'Pesquisar área...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⌕</span>
        </div>
        {(search || selectedArea) && <button className="btn btn-sm" onClick={() => { setSearch(''); if (selectedArea === 'financeiro' && financePath.length) setFinancePath([]); }}>Limpar</button>}
      </div>

      {breadcrumbs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button
            onClick={() => {
            if (selectedArea === 'financeiro' && financePath.length > 0) goBackFinance();
              else if (selectedArea === 'recursos-humanos' && rhPath.length > 0) goBackRh();
              else if (selectedArea && selectedArea !== 'financeiro' && selectedArea !== 'recursos-humanos' && genericPath.length > 0) goBackGeneric();
              else { setSelectedArea(null); setFinancePath([]); setRhPath([]); setGenericPath([]); }
            }}
            title="Voltar atrás"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: '0.5px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ←
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <button key={`${crumb.label}-${idx}`} className="btn btn-sm" onClick={crumb.action}>{crumb.label}</button>
          ))}
        </div>
      )}

      {!selectedArea && renderAreaCards()}

      {selectedArea === 'financeiro' && (
        <div>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Estrutura financeira</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Ano → Mês → Tipo documental. Tipos atuais: clientes, fornecedores, bancos, caixa e documentos internos.</div>
            </div>
          </div>
          {financeDocsVisible.length > 0 ? renderDocsTable(financeDocsVisible, 'financeiro') : <div style={{ marginBottom: 22 }}>{renderFolderGrid(financeFolders)}</div>}
        </div>
      )}

      {selectedArea === 'recursos-humanos' && (
        <div>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700 }}>Estrutura de RH</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Uma pasta por colaborador e uma pasta `Diversos` para documentação transversal.</div>
          </div>
          {rhFolders.length > 0 && <div style={{ marginBottom: 22 }}>{renderFolderGrid(rhFolders, openRhFolder)}</div>}
          {(rhPath.length > 0 || rhFolders.length === 0) && renderDocsTable(rhDocsVisible, 'recursos-humanos')}
        </div>
      )}

      {selectedArea && selectedArea !== 'financeiro' && selectedArea !== 'recursos-humanos' && (
        <>
          {genericFolders.length > 0 && <div style={{ marginBottom: 22 }}>{renderFolderGrid(genericFolders, openGenericFolder)}</div>}
          {renderDocsTable(genericDocsVisible, selectedArea)}
        </>
      )}
    </div>
  );
}

function Empty({ search, msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>◻</div>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{msg || 'Nenhum resultado encontrado'}</div>
      {search && <div style={{ fontSize: 13 }}>Nenhum documento corresponde a "{search}"</div>}
    </div>
  );
}
