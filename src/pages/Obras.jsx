import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CLIENTES_DATA } from './Clientes';
import { canEditModule, getAccessibleObraIds, loadPerfis } from '../context/PermissionsConfig';

export const OBRAS_DATA = [
  {
    id: 'O142',
    nome: 'Centro Logístico Setúbal — Fase 2',
    cliente: 'Logicor Portugal, SA',
    dp: 'Rui Carvalho',
    controller: 'Ana Ferreira',
    dataInicio: '03 Jan 2026',
    dataFimContratual: '30 Jun 2026',
    dataFimPrevista: '15 Jul 2026',
    observacoes: 'Atraso de 15 dias na fase estrutural. Subcontratado em negociação.',
    estado: 'atencao', // ok | atencao | critico
    valorVenda: 2840000,
    custoPrevInicial: 2200000,
    custoPrevAtualizado: 2310000,
    margemInicial: 22.5,
    margemPrevista: 18.7,
    desvioMargem: -3.8,
    execFisicaPrevista: 65,
    execFisicaReal: 55,
    execFinanceiraPrevista: 65,
    execFinanceiraReal: 59,
    tempoDecorrido: 65,
    faturacaoEmitida: 1670000,
    faturacaoRecebida: 1420000,
    saldoFaturar: 1170000,
    pctFaturacao: 58.8,
    fases: [
      { nome: 'Fundações',       roc: 480000, executado: 492000, previsto: 495000, desvioEur:  12000, desvioPct:  2.5, estado: 'critico'  },
      { nome: 'Estrutura',       roc: 620000, executado: 635000, previsto: 648000, desvioEur:  15000, desvioPct:  2.4, estado: 'alerta'   },
      { nome: 'Cobertura',       roc: 310000, executado: 298000, previsto: 302000, desvioEur: -12000, desvioPct: -3.9, estado: 'ok'       },
      { nome: 'Inst. Elétricas', roc: 280000, executado: 271000, previsto: 275000, desvioEur:  -9000, desvioPct: -3.2, estado: 'ok'       },
      { nome: 'Inst. AVAC',      roc: 195000, executado: 201000, previsto: 203000, desvioEur:   6000, desvioPct:  3.1, estado: 'atencao'  },
      { nome: 'Acabamentos',     roc: 315000, executado: 0,      previsto: 0,      desvioEur:      0, desvioPct:  0,   estado: 'pendente' },
    ],
    graficoCustos: [
      { mes: 'Jan', previsto: 200000,  real: 210000  },
      { mes: 'Fev', previsto: 600000,  real: 620000  },
      { mes: 'Mar', previsto: 1000000, real: 980000  },
      { mes: 'Abr', previsto: 1400000, real: 1380000 },
      { mes: 'Mai', previsto: 1800000, real: 1820000 },
      { mes: 'Jun', previsto: 2200000, real: null     },
    ],
    graficoCashflow: [
      { mes: 'Jan', recebimentos:  400000, pagamentos:  210000 },
      { mes: 'Fev', recebimentos:  380000, pagamentos:  420000 },
      { mes: 'Mar', recebimentos:  490000, pagamentos:  560000 },
      { mes: 'Abr', recebimentos:  150000, pagamentos:  180000 },
      { mes: 'Mai', recebimentos:  100000, pagamentos:   80000 },
      { mes: 'Jun', recebimentos:      0,  pagamentos:       0 },
    ],
    encomendas: [
      { descricao: 'Betão C30/37 — Fundações',   valor: 48200 },
      { descricao: 'Perfis metálicos HEA 200',    valor: 31500 },
      { descricao: 'Painéis sandwich 100mm',      valor: 24800 },
      { descricao: 'Quadro elétrico principal',   valor: 18200 },
      { descricao: 'UTA industrial zona produção', valor: 14600 },
    ],
    alertas: [
      { nivel: 'critico', descricao: 'Desvio de 2,5% na fase Fundações — custo real supera orçamento em 12.000 €', data: '07 Mar 2026', jado: 'JADO #003' },
      { nivel: 'alerta',  descricao: 'Desvio de 2,4% na fase Estrutura — subcontratado fora de prazo', data: '10 Mar 2026', jado: 'JADO #004' },
      { nivel: 'atencao', descricao: 'Desvio de 3,1% na fase AVAC — materiais com sobrecusto', data: '11 Mar 2026', jado: null },
    ],
    jados: [
      { num: 'JADO #001', fase: 'Fundações',  data: '12 Fev', desvio: 1.8, estado: 'validado-ms'     },
      { num: 'JADO #002', fase: 'Estrutura',  data: '28 Fev', desvio: 1.2, estado: 'env-comercial'   },
      { num: 'JADO #003', fase: 'Fundações',  data: '07 Mar', desvio: 2.5, estado: 'aguarda-dp'      },
      { num: 'JADO #004', fase: 'Estrutura',  data: '10 Mar', desvio: 2.4, estado: 'aguarda-dir-prod' },
    ],
  },
  {
    id: 'O143',
    nome: 'Ampliação Industrial Sintra',
    cliente: 'Câmara Municipal Sintra',
    dp: 'Sofia Monteiro',
    controller: 'Ana Ferreira',
    dataInicio: '15 Fev 2026',
    dataFimContratual: '31 Ago 2026',
    dataFimPrevista: '31 Ago 2026',
    observacoes: '',
    estado: 'ok',
    valorVenda: 1240000,
    custoPrevInicial: 980000,
    custoPrevAtualizado: 990000,
    margemInicial: 20.9,
    margemPrevista: 20.2,
    desvioMargem: -0.7,
    execFisicaPrevista: 30,
    execFisicaReal: 28,
    execFinanceiraPrevista: 30,
    execFinanceiraReal: 27,
    tempoDecorrido: 28,
    faturacaoEmitida: 335000,
    faturacaoRecebida: 200000,
    saldoFaturar: 905000,
    pctFaturacao: 27.0,
    fases: [
      { nome: 'Fundações',   roc: 180000, executado: 182000, previsto: 183000, desvioEur: 2000, desvioPct: 1.1, estado: 'atencao' },
      { nome: 'Estrutura',   roc: 320000, executado: 85000,  previsto: 90000,  desvioEur: -5000, desvioPct: -1.6, estado: 'ok'    },
      { nome: 'Cobertura',   roc: 240000, executado: 0,      previsto: 0,      desvioEur: 0, desvioPct: 0, estado: 'pendente'      },
      { nome: 'Acabamentos', roc: 240000, executado: 0,      previsto: 0,      desvioEur: 0, desvioPct: 0, estado: 'pendente'      },
    ],
    graficoCustos: [
      { mes: 'Fev', previsto: 180000, real: 182000 },
      { mes: 'Mar', previsto: 350000, real: 267000 },
      { mes: 'Abr', previsto: 550000, real: null   },
      { mes: 'Mai', previsto: 750000, real: null   },
    ],
    graficoCashflow: [
      { mes: 'Fev', recebimentos: 200000, pagamentos: 182000 },
      { mes: 'Mar', recebimentos: 135000, pagamentos:  85000 },
      { mes: 'Abr', recebimentos:      0, pagamentos:      0 },
    ],
    encomendas: [
      { descricao: 'Betão C25/30 — Fundações', valor: 28400 },
      { descricao: 'Armaduras AÇO A500',       valor: 14200 },
    ],
    alertas: [
      { nivel: 'atencao', descricao: 'Desvio de 1,1% na fase Fundações', data: '05 Mar 2026', jado: null },
    ],
    jados: [],
  },
  {
    id: 'O138',
    nome: 'Reabilitação Urbana Setúbal',
    cliente: 'Privado XYZ Lda',
    dp: 'Carlos Mendes',
    controller: 'Ana Ferreira',
    dataInicio: '01 Set 2025',
    dataFimContratual: '30 Abr 2026',
    dataFimPrevista: '15 Mai 2026',
    observacoes: 'Obra em fase final. Pequenos ajustes de acabamentos pendentes.',
    estado: 'ok',
    valorVenda: 890000,
    custoPrevInicial: 720000,
    custoPrevAtualizado: 728000,
    margemInicial: 19.1,
    margemPrevista: 18.2,
    desvioMargem: -0.9,
    execFisicaPrevista: 92,
    execFisicaReal: 89,
    execFinanceiraPrevista: 90,
    execFinanceiraReal: 88,
    tempoDecorrido: 87,
    faturacaoEmitida: 783000,
    faturacaoRecebida: 720000,
    saldoFaturar: 107000,
    pctFaturacao: 88.0,
    fases: [
      { nome: 'Demolições',    roc: 80000,  executado: 79000,  previsto: 79000,  desvioEur: -1000, desvioPct: -1.3, estado: 'ok' },
      { nome: 'Estrutura',     roc: 220000, executado: 218000, previsto: 218000, desvioEur: -2000, desvioPct: -0.9, estado: 'ok' },
      { nome: 'Instalações',   roc: 180000, executado: 176000, previsto: 176000, desvioEur: -4000, desvioPct: -2.2, estado: 'ok' },
      { nome: 'Acabamentos',   roc: 240000, executado: 168000, previsto: 255000, desvioEur: 15000, desvioPct:  6.3, estado: 'alerta' },
    ],
    graficoCustos: [
      { mes: 'Set', previsto: 80000,  real: 79000  },
      { mes: 'Out', previsto: 200000, real: 198000 },
      { mes: 'Nov', previsto: 380000, real: 375000 },
      { mes: 'Dez', previsto: 520000, real: 516000 },
      { mes: 'Jan', previsto: 640000, real: 635000 },
      { mes: 'Fev', previsto: 720000, real: 718000 },
    ],
    graficoCashflow: [
      { mes: 'Set', recebimentos:      0, pagamentos:  79000 },
      { mes: 'Out', recebimentos: 150000, pagamentos: 119000 },
      { mes: 'Nov', recebimentos: 180000, pagamentos: 177000 },
      { mes: 'Dez', recebimentos: 200000, pagamentos: 141000 },
      { mes: 'Jan', recebimentos: 120000, pagamentos: 119000 },
      { mes: 'Fev', recebimentos: 133000, pagamentos:  83000 },
    ],
    encomendas: [
      { descricao: 'Revestimento cerâmico premium', valor: 22400 },
      { descricao: 'Caixilharia alumínio',          valor: 18900 },
      { descricao: 'Pavimento soalho carvalho',     valor: 14200 },
    ],
    alertas: [
      { nivel: 'alerta', descricao: 'Desvio de 6,3% na fase Acabamentos — materiais acima do previsto', data: '08 Mar 2026', jado: 'JADO #001' },
    ],
    jados: [
      { num: 'JADO #001', fase: 'Acabamentos', data: '08 Mar', desvio: 6.3, estado: 'aguarda-dp' },
    ],
  },
  {
    id: 'O145',
    nome: 'Pavilhão Industrial Almada',
    cliente: 'Construtora LD Lda',
    dp: 'Pedro Fonseca',
    controller: 'Ana Ferreira',
    dataInicio: '10 Mar 2026',
    dataFimContratual: '31 Dez 2026',
    dataFimPrevista: '31 Dez 2026',
    observacoes: 'Obra recém-iniciada. Fundações em curso.',
    estado: 'critico',
    valorVenda: 3200000,
    custoPrevInicial: 2600000,
    custoPrevAtualizado: 2725000,
    margemInicial: 18.75,
    margemPrevista: 14.8,
    desvioMargem: -3.95,
    execFisicaPrevista: 8,
    execFisicaReal: 6,
    execFinanceiraPrevista: 8,
    execFinanceiraReal: 5,
    tempoDecorrido: 5,
    faturacaoEmitida: 160000,
    faturacaoRecebida: 0,
    saldoFaturar: 3040000,
    pctFaturacao: 5.0,
    fases: [
      { nome: 'Fundações',   roc: 420000, executado: 136000, previsto: 420000, desvioEur: 4800, desvioPct: 4.8, estado: 'critico'  },
      { nome: 'Estrutura',   roc: 850000, executado: 0,      previsto: 0,      desvioEur: 0,    desvioPct: 0,   estado: 'pendente' },
      { nome: 'Cobertura',   roc: 480000, executado: 0,      previsto: 0,      desvioEur: 0,    desvioPct: 0,   estado: 'pendente' },
      { nome: 'Instalações', roc: 520000, executado: 0,      previsto: 0,      desvioEur: 0,    desvioPct: 0,   estado: 'pendente' },
      { nome: 'Acabamentos', roc: 330000, executado: 0,      previsto: 0,      desvioEur: 0,    desvioPct: 0,   estado: 'pendente' },
    ],
    graficoCustos: [
      { mes: 'Mar', previsto: 136000, real: 142800 },
      { mes: 'Abr', previsto: 420000, real: null   },
      { mes: 'Mai', previsto: 800000, real: null   },
    ],
    graficoCashflow: [
      { mes: 'Mar', recebimentos: 0, pagamentos: 142800 },
    ],
    encomendas: [
      { descricao: 'Betão C30/37 — Fundações Fase 1', valor: 62400 },
      { descricao: 'Armaduras AÇO A500 NR',           valor: 38200 },
    ],
    alertas: [
      { nivel: 'critico', descricao: 'Desvio de 4,8% na fase Fundações — custo acima do orçamento em 6.400 €', data: '14 Mar 2026', jado: 'JADO #001' },
    ],
    jados: [
      { num: 'JADO #001', fase: 'Fundações', data: '14 Mar', desvio: 4.8, estado: 'aguarda-dp' },
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = v => '€ ' + Number(v).toLocaleString('pt-PT');

const ESTADO_CONFIG = {
  ok:       { label: 'No plano',  cls: 'badge-s', cor: 'var(--color-success)', dot: '#2E7D52' },
  atencao:  { label: 'Atenção',   cls: 'badge-w', cor: 'var(--color-warning)', dot: '#C47A1A' },
  critico:  { label: 'Crítico',   cls: 'badge-d', cor: 'var(--color-danger)',  dot: '#B83232' },
};

// ─── MODAL NOVA OBRA ──────────────────────────────────────────────────────────
// Converte ISO (yyyy-mm-dd) ↔ pt-PT (dd/mm/yyyy)
const isoToDisplay = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Componente de dropdown com pesquisa
function SearchDropdown({ label, required, value, onChange, options, placeholder, allowCustom, error }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o =>
    (typeof o === 'string' ? o : o.label).toLowerCase().includes(search.toLowerCase())
  );
  const display = value || '';
  const IS = {
    width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 10px',
    border: `0.5px solid ${error ? 'var(--color-danger)' : open ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };
  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          value={open ? search : display}
          onChange={e => { setSearch(e.target.value); if (allowCustom) onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setSearch(''); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || `Seleccionar ${label.toLowerCase()}...`}
          style={IS}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}>▾</span>
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 600, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
          {filtered.map(o => {
            const lbl = typeof o === 'string' ? o : o.label;
            const val = typeof o === 'string' ? o : o.value;
            return (
              <div key={val} onMouseDown={() => { onChange(val); setSearch(''); setOpen(false); }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                {lbl}
              </div>
            );
          })}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// Linha de plano (financeiro ou físico)
function PlanoRow({ mes, previsto, real, onChange, idx }) {
  const IS = { fontFamily: 'var(--font-body)', fontSize: 12, padding: '4px 6px', border: '0.5px solid var(--border)', borderRadius: 5, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', width: '100%', textAlign: 'right', boxSizing: 'border-box' };
  return (
    <tr>
      <td style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{mes}</td>
      <td style={{ padding: '4px 6px' }}>
        <input type="number" value={previsto} onChange={e => onChange(idx, 'previsto', e.target.value)} style={IS} placeholder="0" />
      </td>
      <td style={{ padding: '4px 6px' }}>
        <input type="number" value={real} onChange={e => onChange(idx, 'real', e.target.value)} style={IS} placeholder="—" />
      </td>
    </tr>
  );
}

function NovaObraModal({ onClose, onSave }) {
  // Dados externos
  const todosClientes = (() => {
    try {
      const extra = JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]');
      return [...CLIENTES_DATA, ...extra];
    } catch { return CLIENTES_DATA; }
  })();
  const todosPerfis = loadPerfis();

  const [form, setForm] = useState({
    id: '', nome: '', cliente: '', dp: '', controller: '',
    dataInicio: '', dataFimContratual: '',
    valorVenda: '', custoPrevInicial: '', observacoes: '',
  });
  const [errors, setErrors]     = useState({});
  const [fases, setFases]       = useState([{ nome: '', roc: '' }]);
  const [planoFin, setPlanoFin] = useState(
    ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map(m => ({ mes: m, previsto: '', real: '' }))
  );
  const [planoFis, setPlanoFis] = useState(
    ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map(m => ({ mes: m, previsto: '', real: '' }))
  );
  const [secao, setSecao] = useState('geral'); // geral | fases | plano

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  // Opções
  const optsClientes = todosClientes.map(c => ({ label: c.nome, value: c.nome }));
  const optsPerfis   = todosPerfis.map(p => ({ label: p.nome, value: p.nome }));

  // Fases
  const addFase = () => setFases(f => [...f, { nome: '', roc: '' }]);
  const setFase = (i, k, v) => setFases(f => f.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const removeFase = i => setFases(f => f.filter((_, j) => j !== i));

  // Plano
  const setPlanoVal = (tipo, idx, key, val) => {
    const setter = tipo === 'fin' ? setPlanoFin : setPlanoFis;
    setter(p => p.map((x, i) => i === idx ? { ...x, [key]: val } : x));
  };

  const validate = () => {
    const e = {};
    if (!form.id.trim())               e.id = 'Obrigatório';
    if (!form.nome.trim())             e.nome = 'Obrigatório';
    if (!form.cliente.trim())          e.cliente = 'Obrigatório';
    if (!form.dp.trim())               e.dp = 'Obrigatório';
    if (!form.dataInicio)              e.dataInicio = 'Obrigatório';
    if (!form.dataFimContratual)       e.dataFimContratual = 'Obrigatório';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); setSecao('geral'); return; }
    const fasesObj = fases.filter(f => f.nome.trim()).map(f => ({
      nome: f.nome.trim(),
      roc: Number(f.roc) || 0,
      executado: 0, previsto: 0,
      desvioEur: 0, desvioPct: 0, estado: 'pendente',
    }));
    const graficoCustos = planoFin.filter(p => p.previsto).map(p => ({
      mes: p.mes, previsto: Number(p.previsto) || 0, real: p.real !== '' ? Number(p.real) : null,
    }));
    const graficoCashflow = planoFis.filter(p => p.previsto || p.real).map(p => ({
      mes: p.mes, recebimentos: Number(p.previsto) || 0, pagamentos: Number(p.real) || 0,
    }));
    onSave({ ...form, fases: fasesObj, graficoCustos, graficoCashflow });
  };

  const inpStyle = (key) => ({
    width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 10px',
    border: `0.5px solid ${errors[key] ? 'var(--color-danger)' : 'var(--border-strong)'}`,
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  });
  const lblStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 };
  const errStyle = { fontSize: 11, color: 'var(--color-danger)', marginTop: 4 };

  const SECOES = [
    { key: 'geral', label: '1. Dados Gerais' },
    { key: 'fases', label: '2. Fases de Custo' },
    { key: 'plano', label: '3. Plano de Execução' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nova obra</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Preenche os dados para criar uma nova obra no SIS</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Tabs de secção */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          {SECOES.map(s => (
            <button key={s.key} onClick={() => setSecao(s.key)}
              style={{ fontFamily: 'var(--font-body)', flex: 1, padding: '10px 0', fontSize: 12, fontWeight: secao === s.key ? 600 : 400, color: secao === s.key ? 'var(--brand-primary)' : 'var(--text-muted)', background: 'none', border: 'none', borderBottom: secao === s.key ? '2px solid var(--brand-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all .15s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Conteúdo scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── SECÇÃO 1: DADOS GERAIS ── */}
          {secao === 'geral' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              {/* Código */}
              <div>
                <label style={lblStyle}>Código obra <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input value={form.id} onChange={e => set('id', e.target.value.toUpperCase())} placeholder="ex: O146" style={inpStyle('id')} />
                {errors.id && <div style={errStyle}>{errors.id}</div>}
              </div>

              {/* Cliente — dropdown */}
              <SearchDropdown
                label="Cliente" required value={form.cliente}
                onChange={v => set('cliente', v)}
                options={optsClientes}
                allowCustom={true}
                error={errors.cliente}
                placeholder="Pesquisar cliente..."
              />

              {/* Designação — full width */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lblStyle}>Designação <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome da obra" style={inpStyle('nome')} />
                {errors.nome && <div style={errStyle}>{errors.nome}</div>}
              </div>

              {/* Director de Produção — dropdown perfis */}
              <SearchDropdown
                label="Director de Produção" required value={form.dp}
                onChange={v => set('dp', v)}
                options={optsPerfis}
                allowCustom={true}
                error={errors.dp}
                placeholder="Pesquisar perfil..."
              />

              {/* Controller — dropdown perfis */}
              <SearchDropdown
                label="Controller" value={form.controller}
                onChange={v => set('controller', v)}
                options={optsPerfis}
                allowCustom={true}
                placeholder="Pesquisar perfil..."
              />

              {/* Data início — date picker */}
              <div>
                <label style={lblStyle}>Data de início <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input type="date" value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)} style={inpStyle('dataInicio')} />
                {form.dataInicio && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{isoToDisplay(form.dataInicio)}</div>}
                {errors.dataInicio && <div style={errStyle}>{errors.dataInicio}</div>}
              </div>

              {/* Fim contratual — date picker */}
              <div>
                <label style={lblStyle}>Fim contratual <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input type="date" value={form.dataFimContratual} onChange={e => set('dataFimContratual', e.target.value)} style={inpStyle('dataFimContratual')} />
                {form.dataFimContratual && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{isoToDisplay(form.dataFimContratual)}</div>}
                {errors.dataFimContratual && <div style={errStyle}>{errors.dataFimContratual}</div>}
              </div>

              {/* Valor de venda */}
              <div>
                <label style={lblStyle}>Valor de venda (€)</label>
                <input type="number" value={form.valorVenda} onChange={e => set('valorVenda', e.target.value)} placeholder="ex: 1500000" style={inpStyle('valorVenda')} />
                {form.valorVenda && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>€ {Number(form.valorVenda).toLocaleString('pt-PT')}</div>}
              </div>

              {/* Custo previsto */}
              <div>
                <label style={lblStyle}>Custo previsto inicial (€)</label>
                <input type="number" value={form.custoPrevInicial} onChange={e => set('custoPrevInicial', e.target.value)} placeholder="ex: 1200000" style={inpStyle('custoPrevInicial')} />
                {form.valorVenda && form.custoPrevInicial && (
                  <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 3 }}>
                    Margem: {(((Number(form.valorVenda) - Number(form.custoPrevInicial)) / Number(form.valorVenda)) * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Observações */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lblStyle}>Observações</label>
                <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2}
                  style={{ ...inpStyle('observacoes'), resize: 'vertical' }} placeholder="Notas adicionais..." />
              </div>
            </div>
          )}

          {/* ── SECÇÃO 2: FASES DE CUSTO ── */}
          {secao === 'fases' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Define as fases de custo da obra. O orçamento de cada fase será importado do Centralgest — podes preencher aqui ou actualizar depois.
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fase de custo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', width: 140 }}>Orçamento (€)</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {fases.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={f.nome} onChange={e => setFase(i, 'nome', e.target.value)}
                          placeholder="ex: Fundações, Estrutura, Cobertura..."
                          style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 8px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" value={f.roc} onChange={e => setFase(i, 'roc', e.target.value)}
                          placeholder="0"
                          style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 8px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        {fases.length > 1 && (
                          <button onClick={() => removeFase(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '2px 6px' }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={addFase}>+ Adicionar fase</button>
              {fases.some(f => f.roc) && (
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Total orçamentado: <span style={{ color: 'var(--brand-primary)' }}>
                    € {fases.reduce((s, f) => s + (Number(f.roc) || 0), 0).toLocaleString('pt-PT')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── SECÇÃO 3: PLANO DE EXECUÇÃO ── */}
          {secao === 'plano' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Introduz o plano de execução financeira e física mensal. O plano pode ser importado via Excel ou preenchido manualmente. Os valores são acumulados.
              </div>
              {/* Importar Excel */}
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Importar via Excel</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Colunas esperadas: Mês | Fin. Previsto | Fin. Real | Fís. Previsto | Fís. Real</div>
                </div>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                        try {
                          const text = ev.target.result;
                          const lines = text.split('\n').filter(l => l.trim());
                          const MESES_MAP = { jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11 };
                          const newFin = [...planoFin];
                          const newFis = [...planoFis];
                          lines.slice(1).forEach(line => {
                            const cols = line.split(',').map(c => c.trim().replace(/"/g,''));
                            const mesKey = cols[0]?.toLowerCase().substring(0,3);
                            const idx = MESES_MAP[mesKey];
                            if (idx === undefined) return;
                            if (cols[1]) newFin[idx] = { ...newFin[idx], previsto: cols[1] };
                            if (cols[2]) newFin[idx] = { ...newFin[idx], real: cols[2] };
                            if (cols[3]) newFis[idx] = { ...newFis[idx], previsto: cols[3] };
                            if (cols[4]) newFis[idx] = { ...newFis[idx], real: cols[4] };
                          });
                          setPlanoFin(newFin);
                          setPlanoFis(newFis);
                        } catch {}
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                  <span className="btn btn-sm">📂 Importar CSV</span>
                </label>
              </div>

              {/* Financeiro */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />
                  Plano de execução financeira (€ acumulado)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 60 }}>Mês</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Previsto (€)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Real (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planoFin.map((p, i) => (
                      <PlanoRow key={p.mes} mes={p.mes} previsto={p.previsto} real={p.real} idx={i}
                        onChange={(idx, key, val) => setPlanoVal('fin', idx, key, val)} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Físico */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                  Plano de execução física (% acumulado)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 60 }}>Mês</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Previsto (%)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Real (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planoFis.map((p, i) => (
                      <PlanoRow key={p.mes} mes={p.mes} previsto={p.previsto} real={p.real} idx={i}
                        onChange={(idx, key, val) => setPlanoVal('fis', idx, key, val)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {SECOES.map((s, i) => (
              <button key={s.key} onClick={() => setSecao(s.key)}
                style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                  background: secao === s.key ? 'var(--brand-primary)' : 'var(--border-strong)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {secao !== 'geral' && (
              <button className="btn" onClick={() => setSecao(secao === 'plano' ? 'fases' : 'geral')}>← Anterior</button>
            )}
            {secao !== 'plano' ? (
              <button className="btn btn-primary" onClick={() => setSecao(secao === 'geral' ? 'fases' : 'plano')}>Seguinte →</button>
            ) : (
              <button className="btn btn-primary" onClick={handleSave}>✓ Criar obra</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GALERIA ──────────────────────────────────────────────────────────────────
const STORAGE_KEY_OBRAS = 'sis_obras_extra';
function loadObrasExtra() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_OBRAS) || '[]'); }
  catch { return []; }
}
function saveObrasExtra(list) {
  localStorage.setItem(STORAGE_KEY_OBRAS, JSON.stringify(list));
}

export default function ObrasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [extras, setExtras] = useState(loadObrasExtra);
  const [toast, setToast] = useState('');
  const [vistaObras, setVistaObras] = useState('galeria');

  const allObras = [...OBRAS_DATA, ...extras];
  const allowedObraIds = getAccessibleObraIds(user, allObras);
  const visibleObras = allObras.filter(o => allowedObraIds.includes(o.id));
  const canEditObrasModule = canEditModule(user, 'obras');

  const handleSave = (form) => {
    if (!canEditObrasModule) return;
    const fmtDate = iso => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${parseInt(d)} ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(m)-1]} ${y}`;
    };
    const nova = {
      id: form.id.toUpperCase(),
      nome: form.nome,
      cliente: form.cliente,
      dp: form.dp,
      controller: form.controller || '—',
      dataInicio: fmtDate(form.dataInicio),
      dataFimContratual: fmtDate(form.dataFimContratual),
      dataFimPrevista: fmtDate(form.dataFimContratual),
      observacoes: form.observacoes || '',
      estado: 'ok',
      valorVenda: Number(form.valorVenda) || 0,
      custoPrevInicial: Number(form.custoPrevInicial) || 0,
      custoPrevAtualizado: Number(form.custoPrevInicial) || 0,
      margemInicial: form.valorVenda && form.custoPrevInicial
        ? +((( Number(form.valorVenda) - Number(form.custoPrevInicial)) / Number(form.valorVenda)) * 100).toFixed(1)
        : 0,
      margemPrevista: form.valorVenda && form.custoPrevInicial
        ? +((( Number(form.valorVenda) - Number(form.custoPrevInicial)) / Number(form.valorVenda)) * 100).toFixed(1)
        : 0,
      desvioMargem: 0,
      execFisicaPrevista: 0, execFisicaReal: 0,
      execFinanceiraPrevista: 0, execFinanceiraReal: 0,
      tempoDecorrido: 0,
      faturacaoEmitida: 0, faturacaoRecebida: 0,
      saldoFaturar: Number(form.valorVenda) || 0,
      pctFaturacao: 0,
      fases: form.fases || [],
      graficoCustos: form.graficoCustos || [],
      graficoCashflow: form.graficoCashflow || [],
      encomendas: [], alertas: [], jados: [],
      _userCreated: true,
    };
    const updated = [...extras, nova];
    setExtras(updated);
    saveObrasExtra(updated);
    setShowModal(false);
    setToast(`Obra "${nova.id}" criada com sucesso`);
    setTimeout(() => setToast(''), 3500);
  };

  const handleDelete = (id, e) => {
    if (!canEditObrasModule) return;
    e.stopPropagation();
    if (!window.confirm(`Remover a obra ${id}?`)) return;
    const updated = extras.filter(o => o.id !== id);
    setExtras(updated);
    saveObrasExtra(updated);
  };

  const filtered = visibleObras.filter(o => {
    const s = search.toLowerCase();
    const matchSearch = o.nome.toLowerCase().includes(s) ||
      o.id.toLowerCase().includes(s) ||
      o.cliente.toLowerCase().includes(s);
    const matchEstado = filtroEstado === 'todos' || o.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const counts = {
    ok:      visibleObras.filter(o => o.estado === 'ok').length,
    atencao: visibleObras.filter(o => o.estado === 'atencao').length,
    critico: visibleObras.filter(o => o.estado === 'critico').length,
  };

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 600, background: 'var(--color-success)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {showModal && <NovaObraModal onClose={() => setShowModal(false)} onSave={handleSave} />}

      <div className="page-header">
        <div>
          <div className="page-title">Obras</div>
          <div className="page-subtitle">{visibleObras.length} obras em curso · Controlo de gestão financeira</div>
        </div>
        {canEditObrasModule && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova obra</button>}
      </div>

      {/* KPIs rápidos — grid horizontal explícito */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Obras em curso</div>
          <div className="kpi-value">{visibleObras.length}</div>
          <div className="kpi-delta up">Activas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">No plano</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{counts.ok}</div>
          <div className="kpi-delta up">Sem alertas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Com atenção</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{counts.atencao}</div>
          <div className="kpi-delta dn">Desvios menores</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Críticas</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{counts.critico}</div>
          <div className="kpi-delta dn">JADOs pendentes</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="sis-input"
          placeholder="Pesquisar por código, nome ou cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'todos',   label: 'Todas' },
            { key: 'ok',      label: 'No plano' },
            { key: 'atencao', label: 'Atenção' },
            { key: 'critico', label: 'Crítico' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroEstado(f.key)} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 14px',
              borderRadius: 20, border: '0.5px solid',
              borderColor: filtroEstado === f.key ? 'var(--brand-primary)' : 'var(--border)',
              background: filtroEstado === f.key ? 'var(--brand-primary)' : 'var(--bg-card)',
              color: filtroEstado === f.key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all .15s',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', background:'var(--bg-app)', borderRadius:8, border:'0.5px solid var(--border)', overflow:'hidden', marginLeft:'auto' }}>
          <button onClick={() => setVistaObras('galeria')} style={{ padding:'6px 10px', border:'none', cursor:'pointer', fontSize:14, background:vistaObras==='galeria'?'var(--brand-primary)':'transparent', color:vistaObras==='galeria'?'#fff':'var(--text-muted)' }} title="Vista galeria">⊞</button>
          <button onClick={() => setVistaObras('tabela')} style={{ padding:'6px 10px', border:'none', cursor:'pointer', fontSize:14, background:vistaObras==='tabela'?'var(--brand-primary)':'transparent', color:vistaObras==='tabela'?'#fff':'var(--text-muted)' }} title="Vista tabela">☰</button>
        </div>
        {canEditObrasModule && extras.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {extras.length} criada{extras.length > 1 ? 's' : ''} por ti
          </span>
        )}
      </div>

      {/* Galeria / Tabela */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          Nenhuma obra encontrada{search ? ` para "${search}"` : ''}.{' '}
          <span style={{ color: 'var(--brand-primary)', cursor: 'pointer' }} onClick={() => setShowModal(true)}>Criar nova?</span>
        </div>
      ) : vistaObras === 'galeria' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {filtered.map(obra => {
            const est = ESTADO_CONFIG[obra.estado];
            return (
              <div
                key={obra.id}
                className="card"
                onClick={() => navigate(`/obras/${obra.id}`)}
                style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', position: 'relative' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(28,58,94,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                {obra._userCreated && (
                  <button onClick={e => handleDelete(obra.id, e)} title="Remover obra"
                    style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 6px', borderRadius: 4, zIndex: 1 }}>
                    ✕
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', background: 'var(--bg-info)', padding: '2px 8px', borderRadius: 4 }}>{obra.id}</span>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: est.dot }} title={est.label} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, paddingRight: obra._userCreated ? 24 : 0 }}>{obra.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{obra.cliente}</div>
                  </div>
                  <span className={`badge ${est.cls}`} style={{ flexShrink: 0 }}>{est.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                  <span>Início {obra.dataInicio}</span><span>·</span>
                  <span>Fim {obra.dataFimPrevista}</span><span>·</span>
                  <span>DP: {obra.dp}</span>
                </div>
                <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 12 }} />
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                    <span>Execução financeira</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{obra.execFinanceiraReal}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(obra.execFinanceiraPrevista, 1)}%`, background: 'var(--border-strong)', borderRadius: 3, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${obra.execFinanceiraPrevista > 0 ? (obra.execFinanceiraReal / obra.execFinanceiraPrevista) * 100 : 0}%`, background: 'var(--brand-primary)', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>Físico: {obra.execFisicaReal}%</span>
                    <span>Tempo: {obra.tempoDecorrido}%</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Valor venda',  value: fmt(obra.valorVenda),      color: undefined },
                    { label: 'Margem prev.', value: `${obra.margemPrevista}%`, color: obra.margemPrevista < 10 ? 'var(--color-danger)' : obra.margemPrevista < 15 ? 'var(--color-warning)' : 'var(--color-success)' },
                    { label: 'Desvio',       value: `${obra.desvioMargem > 0 ? '+' : ''}${obra.desvioMargem} p.p.`, color: obra.desvioMargem < 0 ? 'var(--color-danger)' : obra.desvioMargem === 0 ? 'var(--text-muted)' : 'var(--color-success)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: 'var(--bg-app)', borderRadius: 6, padding: '7px 9px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{k.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: k.color || 'var(--text-primary)' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {obra.alertas.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-danger)' }}>
                    <span>⚠</span>
                    <span>{obra.alertas.length} alerta{obra.alertas.length > 1 ? 's' : ''} activo{obra.alertas.length > 1 ? 's' : ''}</span>
                    {obra.jados.length > 0 && <span style={{ color: 'var(--text-muted)' }}>· {obra.jados.length} JADO{obra.jados.length > 1 ? 's' : ''}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista tabela */
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '0.5px solid var(--border)' }}>
                {['Código','Obra','Cliente','DP','Datas','Exec. Fin.','Exec. Fís.','Valor Venda','Margem','Alertas','Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(obra => {
                const est = ESTADO_CONFIG[obra.estado];
                return (
                  <tr key={obra.id}
                    onClick={() => navigate(`/obras/${obra.id}`)}
                    style={{ cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', background: 'var(--bg-info)', padding: '2px 7px', borderRadius: 4 }}>{obra.id}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obra.nome}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{obra.cliente}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{obra.dp}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{obra.dataInicio} → {obra.dataFimPrevista}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${obra.execFinanceiraReal}%`, background: 'var(--brand-primary)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{obra.execFinanceiraReal}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${obra.execFisicaReal}%`, background: 'var(--color-success)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{obra.execFisicaReal}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(obra.valorVenda)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', color: obra.margemPrevista < 10 ? 'var(--color-danger)' : obra.margemPrevista < 15 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      {obra.margemPrevista}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {obra.alertas.length > 0
                        ? <span style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600 }}>⚠ {obra.alertas.length}</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${est.cls}`}>{est.label}</span>
                    </td>
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
