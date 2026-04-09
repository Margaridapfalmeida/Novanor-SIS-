import { useState, useRef, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  loadPerfis,
  savePerfis,
  DEPARTAMENTOS,
  getFotoColaborador,
  canAccessCollaboratorProfile,
  canApproveFeriasFor,
  canManageCollaborator,
  getHierarchyManagers,
  getHierarchyType,
  getManagedDepartments,
} from '../context/PermissionsConfig';
import { withDemoSeed } from '../utils/deliveryMode';
import { addDocVencimento, canAccessVencDocs, downloadStoredFile, formatCompetencia, loadDocsVencimento, removeDocVencimento } from '../utils/rhDocsVencimento';

// ─── DADOS DEMO ───────────────────────────────────────────────────────────────
const COLABORADORES_DEFAULT = [
  { id: 'c001', nome: 'Miguel Seabra',        cargo: 'CEO',                       dept: 'Direcção',        email: 'ms@novanor.pt',  telemovel: '+351 912 000 001', dataAdmissao: '01/01/2015', estado: 'activo',   salario: 8500, categoria: 'Quadros Superiores' },
  { id: 'c002', nome: 'Leonor Gomes',          cargo: 'Diretora Financeira / RH',  dept: 'Financeiro',      email: 'lg@novanor.pt',  telemovel: '+351 912 000 002', dataAdmissao: '15/03/2016', estado: 'activo',   salario: 5800, categoria: 'Quadros Superiores' },
  { id: 'c003', nome: 'Ana Rodrigues',          cargo: 'Controller de Gestão',      dept: 'Direcção',        email: 'cg@novanor.pt',  telemovel: '+351 912 000 003', dataAdmissao: '01/06/2018', estado: 'activo',   salario: 4200, categoria: 'Quadros Médios' },
  { id: 'c004', nome: 'Carla Sousa',            cargo: 'Assistente Administrativa', dept: 'Financeiro',      email: 'ca@novanor.pt',  telemovel: '+351 912 000 004', dataAdmissao: '10/09/2019', estado: 'activo',   salario: 1800, categoria: 'Administrativos' },
  { id: 'c005', nome: 'Gilberta Alves',         cargo: 'Assistente Administrativa', dept: 'Financeiro',      email: 'ga@novanor.pt',  telemovel: '+351 912 000 005', dataAdmissao: '05/02/2020', estado: 'activo',   salario: 1800, categoria: 'Administrativos' },
  { id: 'c006', nome: 'Pedro Serrão',           cargo: 'Diretor de Produção',       dept: 'Produção',        email: 'ps@novanor.pt',  telemovel: '+351 912 000 006', dataAdmissao: '01/04/2014', estado: 'activo',   salario: 5200, categoria: 'Quadros Superiores' },
  { id: 'c007', nome: 'José Manuel Silva',      cargo: 'Técnico Comercial',         dept: 'Comercial',       email: 'jms@novanor.pt', telemovel: '+351 912 000 007', dataAdmissao: '20/07/2017', estado: 'activo',   salario: 2400, categoria: 'Técnicos' },
  { id: 'c008', nome: 'Pedro Raimundo',         cargo: 'Dir. Projecto Eléctrico',   dept: 'Proj. Eléctrico', email: 'pr@novanor.pt',  telemovel: '+351 912 000 008', dataAdmissao: '12/11/2015', estado: 'activo',   salario: 4800, categoria: 'Quadros Superiores' },
  { id: 'c009', nome: 'Frederico Seabra',       cargo: 'Gestor Comercial',          dept: 'Comercial',       email: 'fs@novanor.pt',  telemovel: '+351 912 000 009', dataAdmissao: '03/03/2018', estado: 'activo',   salario: 3200, categoria: 'Quadros Médios' },
  { id: 'c010', nome: 'José Simão',             cargo: 'Diretor Comercial',         dept: 'Comercial',       email: 'js@novanor.pt',  telemovel: '+351 912 000 010', dataAdmissao: '01/01/2016', estado: 'activo',   salario: 5000, categoria: 'Quadros Superiores' },
  { id: 'c011', nome: 'André Palma',            cargo: 'Dir. Assistência Técnica',  dept: 'Proj. Eléctrico', email: 'ap@novanor.pt',  telemovel: '+351 912 000 011', dataAdmissao: '08/08/2017', estado: 'activo',   salario: 4600, categoria: 'Quadros Superiores' },
  { id: 'c012', nome: 'Daniel Bandeira',        cargo: 'Diretor de Obra',           dept: 'Produção',        email: 'db@novanor.pt',  telemovel: '+351 912 000 012', dataAdmissao: '14/05/2016', estado: 'activo',   salario: 4400, categoria: 'Quadros Superiores' },
  { id: 'c013', nome: 'Hamilton Ascensão',      cargo: 'Diretor de Contrato',       dept: 'Produção',        email: 'ha@novanor.pt',  telemovel: '+351 912 000 013', dataAdmissao: '22/09/2015', estado: 'activo',   salario: 4400, categoria: 'Quadros Superiores' },
  { id: 'c014', nome: 'Rafael Pereira',         cargo: 'Diretor de Obra',           dept: 'Produção',        email: 'rp@novanor.pt',  telemovel: '+351 912 000 014', dataAdmissao: '01/02/2019', estado: 'activo',   salario: 4200, categoria: 'Quadros Superiores' },
  { id: 'c015', nome: 'José Carlos Dias',       cargo: 'Preparador de Obra',        dept: 'Produção',        email: 'jcd@novanor.pt', telemovel: '+351 912 000 015', dataAdmissao: '10/10/2018', estado: 'activo',   salario: 2800, categoria: 'Técnicos' },
  { id: 'c016', nome: 'Manuel Rhodes Mendonça', cargo: 'Diretor de Projecto',       dept: 'Projecto',        email: 'mrm@novanor.pt', telemovel: '+351 912 000 016', dataAdmissao: '05/06/2014', estado: 'activo',   salario: 4800, categoria: 'Quadros Superiores' },
  { id: 'c017', nome: 'Carlos Duque',           cargo: 'Diretor Técnico',           dept: 'Técnico',         email: 'cd@novanor.pt',  telemovel: '+351 912 000 017', dataAdmissao: '18/04/2015', estado: 'activo',   salario: 4600, categoria: 'Quadros Superiores' },
  { id: 'c018', nome: 'Paulo Capelão',          cargo: 'Encarregado',               dept: 'Proj. Eléctrico', email: 'pc@novanor.pt',  telemovel: '+351 912 000 018', dataAdmissao: '25/01/2017', estado: 'activo',   salario: 2200, categoria: 'Técnicos' },
  { id: 'c019', nome: 'Leandro Mesquita',       cargo: 'Desenhador',                dept: 'Comercial',       email: 'lm@novanor.pt',  telemovel: '+351 912 000 019', dataAdmissao: '11/11/2019', estado: 'activo',   salario: 2000, categoria: 'Técnicos' },
  { id: 'c020', nome: 'Vitor Romão',            cargo: 'Encarregado',               dept: 'Proj. Eléctrico', email: 'vr@novanor.pt',  telemovel: '+351 912 000 020', dataAdmissao: '03/07/2018', estado: 'activo',   salario: 2200, categoria: 'Técnicos' },
];

const CATEGORIAS_SAL = [
  { id: 'qs',  label: 'Quadros Superiores', cor: '#1C3A5E', n: 10 },
  { id: 'qm',  label: 'Quadros Médios',     cor: '#2E7D52', n: 3  },
  { id: 'tec', label: 'Técnicos',           cor: '#6B2E7A', n: 5  },
  { id: 'adm', label: 'Administrativos',    cor: '#8B4A12', n: 2  },
];

const FERIAS_DEFAULT = withDemoSeed([
  { id: 'f001', colaborador: 'Pedro Serrão',    inicio: '2026-07-14', fim: '2026-07-25', dias: 10, tipo: 'Férias', estado: 'aprovado' },
  { id: 'f002', colaborador: 'Carla Sousa',     inicio: '2026-08-03', fim: '2026-08-14', dias: 10, tipo: 'Férias', estado: 'pendente' },
  { id: 'f003', colaborador: 'Ana Rodrigues',   inicio: '2026-06-01', fim: '2026-06-05', dias: 5,  tipo: 'Férias', estado: 'aprovado' },
  { id: 'f004', colaborador: 'Daniel Bandeira', inicio: '2026-05-02', fim: '2026-05-02', dias: 1,  tipo: 'Falta',  estado: 'pendente' },
  { id: 'f005', colaborador: 'José Simão',      inicio: '2026-09-07', fim: '2026-09-18', dias: 10, tipo: 'Férias', estado: 'pendente' },
]);

const HORARIOS_DEFAULT = withDemoSeed([
  { id: 'h001', nome: 'Horário Geral',      entrada: '09:00', saida: '18:00', intervalo: '60m', dias: 'Seg–Sex' },
  { id: 'h002', nome: 'Obra / Campo',       entrada: '08:00', saida: '17:00', intervalo: '60m', dias: 'Seg–Sex' },
  { id: 'h003', nome: 'Part-time Manhã',    entrada: '09:00', saida: '13:00', intervalo: '—',   dias: 'Seg–Sex' },
  { id: 'h004', nome: 'Flexível (Escrit.)', entrada: '08:00', saida: '17:00', intervalo: '60m', dias: 'Seg–Sex' },
]);

const PASSAGENS_DEFAULT = withDemoSeed([
  { id: 'p001', colaborador: 'Pedro Serrão',    destino: 'Lisboa → Porto', ida: '2026-04-10', volta: '2026-04-11', preco: 89.50,  estado: 'aprovado', companhia: 'TAP' },
  { id: 'p002', colaborador: 'José Simão',       destino: 'Lisboa → Madrid', ida: '2026-04-22', volta: '2026-04-24', preco: 156.00, estado: 'pendente', companhia: 'Iberia' },
  { id: 'p003', colaborador: 'Ana Rodrigues',    destino: 'Lisboa → Frankfurt', ida: '2026-05-06', volta: '2026-05-08', preco: 312.00, estado: 'pendente', companhia: 'Lufthansa' },
]);

const FERIADOS_2026 = [
  { data: '2026-01-01', nome: "Ano Novo", tipo: 'nacional' },
  { data: '2026-04-03', nome: "Sexta-Feira Santa", tipo: 'nacional' },
  { data: '2026-04-05', nome: "Páscoa", tipo: 'nacional' },
  { data: '2026-04-25', nome: "Dia da Liberdade", tipo: 'nacional' },
  { data: '2026-05-01', nome: "Dia do Trabalhador", tipo: 'nacional' },
  { data: '2026-06-10', nome: "Dia de Portugal", tipo: 'nacional' },
  { data: '2026-06-13', nome: "Santo António (Lisboa)", tipo: 'municipal' },
  { data: '2026-08-15', nome: "Assunção de Nossa Senhora", tipo: 'nacional' },
  { data: '2026-10-05', nome: "Implantação da República", tipo: 'nacional' },
  { data: '2026-11-01', nome: "Dia de Todos os Santos", tipo: 'nacional' },
  { data: '2026-12-01', nome: "Restauração da Independência", tipo: 'nacional' },
  { data: '2026-12-08', nome: "Imaculada Conceição", tipo: 'nacional' },
  { data: '2026-12-25', nome: "Natal", tipo: 'nacional' },
];

const LS_COL  = 'sis_rh_colab';
const LS_FER  = 'sis_rh_ferias';
const LS_HOR  = 'sis_rh_horarios';
const LS_PAS  = 'sis_rh_passagens';
const LS_DESP = 'sis_rh_despesas';
const RH_REGIMES = [
  'Híbrido',
  'Teletrabalho',
  'Presencial 8 às 17',
  'Presencial 9 às 18',
  'Isenção de horário',
  'Part-time',
  'Outro',
];
const RH_EXTRA_DEFAULTS = {
  ms: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Mestrado', taxaAssiduidade: 98, dataNascimento: '1978-03-14' },
  lg: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 97, dataNascimento: '1984-07-18' },
  ca: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: '12.º ano', taxaAssiduidade: 96, dataNascimento: '1991-02-03' },
  cg: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 98, dataNascimento: '1989-11-20' },
  dp: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 95, dataNascimento: '1977-09-12' },
  ga: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: '12.º ano', taxaAssiduidade: 97, dataNascimento: '1993-05-09' },
  jms: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 96, dataNascimento: '1986-04-11' },
  pr: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 95, dataNascimento: '1982-06-28' },
  fs: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 96, dataNascimento: '1988-01-08' },
  js: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 97, dataNascimento: '1980-12-16' },
  ap: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 95, dataNascimento: '1983-08-24' },
  db: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 94, dataNascimento: '1985-10-07' },
  ha: { nacionalidade: 'Angolana', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 95, dataNascimento: '1981-03-29' },
  mrm: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 96, dataNascimento: '1979-05-22' },
  cd: { nacionalidade: 'Portuguesa', tipoContrato: 'Sem termo', habilitacoes: 'Licenciatura', taxaAssiduidade: 97, dataNascimento: '1980-01-30' },
};

function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
// ─── File storage separado para faturas (evita quota exceeded) ────────────────
const DESP_FILE_PFX = 'sis_rh_desp_file_';
function saveFile(id, data) { try { localStorage.setItem(DESP_FILE_PFX + id, data); } catch(e) { console.warn('Fatura não guardada (ficheiro demasiado grande):', e); } }
function loadFile(id) { try { return localStorage.getItem(DESP_FILE_PFX + id) || null; } catch { return null; } }
function removeFile(id) { try { localStorage.removeItem(DESP_FILE_PFX + id); } catch {} }
function loadDespesas() {
  const list = load(LS_DESP, []);
  return list.map(i => {
    if (i.fatura && !i.fatura.data) {
      const data = loadFile(i.id);
      return data ? { ...i, fatura: { ...i.fatura, data } } : i;
    }
    return i;
  });
}
function getColabIdByNome(nome) { return loadPerfis().find(c => c.isColaborador && c.nome === nome)?.id || null; }

function removePerfilExtra(id) {
  try {
    const all = JSON.parse(localStorage.getItem('sis_perfil_extra') || '{}');
    if (!all[id]) return;
    delete all[id];
    localStorage.setItem('sis_perfil_extra', JSON.stringify(all));
    window.dispatchEvent(new Event('perfil_foto_updated'));
  } catch {}
}

function loadVisibleCollaborators(user) {
  const perfis = loadPerfis();
  return perfis.filter(p => p.isColaborador && canAccessCollaboratorProfile(user, p, perfis));
}

function loadManageableCollaborators(user) {
  const perfis = loadPerfis();
  return perfis.filter(p => p.isColaborador && canManageCollaborator(user, p, perfis));
}

const fmt = v => '€ ' + Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2 });

function loadPerfilExtraMap() {
  try {
    return JSON.parse(localStorage.getItem('sis_perfil_extra') || '{}');
  } catch {
    return {};
  }
}

function getRhExtra(perfil, extraMap = loadPerfilExtraMap()) {
  const base = RH_EXTRA_DEFAULTS[perfil?.id] || {};
  const extra = extraMap?.[perfil?.id] || {};
  return {
    salario: 0,
    dataAdmissao: '',
    nacionalidade: '',
    dataNascimento: '',
    tipoContrato: '',
    habilitacoes: '',
    taxaAssiduidade: '',
    ...base,
    ...extra,
  };
}

function getAgeFromPerfil(perfil, extra = null) {
  const idadeNumerica = Number(perfil?.idade);
  if (Number.isFinite(idadeNumerica) && idadeNumerica > 0) return idadeNumerica;
  const dataNascimento = (extra || getRhExtra(perfil)).dataNascimento;
  if (!dataNascimento) return null;
  const birth = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age > 0 ? age : null;
}

function formatPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function formatPercentValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${Number(value).toFixed(1)}%`;
}

function formatDatePt(value) {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-PT');
}

function computeTenureYears(value) {
  if (!value) return null;
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value.split('/').reverse().join('-') : value;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const years = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 ? years : 0;
}

// ─── SECÇÃO: COLABORADORES ────────────────────────────────────────────────────
function Colaboradores({ abrirColaboradorId }) {
  const { user } = useAuth();
  // ── Fonte única: sis_perfis filtrado por isColaborador ──────────────────────
  const [perfis, setPerfis] = useState(() => loadVisibleCollaborators(user));
  const [search, setSearch] = useState('');
  const [dept,   setDept]   = useState('Todos');
  const [selected, setSelected] = useState(null);
  const [showNovo, setShowNovo] = useState(null); // null | 'novo' | perfil obj
  const [, forceRender] = useState(0);
  const fileRef = useRef(null);
  const [fotoUploadId, setFotoUploadId] = useState(null);
  const [docsVencimento, setDocsVencimento] = useState([]);
  const [docsVencLoading, setDocsVencLoading] = useState(false);
  const [docVencForm, setDocVencForm] = useState({ competencia: '', titulo: '', file: null });

  // Re-sync quando sis_perfis muda (ex: via página de Perfis)
  useEffect(() => {
    const handler = () => setPerfis(loadVisibleCollaborators(user));
    window.addEventListener('storage', handler);
    window.addEventListener('sis_perfis_updated', handler);
    return () => { window.removeEventListener('storage', handler); window.removeEventListener('sis_perfis_updated', handler); };
  }, [user]);

  useEffect(() => {
    let active = true;
    const syncDocs = async () => {
      setDocsVencLoading(true);
      const docs = await loadDocsVencimento();
      if (!active) return;
      setDocsVencimento(docs);
      setDocsVencLoading(false);
    };
    syncDocs();
    const handler = () => { syncDocs(); };
    const storageHandler = (e) => {
      if (e.key === 'sis_rh_docs_vencimento_ping') syncDocs();
    };
    window.addEventListener('sis_rh_docs_vencimento_updated', handler);
    window.addEventListener('storage', storageHandler);
    return () => {
      active = false;
      window.removeEventListener('sis_rh_docs_vencimento_updated', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };
  const depts = ['Todos', ...new Set(perfis.map(p => DEPARTAMENTOS.find(d=>d.id===p.departamento)?.label || p.departamento || 'Outro'))];
  const perfilTipo = getHierarchyType(user);
  const canCreateColaborador = Boolean(user?.isAdmin || ['ceo', 'gestao', 'chefia_area'].includes(perfilTipo));
  const manageableCollaborators = useMemo(() => loadManageableCollaborators(user), [user, perfis.length]);
  const manageableDepartmentIds = user?.isAdmin || perfilTipo === 'ceo' || perfilTipo === 'gestao'
    ? DEPARTAMENTOS.map(d => d.id)
    : getManagedDepartments(user);
  const availableDepartments = DEPARTAMENTOS.filter(d => manageableDepartmentIds.includes(d.id) || d.id === 'outro');

  const filtered = perfis.filter(p => {
    const dept_ = DEPARTAMENTOS.find(d=>d.id===p.departamento)?.label || p.departamento || 'Outro';
    const matchS = !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.role||'').toLowerCase().includes(search.toLowerCase());
    const matchD = dept==='Todos' || dept_===dept;
    return matchS && matchD;
  });

  const savePerfisAndSync = (updated) => {
    savePerfis(updated);
    setPerfis(updated.filter(p => p.isColaborador && canAccessCollaboratorProfile(user, p, updated)));
    window.dispatchEvent(new Event('sis_perfis_updated'));
  };

  const getExtra = (id) => { try { return JSON.parse(localStorage.getItem('sis_perfil_extra')||'{}')[id] || {}; } catch { return {}; } };
  const setExtra = (id, fields) => {
    try {
      const all = JSON.parse(localStorage.getItem('sis_perfil_extra')||'{}');
      all[id] = { ...(all[id]||{}), ...fields };
      localStorage.setItem('sis_perfil_extra', JSON.stringify(all));
      window.dispatchEvent(new Event('perfil_foto_updated'));
      forceRender(n => n+1);
    } catch {}
  };

  const handleFoto = (id, file) => {
    const r = new FileReader();
    r.onload = e => setExtra(id, { foto: e.target.result });
    r.readAsDataURL(file);
    setFotoUploadId(null);
  };

  const guardarDocumentoVencimento = async () => {
    if (!selected || !docVencForm.competencia || !docVencForm.file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await addDocVencimento({
          colaboradorId: selected.id,
          competencia: docVencForm.competencia,
          titulo: docVencForm.titulo.trim() || `Recibo ${formatCompetencia(docVencForm.competencia)}`,
          nome: docVencForm.file.name,
          mimeType: docVencForm.file.type || 'application/octet-stream',
          base64: e.target?.result || '',
        });
        setDocVencForm({ competencia: '', titulo: '', file: null });
      } catch (error) {
        window.alert(error?.message || 'Não foi possível guardar o documento.');
      }
    };
    reader.readAsDataURL(docVencForm.file);
  };

  const removerDocumentoVencimento = async (docId) => {
    if (!window.confirm('Remover este documento de vencimento?')) return;
    try {
      await removeDocVencimento(docId);
    } catch (error) {
      window.alert(error?.message || 'Não foi possível remover o documento.');
    }
  };

  // Adicionar novo colaborador — cria entrada em sis_perfis com isColaborador=true
  const [formNovo, setFormNovo] = useState({
    nome:'', email:'', role:'', departamento:'outro', colaboradorId:'', idade:'', genero:'',
    salario:'', dataAdmissao:'', nacionalidade:'', dataNascimento:'', tipoContrato:'', habilitacoes:'', taxaAssiduidade:''
  });
  const setFN = (k,v) => setFormNovo(f=>({...f,[k]:v}));

  const abrirEdicao = (p) => {
    const extra = getExtra(p.id);
    setFormNovo({
      nome: p.nome || '',
      email: p.email || '',
      role: p.role || '',
      departamento: p.departamento || 'outro',
      colaboradorId: p.colaboradorId || '',
      idade: p.idade || '',
      genero: p.genero || '',
      salario: extra.salario || '',
      dataAdmissao: extra.dataAdmissao || '',
      nacionalidade: extra.nacionalidade || '',
      dataNascimento: extra.dataNascimento || '',
      tipoContrato: extra.tipoContrato || '',
      habilitacoes: extra.habilitacoes || '',
      taxaAssiduidade: extra.taxaAssiduidade || '',
    });
    setShowNovo(p);
  };

  const criarColaborador = () => {
    if (!formNovo.nome.trim()) return;
    if (!canCreateColaborador) return;
    if (manageableDepartmentIds.length && !manageableDepartmentIds.includes(formNovo.departamento) && !user?.isAdmin && perfilTipo !== 'gestao' && perfilTipo !== 'ceo') {
      window.alert('Só podes criar colaboradores nas áreas que geres.');
      return;
    }
    const todos = loadPerfis();
    const id = 'col_' + Date.now().toString().slice(-6);
    const dept = DEPARTAMENTOS.find(d=>d.id===formNovo.departamento);
    const novo = {
      id, initials: formNovo.nome.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3),
      nome: formNovo.nome, email: formNovo.email, role: formNovo.role,
      departamento: formNovo.departamento, cor: dept?.cor || '#9CA3AF',
      colaboradorId: formNovo.colaboradorId, idade: formNovo.idade, genero: formNovo.genero,
      isColaborador: true, isAdmin: false, pin: '1234',
      paginas: ['/'], acoes: [],
      notificacoes: {},
      // RH extra — stored in sis_perfil_extra
    };
    savePerfisAndSync([...todos, novo]);
    // Store RH-specific fields in extra
    setExtra(id, {
      salario: Number(formNovo.salario)||0,
      dataAdmissao: formNovo.dataAdmissao,
      nacionalidade: formNovo.nacionalidade,
      dataNascimento: formNovo.dataNascimento,
      tipoContrato: formNovo.tipoContrato,
      habilitacoes: formNovo.habilitacoes,
      taxaAssiduidade: formNovo.taxaAssiduidade === '' ? '' : Number(formNovo.taxaAssiduidade),
    });
    setFormNovo({
      nome:'', email:'', role:'', departamento:'outro', colaboradorId:'', idade:'', genero:'',
      salario:'', dataAdmissao:'', nacionalidade:'', dataNascimento:'', tipoContrato:'', habilitacoes:'', taxaAssiduidade:''
    });
    setShowNovo(null);
  };

  const guardarEdicaoColaborador = () => {
    if (!showNovo || showNovo === 'novo' || !formNovo.nome.trim()) return;
    if (!canManageCollaborator(user, showNovo, loadPerfis()) && !user?.isAdmin) {
      window.alert('Não tens permissão para editar este colaborador.');
      return;
    }
    const todos = loadPerfis();
    const dept = DEPARTAMENTOS.find(d => d.id === formNovo.departamento);
    const updated = todos.map(p => p.id === showNovo.id
      ? {
          ...p,
          nome: formNovo.nome,
          email: formNovo.email,
          role: formNovo.role,
          departamento: formNovo.departamento,
          cor: dept?.cor || p.cor || '#9CA3AF',
          colaboradorId: formNovo.colaboradorId,
          idade: formNovo.idade,
          genero: formNovo.genero,
          isColaborador: true,
        }
      : p);
    savePerfisAndSync(updated);
    setExtra(showNovo.id, {
      salario: Number(formNovo.salario) || 0,
      dataAdmissao: formNovo.dataAdmissao || '',
      nacionalidade: formNovo.nacionalidade || '',
      dataNascimento: formNovo.dataNascimento || '',
      tipoContrato: formNovo.tipoContrato || '',
      habilitacoes: formNovo.habilitacoes || '',
      taxaAssiduidade: formNovo.taxaAssiduidade === '' ? '' : Number(formNovo.taxaAssiduidade),
    });
    setSelected(s => (s?.id === showNovo.id ? { ...s, ...updated.find(p => p.id === showNovo.id) } : s));
    setFormNovo({
      nome:'', email:'', role:'', departamento:'outro', colaboradorId:'', idade:'', genero:'',
      salario:'', dataAdmissao:'', nacionalidade:'', dataNascimento:'', tipoContrato:'', habilitacoes:'', taxaAssiduidade:''
    });
    setShowNovo(null);
  };

  const removerColaborador = (p) => {
    if (!p) return;
    if (!canManageCollaborator(user, p, loadPerfis()) && !user?.isAdmin) {
      window.alert('Não tens permissão para remover este colaborador.');
      return;
    }
    if (p.id === user?.id) {
      window.alert('Não é possível remover o utilizador com sessão iniciada.');
      return;
    }
    if (!window.confirm(`Remover o colaborador "${p.nome}"?`)) return;
    const updated = loadPerfis().filter(x => x.id !== p.id);
    savePerfisAndSync(updated);
    removePerfilExtra(p.id);
    setSelected(s => (s?.id === p.id ? null : s));
  };

  const totalSalario = perfis.reduce((s,p) => s + (getExtra(p.id).salario||0), 0);

  useEffect(() => {
    if (!abrirColaboradorId) return;
    const perfil = perfis.find(p => p.id === abrirColaboradorId);
    if (perfil) setSelected(perfil);
  }, [abrirColaboradorId, perfis]);

  return (
    <div>
      <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display:'none' }}
        onChange={e=>{ const f=e.target.files?.[0]; if(f&&fotoUploadId) handleFoto(fotoUploadId,f); e.target.value=''; }} />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Colaboradores', value:perfis.length, sub:`${perfis.filter(p=>!p.inativo).length} activos`, cor:'var(--brand-primary)' },
          { label:'Massa Salarial', value:fmt(totalSalario), sub:'Mensal bruto estimado', cor:'var(--color-success)' },
          { label:'Departamentos', value:new Set(perfis.map(p=>p.departamento)).size, sub:'Áreas distintas', cor:'#6B2E7A' },
          { label:'Com foto', value:perfis.filter(p=>getFotoColaborador(p.id)).length, sub:'Perfis completos', cor:'#8B4A12' },
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.cor }}>{k.value}</div>
            <div className="kpi-delta up">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar por nome ou cargo..."
          style={{ flex:1, minWidth:200, fontFamily:'var(--font-body)', fontSize:13, padding:'7px 12px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-app)', color:'var(--text-primary)', outline:'none' }} />
        <select value={dept} onChange={e=>setDept(e.target.value)}
          style={{ fontFamily:'var(--font-body)', fontSize:13, padding:'7px 12px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
          {depts.map(d=><option key={d}>{d}</option>)}
        </select>
        {canCreateColaborador && <button className="btn btn-primary" onClick={()=>setShowNovo('novo')}>+ Novo colaborador</button>}
      </div>

      {/* Form novo colaborador */}
      {showNovo && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>{showNovo === 'novo' ? 'Novo colaborador' : 'Editar colaborador'}
            <span style={{ fontSize:12, fontWeight:400, color:'var(--text-muted)', marginLeft:8 }}>Também cria perfil de acesso no SIS</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            {[
              ['Nome completo *','nome','text',''],
              ['Email','email','email','nome@novanor.pt'],
              ['Cargo / Função','role','text','ex: Diretor de Obra'],
              ['ID Colaborador','colaboradorId','text','ex: COL-016'],
              ['Idade','idade','number',''],
              ['Data de Nascimento','dataNascimento','date',''],
              ['Data de Admissão','dataAdmissao','date',''],
              ['Salário Bruto (€)','salario','number',''],
              ['Nacionalidade','nacionalidade','text','ex: Portuguesa'],
              ['Tipo de contrato','tipoContrato','text','ex: Sem termo'],
              ['Habilitações','habilitacoes','text','ex: Licenciatura'],
              ['Taxa de assiduidade (%)','taxaAssiduidade','number','ex: 96'],
            ].map(([label,key,type,placeholder])=>(
              <div key={key}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>{label}</label>
                <input
                  type={type}
                  value={formNovo[key]}
                  onChange={e=>setFN(key,e.target.value)}
                  placeholder={placeholder}
                  min={key === 'taxaAssiduidade' ? 0 : undefined}
                  max={key === 'taxaAssiduidade' ? 100 : undefined}
                  style={IS}
                />
              </div>
            ))}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Género</label>
              <select value={formNovo.genero} onChange={e=>setFN('genero',e.target.value)} style={IS}>
                {[['','Não indicado'],['M','Masculino'],['F','Feminino'],['Outro','Outro']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Departamento</label>
              <select value={formNovo.departamento} onChange={e=>setFN('departamento',e.target.value)} style={IS}>
                {availableDepartments.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop:12, padding:'8px 12px', background:'var(--bg-info)', borderRadius:8, fontSize:12, color:'#0a3a6a' }}>
            ℹ Este colaborador ficará disponível em todas as funcionalidades de RH e será adicionado automaticamente como utilizador do SIS (sem acessos até serem atribuídos na página de Perfis).
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
            <button className="btn" onClick={()=>setShowNovo(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={showNovo === 'novo' ? criarColaborador : guardarEdicaoColaborador}>
              {showNovo === 'novo' ? '+ Criar colaborador' : 'Guardar alterações'}
            </button>
          </div>
        </div>
      )}

      {/* Tabela de colaboradores */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
              {['Foto','ID','Nome','Cargo','Departamento','Género','Idade','Salário','Ações'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const foto = getFotoColaborador(p.id);
              const extra = getExtra(p.id);
              const dept = DEPARTAMENTOS.find(d=>d.id===p.departamento);
              return (
                <tr key={p.id} style={{ borderBottom:'0.5px solid var(--border)', cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-app)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  {/* Foto */}
                  <td style={{ padding:'8px 12px' }}>
                    <div style={{ position:'relative', display:'inline-block' }}>
                      {foto
                        ? <img src={foto} alt={p.initials} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:`2px solid ${p.cor||'#ccc'}` }} />
                        : <div style={{ width:40, height:40, borderRadius:'50%', background:p.cor||'#9CA3AF', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{p.initials}</div>
                      }
                      <button onClick={e=>{e.stopPropagation(); setFotoUploadId(p.id); setTimeout(()=>fileRef.current?.click(),50);}}
                        style={{ position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:'50%', background:'var(--brand-primary)', color:'#fff', border:'2px solid var(--bg-card)', cursor:'pointer', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
                        title="Alterar foto">✎</button>
                    </div>
                  </td>
                  {/* ID */}
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{p.colaboradorId||'—'}</span>
                  </td>
                  {/* Nome */}
                  <td style={{ padding:'8px 12px' }} onClick={()=>setSelected(p)}>
                    <div style={{ fontWeight:600 }}>{p.nome}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.email}</div>
                  </td>
                  {/* Cargo */}
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)', maxWidth:160 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.role||'—'}</div>
                  </td>
                  {/* Departamento */}
                  <td style={{ padding:'8px 12px' }}>
                    {dept
                      ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:dept.cor, color:dept.corTexto, whiteSpace:'nowrap' }}>{dept.label}</span>
                      : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
                    }
                  </td>
                  {/* Género */}
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>
                    {p.genero==='M'?'♂ M':p.genero==='F'?'♀ F':p.genero||'—'}
                  </td>
                  {/* Idade */}
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>
                    {p.idade||'—'}
                  </td>
                  {/* Salário (de extra) */}
                  <td style={{ padding:'8px 12px', fontWeight:600, fontSize:12 }}>
                    {extra.salario ? fmt(extra.salario) : '—'}
                  </td>
                  {/* Ações */}
                  <td style={{ padding:'8px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-sm" onClick={()=>setSelected(p)}>Ver</button>
                      {canManageCollaborator(user, p, loadPerfis()) && <button className="btn btn-sm" onClick={()=>abrirEdicao(p)}>Editar</button>}
                      {canManageCollaborator(user, p, loadPerfis()) && <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={()=>removerColaborador(p)}>Remover</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detalhe colaborador */}
      {selected && (() => {
        const foto = getFotoColaborador(selected.id);
        const extra = getRhExtra(selected, loadPerfilExtraMap());
        const dept = DEPARTAMENTOS.find(d=>d.id===selected.departamento);
        const podeGerirDocs = canAccessVencDocs(user, selected.id);
        const docsColaborador = docsVencimento.filter(doc => doc.colaboradorId === selected.id);
        const regimeActual = load(LS_HOR, {})[selected.id] || '—';
        const idadeCalculada = getAgeFromPerfil(selected, extra);
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
            <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:860, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.2)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {foto
                    ? <img src={foto} alt={selected.initials} style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:`2px solid ${selected.cor}` }} />
                    : <div style={{ width:48, height:48, borderRadius:'50%', background:selected.cor||'#9CA3AF', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 }}>{selected.initials}</div>
                  }
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{selected.nome}</div>
                    {dept && <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:10, background:dept.cor, color:dept.corTexto }}>{dept.label}</span>}
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px' }}>
                {[
                  ['ID Colaborador', selected.colaboradorId||'—'],
                  ['Cargo', selected.role||'—'],
                  ['Email', selected.email||'—'],
                  ['Género', selected.genero==='M'?'Masculino':selected.genero==='F'?'Feminino':selected.genero||'—'],
                  ['Idade', idadeCalculada ? idadeCalculada + ' anos' : '—'],
                  ['Data de nascimento', formatDatePt(extra.dataNascimento)],
                  ['Admissão', formatDatePt(extra.dataAdmissao)],
                  ['Salário Bruto', extra.salario ? fmt(extra.salario) : '—'],
                  ['Nacionalidade', extra.nacionalidade || '—'],
                  ['Tipo de contrato', extra.tipoContrato || '—'],
                  ['Habilitações', extra.habilitacoes || '—'],
                  ['Taxa de assiduidade', formatPercentValue(extra.taxaAssiduidade)],
                  ['Regime de trabalho', regimeActual],
                  ['Estado', selected.inativo?'Inactivo':'Activo'],
                ].map(([l,v])=>(
                  <div key={l}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {podeGerirDocs && (
                <div style={{ padding:'0 20px 20px' }}>
                  <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>Documentos de vencimento</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Recibos e documentos mensais acessíveis por Admin, RH e pelo próprio colaborador.</div>
                      </div>
                      <span className="badge badge-i">{docsColaborador.length} documento{docsColaborador.length === 1 ? '' : 's'}</span>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr auto', gap:10, alignItems:'end', marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>Competência</div>
                        <input
                          type="month"
                          value={docVencForm.competencia}
                          onChange={e => setDocVencForm(f => ({ ...f, competencia: e.target.value }))}
                          style={IS}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>Título</div>
                        <input
                          value={docVencForm.titulo}
                          onChange={e => setDocVencForm(f => ({ ...f, titulo: e.target.value }))}
                          placeholder="Ex: Recibo de vencimento"
                          style={IS}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>Ficheiro</div>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => setDocVencForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                          style={{ ...IS, padding:'6px 8px' }}
                        />
                      </div>
                      <button className="btn btn-primary" onClick={guardarDocumentoVencimento} disabled={!docVencForm.competencia || !docVencForm.file}>Guardar</button>
                    </div>

                    <div className="card" style={{ padding:0, overflow:'hidden' }}>
                      {docsVencLoading ? (
                        <div style={{ padding:18, fontSize:13, color:'var(--text-muted)' }}>A carregar documentos...</div>
                      ) : docsColaborador.length === 0 ? (
                        <div style={{ padding:18, fontSize:13, color:'var(--text-muted)' }}>Ainda não existem documentos de vencimento para este colaborador.</div>
                      ) : (
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                          <thead>
                            <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
                              {['Competência', 'Título', 'Ficheiro', 'Data upload', 'Ações'].map(h => (
                                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {docsColaborador.map(doc => (
                              <tr key={doc.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                                <td style={{ padding:'10px 12px', fontWeight:600 }}>{formatCompetencia(doc.competencia)}</td>
                                <td style={{ padding:'10px 12px' }}>{doc.titulo}</td>
                                <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:12 }}>{doc.nome}</td>
                                <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text-muted)' }}>{doc.dataUpload ? new Date(doc.dataUpload).toLocaleString('pt-PT') : '—'}</td>
                                <td style={{ padding:'10px 12px' }}>
                                  <div style={{ display:'flex', gap:8 }}>
                                    <button className="btn btn-sm" onClick={() => downloadStoredFile(doc)}>Descarregar</button>
                                    <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={() => removerDocumentoVencimento(doc.id)}>Remover</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SECÇÃO: FÉRIAS E FALTAS ──────────────────────────────────────────────────
function FeriasEFaltas() {
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const perfis = loadPerfis();
  const me = perfis.find(p => p.id === user?.id) || user;
  const isAdmin = user?.isAdmin || user?.id === 'ms';
  const visibleCollaborators = perfis.filter(p => p.isColaborador && canAccessCollaboratorProfile(me, p, perfis));
  const manageableCollaborators = perfis.filter(p => p.isColaborador && canManageCollaborator(me, p, perfis));
  const canApproveAny = Boolean(isAdmin || manageableCollaborators.length > 0);
  const requestableCollaborators = [
    ...(user?.id ? perfis.filter(p => p.id === user.id && p.isColaborador) : []),
    ...manageableCollaborators.filter(p => p.id !== user?.id),
  ];
  const [items, setItems] = useState(() => load(LS_FER, FERIAS_DEFAULT));
  const [ano, setAno]     = useState(new Date().getFullYear());
  const [viewTab, setViewTab] = useState('calendario'); // calendario | anual | resumo
  const [showNovo, setShowNovo] = useState(false);
  const [editId, setEditId] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [tipoCelula, setTipoCelula] = useState('Férias');
  const [form, setForm] = useState({ colaborador:'', inicio:'', fim:'', tipo:'Férias', motivo:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const COLAB = visibleCollaborators;
  const TIPOS = { 'Férias':'#22c55e', 'Falta':'#ef4444', 'Baixa Médica':'#f97316', 'Formação':'#3b82f6', 'Serviço Externo':'#8b5cf6', 'Teletrabalho':'#06b6d4' };
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const corPorNome = Object.fromEntries(COLAB.map(c => [c.nome, c.cor || '#9CA3AF']));
  const collaboratorByName = Object.fromEntries(perfis.filter(p => p.isColaborador).map(p => [p.nome, p]));
  const visibleNames = new Set(COLAB.map(c => c.nome));
  const feriadosAno = FERIADOS_2026.filter(f => f.data.startsWith(`${ano}-`));
  const feriadoPorData = Object.fromEntries(feriadosAno.map(f => [f.data, f]));
  const persist = (list) => { setItems(list); save(LS_FER, list); };
  const dateAdd = (dateStr, n) => {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const calcDias = (inicio, fim) => Math.max(1, Math.ceil((new Date(fim) - new Date(inicio)) / 864e5) + 1);
  const getAusenciasDia = (dateStr) => {
    const mapa = new Map();
    items.forEach(i => {
      if (!visibleNames.has(i.colaborador)) return;
      if (i.estado !== 'aprovado') return;
      if (dateStr >= i.inicio && dateStr <= i.fim) mapa.set(i.colaborador, i);
    });
    return [...mapa.values()];
  };

  const aprovar = (id) => {
    const it = items.find(i=>i.id===id);
    if (!it || !canApproveFeriasFor(me, collaboratorByName[it.colaborador], perfis)) return;
    persist(items.map(i => i.id===id ? {...i, estado:'aprovado'} : i));
    if (addNotif && it) addNotif({ tipo:'info', icon:'✅', accionavel:false, titulo:`Férias/Falta aprovada`, sub:`${it.colaborador} · ${it.inicio} → ${it.fim}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
  };
  const rejeitar = (id) => {
    const it = items.find(i=>i.id===id);
    if (!it || !canApproveFeriasFor(me, collaboratorByName[it.colaborador], perfis)) return;
    persist(items.map(i => i.id===id ? {...i, estado:'rejeitado'} : i));
    if (addNotif && it) addNotif({ tipo:'info', icon:'↩', accionavel:false, titulo:`Pedido de ${it.tipo} rejeitado`, sub:`${it.colaborador} · ${it.inicio} → ${it.fim}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
  };
  const submeter = () => {
    const colaboradorReq = canApproveAny ? (form.colaborador || user?.nome) : (user?.nome || form.colaborador);
    if (!colaboradorReq || !form.inicio || !form.fim) return;
    const dias = Math.max(1, Math.ceil((new Date(form.fim)-new Date(form.inicio))/(864e5))+1);
    if (editId) {
      const original = items.find(i => i.id === editId);
      persist(items.map(i => i.id === editId ? { ...i, ...form, colaborador: colaboradorReq, dias } : i));
      if (addNotif && original) addNotif({ tipo:'info', icon:'📝', accionavel:false, titulo:`Pedido de ${form.tipo} editado`, sub:`${colaboradorReq} · ${form.inicio} → ${form.fim}`, path:'/rh', destinatario: getColabIdByNome(colaboradorReq), prefKey:'tarefa_atribuida' });
    } else {
      persist([{ id:`f${Date.now()}`, ...form, colaborador: colaboradorReq, dias, estado:'pendente' }, ...items]);
    }
    setForm({ colaborador:'', inicio:'', fim:'', tipo:'Férias', motivo:'' });
    setShowNovo(false);
    setEditId(null);
    if (!editId && addNotif) {
      const colaboradorPerfil = collaboratorByName[colaboradorReq];
      const managers = getHierarchyManagers(colaboradorPerfil, perfis);
      managers.forEach((manager) => {
        addNotif({ tipo:'acao_lg', icon:'🌴', accionavel:true, titulo:`Pedido de ${form.tipo} para aprovação`, sub:`${colaboradorReq} · ${form.inicio} → ${form.fim} (${dias} dias)`, path:'/rh', destinatario: manager.id, acao:'Aprovar/Rejeitar' });
      });
    }
  };

  const editarItem = (it) => {
    setForm({
      colaborador: it.colaborador || '',
      inicio: it.inicio || '',
      fim: it.fim || '',
      tipo: it.tipo || 'Férias',
      motivo: it.motivo || '',
    });
    setEditId(it.id);
    setShowNovo(true);
  };

  const removerItem = (id) => {
    if (!window.confirm('Remover este registo de férias/falta?')) return;
    const it = items.find(i => i.id === id);
    persist(items.filter(i => i.id !== id));
    if (addNotif && it) addNotif({ tipo:'info', icon:'🗑', accionavel:false, titulo:`Registo removido`, sub:`${it.colaborador} · ${it.inicio} → ${it.fim}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
  };

  const removerAusenciaNoDia = (colaborador, dataRef) => {
    const updated = items.flatMap(i => {
      if (i.estado !== 'aprovado' || i.colaborador !== colaborador || dataRef < i.inicio || dataRef > i.fim) return [i];
      if (i.inicio === i.fim && i.inicio === dataRef) return [];
      if (dataRef === i.inicio) {
        const novoInicio = dateAdd(i.inicio, 1);
        return [{ ...i, inicio: novoInicio, dias: calcDias(novoInicio, i.fim) }];
      }
      if (dataRef === i.fim) {
        const novoFim = dateAdd(i.fim, -1);
        return [{ ...i, fim: novoFim, dias: calcDias(i.inicio, novoFim) }];
      }
      const parte1Fim = dateAdd(dataRef, -1);
      const parte2Ini = dateAdd(dataRef, 1);
      return [
        { ...i, id: `${i.id}_a_${dataRef}`, fim: parte1Fim, dias: calcDias(i.inicio, parte1Fim) },
        { ...i, id: `${i.id}_b_${dataRef}`, inicio: parte2Ini, dias: calcDias(parte2Ini, i.fim) },
      ];
    });
    persist(updated);
    if (addNotif) addNotif({ tipo:'info', icon:'🗓', accionavel:false, titulo:`Ausência removida`, sub:`${colaborador} · ${dataRef}`, path:'/rh', destinatario: getColabIdByNome(colaborador), prefKey:'tarefa_atribuida' });
  };

  const adicionarAusenciaNoDia = (colaborador, dataRef, tipo) => {
    const semEsseDia = items.filter(i => !(i.estado === 'aprovado' && i.colaborador === colaborador && dataRef >= i.inicio && dataRef <= i.fim));
    persist([{ id: `f${Date.now()}`, colaborador, inicio: dataRef, fim: dataRef, dias: 1, tipo, motivo: 'Ajuste manual admin', estado: 'aprovado' }, ...semEsseDia]);
    if (addNotif) addNotif({ tipo:'info', icon:'🗓', accionavel:false, titulo:`Ausência adicionada`, sub:`${colaborador} · ${tipo} · ${dataRef}`, path:'/rh', destinatario: getColabIdByNome(colaborador), prefKey:'tarefa_atribuida' });
  };

  const toggleAusenciaDia = (colaborador, dataRef) => {
    const existe = getAusenciasDia(dataRef).some(a => a.colaborador === colaborador);
    if (existe) removerAusenciaNoDia(colaborador, dataRef);
    else adicionarAusenciaNoDia(colaborador, dataRef, tipoCelula);
  };

  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };

  // Calendário mensal tipo Gantt (vista original)
  const CalendarioMensal = ({ mes, mesIdx }) => {
    const diasNoMes = new Date(ano, mesIdx+1, 0).getDate();
    const dias = Array.from({length:diasNoMes},(_,i)=>i+1);
    const hoje = new Date();
    const itemsDoMes = items.filter(it => {
      const ini = new Date(it.inicio); const fim = new Date(it.fim);
      return ini <= new Date(ano, mesIdx, diasNoMes) && fim >= new Date(ano, mesIdx, 1);
    });
    const colaboradoresDoMes = [...new Set(itemsDoMes.map(i=>i.colaborador))].sort();
    if (colaboradoresDoMes.length === 0) return null;
    const getDia = (d) => {
      const dt = new Date(ano, mesIdx, d);
      const dow = dt.getDay();
      return { fds: dow===0||dow===6, hoje: dt.toDateString()===hoje.toDateString() };
    };
    const getCell = (colab, d) => {
      const dt = new Date(ano, mesIdx, d);
      const it = itemsDoMes.find(i => i.colaborador===colab && new Date(i.inicio)<=dt && new Date(i.fim)>=dt);
      return it || null;
    };

    return (
      <div style={{ marginBottom:24 }}>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:10, textAlign:'center' }}>{mes}</div>
        <div style={{ overflowX:'auto', borderRadius:10, border:'0.5px solid var(--border)', background:'var(--bg-card)' }}>
          <table style={{ borderCollapse:'collapse', fontSize:11, whiteSpace:'nowrap' }}>
            <thead>
              <tr>
                <th style={{ padding:'6px 12px', textAlign:'left', fontSize:10, fontWeight:600, color:'var(--text-muted)', background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)', minWidth:160, position:'sticky', left:0, zIndex:2 }}>Colaborador</th>
                {dias.map(d => {
                  const {fds, hoje} = getDia(d);
                  return (
                    <th key={d} style={{ padding:'4px 0', textAlign:'center', fontSize:9, fontWeight: hoje?700:400, color: hoje?'var(--brand-primary)':fds?'var(--text-muted)':'var(--text-secondary)', background: hoje?'rgba(28,58,94,0.08)':fds?'var(--bg-app)':'var(--bg-card)', borderBottom:'0.5px solid var(--border)', width:24, minWidth:24 }}>{d}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {colaboradoresDoMes.map((colab) => (
                <tr key={colab} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'4px 12px', fontWeight:500, fontSize:12, background:'var(--bg-app)', position:'sticky', left:0, zIndex:1, borderRight:'0.5px solid var(--border)' }}>{colab}</td>
                  {dias.map(d => {
                    const {fds} = getDia(d);
                    const it = getCell(colab, d);
                    const cor = it ? (TIPOS[it.tipo]||'#22c55e') : null;
                    return (
                      <td key={d} title={it ? `${it.tipo} — ${it.estado}` : ''}
                        style={{ padding:0, height:26, background: cor ? cor+'33' : fds?'var(--bg-app)':'transparent', borderRight:'0.5px solid var(--border-light, #f0f0f0)' }}>
                        {it && (
                          <div
                            style={{
                              height:'100%',
                              background:cor,
                              opacity: it.estado==='rejeitado' ? 0.4 : it.estado==='pendente' ? 0.7 : 1,
                            }}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Calendário anual por célula (nova vista tipo Excel)
  const CalendarioMes = ({ mes, mesIdx }) => {
    const diasNoMes = new Date(ano, mesIdx+1, 0).getDate();
    const primeiraSemanaOffset = (new Date(ano, mesIdx, 1).getDay() + 6) % 7;
    const hojeStr = new Date().toISOString().slice(0, 10);
    const cells = [];
    for (let i = 0; i < primeiraSemanaOffset; i += 1) cells.push(null);
    for (let d = 1; d <= diasNoMes; d += 1) cells.push(d);

    return (
      <div className="card" style={{ padding:'12px 12px 10px' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:8, textAlign:'center' }}>{mes}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
          {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {cells.map((d, idx) => {
            if (!d) return <div key={`vazio-${idx}`} />;
            const dateStr = `${ano}-${String(mesIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const aus = getAusenciasDia(dateStr);
            const feriado = feriadoPorData[dateStr];
            const isHoje = dateStr === hojeStr;
            const umaPessoa = aus.length === 1 ? aus[0] : null;
            const corPessoa = umaPessoa ? (corPorNome[umaPessoa.colaborador] || '#9CA3AF') : null;
            const bg = aus.length > 1
              ? '#D1D5DB'
              : corPessoa
                ? `${corPessoa}55`
                : feriado
                  ? '#EAF2FB'
                  : 'var(--bg-card)';
            const borderCor = isHoje ? 'var(--brand-primary)' : aus.length > 1 ? '#9CA3AF' : corPessoa || (feriado ? 'var(--color-info)' : 'var(--border)');
            return (
              <button
                key={dateStr}
                onClick={() => setDiaSelecionado(dateStr)}
                title={`${dateStr}${feriado ? ` · ${feriado.nome}` : ''}${aus.length ? ` · ${aus.length} ausência(s)` : ''}`}
                style={{
                  border: `1px solid ${borderCor}`, borderRadius: 6, padding: '6px 4px', minHeight: 44, cursor: 'pointer',
                  background: bg, fontFamily:'var(--font-body)', color:'var(--text-primary)', textAlign:'left',
                }}
              >
                <div style={{ fontSize:11, fontWeight:700 }}>{d}</div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>
                  {feriado ? 'Feriado' : aus.length > 1 ? `${aus.length} aus.` : aus.length === 1 ? aus[0].colaborador.split(' ')[0] : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:12 }}>
          {[['Pendentes', items.filter(i=>i.estado==='pendente').length, 'var(--color-warning)'],
            ['Aprovados', items.filter(i=>i.estado==='aprovado').length, 'var(--color-success)'],
            ['Total dias aprovados', items.filter(i=>i.estado==='aprovado').reduce((s,i)=>s+i.dias,0), 'var(--brand-primary)']
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:'var(--bg-app)', borderRadius:10, padding:'8px 16px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ display:'flex', background:'var(--bg-app)', borderRadius:8, border:'0.5px solid var(--border)', overflow:'hidden' }}>
              <button onClick={()=>setViewTab('calendario')} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, background:viewTab==='calendario'?'var(--brand-primary)':'transparent', color:viewTab==='calendario'?'#fff':'var(--text-muted)', fontFamily:'var(--font-body)' }}>📅 Mensal</button>
              <button onClick={()=>setViewTab('anual')} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, background:viewTab==='anual'?'var(--brand-primary)':'transparent', color:viewTab==='anual'?'#fff':'var(--text-muted)', fontFamily:'var(--font-body)' }}>🧩 Calendário</button>
              <button onClick={()=>setViewTab('resumo')} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, background:viewTab==='resumo'?'var(--brand-primary)':'transparent', color:viewTab==='resumo'?'#fff':'var(--text-muted)', fontFamily:'var(--font-body)' }}>📋 Lista</button>
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button className="btn" onClick={()=>setAno(a=>a-1)}>‹ {ano-1}</button>
            <span style={{ fontWeight:700, fontSize:14, padding:'0 8px' }}>{ano}</span>
            <button className="btn" onClick={()=>setAno(a=>a+1)}>{ano+1} ›</button>
          </div>
          <button className="btn btn-primary" onClick={()=>{ setShowNovo(s=>!s); if (!showNovo) setEditId(null); }}>+ Pedido</button>
        </div>
      </div>

      {/* Novo pedido */}
      {showNovo && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:14 }}>{editId ? 'Editar pedido de férias / falta' : 'Novo pedido de férias / falta'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Colaborador *</label>
              {canApproveAny ? (
                <select value={form.colaborador} onChange={e=>set('colaborador',e.target.value)} style={IS}>
                  <option value="">Seleccionar...</option>
                  {requestableCollaborators.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              ) : (
                <input value={user?.nome || ''} disabled style={{ ...IS, background:'var(--bg-app)', color:'var(--text-muted)' }} />
              )}
            </div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Tipo</label>
              <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={IS}>
                {Object.keys(TIPOS).map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Motivo</label>
              <input value={form.motivo} onChange={e=>set('motivo',e.target.value)} placeholder="Opcional" style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Início *</label>
              <input type="date" value={form.inicio} onChange={e=>set('inicio',e.target.value)} style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Fim *</label>
              <input type="date" value={form.fim} onChange={e=>set('fim',e.target.value)} style={IS} /></div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
              <button className="btn" onClick={()=>{ setShowNovo(false); setEditId(null); setForm({ colaborador:'', inicio:'', fim:'', tipo:'Férias', motivo:'' }); }}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={submeter}>{editId ? 'Guardar alterações' : 'Submeter pedido'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        {Object.entries(TIPOS).map(([tipo,cor])=>(
          <div key={tipo} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
            <div style={{ width:14, height:14, borderRadius:3, background:cor }} />
            <span style={{ color:'var(--text-muted)' }}>{tipo}</span>
          </div>
        ))}
      </div>

      {/* Vista */}
      {viewTab==='calendario' ? (
        <div>
          {MESES.map((mes,mi)=><CalendarioMensal key={mes} mes={mes} mesIdx={mi} />)}
        </div>
      ) : viewTab==='anual' ? (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(250px,1fr))', gap:12 }}>
            {MESES.map((mes,mi)=><CalendarioMes key={mes} mes={mes} mesIdx={mi} />)}
          </div>
          <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span className="badge badge-i">Feriado</span>
            <span className="badge badge-s">1 colaborador ausente = cor do colaborador</span>
            <span className="badge badge-n">Múltiplos ausentes = cinzento (clicar para ver lista)</span>
            {canApproveAny && <span className="badge badge-w">Chefia/Gestão pode editar célula da sua equipa</span>}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
              {['Colaborador','Tipo','Início','Fim','Dias','Motivo','Estado','Ações'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.filter(i => visibleNames.has(i.colaborador)).map(i=>(
                <tr key={i.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', fontWeight:500 }}>{i.colaborador}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:(TIPOS[i.tipo]||'#22c55e')+'22', color:TIPOS[i.tipo]||'#22c55e', fontWeight:600 }}>{i.tipo}</span>
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.inicio}</td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.fim}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{i.dias}</td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.motivo||'—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <span className={`badge ${i.estado==='aprovado'?'badge-s':i.estado==='rejeitado'?'badge-d':'badge-w'}`}>
                      {i.estado==='aprovado'?'✓ Aprovado':i.estado==='rejeitado'?'✕ Rejeitado':'⏳ Pendente'}
                    </span>
                  </td>
                  <td style={{ padding:'8px 12px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {canApproveFeriasFor(me, collaboratorByName[i.colaborador], perfis) && i.estado==='pendente' && (
                        <>
                          <button className="btn btn-sm" style={{ background:'var(--color-success)', color:'#fff', border:'none' }} onClick={()=>aprovar(i.id)}>✓</button>
                          <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={()=>rejeitar(i.id)}>✕</button>
                        </>
                      )}
                      {(i.colaborador === user?.nome || canApproveFeriasFor(me, collaboratorByName[i.colaborador], perfis)) && <button className="btn btn-sm" onClick={()=>editarItem(i)}>Editar</button>}
                      {(i.colaborador === user?.nome || canApproveFeriasFor(me, collaboratorByName[i.colaborador], perfis)) && <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={()=>removerItem(i.id)}>Remover</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diaSelecionado && (() => {
        const aus = getAusenciasDia(diaSelecionado);
        const fer = feriadoPorData[diaSelecionado];
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
            <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border)', width:'100%', maxWidth:640, boxShadow:'0 16px 48px rgba(0,0,0,0.2)' }}>
              <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-PT', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>{fer ? `Feriado: ${fer.nome}` : 'Dia útil/normal'}</div>
                </div>
                <button onClick={()=>setDiaSelecionado(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
              </div>

              <div style={{ padding:'16px 18px' }}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:8 }}>
                  Colaboradores ausentes ({aus.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                  {aus.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>Sem ausências aprovadas neste dia.</div>
                  ) : aus.map(a => (
                    <div key={`${a.colaborador}-${a.id}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'7px 10px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-app)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:corPorNome[a.colaborador] || '#9CA3AF' }} />
                        <span style={{ fontSize:13, fontWeight:600 }}>{a.colaborador}</span>
                        <span className="badge badge-i">{a.tipo}</span>
                      </div>
                      {canApproveFeriasFor(me, collaboratorByName[a.colaborador], perfis) && (
                        <div style={{ display:'flex', gap:6 }}>
                          <select value={a.tipo} onChange={e => { removerAusenciaNoDia(a.colaborador, diaSelecionado); adicionarAusenciaNoDia(a.colaborador, diaSelecionado, e.target.value); }}
                            style={{ ...IS, width: 140, padding:'4px 8px', fontSize:12 }}>
                            {Object.keys(TIPOS).map(t => <option key={t}>{t}</option>)}
                          </select>
                          <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={() => removerAusenciaNoDia(a.colaborador, diaSelecionado)}>Remover</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {canApproveAny && (
                  <>
                    <div style={{ height:'0.5px', background:'var(--border)', margin:'10px 0 12px' }} />
                    <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:8 }}>
                      Edição rápida (tipo Excel)
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>Tipo:</span>
                      <select value={tipoCelula} onChange={e => setTipoCelula(e.target.value)} style={{ ...IS, width: 200 }}>
                        {Object.keys(TIPOS).map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {manageableCollaborators.map(c => {
                        const ativo = aus.some(a => a.colaborador === c.nome);
                        return (
                          <button key={c.id} onClick={() => toggleAusenciaDia(c.nome, diaSelecionado)} style={{
                            fontFamily:'var(--font-body)', fontSize:11, padding:'5px 9px', borderRadius:18,
                            border:`1px solid ${ativo ? c.cor : 'var(--border)'}`,
                            background: ativo ? c.cor : 'var(--bg-card)',
                            color: ativo ? '#fff' : 'var(--text-secondary)', cursor:'pointer',
                          }}>
                            {c.initials || c.nome.split(' ').map(w=>w[0]).join('').slice(0,2)} · {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function GestaoHorarios() {
  const { user } = useAuth();
  const [perfis, setPerfis] = useState(() => loadPerfis().filter(p => p.isColaborador));
  const [mapaRegimes, setMapaRegimes] = useState(() => load(LS_HOR, {}));
  const [search, setSearch] = useState('');
  const isEditor = Boolean(user?.isAdmin || (user?.departamento || '').toLowerCase() === 'rh' || (user?.role || '').toLowerCase().includes('recursos humanos'));
  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };

  useEffect(() => {
    const handler = () => setPerfis(loadPerfis().filter(p => p.isColaborador));
    window.addEventListener('storage', handler);
    window.addEventListener('sis_perfis_updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('sis_perfis_updated', handler);
    };
  }, []);

  const setRegime = (colaboradorId, regime) => {
    const updated = { ...mapaRegimes, [colaboradorId]: regime };
    setMapaRegimes(updated);
    save(LS_HOR, updated);
  };

  const filtered = perfis.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>{perfis.length} colaboradores</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Cada colaborador fica associado ao respetivo regime de trabalho.</div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar colaborador..."
          style={{ ...IS, width:260, background:'var(--bg-app)' }}
        />
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
              {['Colaborador', 'Cargo', 'Departamento', 'Regime de trabalho'].map(h => (
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const dept = DEPARTAMENTOS.find(d => d.id === p.departamento);
              return (
                <tr key={p.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{p.nome}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{p.role || '—'}</td>
                  <td style={{ padding:'10px 12px' }}>
                    {dept ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:dept.cor, color:dept.corTexto }}>{dept.label}</span> : '—'}
                  </td>
                  <td style={{ padding:'10px 12px', minWidth:260 }}>
                    {isEditor ? (
                      <select value={mapaRegimes[p.id] || ''} onChange={e => setRegime(p.id, e.target.value)} style={IS}>
                        <option value="">Selecionar...</option>
                        {RH_REGIMES.map(regime => <option key={regime} value={regime}>{regime}</option>)}
                      </select>
                    ) : (
                      <span style={{ color:'var(--text-secondary)' }}>{mapaRegimes[p.id] || '—'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── SECÇÃO: PASSAGENS AÉREAS ─────────────────────────────────────────────────
function PassagensAereas() {
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const fileRef = useRef(null);
  const faturRef = useRef(null);
  const [items, setItems] = useState(() => load(LS_PAS, PASSAGENS_DEFAULT));
  const [showNovo, setShowNovo] = useState(false);
  const [editId, setEditId] = useState(null);
  const [uploadId, setUploadId] = useState(null);   // id da passagem a fazer upload bilhete
  const [faturId, setFaturId]   = useState(null);   // id da passagem a fazer upload fatura
  const [form, setForm] = useState({ colaborador:'', destino:'', ida:'', volta:'', preco:'', companhia:'', motivo:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const COLAB = loadPerfis().filter(p => p.isColaborador);
  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };

  const persist = (list) => { setItems(list); save(LS_PAS, list); };

  const submeter = () => {
    if (!form.colaborador || !form.destino || !form.ida) return;
    if (editId) {
      persist(items.map(i => i.id === editId ? { ...i, ...form, preco:Number(form.preco)||0 } : i));
      if (addNotif) addNotif({ tipo:'info', icon:'📝', accionavel:false, titulo:`Pedido de passagem editado`, sub:`${form.colaborador} · ${form.destino}`, path:'/rh', destinatario: getColabIdByNome(form.colaborador), prefKey:'tarefa_atribuida' });
    } else {
      const novo = { id:`p${Date.now()}`, ...form, preco:Number(form.preco)||0, estado:'pendente', bilhete:null, fatura:null };
      persist([novo, ...items]);
    }
    setShowNovo(false);
    setEditId(null);
    setForm({ colaborador:'', destino:'', ida:'', volta:'', preco:'', companhia:'', motivo:'' });
    // Notify CA (administrativa) — actionable
    if (!editId && addNotif) addNotif({ tipo:'acao_ca', icon:'✈️', accionavel:true, titulo:`Pedido de passagem — ${form.colaborador}`, sub:`${form.destino} · ${form.ida}${form.volta?' → '+form.volta:''}`, path:'/rh', destinatario:'ca', acao:'Tratar passagem' });
  };

  const editarPassagem = (it) => {
    setForm({
      colaborador: it.colaborador || '',
      destino: it.destino || '',
      ida: it.ida || '',
      volta: it.volta || '',
      preco: it.preco ?? '',
      companhia: it.companhia || '',
      motivo: it.motivo || '',
    });
    setEditId(it.id);
    setShowNovo(true);
  };

  const removerPassagem = (id) => {
    if (!window.confirm('Remover esta passagem aérea?')) return;
    const it = items.find(i => i.id === id);
    persist(items.filter(i => i.id !== id));
    if (addNotif && it) addNotif({ tipo:'info', icon:'🗑', accionavel:false, titulo:`Passagem removida`, sub:`${it.colaborador} · ${it.destino}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
  };

  const uploadBilhete = async (id, file) => {
    const reader = new FileReader();
    reader.onload = e => {
      const updated = items.map(i => i.id===id ? {...i, bilhete:{ name:file.name, data:e.target.result }, estado:'confirmado' } : i);
      persist(updated);
      const it = updated.find(i=>i.id===id);
      // Email-like notif to the colaborador
      if (addNotif && it) addNotif({ tipo:'info', icon:'✈️', accionavel:false, titulo:`Bilhete disponível — ${it.destino}`, sub:`${it.colaborador} · Bilhete tratado pela administrativa`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
    };
    reader.readAsDataURL(file);
    setUploadId(null);
  };

  const uploadFatura = async (id, file) => {
    const reader = new FileReader();
    reader.onload = e => {
      const updated = items.map(i => i.id===id ? {...i, fatura:{ name:file.name, data:e.target.result } } : i);
      persist(updated);
      const it = updated.find(i => i.id === id);
      if (addNotif && it) addNotif({ tipo:'info', icon:'🧾', accionavel:false, titulo:`Fatura da passagem adicionada`, sub:`${it.colaborador} · ${it.destino}`, path:'/rh', destinatario:'ca', prefKey:'tarefa_atribuida' });
    };
    reader.readAsDataURL(file);
    setFaturId(null);
  };

  const EST = { pendente:'badge-w', confirmado:'badge-s', cancelado:'badge-d' };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:12 }}>
          {[['Pendentes', items.filter(i=>i.estado==='pendente').length, 'var(--color-warning)'],
            ['Confirmadas', items.filter(i=>i.estado==='confirmado').length, 'var(--color-success)'],
            ['Total €', fmt(items.reduce((s,i)=>s+(i.preco||0),0)), 'var(--brand-primary)']
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:'var(--bg-app)', borderRadius:10, padding:'8px 16px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={()=>{ setShowNovo(s=>!s); if (!showNovo) setEditId(null); }}>+ Pedir passagem</button>
      </div>

      {/* Inputs ocultos para upload */}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.png" style={{ display:'none' }}
        onChange={e => { const f=e.target.files?.[0]; if(f&&uploadId) uploadBilhete(uploadId,f); e.target.value=''; }} />
      <input ref={faturRef} type="file" accept=".pdf,.jpg,.png" style={{ display:'none' }}
        onChange={e => { const f=e.target.files?.[0]; if(f&&faturId) uploadFatura(faturId,f); e.target.value=''; }} />

      {/* Novo pedido */}
      {showNovo && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:14 }}>{editId ? 'Editar passagem aérea' : 'Pedido de passagem aérea'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Colaborador *</label>
              <select value={form.colaborador} onChange={e=>set('colaborador',e.target.value)} style={IS}>
                <option value="">Seleccionar...</option>
                {COLAB.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select></div>
            <div style={{ gridColumn:'span 2' }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Destino *</label>
              <input value={form.destino} onChange={e=>set('destino',e.target.value)} placeholder="ex: Lisboa → Luanda" style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Data de ida *</label>
              <input type="date" value={form.ida} onChange={e=>set('ida',e.target.value)} style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Data de volta</label>
              <input type="date" value={form.volta} onChange={e=>set('volta',e.target.value)} style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Companhia</label>
              <input value={form.companhia} onChange={e=>set('companhia',e.target.value)} placeholder="ex: TAP, TAAG..." style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Preço previsto (€)</label>
              <input type="number" value={form.preco} onChange={e=>set('preco',e.target.value)} style={IS} /></div>
            <div style={{ gridColumn:'span 2' }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Motivo / Obra</label>
              <input value={form.motivo} onChange={e=>set('motivo',e.target.value)} placeholder="ex: Deslocação obra O142" style={IS} /></div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
            <button className="btn" onClick={()=>{ setShowNovo(false); setEditId(null); setForm({ colaborador:'', destino:'', ida:'', volta:'', preco:'', companhia:'', motivo:'' }); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={submeter}>{editId ? 'Guardar alterações' : '✈️ Submeter pedido'}</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
            {['Colaborador','Destino','Ida','Volta','Companhia','Preço','Motivo','Bilhete','Fatura','Estado','Ações'].map(h=>(
              <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map(i=>(
              <tr key={i.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                <td style={{ padding:'8px 12px', fontWeight:500 }}>{i.colaborador}</td>
                <td style={{ padding:'8px 12px', fontWeight:500 }}>{i.destino}</td>
                <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.ida}</td>
                <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.volta||'—'}</td>
                <td style={{ padding:'8px 12px', fontSize:12 }}>{i.companhia||'—'}</td>
                <td style={{ padding:'8px 12px', fontWeight:600 }}>{i.preco?fmt(i.preco):'—'}</td>
                <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)', maxWidth:140 }}>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.motivo||'—'}</div>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  {i.bilhete
                    ? <a href={i.bilhete.data} download={i.bilhete.name} style={{ fontSize:12, color:'var(--brand-primary)', textDecoration:'none' }}>📎 {i.bilhete.name.slice(0,16)}</a>
                    : <button className="btn btn-sm" onClick={()=>{ setUploadId(i.id); setTimeout(()=>fileRef.current?.click(),50); }}>+ Bilhete</button>
                  }
                </td>
                <td style={{ padding:'8px 12px' }}>
                  {i.fatura
                    ? <a href={i.fatura.data} download={i.fatura.name} style={{ fontSize:12, color:'var(--brand-primary)', textDecoration:'none' }}>🧾 {i.fatura.name.slice(0,16)}</a>
                    : <button className="btn btn-sm" onClick={()=>{ setFaturId(i.id); setTimeout(()=>faturRef.current?.click(),50); }}>+ Fatura</button>
                  }
                </td>
                <td style={{ padding:'8px 12px' }}>
                  <span className={`badge ${EST[i.estado]||'badge-n'}`}>
                    {i.estado==='confirmado'?'✓ Confirmado':i.estado==='cancelado'?'✕ Cancelado':'⏳ Pendente'}
                  </span>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-sm" onClick={()=>editarPassagem(i)}>Editar</button>
                    <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={()=>removerPassagem(i.id)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Feriados() {
  const hoje = new Date();
  const proximos = FERIADOS_2026.filter(f => new Date(f.data) >= hoje).slice(0, 5);
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Próximos */}
        <div className="card">
          <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>Próximos feriados</div>
          {proximos.map((f,i) => {
            const d = new Date(f.data);
            const diff = Math.ceil((d - hoje)/(1000*60*60*24));
            return (
              <div key={f.data} style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 0', borderBottom:i<proximos.length-1?'0.5px solid var(--border)':'none' }}>
                <div style={{ width:44, height:44, borderRadius:10, background:'var(--bg-info)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--brand-primary)', lineHeight:1 }}>{d.getDate()}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>{d.toLocaleDateString('pt-PT',{month:'short'})}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{f.nome}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    <span className={`badge ${f.tipo==='nacional'?'badge-s':'badge-w'}`} style={{ fontSize:10 }}>{f.tipo}</span>
                    <span style={{ marginLeft:8 }}>em {diff} dias</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Lista completa */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'0.5px solid var(--border)', fontWeight:600, fontSize:14 }}>Feriados 2026 ({FERIADOS_2026.length})</div>
          <div style={{ maxHeight:380, overflowY:'auto' }}>
            {FERIADOS_2026.map((f,i) => {
              const passado = new Date(f.data) < hoje;
              return (
                <div key={f.data} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px', borderBottom:i<FERIADOS_2026.length-1?'0.5px solid var(--border)':'none', opacity:passado?0.45:1 }}>
                  <div style={{ fontSize:13 }}>{f.nome}</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span className={`badge ${f.tipo==='nacional'?'badge-s':'badge-w'}`} style={{ fontSize:10 }}>{f.tipo}</span>
                    <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{new Date(f.data).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SECÇÃO: ESTATÍSTICAS ─────────────────────────────────────────────────────
function EstatisticasRH() {
  const perfis = loadPerfis().filter(p => p.isColaborador);
  const extraMap = loadPerfilExtraMap();
  const regimes = load(LS_HOR, {});
  const total = perfis.length;
  const rows = perfis.map((perfil) => {
    const extra = getRhExtra(perfil, extraMap);
    const idade = getAgeFromPerfil(perfil, extra);
    const salario = Number(extra.salario) || 0;
    const assiduidade = extra.taxaAssiduidade === '' || extra.taxaAssiduidade === null || extra.taxaAssiduidade === undefined
      ? null
      : Number(extra.taxaAssiduidade);
    return {
      perfil,
      extra,
      idade,
      salario,
      assiduidade,
      regime: regimes[perfil.id] || 'Não definido',
      departamento: DEPARTAMENTOS.find(d => d.id === perfil.departamento)?.label || perfil.departamento || 'Outro',
    };
  });

  const totalAtivos = rows.filter(r => !r.perfil.inativo).length;
  const generoCounts = {
    masculino: rows.filter(r => r.perfil.genero === 'M').length,
    feminino: rows.filter(r => r.perfil.genero === 'F').length,
    outro: rows.filter(r => !['M', 'F', ''].includes(r.perfil.genero || '') && r.perfil.genero !== undefined).length,
    naoIndicado: rows.filter(r => !r.perfil.genero).length,
  };
  const ageBands = [
    { label: '< 30', count: rows.filter(r => (r.idade || 0) > 0 && r.idade < 30).length },
    { label: '30–39', count: rows.filter(r => r.idade >= 30 && r.idade <= 39).length },
    { label: '40–49', count: rows.filter(r => r.idade >= 40 && r.idade <= 49).length },
    { label: '50+', count: rows.filter(r => r.idade >= 50).length },
  ];
  const avgAge = rows.filter(r => r.idade).length
    ? rows.filter(r => r.idade).reduce((sum, r) => sum + r.idade, 0) / rows.filter(r => r.idade).length
    : 0;
  const avgAssiduidade = rows.filter(r => r.assiduidade !== null).length
    ? rows.filter(r => r.assiduidade !== null).reduce((sum, r) => sum + r.assiduidade, 0) / rows.filter(r => r.assiduidade !== null).length
    : 0;
  const avgTenure = rows
    .map(r => computeTenureYears(r.extra.dataAdmissao))
    .filter(v => v !== null);
  const avgTenureValue = avgTenure.length ? avgTenure.reduce((sum, v) => sum + v, 0) / avgTenure.length : 0;
  const missingDataCount = rows.filter(r =>
    !r.extra.nacionalidade || !r.extra.tipoContrato || !r.extra.habilitacoes || r.assiduidade === null || !r.extra.dataNascimento
  ).length;

  const regimeStats = Object.entries(
    rows.reduce((acc, row) => {
      acc[row.regime] = (acc[row.regime] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const nationalityStats = Object.entries(
    rows.reduce((acc, row) => {
      const key = row.extra.nacionalidade || 'Não definida';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const contractStats = Object.entries(
    rows.reduce((acc, row) => {
      const key = row.extra.tipoContrato || 'Não definido';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const deptStats = Object.entries(
    rows.reduce((acc, row) => {
      acc[row.departamento] = (acc[row.departamento] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const escolaridadeStats = Object.entries(
    rows.reduce((acc, row) => {
      const key = row.extra.habilitacoes || 'Não definida';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const topSalary = [...rows].sort((a, b) => b.salario - a.salario).slice(0, 5);
  const genderChart = [
    { label: 'Homens', value: generoCounts.masculino, color: '#1C3A5E' },
    { label: 'Mulheres', value: generoCounts.feminino, color: '#C47A1A' },
    { label: 'Outro/Não indicado', value: generoCounts.outro + generoCounts.naoIndicado, color: '#7A7F87' },
  ];

  const renderDistributionCard = (title, items, color = 'var(--brand-primary)') => (
    <div className="card" style={{ padding:'18px 20px' }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>{title}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {items.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Sem dados.</div>}
        {items.map(([label, value]) => (
          <div key={label}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:12, marginBottom:4 }}>
              <span style={{ fontWeight:600 }}>{label}</span>
              <span style={{ color:'var(--text-muted)' }}>{value} · {formatPercent(value, total)}</span>
            </div>
            <div style={{ height:6, borderRadius:999, background:'var(--bg-app)', overflow:'hidden' }}>
              <div style={{ width: `${total ? (value / total) * 100 : 0}%`, height:'100%', background:color, borderRadius:999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Colaboradores ativos', value: totalAtivos, sub:`${total} no total`, cor:'var(--brand-primary)' },
          { label:'Taxa média assiduidade', value: avgAssiduidade ? formatPercentValue(avgAssiduidade) : '—', sub:'Média dos colaboradores', cor:'var(--color-success)' },
          { label:'Idade média', value: avgAge ? `${avgAge.toFixed(1)} anos` : '—', sub:'Com base nos dados disponíveis', cor:'#8B4A12' },
          { label:'Antiguidade média', value: avgTenureValue ? `${avgTenureValue.toFixed(1)} anos` : '—', sub:'Desde a admissão', cor:'#6B2E7A' },
          { label:'Perfis por completar', value: missingDataCount, sub:'Faltam dados para RH', cor:'var(--color-warning)' },
        ].map(card => (
          <div key={card.label} className="kpi-card">
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-value" style={{ color:card.cor }}>{card.value}</div>
            <div className="kpi-delta up">{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:14, marginBottom:14 }}>
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Distribuição por género</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
            {genderChart.map(item => (
              <div key={item.label} style={{ background:'var(--bg-app)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>{item.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:item.color }}>{item.value}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{formatPercent(item.value, total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Rácio etário</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {ageBands.map(item => (
              <div key={item.label}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ fontWeight:600 }}>{item.label}</span>
                  <span style={{ color:'var(--text-muted)' }}>{item.count} · {formatPercent(item.count, total)}</span>
                </div>
                <div style={{ height:7, background:'var(--bg-app)', borderRadius:999, overflow:'hidden' }}>
                  <div style={{ width:`${total ? (item.count / total) * 100 : 0}%`, height:'100%', background:'#1C3A5E', borderRadius:999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        {renderDistributionCard('Regimes de trabalho', regimeStats, '#2E7D52')}
        {renderDistributionCard('Nacionalidades', nationalityStats, '#C47A1A')}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        {renderDistributionCard('Tipos de contrato', contractStats, '#6B2E7A')}
        {renderDistributionCard('Habilitações', escolaridadeStats, '#8B4A12')}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Distribuição por departamento</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {deptStats.map(([label, value]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:10 }}>
                <span style={{ fontWeight:600 }}>{label}</span>
                <span style={{ color:'var(--text-muted)' }}>{value} · {formatPercent(value, total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Indicadores adicionais</div>
          <div style={{ display:'grid', gap:10 }}>
            {[
              ['Salário médio bruto', rows.length ? fmt(rows.reduce((sum, r) => sum + r.salario, 0) / rows.length) : '—'],
              ['Maior regime identificado', regimeStats[0] ? `${regimeStats[0][0]} (${formatPercent(regimeStats[0][1], total)})` : '—'],
              ['Nacionalidade predominante', nationalityStats[0] ? `${nationalityStats[0][0]} (${formatPercent(nationalityStats[0][1], total)})` : '—'],
              ['Contratos sem termo', contractStats.find(([label]) => label.toLowerCase().includes('sem termo')) ? formatPercent(contractStats.find(([label]) => label.toLowerCase().includes('sem termo'))[1], total) : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:10, background:'var(--bg-app)' }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight:700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'18px 20px', marginTop:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Perfis com remuneração mais elevada</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Ajuda a contextualizar massa salarial e senioridade.</div>
          </div>
        </div>
        <div className="card" style={{ padding:0, overflow:'hidden', boxShadow:'none', border:'0.5px solid var(--border)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
                {['Colaborador', 'Departamento', 'Salário', 'Regime', 'Assiduidade', 'Nacionalidade'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSalary.map(({ perfil, extra, salario, regime, assiduidade }) => (
                <tr key={perfil.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{perfil.nome}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{DEPARTAMENTOS.find(d => d.id === perfil.departamento)?.label || perfil.departamento || '—'}</td>
                  <td style={{ padding:'10px 12px', fontWeight:700 }}>{salario ? fmt(salario) : '—'}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{regime}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{formatPercentValue(assiduidade)}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{extra.nacionalidade || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL RH ─────────────────────────────────────────────────────
function GestaoInterna() {
  const { user } = useAuth();
  const { addNotif } = useNotifications();
  const fileRef = useRef(null);
  const [items, setItems] = useState(() => loadDespesas());
  const [showNovo, setShowNovo] = useState(false);
  const [uploadId, setUploadId] = useState(null);
  const [form, setForm] = useState({ colaborador:'', tipo:'Combustível', descricao:'', valor:'', data: new Date().toISOString().split('T')[0], obra:'', viatura:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const COLAB = loadPerfis().filter(p => p.isColaborador);
  const TIPOS_DESP = ['Combustível','Refeição','Alojamento','Estacionamento','Portagem','Material de escritório','Ferramenta','Transporte','Comunicações','Outro'];
  const IS = { fontFamily:'var(--font-body)', fontSize:13, padding:'7px 10px', border:'0.5px solid var(--border-strong)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none', width:'100%', boxSizing:'border-box' };

  const persist = (list) => {
    setItems(list);
    const stripped = list.map(i => {
      if (i.fatura?.data) {
        saveFile(i.id, i.fatura.data);
        return { ...i, fatura: { name: i.fatura.name } };
      }
      return i;
    });
    save(LS_DESP, stripped);
  };

  const submeter = () => {
    if (!form.colaborador || !form.valor || !form.descricao) return;
    const nova = { id:`d${Date.now()}`, ...form, valor:Number(form.valor), estado:'pendente', fatura:null, reembolsado:false };
    persist([nova, ...items]);
    setShowNovo(false);
    setForm({ colaborador:'', tipo:'Combustível', descricao:'', valor:'', data:new Date().toISOString().split('T')[0], obra:'', viatura:'' });
    // Notify CA — actionable to process expense
    if (addNotif) addNotif({
      tipo:'acao_ca', icon:'🧾', accionavel:true,
      titulo:`Despesa para tratar — ${form.colaborador}`,
      sub:`${form.tipo} · ${form.descricao} · €${form.valor}`,
      path:'/rh', destinatario:'ca', acao:'Processar despesa', prefKey:'tarefa_atribuida'
    });
  };

  const uploadFatura = (id, file) => {
    const reader = new FileReader();
    reader.onload = e => {
      const updated = items.map(i => i.id===id ? {...i, fatura:{ name:file.name, data:e.target.result }, estado:'em_analise'} : i);
      persist(updated);
      const it = updated.find(i => i.id === id);
      if (addNotif && it) addNotif({ tipo:'info', icon:'📎', accionavel:false, titulo:`Fatura submetida para análise`, sub:`${it.colaborador} · ${it.tipo} · ${fmt(it.valor)}`, path:'/rh', destinatario:'ca', prefKey:'tarefa_atribuida' });
    };
    reader.readAsDataURL(file);
    setUploadId(null);
  };

  const aprovar = (id) => {
    const it = items.find(i=>i.id===id);
    persist(items.map(i => i.id===id ? {...i, estado:'aprovado'} : i));
    // Add to tesouraria (sis_faturas_forn equivalent for expenses)
    try {
      const EXP_KEY = 'sis_despesas_internas';
      const all = JSON.parse(localStorage.getItem(EXP_KEY)||'[]');
      const { fatura, ...itSemFicheiro } = it || {};
      all.push({ ...itSemFicheiro, estado:'aprovado', aprovadoEm: new Date().toLocaleDateString('pt-PT'), ...(fatura ? { fatura: { name: fatura.name } } : {}) });
      localStorage.setItem(EXP_KEY, JSON.stringify(all));
    } catch {}
    // Notify colaborador and LG
    if (addNotif && it) {
      addNotif({ tipo:'info', icon:'✅', accionavel:false, titulo:`Despesa aprovada — reembolso a processar`, sub:`${it.colaborador} · ${it.tipo} · ${fmt(it.valor)}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
      addNotif({ tipo:'acao_lg', icon:'💶', accionavel:true, titulo:`Reembolso a processar — ${it.colaborador}`, sub:`${it.tipo} · ${it.descricao} · ${fmt(it.valor)}`, path:'/tesouraria', destinatario:'lg', acao:'Processar reembolso', prefKey:'tarefa_atribuida', meta:{ entityType:'despesa', entityId: it.id } });
    }
  };

  const rejeitar = (id) => {
    const it = items.find(i => i.id === id);
    persist(items.map(i => i.id===id ? {...i, estado:'rejeitado'} : i));
    if (addNotif && it) addNotif({ tipo:'info', icon:'↩', accionavel:false, titulo:`Despesa rejeitada`, sub:`${it.colaborador} · ${it.tipo} · ${fmt(it.valor)}`, path:'/rh', destinatario: getColabIdByNome(it.colaborador), prefKey:'tarefa_atribuida' });
  };

  const marcarReembolsado = (id) => {
    persist(items.map(i => i.id===id ? {...i, reembolsado:true, estado:'concluido'} : i));
    if (addNotif) {
      const it = items.find(i=>i.id===id);
      addNotif({ tipo:'info', icon:'💰', accionavel:false, titulo:`Reembolso efectuado — ${it?.colaborador}`, sub:`${it?.tipo} · ${fmt(it?.valor||0)}`, path:'/rh', destinatario: getColabIdByNome(it?.colaborador), prefKey:'recebimentos' });
    }
  };

  const totalPendente = items.filter(i=>i.estado==='pendente'||i.estado==='em_analise').reduce((s,i)=>s+(i.valor||0),0);
  const totalAprovar = items.filter(i=>i.estado==='aprovado'&&!i.reembolsado).reduce((s,i)=>s+(i.valor||0),0);
  const totalMes = items.filter(i=>{
    const d=new Date(i.data); const n=new Date();
    return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
  }).reduce((s,i)=>s+(i.valor||0),0);

  const EST_CLS = { pendente:'badge-i', em_analise:'badge-w', aprovado:'badge-s', rejeitado:'badge-d', concluido:'badge-s' };
  const EST_LAB = { pendente:'Pendente', em_analise:'Em análise', aprovado:'Aprovado', rejeitado:'Rejeitado', concluido:'✓ Concluído' };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:12 }}>
          {[['Pendentes',fmt(totalPendente),'var(--color-warning)'],
            ['A reembolsar',fmt(totalAprovar),'var(--color-info)'],
            ['Este mês',fmt(totalMes),'var(--brand-primary)'],
            ['Total registos',items.length,'var(--text-muted)']
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:'var(--bg-app)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
              <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={()=>setShowNovo(s=>!s)}>+ Nova despesa</button>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.png" style={{ display:'none' }}
        onChange={e=>{ const f=e.target.files?.[0]; if(f&&uploadId) uploadFatura(uploadId,f); e.target.value=''; }} />

      {/* Novo registo */}
      {showNovo && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:14 }}>Registar despesa interna</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Colaborador *</label>
              <select value={form.colaborador} onChange={e=>set('colaborador',e.target.value)} style={IS}>
                <option value="">Seleccionar...</option>
                {COLAB.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Tipo de despesa *</label>
              <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={IS}>
                {TIPOS_DESP.map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Data</label>
              <input type="date" value={form.data} onChange={e=>set('data',e.target.value)} style={IS} /></div>
            <div style={{ gridColumn:'span 2' }}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Descrição *</label>
              <input value={form.descricao} onChange={e=>set('descricao',e.target.value)} placeholder="ex: Abastecimento BP Cascais — 50L gasoleo" style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Valor (€) *</label>
              <input type="number" value={form.valor} onChange={e=>set('valor',e.target.value)} placeholder="0.00" style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Obra associada</label>
              <input value={form.obra} onChange={e=>set('obra',e.target.value)} placeholder="ex: O142" style={IS} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Viatura</label>
              <input value={form.viatura} onChange={e=>set('viatura',e.target.value)} placeholder="ex: 00-AA-00" style={IS} /></div>
          </div>
          <div style={{ marginTop:12, padding:'10px 14px', background:'var(--bg-info)', borderRadius:8, fontSize:12, color:'#0a3a6a' }}>
            ℹ Após submeter, a administrativa recebe notificação. Podes fazer upload da fatura na tabela.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
            <button className="btn" onClick={()=>setShowNovo(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={submeter}>🧾 Submeter despesa</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {items.length===0 ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🧾</div>
            <div style={{ fontWeight:500, marginBottom:8 }}>Sem despesas registadas</div>
            <button className="btn btn-primary" onClick={()=>setShowNovo(true)}>Registar primeira despesa</button>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'var(--bg-app)', borderBottom:'0.5px solid var(--border)' }}>
              {['Data','Colaborador','Tipo','Descrição','Obra','Viatura','Valor','Fatura','Estado','Ações'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map(i=>(
                <tr key={i.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{i.data}</td>
                  <td style={{ padding:'8px 12px', fontWeight:500 }}>{i.colaborador}</td>
                  <td style={{ padding:'8px 12px' }}><span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'var(--bg-app)', border:'0.5px solid var(--border)' }}>{i.tipo}</span></td>
                  <td style={{ padding:'8px 12px', fontSize:12, maxWidth:200 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.descricao}</div>
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.obra||'—'}</td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{i.viatura||'—'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:700, whiteSpace:'nowrap' }}>{fmt(i.valor||0)}</td>
                  <td style={{ padding:'8px 12px' }}>
                    {i.fatura
                      ? <a href={i.fatura.data} download={i.fatura.name} style={{ fontSize:12, color:'var(--brand-primary)', textDecoration:'none' }}>📎 {i.fatura.name.slice(0,16)}</a>
                      : <button className="btn btn-sm" onClick={()=>{ setUploadId(i.id); setTimeout(()=>fileRef.current?.click(),50); }}>+ Fatura</button>
                    }
                  </td>
                  <td style={{ padding:'8px 12px' }}>
                    <span className={`badge ${EST_CLS[i.estado]||'badge-n'}`}>{EST_LAB[i.estado]||i.estado}</span>
                    {i.reembolsado && <span style={{ fontSize:10, color:'var(--color-success)', display:'block' }}>💰 Reembolsado</span>}
                  </td>
                  <td style={{ padding:'8px 12px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {(i.estado==='pendente'||i.estado==='em_analise') && (
                        <>
                          <button className="btn btn-sm" style={{ background:'var(--color-success)', color:'#fff', border:'none' }} onClick={()=>aprovar(i.id)} title="Aprovar e notificar LG">✓</button>
                          <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }} onClick={()=>rejeitar(i.id)} title="Rejeitar">✕</button>
                        </>
                      )}
                      {i.estado==='aprovado'&&!i.reembolsado && (
                        <button className="btn btn-sm btn-primary" onClick={()=>marcarReembolsado(i.id)} title="Marcar como reembolsado">💶 Pago</button>
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

const TABS = [
  { key: 'colaboradores',  label: '👥 Colaboradores',    Component: Colaboradores },
  { key: 'ferias',         label: '🌴 Férias e Faltas',  Component: FeriasEFaltas },
  { key: 'horarios',       label: '⏰ Horários',          Component: GestaoHorarios },
  { key: 'passagens',      label: '✈️ Passagens Aéreas',  Component: PassagensAereas },
  { key: 'feriados',       label: '📅 Feriados',          Component: Feriados },
  { key: 'estatisticas',   label: '📊 Estatísticas',      Component: EstatisticasRH },
  { key: 'despesas',       label: '🧾 Despesas Internas',     Component: GestaoInterna },
];

export default function RHPage() {
  const location = useLocation();
  const [tab, setTab] = useState('colaboradores');
  const [abrirColaboradorId, setAbrirColaboradorId] = useState(null);
  const tabObj = TABS.find(t => t.key === tab);
  const TabContent = tabObj?.Component;

  useEffect(() => {
    const nextTab = location.state?.rhTab;
    const nextColab = location.state?.abrirColaborador;
    if (!nextTab && !nextColab) return;
    if (nextTab) setTab(nextTab);
    if (nextColab) setAbrirColaboradorId(nextColab);
    window.history.replaceState({}, '');
  }, [location.state]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Recursos Humanos</div>
          <div className="page-subtitle">Colaboradores · Férias · Horários · Passagens · Feriados</div>
        </div>
      </div>

      {/* Tabs horizontais */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-app)', borderRadius:'var(--radius-md)', padding:4, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              fontFamily:'var(--font-body)', fontSize:12, fontWeight:tab===t.key?600:400,
              padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab===t.key ? 'var(--bg-card)' : 'transparent',
              color: tab===t.key ? 'var(--brand-primary)' : 'var(--text-muted)',
              boxShadow: tab===t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .15s', whiteSpace:'nowrap',
            }}
          >{t.label}</button>
        ))}
      </div>

      {TabContent && <TabContent abrirColaboradorId={tab === 'colaboradores' ? abrirColaboradorId : null} />}
    </div>
  );
}
