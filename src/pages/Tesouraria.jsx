import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { exportTesourariaCompleto, exportTableToExcel, printTable } from '../utils/exportTesouraria';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  notifFaturaFornRecebida, notifFaturaFornValidadaDP,
  notifPagamentoAutorizadoMS, notifPagamentoEfectuado,
  notifRecebimentoConfirmado, notifCashflowNegativo,
  verificarAlertasTesouraria,
} from '../context/NotificationsContext';
import { FORNECEDORES_DATA } from './Fornecedores';
import { CLIENTES_DATA } from './Clientes';
import { canEditModule } from '../context/PermissionsConfig';
import { withDemoSeed } from '../utils/deliveryMode';

const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── CARREGAR DADOS DO LOCALSTORAGE ───────────────────────────────────────────

function loadPagamentos() {
  try {
    const raw = JSON.parse(localStorage.getItem('sis_faturas_forn') || '{}');
    const extras = JSON.parse(localStorage.getItem('sis_fornecedores_extra') || '[]');
    const todosForn = [...FORNECEDORES_DATA, ...extras];
    const result = [];
    todosForn.forEach(forn => {
      const faturas = raw[forn.id] ?? forn.faturas ?? [];
      faturas.forEach(fat => {
        result.push({
          id:           fat.id,
          fornecedor:   forn.nome,
          obra:         fat.obra,
          categoria:    forn.categoria,
          nFatura:      fat.nFatura || fat.id,
          valor:        fat.valor,
          dataFatura:   fat.data,
          dataVenc:     fat.venc || '—',
          prevPagamento: (() => {
            const dp = fat.dataPrevisaoPagamento;
            // If already set, convert to ISO for date input
            if (dp) {
              if (dp.includes('/')) { const [d,m,y] = dp.split('/'); return y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : dp; }
              return dp;
            }
            // Auto-calculate from condPag + data
            try {
              const cond = fat.condPag || '';
              if (cond === 'acordado') {
                // use vencimento
                const v = fat.venc || '';
                if (v && v.includes('/')) { const [d,m,y] = v.split('/'); return y&&m&&d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : ''; }
                return v || '';
              }
              const dias = parseInt(cond);
              if (dias && fat.data) {
                const base = fat.data.includes('/')
                  ? new Date(fat.data.split('/').reverse().join('-'))
                  : new Date(fat.data);
                if (!isNaN(base)) { base.setDate(base.getDate() + dias); return base.toISOString().split('T')[0]; }
              }
            } catch {}
            return fat.venc ? (fat.venc.includes('/') ? (() => { const [d,m,y] = fat.venc.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; })() : fat.venc) : '';
          })(),
          estadoPag:    fat.estado === 'concluido' ? 'pago' : fat.estado,
          // fluxoVal derived from estado — single source of truth
          fluxoVal:     fat.estado === 'pago' || fat.estado === 'concluido' ? 'autorizado'
                        : fat.estado === 'autorizado'  ? 'autorizado'
                        : fat.estado === 'pending-ms'  ? 'pendente_ms'
                        : fat.estado === 'standby-lg'  ? 'pendente_lg'
                        : fat.estado === 'pending-lg'  ? 'pendente_lg'
                        : 'pendente_dp',
          confirmado:   fat.estado === 'pago' || fat.estado === 'concluido' || fat.confirmado || false,
          dataConfirmacao: fat.dataPagamento || fat.dataConfirmacao || null,
          comprovativoPagamento: fat.comprovativoPagamento || null,
          fornId:       forn.id,
          observacaoMS: fat.observacaoMS || '',
          dataValidacaoDP: fat.dataValidacaoDP || null,
          dataAprovacaoLG: fat.dataAprovacaoLG || null,
          dataAutorizacaoMS: fat.dataAutorizacaoMS || null,
          dataPrevisaoPagamento: fat.dataPrevisaoPagamento || null,
          condPag:      fat.condPag || '—',
          validDP:      fat.validDP || 'Pendente',
          banco:        fat.banco || '—',
          comprovativo: fat.comprovativoPagamento?.name || null,
          obsMD:        fat.observacaoMS || '',
        });
      });
    });
    return result.length > 0 ? result : PAGAMENTOS_DEFAULT;
  } catch { return PAGAMENTOS_DEFAULT; }
}

// Persiste alterações de uma fatura de fornecedor no localStorage e actualiza estado local
function saveFaturaForn(fornId, faturaId, campos) {
  try {
    const all = JSON.parse(localStorage.getItem('sis_faturas_forn') || '{}');
    if (!all[fornId]) all[fornId] = [];
    all[fornId] = all[fornId].map(f => f.id === faturaId ? { ...f, ...campos } : f);
    const json = JSON.stringify(all);
    localStorage.setItem('sis_faturas_forn', json);
    // Dispatch storage event so Fornecedores page updates in real time (same tab)
    window.dispatchEvent(new StorageEvent('storage', { key: 'sis_faturas_forn', newValue: json }));
  } catch {}
}

function saveFaturaCli(cliId, faturaId, campos) {
  try {
    const all = JSON.parse(localStorage.getItem('sis_faturas_cli') || '{}');
    if (!all[cliId]) all[cliId] = [];
    all[cliId] = all[cliId].map(f => f.id === faturaId ? { ...f, ...campos } : f);
    const json = JSON.stringify(all);
    localStorage.setItem('sis_faturas_cli', json);
    window.dispatchEvent(new StorageEvent('storage', { key: 'sis_faturas_cli', newValue: json }));
  } catch {}
}

function loadRecebimentos() {
  try {
    const raw = JSON.parse(localStorage.getItem('sis_faturas_cli') || '{}');
    const extras = JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]');
    const todosCli = [...CLIENTES_DATA, ...extras];
    const result = [];
    todosCli.forEach(cli => {
      const faturas = raw[cli.id] ?? cli.faturas ?? [];
      faturas.forEach(fat => {
        result.push({
          id:              fat.id,
          cliente:         cli.nome,
          clienteId:       cli.id,
          obra:            fat.obra,
          nFatura:         fat.id,
          valor:           fat.valor,
          dataEmissao:     fat.data,
          condPag:         fat.condPag || '—',
          prevRecebimento: fat.venc || '—',
          dataRecebimento: fat.dataPagamento || null,
          estadoRec:       fat.concluido ? 'recebido' : fat.estado === 'recebido' ? 'recebido' : fat.estado === 'parcial' ? 'parcial' : fat.estado === 'vencida' ? 'vencida' : 'pendente',
          fluxoVal:        fat.fluxoVal || fat.estado || 'pendente_req',
          requerente:      fat.requerente || null,
          confirmado:      fat.confirmado || fat.estado === 'recebido' || false,
          dataConfirmacao: fat.dataConfirmacao || fat.dataPagamento || null,
          validLG:         fat.confirmedByLG || fat.aprovadoPorLG ? 'Validada' : 'Pendente',
          validReq:        fat.aprovadoPorReq || fat.aprovadoPor ? 'Validada' : 'Pendente',
          comprovativo:    fat.comprovativoPagamento?.name || null,
        });
      });
    });
    return result.length > 0 ? result : RECEBIMENTOS_DEFAULT;
  } catch { return RECEBIMENTOS_DEFAULT; }
}

// ─── DADOS DEFAULT (fallback se localStorage vazio) ───────────────────────────

const PAGAMENTOS_DEFAULT = withDemoSeed([
  {
    id: 'p001', fluxoVal: 'pendente_ms', confirmado: false, fornecedor: 'Metalúrgica SA', obra: 'O142', categoria: 'Estruturas metálicas',
    nFatura: 'F-2024-0891', valor: 12400, dataFatura: '10 Mar', dataVenc: '18 Mar',
    prevPagamento: '18 Mar', estadoPag: 'pending-ms', validDP: 'Validada', banco: 'CGD',
    comprovativo: null, obsMD: '',
  },
  {
    id: 'p002', fluxoVal: 'autorizado', confirmado: false, fornecedor: 'Elétrica Norte Lda', obra: 'O143', categoria: 'Instalações elétricas',
    nFatura: 'F-2024-0892', valor: 8750, dataFatura: '08 Mar', dataVenc: '20 Mar',
    prevPagamento: '20 Mar', estadoPag: 'autorizado', validDP: 'Validada', banco: 'BPI',
    comprovativo: null, obsMD: 'Autorizado. Pagar até 20 Mar.',
  },
  {
    id: 'p003', fluxoVal: 'pendente_dp', confirmado: false, fornecedor: 'Construções RJ', obra: 'O138', categoria: 'Subempreitada geral',
    nFatura: 'F-2024-0888', valor: 31200, dataFatura: '05 Mar', dataVenc: '22 Mar',
    prevPagamento: '22 Mar', estadoPag: 'pending-dp', validDP: 'Atrasada', banco: 'CGD',
    comprovativo: null, obsMD: '',
  },
  {
    id: 'p004', fluxoVal: 'pendente_ms', confirmado: false, fornecedor: 'IsolTec Unipessoal', obra: 'O142', categoria: 'Impermeabilização',
    nFatura: 'F-2024-0895', valor: 5200, dataFatura: '12 Mar', dataVenc: '25 Mar',
    prevPagamento: '25 Mar', estadoPag: 'pending-ms', validDP: 'Validada', banco: 'BPI',
    comprovativo: null, obsMD: '',
  },
  {
    id: 'p005', fluxoVal: 'autorizado', confirmado: false, fornecedor: 'Betões Lisboa SA', obra: 'O145', categoria: 'Betão e prefabricados',
    nFatura: 'F-2024-0860', valor: 48200, dataFatura: '28 Fev', dataVenc: '28 Mar',
    prevPagamento: '28 Mar', estadoPag: 'pago', validDP: 'Validada', banco: 'CGD',
    comprovativo: 'comp_p005.pdf', obsMD: '',
  },
  {
    id: 'p006', fluxoVal: 'autorizado', confirmado: false, fornecedor: 'AVAC Systems', obra: 'O143', categoria: 'AVAC',
    nFatura: 'F-2024-0830', valor: 18500, dataFatura: '20 Fev', dataVenc: '20 Mar',
    prevPagamento: '20 Mar', estadoPag: 'pago', validDP: 'Validada', banco: 'BPI',
    comprovativo: 'comp_p006.pdf', obsMD: '',
  },
]);

const RECEBIMENTOS_DEFAULT = withDemoSeed([
  {
    id: 'r001', fluxoVal: 'pendente_req', confirmado: false, cliente: 'Logicor Portugal SA', obra: 'O142', nFatura: 'FT-2026-0045',
    valor: 280000, dataEmissao: '02 Jan', condPag: '30 dias', prevRecebimento: '01 Fev',
    dataRecebimento: null, estadoRec: 'vencida', validLG: 'Validada', validReq: 'Validada',
    comprovativo: null,
  },
  {
    id: 'r002', fluxoVal: 'pendente_lg', confirmado: false, cliente: 'Grupo LIDL Portugal', obra: 'O142', nFatura: 'FT-2026-0058',
    valor: 132000, dataEmissao: '10 Jan', condPag: '30 dias', prevRecebimento: '10 Fev',
    dataRecebimento: null, estadoRec: 'parcial', validLG: 'Validada', validReq: 'Validada',
    comprovativo: null,
  },
  {
    id: 'r003', fluxoVal: 'pendente_ms', confirmado: false, cliente: 'Câmara Municipal Setúbal', obra: 'O143', nFatura: 'FT-2026-0061',
    valor: 67500, dataEmissao: '15 Jan', condPag: '45 dias', prevRecebimento: '28 Fev',
    dataRecebimento: null, estadoRec: 'pendente', validLG: 'Validada', validReq: 'Validada',
    comprovativo: null,
  },
  {
    id: 'r004', fluxoVal: 'autorizado', confirmado: false, cliente: 'Construtora LD Lda', obra: 'O145', nFatura: 'FT-2026-0072',
    valor: 94000, dataEmissao: '01 Fev', condPag: '30 dias', prevRecebimento: '03 Mar',
    dataRecebimento: '28 Fev', estadoRec: 'recebido', validLG: 'Validada', validReq: 'Validada',
    comprovativo: 'rec_r004.pdf',
  },
  {
    id: 'r005', fluxoVal: 'pendente_req', confirmado: false, cliente: 'Promotor ABC Lda', obra: 'O138', nFatura: 'FT-2026-0081',
    valor: 210000, dataEmissao: '15 Fev', condPag: '30 dias', prevRecebimento: '17 Mar',
    dataRecebimento: null, estadoRec: 'pendente', validLG: 'Pendente', validReq: 'Pendente',
    comprovativo: null,
  },
]);

// Quinzenas para o cashflow
const QUINZENAS = withDemoSeed([
  { label: '1–15 Fev', recebimentos: 0,      pagamentos: 88000,  saldo: -88000 },
  { label: '16–28 Fev', recebimentos: 94000, pagamentos: 46700,  saldo: 47300  },
  { label: '1–15 Mar', recebimentos: 132000, pagamentos: 57350,  saldo: 74650  },
  { label: '16–31 Mar', recebimentos: 67500, pagamentos: 104900, saldo: -37400 },
  { label: '1–15 Abr', recebimentos: 280000, pagamentos: 48200,  saldo: 231800 },
  { label: '16–30 Abr', recebimentos: 0,     pagamentos: 18500,  saldo: -18500 },
]);

function getPerfisLista() {
  try {
    const saved = JSON.parse(localStorage.getItem('sis_perfis') || '[]');
    if (saved.length > 0) return saved;
  } catch {}
  return [
    { id: 'ms', nome: 'Miguel Seabra', email: 'ms@novanor.pt', role: 'Direção' },
    { id: 'lg', nome: 'Leonor Gomes',  email: 'lg@novanor.pt', role: 'Diretora Financeira' },
    { id: 'dp', nome: 'Dir. Produção', email: 'dp@novanor.pt', role: 'Diretor de Produção' },
  ];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = v => (v < 0 ? '−' : '') + '€\u00a0' + Math.abs(v).toLocaleString('pt-PT');

const CATS_FORN = ['Todas','Estruturas metálicas','Instalações elétricas','Subempreitada geral','AVAC e climatização','Betão e prefabricados','Isolamentos e impermeabilização','Serralharia','Carpintaria','Pintura','Outro'];

const PAG_EST = {
  'pago':       { label: 'Pago',       cls: 'badge-s' },
  'autorizado': { label: 'Autorizado', cls: 'badge-s' },
  'pending-ms': { label: 'Aguarda MS', cls: 'badge-w' },
  'pending-dp': { label: 'Aguarda DP', cls: 'badge-i' },
  'vencida':    { label: 'Vencida',    cls: 'badge-d' },
};
const REC_EST = {
  'recebido': { label: 'Recebido',      cls: 'badge-s' },
  'parcial':  { label: 'Parcial',       cls: 'badge-w' },
  'pendente': { label: 'Pendente',      cls: 'badge-i' },
  'vencida':  { label: 'Vencida',       cls: 'badge-d' },
};
const VAL_CLS = { 'Validada': 'badge-s', 'Pendente': 'badge-w', 'Atrasada': 'badge-d' };

// ─── DROPDOWN DE AÇÕES ────────────────────────────────────────────────────────
function AcoesPagamento({ p, onChange, onObs }) {
  const [open, setOpen] = useState(false);
  const [acima, setAcima] = useState(false);
  const [pos, setPos] = useState({ top: 0, bottom: 0, right: 0 });
  const btnRef = useRef(null);

  const OPCOES = [
    { label: 'Marcar: Aguarda DP',  estado: 'pending-dp', icon: '○' },
    { label: 'Marcar: Aguarda MS',  estado: 'pending-ms', icon: '○' },
    { label: 'Marcar: Autorizado',  estado: 'autorizado', icon: '✓' },
    { label: 'Marcar: Pago',        estado: 'pago',       icon: '✓' },
  ];

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - rect.bottom;
      setAcima(espacoAbaixo < 200);
      setPos({ top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
      {p.estadoPag === 'pending-dp' && (
        <button className="btn btn-sm" onClick={() => onChange(p.id, 'pending-ms')}>Validar DP</button>
      )}
      {p.estadoPag === 'pending-ms' && (
        <button className="btn btn-sm btn-primary" onClick={() => onChange(p.id, 'autorizado')}>Autorizar</button>
      )}
      {p.estadoPag === 'autorizado' && (
        <button className="btn btn-sm" style={{ background: 'var(--color-success)', color: '#fff', border: 'none' }} onClick={() => onChange(p.id, 'pago')}>Pagar</button>
      )}
      {p.estadoPag === 'pago' && (
        <button className="btn btn-sm">Comprovativo</button>
      )}

      {/* Botão ⋯ */}
      <div style={{ position: 'relative' }}>
        <button
          ref={btnRef}
          className="btn btn-sm"
          onClick={handleOpen}
          style={{ padding: '4px 8px', minWidth: 28 }}
          title="Mais opções"
        >⋯</button>

        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
            <div style={{
              position: 'fixed', right: pos.right, zIndex: 9999,
              ...(acima ? { bottom: pos.bottom } : { top: pos.top }),
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid var(--border)' }}>
                Alterar estado
              </div>
              {OPCOES.map(op => (
                <button
                  key={op.estado}
                  onClick={() => { onChange(p.id, op.estado); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    background: p.estadoPag === op.estado ? 'var(--bg-app)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    color: p.estadoPag === op.estado ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{op.icon}</span>
                  {op.label}
                  {p.estadoPag === op.estado && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--brand-primary)' }}>actual</span>}
                </button>
              ))}
              <div style={{ borderTop: '0.5px solid var(--border)' }}>
                <button
                  onClick={() => { onObs(); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: 10, opacity: 0.5 }}>✏</span>
                  Observações MS
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AcoesRecebimento({ r, onChange }) {
  const [open, setOpen] = useState(false);
  const [acima, setAcima] = useState(false);
  const [pos, setPos] = useState({ top: 0, bottom: 0, right: 0 });
  const btnRef = useRef(null);

  const OPCOES = [
    { label: 'Marcar: Pendente',  estado: 'pendente', icon: '○' },
    { label: 'Marcar: Parcial',   estado: 'parcial',  icon: '◐' },
    { label: 'Marcar: Recebido',  estado: 'recebido', icon: '✓' },
    { label: 'Marcar: Vencida',   estado: 'vencida',  icon: '!' },
  ];

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - rect.bottom;
      setAcima(espacoAbaixo < 200);
      setPos({ top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
      {(r.estadoRec === 'pendente' || r.estadoRec === 'vencida') && (
        <button className="btn btn-sm btn-primary" onClick={() => onChange(r.id, 'recebido')}>Confirmar</button>
      )}
      {r.estadoRec === 'parcial' && (
        <button className="btn btn-sm" style={{ background: 'var(--color-warning)', color: '#fff', border: 'none' }} onClick={() => onChange(r.id, 'recebido')}>Completar</button>
      )}
      {r.estadoRec === 'recebido' && (
        <button className="btn btn-sm">Comprovativo</button>
      )}

      <div style={{ position: 'relative' }}>
        <button ref={btnRef} className="btn btn-sm" onClick={handleOpen} style={{ padding: '4px 8px', minWidth: 28 }} title="Mais opções">⋯</button>

        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
            <div style={{
              position: 'fixed', right: pos.right, zIndex: 9999,
              ...(acima ? { bottom: pos.bottom } : { top: pos.top }),
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid var(--border)' }}>
                Alterar estado
              </div>
              {OPCOES.map(op => (
                <button
                  key={op.estado}
                  onClick={() => { onChange(r.id, op.estado); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    background: r.estadoRec === op.estado ? 'var(--bg-app)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    color: r.estadoRec === op.estado ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{op.icon}</span>
                  {op.label}
                  {r.estadoRec === op.estado && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--brand-primary)' }}>actual</span>}
                </button>
              ))}
              <div style={{ borderTop: '0.5px solid var(--border)' }}>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                }}>
                  <span style={{ fontSize: 14 }}>📎</span> Comprovativo
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MINI BAR CHART (puro CSS) ────────────────────────────────────────────────
function CashflowChart({ quinzenas }) {
  const max = Math.max(...quinzenas.map(q => Math.max(q.recebimentos, q.pagamentos)));

  return (
    <div style={{ marginTop: 8 }}>
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        {[
          { cor: 'var(--color-success)', label: 'Recebimentos' },
          { cor: 'var(--color-danger)',  label: 'Pagamentos'   },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.cor }} />
            <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Barras */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140 }}>
        {quinzenas.map((q, i) => {
          const hRec = max > 0 ? (q.recebimentos / max) * 120 : 0;
          const hPag = max > 0 ? (q.pagamentos   / max) * 120 : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120 }}>
                <div style={{ width: 12, height: hRec, background: 'var(--color-success)', borderRadius: '3px 3px 0 0', opacity: 0.85, minHeight: hRec > 0 ? 2 : 0 }} />
                <div style={{ width: 12, height: hPag, background: 'var(--color-danger)',  borderRadius: '3px 3px 0 0', opacity: 0.75, minHeight: hPag > 0 ? 2 : 0 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{q.label}</div>
              <div style={{
                fontSize: 10, fontWeight: 600,
                color: q.saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {q.saldo >= 0 ? '+' : ''}{(q.saldo / 1000).toFixed(0)}k
              </div>
            </div>
          );
        })}
      </div>

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        {[
          { label: 'Total recebimentos', value: fmt(quinzenas.reduce((s, q) => s + q.recebimentos, 0)), color: 'var(--color-success)' },
          { label: 'Total pagamentos',   value: fmt(quinzenas.reduce((s, q) => s + q.pagamentos,   0)), color: 'var(--color-danger)'  },
          { label: 'Saldo líquido 30d',  value: fmt(quinzenas.reduce((s, q) => s + q.saldo,        0)), color: 'var(--brand-primary)' },
        ].map(t => (
          <div key={t.label} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.color }}>{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE FLUXO DE VALIDAÇÃO ───────────────────────────────────────────
// Regras de permissão por estado:
//   Forn: pendente_dp → só DP | pendente_lg → só LG | pendente_ms/autorizado → só MS
//   Cli:  pendente_req → REQ (qualquer não-LG-MS-DP) | pendente_lg → LG | pendente_ms/autorizado → MS
// MS pode sempre escolher para onde recua (LG ou Req/DP)
function FluxoValidacao({ estadoAtual, onAvancar, tipo, pago, user, requerente }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const STEPS_FORN = [
    { key: 'pendente_dp',  label: 'Aguarda DP',  actor: 'DP',  cor: 'badge-i' },
    { key: 'pendente_lg',  label: 'Aguarda LG',  actor: 'LG',  cor: 'badge-w' },
    { key: 'pendente_ms',  label: 'Aguarda MS',  actor: 'MS',  cor: 'badge-w' },
    { key: 'autorizado',   label: 'Autorizado',  actor: 'MS',  cor: 'badge-s' },
  ];
  const STEPS_CLI = [
    { key: 'pendente_req', label: requerente ? `Aguarda ${requerente}` : 'Aguarda Req.', actor: 'REQ', cor: 'badge-i' },
    { key: 'pendente_lg',  label: 'Aguarda LG',        actor: 'LG',  cor: 'badge-w' },
    { key: 'emitida',      label: 'Emitida',            actor: 'LG',  cor: 'badge-i' },
    { key: 'recebido',     label: 'Recebido',           actor: 'LG',  cor: 'badge-s' },
  ];
  const steps = tipo === 'forn' ? STEPS_FORN : STEPS_CLI;
  const idx = steps.findIndex(s => s.key === estadoAtual);
  const step = steps[idx] || steps[0];
  const isLast = idx === steps.length - 1;

  // Match by initials (MS, LG, DP, CA) or by name for requerente
  const initials = (user?.initials || '').toUpperCase();
  const nome = user?.nome || '';
  const isMS  = initials === 'MS';
  const isLG  = initials === 'LG';
  const isDP  = initials === 'DP' || initials.startsWith('DP');
  // For REQ: user is the requerente if their name/initials matches fatura requerente
  const reqLabel_match = requerente && (initials === requerente || nome === requerente);
  const isREQ = reqLabel_match || (!isMS && !isLG && !isDP && !!initials);

  const podeAvancar = (() => {
    if (!initials) return false;
    if (isMS) return !isLast;
    switch (step.actor) {
      case 'DP':  return isDP && !isLast;
      case 'LG':  return isLG && !isLast;
      case 'MS':  return false; // only MS
      case 'REQ': return isREQ && !isLast;
      default: return false;
    }
  })();

  const podeVerMenu = isMS || podeAvancar;

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setMenuOpen(o => !o);
  };

  if (pago) {
    return <span className="badge badge-s" style={{ fontSize: 11 }}>✓ Concluído</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      <span className={`badge ${step.cor}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{step.label}</span>

      {podeAvancar && (
        <button onClick={() => onAvancar(steps[idx + 1].key)} className="btn btn-sm"
          style={{ fontSize: 10, padding: '2px 7px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 5 }}
          title={`Avançar para ${steps[idx + 1].label}`}>✓</button>
      )}

      {podeVerMenu && (
        <button ref={btnRef} className="btn btn-sm" onClick={handleOpen}
          style={{ fontSize: 10, padding: '2px 6px', minWidth: 22 }} title="Opções">⋯</button>
      )}

      {!podeAvancar && !isMS && initials && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.45 }} title="Aguarda acção de outro utilizador">🔒</span>
      )}

      {menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setMenuOpen(false)} />
          <div style={{ position: 'fixed', right: pos.right, top: pos.top, zIndex: 9999, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 220, overflow: 'hidden' }}>
            <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid var(--border)' }}>
              {isMS ? 'Alterar estado (MS)' : 'Avançar para'}
            </div>
            {steps.map((s, si) => {
              const visivel = isMS ? true : si >= idx;
              if (!visivel) return null;
              const bloqueado = !isMS && si < idx;
              return (
                <button key={s.key} onClick={() => { if (!bloqueado) { onAvancar(s.key); setMenuOpen(false); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer', background: s.key === estadoAtual ? 'var(--bg-app)' : 'transparent', color: bloqueado ? 'var(--text-muted)' : s.key === estadoAtual ? 'var(--brand-primary)' : 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 12, opacity: bloqueado ? 0.4 : 1 }}>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{si < idx ? '↩' : si === idx ? '●' : '→'}</span>
                  <span>{s.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>({s.actor})</span>
                  {s.key === estadoAtual && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--brand-primary)' }}>actual</span>}
                </button>
              );
            })}
            {isMS && idx > 0 && (
              <div style={{ borderTop: '0.5px solid var(--border)', padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)' }}>
                Como MS pode devolver para qualquer etapa
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
// ─── FLUXO VALIDAÇÃO FORNECEDORES (sincronizado com Fornecedores.jsx) ────────
// Usa os mesmos estados que a página de Fornecedores: pending-dp, pending-lg, pending-ms, autorizado, pago
function FluxoValidacaoForn({ p, user, addNotif, onUpdate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [obsInput, setObsInput] = useState('');
  const [showObs, setShowObs] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const initials = (user?.initials || '').toUpperCase();
  const isMS  = initials === 'MS';
  const isLG  = initials === 'LG' || user?.role?.toLowerCase().includes('financeira');
  const isDP  = initials === 'DP' || user?.acoes?.includes('validar_fatura_forn');
  const isCA  = initials === 'CA';

  const estado = p.estadoPag || p.estado || 'pending-dp';

  const STEPS = [
    { key:'pending-dp', label:'Aguarda DP',  cor:'badge-i', canAct: isDP || isMS },
    { key:'pending-lg', label:'Aguarda LG',  cor:'badge-w', canAct: isLG || isMS },
    { key:'pending-ms', label:'Aguarda MS',  cor:'badge-w', canAct: isMS },
    { key:'autorizado', label:'Autorizado',  cor:'badge-s', canAct: isMS },
  ];
  const idx = STEPS.findIndex(s => s.key === estado);
  const step = STEPS[Math.max(0, idx)];
  const isLast = idx === STEPS.length - 1;
  const pago = estado === 'pago' || estado === 'concluido' || p.confirmado;

  const avancar = (novoEstado) => {
    let campos = { estado: novoEstado };
    let notifDest = null, notifTitulo = '';
    const data = new Date().toLocaleDateString('pt-PT');

    if (novoEstado === 'pending-lg') {
      campos = { ...campos, validDP:'Validada', dataValidacaoDP: data };
      notifDest = 'lg';
      notifTitulo = `Fatura validada — aguarda aprovação LG`;
    } else if (novoEstado === 'pending-ms') {
      campos = { ...campos, aprovadoLG: true, dataAprovacaoLG: data };
      notifDest = 'ms';
      notifTitulo = `Fatura aprovada pela LG — aguarda autorização MS`;
    } else if (novoEstado === 'autorizado') {
      campos = { ...campos, autorizadoMS: true, dataAutorizacaoMS: data };
      notifDest = 'lg';
      notifTitulo = `Pagamento autorizado — podes efectuar o pagamento`;
    } else if (novoEstado === 'pending-dp') {
      campos = { ...campos, validDP:'Pendente', aprovadoLG: false, autorizadoMS: false };
      notifDest = 'dp';
      notifTitulo = `Fatura devolvida ao DP para revalidação`;
    }

    onUpdate(campos);
    if (notifDest) {
      addNotif({ tipo:'confirmar_emissao', icon:'📋', titulo:notifTitulo,
        sub:`${p.fornecedor} · ${p.nFatura}`, path:'/fornecedores',
        destinatario: notifDest, meta:{faturaId:p.id, fornecedorNome:p.fornecedor} });
    }
    setMenuOpen(false);
  };

  const enviarObs = () => {
    if (!obsInput.trim()) return;
    onUpdate({ observacaoMS: obsInput.trim(), dataObservacaoMS: new Date().toLocaleDateString('pt-PT') });
    addNotif({ tipo:'info', icon:'💬', titulo:`Observação MS — ${p.fornecedor}`, sub:obsInput.slice(0,60), path:'/fornecedores', destinatario:'lg', meta:{faturaId:p.id} });
    setObsInput(''); setShowObs(false);
  };

  if (pago) return <span className="badge badge-s" style={{ fontSize:11 }}>✓ Pago</span>;

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 200;
      setPos({ top: openUp ? null : r.bottom + 4, bottom: openUp ? window.innerHeight - r.top + 4 : null, right: window.innerWidth - r.right });
    }
    setMenuOpen(o=>!o);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <span className={`badge ${step.cor}`} style={{ fontSize:11, whiteSpace:'nowrap' }}>{step.label}</span>

        {/* Avançar — só quem tem permissão */}
        {!isLast && step.canAct && (
          <button onClick={() => avancar(STEPS[idx+1].key)} className="btn btn-sm"
            style={{ fontSize:10, padding:'2px 7px', background:'var(--color-success)', color:'#fff', border:'none', borderRadius:5 }}
            title={`Avançar para ${STEPS[idx+1].label}`}>✓</button>
        )}

        {/* Menu ⋯ */}
        {(isMS || step.canAct) && (
          <button ref={btnRef} className="btn btn-sm" onClick={handleOpen}
            style={{ fontSize:10, padding:'2px 6px', minWidth:22 }} title="Opções">⋯</button>
        )}

        {!step.canAct && !isMS && (
          <span style={{ fontSize:10, color:'var(--text-muted)', opacity:0.4 }} title="Sem permissão">🔒</span>
        )}
      </div>

      {/* Obs MS inline */}
      {isMS && showObs && (
        <div style={{ display:'flex', gap:4 }}>
          <input value={obsInput} onChange={e=>setObsInput(e.target.value)} placeholder="Observação…"
            style={{ flex:1, fontSize:11, fontFamily:'var(--font-body)', padding:'3px 6px', border:'1px solid var(--border)', borderRadius:4, outline:'none', background:'var(--bg-card)' }}
            onKeyDown={e=>{if(e.key==='Enter')enviarObs();if(e.key==='Escape')setShowObs(false);}} />
          <button className="btn btn-sm" onClick={enviarObs} style={{ fontSize:11 }}>✓</button>
          <button className="btn btn-sm" onClick={()=>setShowObs(false)} style={{ fontSize:11 }}>✕</button>
        </div>
      )}

      {/* Obs existente */}
      {p.observacaoMS && (
        <div style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={p.observacaoMS}>
          💬 {p.observacaoMS}
        </div>
      )}

      {menuOpen && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:100 }} onClick={()=>setMenuOpen(false)} />
          <div style={{ position:'fixed', right:pos.right, top:pos.top ?? undefined, bottom:pos.bottom ?? undefined, zIndex:9999, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', minWidth:220, overflow:'hidden' }}>
            <div style={{ padding:'6px 12px', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'0.5px solid var(--border)' }}>
              {isMS ? 'MS — Alterar estado' : 'Avançar para'}
            </div>
            {STEPS.map((s, si) => {
              if (!isMS && si < idx) return null;
              return (
                <button key={s.key} onClick={() => avancar(s.key)}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'8px 12px', border:'none', cursor:'pointer', background:s.key===estado?'var(--bg-app)':'transparent', color:s.key===estado?'var(--brand-primary)':'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:12 }}>
                  <span style={{ fontSize:10, opacity:0.4 }}>{si<idx?'↩':si===idx?'●':'→'}</span>
                  {s.label}
                  {s.key===estado && <span style={{ marginLeft:'auto', fontSize:10, color:'var(--brand-primary)' }}>actual</span>}
                </button>
              );
            })}
            {isMS && (
              <div style={{ borderTop:'0.5px solid var(--border)' }}>
                <button onClick={()=>{setShowObs(true);setMenuOpen(false);}}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'8px 12px', border:'none', cursor:'pointer', background:'transparent', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:12 }}>
                  <span style={{ fontSize:12 }}>💬</span> Adicionar observação
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── COMPONENTE CONFIRMAR PAGAMENTO/RECEBIMENTO ───────────────────────────────
function ConfirmarLiquidacao({ id, tipo, estadoFluxo, confirmado, dataConfirmacao, comprovativo, onConfirmar, userId, user }) {
  const [dataPag, setDataPag] = useState(new Date().toISOString().split('T')[0]);
  const [aberto, setAberto] = useState(false);
  // Só LG e MS podem confirmar recebimentos/pagamentos
  const _ini = (user?.initials || userId || '').toUpperCase();
  const podeFazer = _ini === 'LG' || _ini === 'CA' || _ini === 'MS' || userId === 'lg' || userId === 'ca';

  // For clients: ready when emitida (confirmedByLG) or autorizado
  // For suppliers: ready when autorizado
  const pronto = tipo === 'cli'
    ? (estadoFluxo === 'autorizado' || estadoFluxo === 'emitida' || estadoFluxo === 'pendente_lg' || estadoFluxo === 'recebido')
    : estadoFluxo === 'autorizado';

  if (!pronto && !confirmado) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 11, opacity: 0.4 }}>— {tipo === 'cli' ? 'Aguarda emissão' : 'Aguarda autorização'}</span>;
  }
  if (confirmado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="badge badge-s" style={{ fontSize: 11 }}>✓ {tipo === 'forn' ? 'Pago' : 'Recebido'}</span>
        {dataConfirmacao && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dataConfirmacao}</span>}
        {comprovativo && <span style={{ fontSize: 10, color: 'var(--brand-primary)' }}>📎 {String(comprovativo).slice(0,14)}</span>}
      </div>
    );
  }
  if (!podeFazer) {
    return <span className="badge badge-w" style={{ fontSize: 11 }}>Aguarda LG/CA</span>;
  }

  if (!aberto) {
    return (
      <button className="btn btn-sm" style={{ fontSize: 11, background: 'var(--color-success)', color: '#fff', border: 'none' }}
        onClick={() => setAberto(true)}>
        {tipo === 'forn' ? '+ Registar pagamento' : '+ Confirmar recebimento'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
      <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
        style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 6px', border: '0.5px solid var(--border-strong)', borderRadius: 5, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', width: '100%' }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <label style={{ flex: 1, cursor: 'pointer' }}>
          <input type="file" accept=".pdf,.jpg,.png" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              const d = dataPag ? new Date(dataPag).toLocaleDateString('pt-PT') : new Date().toLocaleDateString('pt-PT');
              onConfirmar({ data: d, comprovativo: f?.name || null });
              setAberto(false);
            }}
          />
          <span className="btn btn-sm" style={{ fontSize: 10, display: 'block', textAlign: 'center', background: 'var(--color-success)', color: '#fff', border: 'none' }}>📎 PDF</span>
        </label>
        <button className="btn btn-sm" style={{ flex: 1, fontSize: 10 }}
          onClick={() => {
            const d = dataPag ? new Date(dataPag).toLocaleDateString('pt-PT') : new Date().toLocaleDateString('pt-PT');
            onConfirmar({ data: d, comprovativo: null });
            setAberto(false);
          }}>Sem PDF</button>
        <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setAberto(false)}>✕</button>
      </div>
    </div>
  );
}


// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function TesourariaPage() {
  const { user } = useAuth();
  const { addNotif, notifs } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const lista = getPerfisLista();
  const perfilUser = lista.find(p => p.id === user?.id);
  const canEditTesouraria = canEditModule(user, 'tesouraria');
  const hoje = new Date();
  const currentYear = hoje.getFullYear();
  const currentMonth = hoje.getMonth() + 1;
  const currentQuinzena = hoje.getDate() <= 15 ? 1 : 2;
  const currentMonthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
  const currentMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
  const podeEditarDataPrev = user?.isAdmin
    || (user?.initials || '').toUpperCase() === 'MS'
    || (user?.initials || '').toUpperCase() === 'LG'
    || perfilUser?.acoes?.includes('editar_data_previsao_pag')
    || canEditTesouraria;
  const [tab, setTab]         = useState('resumo');
  const [catForn, setCatForn] = useState('Todas');
  const [filtroValidLG, setFiltroValidLG] = useState('Todas');
  const [filtroValidReq, setFiltroValidReq] = useState('Todas');
  const [filtroEstadoRec, setFiltroEstadoRec] = useState('Todos');
  const [filtroValidDP, setFiltroValidDP] = useState('Todas');
  const [filtroEstadoPag, setFiltroEstadoPag] = useState('Todos');
  const [vista, setVista]     = useState('quinzenal');
  const [historicoAtivo, setHistoricoAtivo] = useState(false);
  const [anoAtivo, setAnoAtivo]       = useState(currentYear);
  const [mesAtivo, setMesAtivo]       = useState(currentMonth); // 1-12
  const [quinzenaAtiva, setQuinzenaAtiva] = useState(currentQuinzena); // 1 ou 2
  const [periodoInicio, setPeriodoInicio] = useState(currentMonthStart);
  const [periodoFim, setPeriodoFim] = useState(currentMonthEnd);
  const [pagamentos, setPagamentos]   = useState(loadPagamentos);
  const [recebimentos, setRecebimentos] = useState(loadRecebimentos);
  const [obsModal, setObsModal]       = useState(null);
  // ── Estado de simulação global ───────────────────────────────────────────────
  // pendingChanges: array de { chave, itemKey, mi, q, valorNovo, valorAnterior, itemLabel, grupoLabel, tipo }
  const [pendingChanges, setPendingChanges] = useState([]);
  const [dadosSimulados, setDadosSimulados] = useState(null); // null = sem simulação activa

  useEffect(() => {
    const nextTab = location.state?.tesTab;
    if (!nextTab) return;
    setTab(nextTab);
    window.history.replaceState({}, '');
  }, [location.state]);

  // Aplica uma alteração pendente sem guardar — actualiza dadosSimulados
  const adicionarPendingChange = (change) => {
    const base = dadosSimulados || loadManual();
    const next = JSON.parse(JSON.stringify(base));
    const { chave, itemKey, mi, q, valorNovo } = change;
    if (!next[change.anoSel]) next[change.anoSel] = {};
    if (!next[change.anoSel][chave]) next[change.anoSel][chave] = { grupos: [], valores: {} };
    if (!next[change.anoSel][chave].valores) next[change.anoSel][chave].valores = {};
    if (!next[change.anoSel][chave].valores[itemKey]) next[change.anoSel][chave].valores[itemKey] = Array(12).fill(null).map(() => [0,0]);
    next[change.anoSel][chave].valores[itemKey][mi][q] = valorNovo;
    setDadosSimulados(next);
    setPendingChanges(prev => {
      // Substitui se já existe alteração para o mesmo itemKey/mi/q
      const sem = prev.filter(c => !(c.itemKey === itemKey && c.mi === mi && c.q === q));
      return [...sem, change];
    });
  };

  const validarTodas = () => {
    if (dadosSimulados) saveManual(dadosSimulados);
    setDadosSimulados(null);
    setPendingChanges([]);
  };

  const cancelarTodas = () => {
    setDadosSimulados(null);
    setPendingChanges([]);
  };

  const actualizarPrevRecebimento = (recebimentoId, novaData) => {
    const alvo = recebimentos.find(r => r.id === recebimentoId);
    if (!alvo) return;
    setRecebimentos(prev => prev.map(r => r.id === recebimentoId ? { ...r, prevRecebimento: novaData } : r));
    if (alvo.clienteId) {
      saveFaturaCli(alvo.clienteId, recebimentoId, { venc: novaData });
    }
  };

  const temSimulacao = pendingChanges.length > 0;
  const periodoActivoLabel = !historicoAtivo
    ? (vista === 'anual'
        ? `Horizonte activo · referência ${currentYear}`
        : vista === 'mensal'
          ? `${NOMES_MES[currentMonth-1]} ${currentYear}`
          : `${currentQuinzena === 1 ? '1–15' : '16–fim'} ${NOMES_MES[currentMonth-1]} ${currentYear}`)
    : (vista === 'anual'
        ? `Ano ${anoAtivo}`
        : vista === 'mensal'
          ? `${NOMES_MES[mesAtivo-1]} ${anoAtivo}`
          : `${quinzenaAtiva === 1 ? '1–15' : '16–fim'} ${NOMES_MES[mesAtivo-1]} ${anoAtivo}`);

  useEffect(() => {
    setPagamentos(loadPagamentos());
    setRecebimentos(loadRecebimentos());
  }, [tab]);

  // Sincronização em tempo real com página de Fornecedores/Clientes
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'sis_faturas_forn') setPagamentos(loadPagamentos());
      if (e.key === 'sis_faturas_cli')  setRecebimentos(loadRecebimentos());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []); // eslint-disable-line

  // Motor de alertas automáticos: corre ao montar e quando os dados mudam
  useEffect(() => {
    if (pagamentos.length === 0) return;
    verificarAlertasTesouraria({ pagamentos, addNotif, notifs });
  }, [pagamentos.length]); // eslint-disable-line

  // Alerta cashflow negativo — verifica quinzenas dos próximos 30 dias
  useEffect(() => {
    const quinzenasNegativas = QUINZENAS.filter(q => q.saldo < 0);
    if (quinzenasNegativas.length === 0) return;
    const jaAlertado = notifs.some(n =>
      n.tipo === 'alerta' && n.titulo?.includes('Cashflow negativo') &&
      (Date.now() - new Date(n.timestamp).getTime()) < 24 * 60 * 60 * 1000
    );
    if (jaAlertado) return;
    const pior = quinzenasNegativas.reduce((m, q) => q.saldo < m.saldo ? q : m);
    notifCashflowNegativo({ quinzena: pior.label, valorPrevisto: pior.saldo })
      .forEach(n => addNotif(n));
  }, []); // eslint-disable-line

  const ANOS  = [2025, 2026, 2027];
  const MES_NUM = { 'Jan':1,'Fev':2,'Mar':3,'Abr':4,'Mai':5,'Jun':6,'Jul':7,'Ago':8,'Set':9,'Out':10,'Nov':11,'Dez':12 };
  const temIntervaloCustomizado = periodoInicio !== currentMonthStart || periodoFim !== currentMonthEnd;
  const tabsComIntervalo = ['pagamentos', 'recebimentos', 'financiamentos', 'colaboradores', 'impostos', 'investimentos', 'diversos'];
  const usaFiltroIntervalo = tabsComIntervalo.includes(tab);

  const parseDataCompleta = (str, fallbackYear = currentYear) => {
    if (!str || str === '—') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(`${str}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const slashFull = str.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (slashFull) {
      const d = new Date(Number(slashFull[3]), Number(slashFull[2]) - 1, Number(slashFull[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const mesDia = str.match(/(\d{1,2})\s+([A-Za-zç]{3})/);
    if (mesDia) {
      const d = new Date(fallbackYear, (MES_NUM[mesDia[2]] || 1) - 1, Number(mesDia[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const slash = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (slash) {
      const d = new Date(fallbackYear, Number(slash[2]) - 1, Number(slash[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const formatDateRangeLabel = (inicio, fim) => {
    const from = parseDataCompleta(inicio);
    const to = parseDataCompleta(fim);
    if (!from || !to) return 'Período seleccionado';
    const sameYear = from.getFullYear() === to.getFullYear();
    const sameMonth = sameYear && from.getMonth() === to.getMonth();
    if (sameMonth) return `${from.getDate()}–${to.getDate()} ${NOMES_MES[from.getMonth()]} ${from.getFullYear()}`;
    if (sameYear) return `${from.getDate()} ${NOMES_MES[from.getMonth()]} — ${to.getDate()} ${NOMES_MES[to.getMonth()]} ${to.getFullYear()}`;
    return `${from.getDate()} ${NOMES_MES[from.getMonth()]} ${from.getFullYear()} — ${to.getDate()} ${NOMES_MES[to.getMonth()]} ${to.getFullYear()}`;
  };

  const ajustarPeriodoPorVista = (direction) => {
    const step = direction >= 0 ? 1 : -1;
    if (vista === 'anual') {
      const base = parseDataCompleta(periodoInicio) || new Date(currentYear, 0, 1);
      const nextYear = base.getFullYear() + step;
      setPeriodoInicio(`${nextYear}-01-01`);
      setPeriodoFim(`${nextYear}-12-31`);
      return;
    }
    if (vista === 'mensal') {
      const base = parseDataCompleta(periodoInicio) || new Date(currentYear, currentMonth - 1, 1);
      const next = new Date(base.getFullYear(), base.getMonth() + step, 1);
      setPeriodoInicio(new Date(next.getFullYear(), next.getMonth(), 1).toISOString().split('T')[0]);
      setPeriodoFim(new Date(next.getFullYear(), next.getMonth() + 1, 0).toISOString().split('T')[0]);
      return;
    }
    const base = parseDataCompleta(periodoInicio) || new Date(currentYear, currentMonth - 1, currentQuinzena === 1 ? 1 : 16);
    let month = base.getMonth();
    let year = base.getFullYear();
    const firstHalf = base.getDate() <= 15;
    if (step > 0) {
      if (firstHalf) {
        setPeriodoInicio(new Date(year, month, 16).toISOString().split('T')[0]);
        setPeriodoFim(new Date(year, month + 1, 0).toISOString().split('T')[0]);
      } else {
        const next = new Date(year, month + 1, 1);
        setPeriodoInicio(new Date(next.getFullYear(), next.getMonth(), 1).toISOString().split('T')[0]);
        setPeriodoFim(new Date(next.getFullYear(), next.getMonth(), 15).toISOString().split('T')[0]);
      }
    } else if (firstHalf) {
      const prev = new Date(year, month - 1, 1);
      setPeriodoInicio(new Date(prev.getFullYear(), prev.getMonth(), 16).toISOString().split('T')[0]);
      setPeriodoFim(new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().split('T')[0]);
    } else {
      setPeriodoInicio(new Date(year, month, 1).toISOString().split('T')[0]);
      setPeriodoFim(new Date(year, month, 15).toISOString().split('T')[0]);
    }
  };

  const reporPeriodoMesAtual = () => {
    setPeriodoInicio(currentMonthStart);
    setPeriodoFim(currentMonthEnd);
  };

  const parseMesDia = (str) => {
    if (!str || str === '—') return null;
    const m1 = str.match(/(\d{1,2})\s+([A-Za-zç]{3})/);
    if (m1) return { dia: parseInt(m1[1]), mes: MES_NUM[m1[2]] || 0 };
    const m2 = str.match(/(\d{1,2})\/(\d{1,2})/);
    if (m2) return { dia: parseInt(m2[1]), mes: parseInt(m2[2]) };
    const m3 = str.match(/\d{4}-(\d{2})-(\d{2})/);
    if (m3) return { dia: parseInt(m3[2]), mes: parseInt(m3[1]) };
    return null;
  };

  const filtrar = (lista, campoData) => {
    return lista.filter(item => {
      const dataPrincipal = item.prevPagamento || item.prevRecebimento || item[campoData] || '';
      if (usaFiltroIntervalo) {
        const dCompleta = parseDataCompleta(dataPrincipal, anoAtivo);
        const inicio = parseDataCompleta(periodoInicio);
        const fim = parseDataCompleta(periodoFim);
        if (!dCompleta || !inicio || !fim) return false;
        return dCompleta >= inicio && dCompleta <= fim;
      }
      const d = parseMesDia(dataPrincipal);
      if (!d) return vista === 'anual'; // sem data só aparece na vista anual
      if (vista === 'anual') return true;
      if (d.mes !== mesAtivo) return false;
      if (vista === 'mensal') return true;
      // quinzenal: filtra pela quinzena seleccionada
      if (quinzenaAtiva === 1) return d.dia >= 1 && d.dia <= 15;
      return d.dia >= 16;
    });
  };

  const pagsFiltrados = filtrar(pagamentos, 'dataFatura')
    .filter(p => catForn === 'Todas' || (p.categoria || '') === catForn)
    .filter(p => filtroValidDP === 'Todas' || p.validDP === filtroValidDP)
    .filter(p => filtroEstadoPag === 'Todos' || p.estadoPag === filtroEstadoPag);
  const recsFiltrados = filtrar(recebimentos, 'dataEmissao')
    .filter(r => filtroValidLG === 'Todas' || r.validLG === filtroValidLG)
    .filter(r => filtroValidReq === 'Todas' || r.validReq === filtroValidReq)
    .filter(r => filtroEstadoRec === 'Todos' || r.estadoRec === filtroEstadoRec);

  // KPIs
  const saldo        = recebimentos.filter(r => r.estadoRec === 'recebido').reduce((s, r) => s + r.valor, 0)
                     - pagamentos.filter(p => p.estadoPag === 'pago').reduce((s, p) => s + p.valor, 0);
  const totPendPag   = pagamentos.filter(p => p.estadoPag !== 'pago').reduce((s, p) => s + p.valor, 0);
  const totPendRec   = recebimentos.filter(r => r.estadoRec !== 'recebido').reduce((s, r) => s + r.valor, 0);
  const cashflow30d  = QUINZENAS.slice(0, 4).reduce((s, q) => s + q.saldo, 0);
  const desvio       = -8.4;

  const mudaEstadoPag = (id, novoEstado) => {
    const p = pagamentos.find(x => x.id === id);
    setPagamentos(prev => prev.map(x => x.id === id ? { ...x, estadoPag: novoEstado, comprovativo: novoEstado === 'pago' ? 'comp_novo.pdf' : x.comprovativo } : x));
    if (novoEstado === 'pago' && p) {
      // Notifica CA + MS
      notifPagamentoEfectuado({ fatura: p, fornecedor: p.fornecedor, executadoPor: user?.nome || 'LG' })
        .forEach(n => addNotif(n));
    }
  };

  const mudaEstadoRec = (id, novoEstado) => {
    const r = recebimentos.find(x => x.id === id);
    setRecebimentos(prev => prev.map(x => x.id === id ? { ...x, estadoRec: novoEstado, dataRecebimento: novoEstado === 'recebido' ? new Date().toLocaleDateString('pt-PT') : x.dataRecebimento } : x));
    if (novoEstado === 'recebido' && r) {
      // Notifica CA + MS + LG
      notifRecebimentoConfirmado({ fatura: r, cliente: r.cliente, confirmadoPor: user?.nome || 'LG' })
        .forEach(n => addNotif(n));
    }
  };
  const guardarObs = (texto) => {
    if (!obsModal) return;
    if (obsModal.tipo === 'pag') setPagamentos(prev => prev.map(p => p.id === obsModal.id ? { ...p, obsMD: texto } : p));
    setObsModal(null);
  };

  const validarPagamento = async (id, campo) => {
    const p = pagamentos.find(x => x.id === id);
    if (!p) return;
    const nome = user?.nome || 'SIS';
    const agora = new Date().toLocaleDateString('pt-PT');
    if (campo === 'validDP') {
      setPagamentos(prev => prev.map(x => x.id === id ? { ...x, validDP: 'Validada', dataValidDP: agora, estadoPag: 'pending-ms' } : x));
      // Notificações SIS → LG + CA
      notifFaturaFornValidadaDP({ fatura: p, fornecedor: p.fornecedor, validadoPor: nome })
        .forEach(n => addNotif(n));
    }
    if (campo === 'validDAF') {
      setPagamentos(prev => prev.map(x => x.id === id ? { ...x, validDAF: 'Validada', dataValidDAF: agora, estadoPag: 'pending-ms' } : x));
    }
    if (campo === 'autorMS') {
      setPagamentos(prev => prev.map(x => x.id === id ? { ...x, autorMS: 'Autorizado', dataAutorMS: agora, estadoPag: 'autorizado' } : x));
      // Notificação SIS → LG
      addNotif(notifPagamentoAutorizadoMS({ fatura: p, fornecedor: p.fornecedor, autorizadoPor: nome }));
    }
  };

  return (
    <div>
      {/* Modal observações */}
      {obsModal && (
        <ObsModal
          inicial={obsModal.texto}
          onClose={() => setObsModal(null)}
          onSave={guardarObs}
        />
      )}

      {/* ── Barra de Simulação Global ── */}
      {temSimulacao && canEditTesouraria && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 200,
          background: 'linear-gradient(135deg, #1C3A5E 0%, #2E5C8E 100%)',
          borderBottom: '2px solid #C47A1A',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 16px rgba(28,58,94,0.35)',
        }}>
          {/* Ícone */}
          <div style={{ fontSize: 20, flexShrink: 0 }}>👁</div>
          {/* Texto */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              Modo simulação activo — {pendingChanges.length} alteração{pendingChanges.length > 1 ? 'ões' : ''} pendente{pendingChanges.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Navega livremente para ver o impacto no Resumo, KPIs e Cashflow. Os valores ainda não foram guardados.
            </div>
          </div>
          {/* Resumo das alterações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 480 }}>
            {pendingChanges.slice(0, 3).map((c, i) => {
              const diff = c.tipo === 'entrada' ? c.valorNovo - c.valorAnterior : c.valorAnterior - c.valorNovo;
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#fff', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ opacity: 0.7 }}>{c.grupoLabel} · {c.itemLabel} · {NOMES_MES[c.mi]}</span>
                  <span style={{ fontWeight: 700, color: diff >= 0 ? '#a8f0c6' : '#ffb3b3' }}>
                    {diff >= 0 ? '+' : '−'}{Math.abs(diff).toLocaleString('pt-PT')} €
                  </span>
                </div>
              );
            })}
            {pendingChanges.length > 3 && (
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                +{pendingChanges.length - 3} mais
              </div>
            )}
          </div>
          {/* Botões */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={cancelarTodas} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              padding: '8px 16px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
            }}>✕ Cancelar</button>
            <button onClick={validarTodas} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: '#C47A1A', color: '#fff', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(196,122,26,0.4)',
            }}>✓ Validar {pendingChanges.length > 1 ? `${pendingChanges.length} alterações` : 'alteração'}</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Mapa de Tesouraria</div>
          <div className="page-subtitle">NOVANOR · Departamento Financeiro · LG — Leonor</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}
            onClick={() => {
              const md = (() => { try { return JSON.parse(localStorage.getItem('sis_tesouraria_manual')||'{}'); } catch { return {}; } })();
              exportTesourariaCompleto(pagamentos, recebimentos, md, anoAtivo);
            }}>
            📥 Exportar Excel completo
          </button>
        </div>
      </div>

      {/* Selector de vista e período */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Toggle vista */}
        <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 8, padding: 3, gap: 2, border: '0.5px solid var(--border)' }}>
          {[
            { key: 'quinzenal', label: 'Quinzenal' },
            { key: 'mensal',    label: 'Mensal'    },
            { key: 'anual',     label: 'Anual'     },
          ].map(v => (
            <button key={v.key} onClick={() => setVista(v.key)} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: vista === v.key ? 'var(--brand-primary)' : 'transparent',
              color: vista === v.key ? '#fff' : 'var(--text-muted)',
              transition: 'all .15s',
            }}>{v.label}</button>
          ))}
        </div>
        {tab === 'resumo' && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setHistoricoAtivo(prev => {
                const next = !prev;
                if (!next) {
                  setAnoAtivo(currentYear);
                  setMesAtivo(currentMonth);
                  setQuinzenaAtiva(currentQuinzena);
                }
                return next;
              });
            }}
          >
            {historicoAtivo ? 'Fechar histórico' : 'Ver histórico'}
          </button>
        )}

        {tab === 'resumo' && historicoAtivo && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderRadius: 8, background: 'var(--bg-app)', border: '0.5px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Referência</span>
            <select value={anoAtivo} onChange={e => setAnoAtivo(parseInt(e.target.value, 10))} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {vista !== 'anual' && (
              <select value={mesAtivo} onChange={e => setMesAtivo(parseInt(e.target.value, 10))} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
                {NOMES_MES.map((nome, idx) => <option key={nome} value={idx + 1}>{nome}</option>)}
              </select>
            )}
            {vista === 'quinzenal' && (
              <select value={quinzenaAtiva} onChange={e => setQuinzenaAtiva(parseInt(e.target.value, 10))} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value={1}>1–15</option>
                <option value={2}>16–fim</option>
              </select>
            )}
          </div>
        )}

        {/* Label do período activo */}
        {tab === 'resumo' && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
            {periodoActivoLabel}
            {' · '}<strong>{pagsFiltrados.length + recsFiltrados.length}</strong> registos
          </span>
        )}
      </div>

      {usaFiltroIntervalo && (
        <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button className="btn btn-sm" onClick={() => ajustarPeriodoPorVista(-1)} title="Período anterior">←</button>
            <button className="btn btn-sm" onClick={() => ajustarPeriodoPorVista(1)} title="Período seguinte">→</button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', padding:'8px 10px', borderRadius:8, background:'var(--bg-app)', border:'0.5px solid var(--border)' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>Período</span>
            <input
              type="date"
              value={periodoInicio}
              onChange={e => setPeriodoInicio(e.target.value)}
              style={{ fontFamily:'var(--font-body)', fontSize:12, padding:'5px 10px', border:'0.5px solid var(--border)', borderRadius:6, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}
            />
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>até</span>
            <input
              type="date"
              value={periodoFim}
              onChange={e => setPeriodoFim(e.target.value)}
              style={{ fontFamily:'var(--font-body)', fontSize:12, padding:'5px 10px', border:'0.5px solid var(--border)', borderRadius:6, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}
            />
            <button className="btn btn-sm" onClick={reporPeriodoMesAtual}>Mês atual</button>
          </div>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            A mostrar: <strong style={{ color:'var(--text-primary)' }}>{formatDateRangeLabel(periodoInicio, periodoFim)}</strong>
            {temIntervaloCustomizado && (
              <span style={{ marginLeft:8, color:'var(--brand-primary)', fontWeight:600 }}>intervalo personalizado</span>
            )}
          </span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 10, marginBottom: 20, opacity: temSimulacao ? 0.85 : 1, transition: 'opacity .3s' }}>
        {[
          {
            label: 'Saldo de Tesouraria',
            value: fmt(284320),
            sub: 'Acima do limite',
            subCls: 'badge-s',
          },
          {
            label: 'Pagamentos Pendentes',
            value: fmt(totPendPag),
            sub: `${pagamentos.filter(p => p.estadoPag !== 'pago').length} faturas`,
            subCls: pagamentos.filter(p => p.validDP === 'Atrasada').length > 0 ? 'badge-d' : 'badge-w',
          },
          {
            label: 'Recebimentos Pendentes',
            value: fmt(totPendRec),
            sub: `${recebimentos.filter(r => r.estadoRec === 'vencida').length} vencida(s)`,
            subCls: recebimentos.filter(r => r.estadoRec === 'vencida').length > 0 ? 'badge-d' : 'badge-i',
          },
          {
            label: 'Cashflow Previsto 30d',
            value: fmt(cashflow30d),
            sub: cashflow30d >= 0 ? 'Positivo' : 'Negativo',
            subCls: cashflow30d >= 0 ? 'badge-s' : 'badge-d',
            valueColor: cashflow30d >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          },
          {
            label: 'Desvio vs Previsão',
            value: `${desvio}%`,
            sub: 'Abaixo limite 10%',
            subCls: Math.abs(desvio) > 10 ? 'badge-d' : 'badge-w',
            valueColor: desvio < 0 ? 'var(--color-warning)' : 'var(--color-success)',
          },
          {
            label: 'Fat. s/ Validação DP',
            value: String(pagamentos.filter(p => p.validDP !== 'Validada' && p.estadoPag !== 'pago').length),
            sub: pagamentos.filter(p => p.validDP !== 'Validada' && p.estadoPag !== 'pago').length > 0
              ? `${fmt(pagamentos.filter(p => p.validDP !== 'Validada' && p.estadoPag !== 'pago').reduce((s,p)=>s+p.valor,0))}`
              : 'Todas validadas',
            subCls: pagamentos.filter(p => p.validDP !== 'Validada' && p.estadoPag !== 'pago').length > 0 ? 'badge-d' : 'badge-s',
            valueColor: pagamentos.filter(p => p.validDP !== 'Validada' && p.estadoPag !== 'pago').length > 0 ? 'var(--color-danger)' : 'var(--color-success)',
            onClick: () => setTab('pagamentos'),
          },
        ].map(k => (
          <div key={k.label} className="kpi-card" onClick={k.onClick} style={{ cursor: k.onClick ? 'pointer' : 'default', transition: 'box-shadow .15s' }}
            onMouseEnter={e => { if (k.onClick) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 18, color: k.valueColor }}>{k.value}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className={`badge ${k.subCls}`}>{k.sub}</span>
              {k.onClick && <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>→</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda fontes */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 12 }}>
        {[
          { cor: '#1C3A5E', label: 'Centralgest (automático)' },
                    { cor: '#C47A1A', label: 'Introdução manual SIS'    },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.cor }} />
            <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
        {[
          { key: 'resumo',         label: '⊞ Resumo' },
          { key: 'pagamentos',     label: `↓ Fornecedores (${pagamentos.filter(p => p.estadoPag !== 'pago').length} pend.)` },
          { key: 'recebimentos',   label: `↑ Clientes (${recebimentos.filter(r => r.estadoRec !== 'recebido').length} pend.)` },
          { key: 'financiamentos', label: '🏦 Financiamentos' },
          { key: 'colaboradores',  label: '👥 Colaboradores' },
          { key: 'impostos',       label: '📋 Impostos' },
          { key: 'investimentos',  label: '📈 Investimentos' },
          { key: 'diversos',       label: '📦 Diversos' },

        ].map(t => (
          <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB PAGAMENTOS ── */}
      {tab === 'pagamentos' && (
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)' }}>
          {/* Barra de filtros */}
          <div style={{ padding: '8px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Categoria</span>
              {CATS_FORN.map(c => (
                <button key={c} onClick={() => setCatForn(c)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', borderColor: catForn === c ? 'var(--brand-primary)' : 'var(--border)', background: catForn === c ? 'var(--brand-primary)' : 'var(--bg-card)', color: catForn === c ? '#fff' : 'var(--text-secondary)' }}>{c}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Valid. DP</span>
              {['Todas','Pendente','Validada','Atrasada'].map(v => (
                <button key={v} onClick={() => setFiltroValidDP(v)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', borderColor: filtroValidDP === v ? 'var(--brand-primary)' : 'var(--border)', background: filtroValidDP === v ? 'var(--brand-primary)' : 'var(--bg-card)', color: filtroValidDP === v ? '#fff' : 'var(--text-secondary)' }}>{v}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Estado</span>
              {['Todos','pending-dp','pending-ms','autorizado','pago'].map(v => (
                <button key={v} onClick={() => setFiltroEstadoPag(v)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', borderColor: filtroEstadoPag === v ? 'var(--brand-primary)' : 'var(--border)', background: filtroEstadoPag === v ? 'var(--brand-primary)' : 'var(--bg-card)', color: filtroEstadoPag === v ? '#fff' : 'var(--text-secondary)' }}>{v === 'Todos' ? 'Todos' : PAG_EST[v]?.label || v}</button>
              ))}
            </div>
          </div>
          {/* Sub-header */}
          <div style={{ padding: '8px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Fornecedores · {formatDateRangeLabel(periodoInicio, periodoFim)} · {pagsFiltrados.length} registos</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Total: <strong>{fmt(pagsFiltrados.reduce((s,p)=>s+p.valor,0))}</strong></span>
              <span>Pendente: <strong style={{ color: 'var(--color-warning)' }}>{fmt(pagsFiltrados.filter(p=>p.estadoPag!=='pago').reduce((s,p)=>s+p.valor,0))}</strong></span>
              <span>Pago: <strong style={{ color: 'var(--color-success)' }}>{fmt(pagsFiltrados.filter(p=>p.estadoPag==='pago').reduce((s,p)=>s+p.valor,0))}</strong></span>
            </div>
          </div>
          {/* Tabela */}
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table id="tes-tabela-pagamentos" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', position: 'sticky', top: 0, zIndex: 4 }}>
                  {vista === 'quinzenal' && <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', borderRight: '0.5px solid var(--border)', whiteSpace: 'nowrap', minWidth: 80, textTransform: 'uppercase', letterSpacing: '0.03em', background: 'var(--bg-app)' }}>Quinzena</th>}
                  {[
                    { label: 'Fornecedor', w: 160 }, { label: 'Obra/Projeto', w: 90 },
                    { label: 'Categoria', w: 150 }, { label: 'Nº Encomenda', w: 120 },
                    { label: 'Data Encomenda', w: 110 }, { label: 'Val. Total Enc.', w: 120, right: true },
                    { label: 'Val. Parcial Enc.', w: 120, right: true }, { label: 'Nº Fatura', w: 120 },
                    { label: 'Descrição', w: 160 }, { label: 'Valor Fatura', w: 110, right: true },
                    { label: 'Data Fatura', w: 95 }, { label: 'Vencimento', w: 95 },
                    { label: 'Cond. Pagamento', w: 110 }, { label: 'Prev. Pagamento', w: 130 },
                    { label: 'Banco', w: 110 },
                    { label: 'Ações', w: 220 },
                  ].map(col => (
                    <th key={col.label} style={{ padding: '8px 10px', textAlign: col.right ? 'right' : 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', borderRight: '0.5px solid var(--border)', whiteSpace: 'nowrap', minWidth: col.w, textTransform: 'uppercase', letterSpacing: '0.03em', background: 'var(--bg-app)' }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pagsFiltrados].sort((a,b) => { const da=parseMesDia(a.dataFatura||''),db=parseMesDia(b.dataFatura||''); return (da?.dia||0)-(db?.dia||0); }).map((p, i) => {
                  const vencida = p.estadoPag !== 'pago' && p.dataVenc && p.dataVenc !== '—';
                  const rowBg = p.estadoPag==='pago' ? 'rgba(46,125,82,0.10)' : p.estadoPag==='vencida' ? 'rgba(184,50,50,0.06)' : i%2===0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.018)';
                  const rowBorder = p.estadoPag==='pago' ? '3px solid var(--color-success)' : p.estadoPag==='vencida' ? '3px solid var(--color-danger)' : 'none';
                  const dia = parseMesDia(p.dataFatura||'')?.dia||0;
                  const quinzena = dia>0&&dia<=15 ? `1ª quinzena` : dia>15 ? `2ª quinzena` : '—';
                  const TD = (ex={}) => ({ padding:'7px 10px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)', ...ex });
                  const TDE = { padding:'4px 6px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)' };
                  const IS = { width:'100%', fontFamily:'var(--font-body)', fontSize:11, color:'var(--text-muted)', background:'transparent', border:'none', outline:'none', padding:'3px 4px', borderRadius:4 };
                  const onFI = e => { e.target.style.background='var(--bg-card)'; e.target.style.border='1px solid var(--brand-primary)'; e.target.style.color='var(--text-primary)'; };
                  const onFO = e => { e.target.style.background='transparent'; e.target.style.border='none'; e.target.style.color='var(--text-muted)'; };
                  return (
                    <tr key={p.id} style={{ background: rowBg }}>
                      {vista==='quinzenal' && <td style={{ ...TD(), whiteSpace:'nowrap', borderLeft:rowBorder }}><span className={`badge ${quinzena.startsWith('1')?'badge-i':'badge-n'}`}>{quinzena}</span></td>}
                      <td style={TD({ fontWeight:500, whiteSpace:'nowrap', borderLeft:vista!=='quinzenal'?rowBorder:undefined })}>
                        <span onClick={() => navigate('/fornecedores', { state: { abrirFornecedor: p.fornId } })}
                          style={{ cursor:'pointer', color:'var(--brand-primary)', textDecoration:'underline', textDecorationStyle:'dotted' }}
                          title="Abrir fornecedor">
                          {p.fornecedor}
                        </span>
                      </td>
                      <td style={TD()}><span className="badge badge-n">{p.obra}</span></td>
                      <td style={TDE}>
                        <select value={p.categoria||''} onChange={e=>setPagamentos(prev=>prev.map(x=>x.id===p.id?{...x,categoria:e.target.value}:x))} style={{...IS,cursor:'pointer'}} onFocus={e=>{e.target.style.background='var(--bg-card)';e.target.style.border='1px solid var(--brand-primary)';}} onBlur={e=>{e.target.style.background='transparent';e.target.style.border='none';}}>
                          <option value="">— seleccionar —</option>
                          {CATS_FORN.slice(1).map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={TD({ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' })}>{p.nEncomenda||'—'}</td>
                      <td style={TD({ color:'var(--text-muted)', whiteSpace:'nowrap' })}>{p.dataEncomenda||'—'}</td>
                      <td style={TD({ textAlign:'right', color:'var(--text-muted)' })}>{p.valorEncomenda?fmt(p.valorEncomenda):'—'}</td>
                      <td style={TDE}><input key={p.id+'_vpe'} defaultValue={p.valorParcialEncomenda||''} placeholder="—" style={{...IS,textAlign:'right',fontFamily:'var(--font-mono)'}} onFocus={onFI} onBlur={e=>{const v=parseFloat(e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))||null;setPagamentos(prev=>prev.map(x=>x.id===p.id?{...x,valorParcialEncomenda:v}:x));onFO(e);}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}/></td>
                      <td style={TD({ fontFamily:'var(--font-mono)', fontSize:11 })}>
                        <span onClick={() => navigate('/fornecedores', { state: { abrirFaturaForn: { faturaId: p.id, fornecedorId: p.fornId } } })}
                          style={{ cursor:'pointer', color:'var(--brand-primary)', textDecoration:'underline', textDecorationStyle:'dotted' }}
                          title="Abrir fatura">
                          {p.nFatura}
                        </span>
                      </td>
                      <td style={TD({ color:'var(--text-secondary)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' })}>{p.descricao||'—'}</td>
                      <td style={TD({ textAlign:'right', fontWeight:600 })}>{fmt(p.valor)}</td>
                      <td style={TD({ color:'var(--text-muted)', whiteSpace:'nowrap' })}>{p.dataFatura||'—'}</td>
                      <td style={TD({ color:vencida?'var(--color-danger)':'var(--text-muted)', whiteSpace:'nowrap', fontWeight:vencida?600:400 })}>{p.dataVenc||'—'}{vencida&&' ⚠'}</td>
                      <td style={TD({ color:'var(--text-muted)' })}>{p.condPag||'—'}</td>
                      <td style={TDE}>
                        {podeEditarDataPrev ? (
                          <input type="date"
                            value={p.prevPagamento&&/^\d{4}-\d{2}-\d{2}$/.test(p.prevPagamento)?p.prevPagamento:''}
                            onChange={e => {
                              const val = e.target.value;
                              setPagamentos(prev => prev.map(x => x.id===p.id ? {...x, prevPagamento:val} : x));
                              saveFaturaForn(p.fornId, p.id, { dataPrevisaoPagamento: val });
                            }}
                            style={{...IS, cursor:'pointer'}}
                            onFocus={e=>{e.target.style.background='var(--bg-card)';e.target.style.border='1px solid var(--brand-accent)';}}
                            onBlur={e=>{e.target.style.background='transparent';e.target.style.border='none';}}
                          />
                        ) : (
                          <span style={{fontSize:12, color:'var(--text-muted)', padding:'0 4px'}}>{p.prevPagamento||'—'}</span>
                        )}
                      </td>
                      <td style={TDE}>
                        <select value={p.banco||''} onChange={e=>setPagamentos(prev=>prev.map(x=>x.id===p.id?{...x,banco:e.target.value}:x))} style={{...IS,cursor:'pointer'}} onFocus={e=>{e.target.style.background='var(--bg-card)';e.target.style.border='1px solid var(--brand-primary)';}} onBlur={e=>{e.target.style.background='transparent';e.target.style.border='none';}}>
                          <option value="">— banco —</option>
                          {['CGD','BPI','Novo Banco','Santander','BCP','BIC','Montepio','Outro'].map(b=><option key={b} value={b}>{b}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border)', minWidth:220 }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <FluxoValidacaoForn
                            p={p}
                            user={user}
                            addNotif={addNotif}
                            onUpdate={campos => {
                              saveFaturaForn(p.fornId, p.id, campos);
                              setPagamentos(prev => prev.map(x => x.id===p.id ? {...x, ...campos,
                                fluxoVal: campos.estado==='pago'||campos.estado==='concluido' ? 'autorizado'
                                  : campos.estado==='autorizado' ? 'autorizado'
                                  : campos.estado==='pending-ms' ? 'pendente_ms'
                                  : campos.estado==='standby-lg'||campos.estado==='pending-lg' ? 'pendente_lg'
                                  : 'pendente_dp',
                                confirmado: campos.estado==='pago'||campos.estado==='concluido'||false,
                              } : x));
                            }}
                          />
                          <ConfirmarLiquidacao
                            id={p.id} tipo="forn"
                            estadoFluxo={p.fluxoVal||'pendente_dp'}
                            confirmado={p.confirmado}
                            dataConfirmacao={p.dataConfirmacao}
                            comprovativo={p.comprovativo?.name || p.comprovativo}
                            user={user}
                            onConfirmar={({data, comprovativo:comp}) => {
                              const campos = { estado:'pago', dataPagamento:data, confirmado:true, dataConfirmacao:data, comprovativoPagamento: comp ? {name:comp} : p.comprovativoPagamento };
                              saveFaturaForn(p.fornId, p.id, campos);
                              setPagamentos(prev => prev.map(x => x.id===p.id ? {...x, ...campos, estadoPag:'pago', fluxoVal:'autorizado', comprovativo:comp||x.comprovativo} : x));
                              addNotif({ tipo:'confirmar_emissao', icon:'💶', titulo:`Pagamento registado — adicionar Doc. 51`, sub:`${p.fornecedor} · ${p.nFatura} · Pago em ${data}`, path:'/fornecedores', destinatario:'ca', meta:{faturaId:p.id, fornecedorNome:p.fornecedor} });
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Rodapé */}
          <div style={{ padding:'8px 16px', borderTop:'0.5px solid var(--border)', display:'flex', gap:20, fontSize:12, background:'var(--bg-app)', flexShrink:0 }}>
            {[{label:'Aguarda DP',val:pagsFiltrados.filter(p=>p.estadoPag==='pending-dp').length,cls:'badge-i'},{label:'Aguarda MS',val:pagsFiltrados.filter(p=>p.estadoPag==='pending-ms').length,cls:'badge-w'},{label:'Autorizado',val:pagsFiltrados.filter(p=>p.estadoPag==='autorizado').length,cls:'badge-s'},{label:'Pago',val:pagsFiltrados.filter(p=>p.estadoPag==='pago').length,cls:'badge-s'}].map(s=>(
              <span key={s.label} style={{ color:'var(--text-muted)' }}>{s.label}: <span className={`badge ${s.cls}`}>{s.val}</span></span>
            ))}
            <span style={{ marginLeft:'auto', color:'var(--text-muted)' }}>Total em aberto: <strong style={{ color:'var(--color-warning)' }}>{fmt(pagsFiltrados.filter(p=>p.estadoPag!=='pago').reduce((s,p)=>s+p.valor,0))}</strong></span>
          </div>
        </div>
      )}

      {/* ── TAB RECEBIMENTOS ── */}
      {tab === 'recebimentos' && (
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)' }}>
          {/* Barra de filtros */}
          <div style={{ padding: '8px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Valid. LG</span>
              {['Todas','Pendente','Validada'].map(v => (
                <button key={v} onClick={() => setFiltroValidLG(v)} style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'4px 12px', borderRadius:20, border:'0.5px solid', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap', borderColor:filtroValidLG===v?'var(--brand-primary)':'var(--border)', background:filtroValidLG===v?'var(--brand-primary)':'var(--bg-card)', color:filtroValidLG===v?'#fff':'var(--text-secondary)' }}>{v}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Valid. Req.</span>
              {['Todas','Pendente','Validada'].map(v => (
                <button key={v} onClick={() => setFiltroValidReq(v)} style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'4px 12px', borderRadius:20, border:'0.5px solid', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap', borderColor:filtroValidReq===v?'var(--brand-primary)':'var(--border)', background:filtroValidReq===v?'var(--brand-primary)':'var(--bg-card)', color:filtroValidReq===v?'#fff':'var(--text-secondary)' }}>{v}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Estado</span>
              {['Todos','pendente','parcial','vencida','recebido'].map(v => (
                <button key={v} onClick={() => setFiltroEstadoRec(v)} style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'4px 12px', borderRadius:20, border:'0.5px solid', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap', borderColor:filtroEstadoRec===v?'var(--brand-primary)':'var(--border)', background:filtroEstadoRec===v?'var(--brand-primary)':'var(--bg-card)', color:filtroEstadoRec===v?'#fff':'var(--text-secondary)' }}>{v==='Todos'?'Todos':REC_EST[v]?.label||v}</button>
              ))}
            </div>
          </div>
          {/* Sub-header */}
          <div style={{ padding:'8px 16px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>Clientes · {formatDateRangeLabel(periodoInicio, periodoFim)} · {recsFiltrados.length} registos</div>
            <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-muted)' }}>
              <span>Total esperado: <strong>{fmt(recsFiltrados.reduce((s,r)=>s+r.valor,0))}</strong></span>
              <span>Recebido: <strong style={{ color:'var(--color-success)' }}>{fmt(recsFiltrados.filter(r=>r.estadoRec==='recebido').reduce((s,r)=>s+r.valor,0))}</strong></span>
              <span>Pendente: <strong style={{ color:'var(--color-warning)' }}>{fmt(recsFiltrados.filter(r=>r.estadoRec!=='recebido').reduce((s,r)=>s+r.valor,0))}</strong></span>
            </div>
          </div>
          {/* Tabela */}
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table id="tes-tabela-recebimentos" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', position: 'sticky', top: 0, zIndex: 4 }}>
                  {vista==='quinzenal' && <th style={{ padding:'8px 10px', fontWeight:600, fontSize:11, color:'var(--text-secondary)', borderBottom:'1px solid var(--border)', borderRight:'0.5px solid var(--border)', whiteSpace:'nowrap', minWidth:80, textTransform:'uppercase', letterSpacing:'0.03em', background:'var(--bg-app)' }}>Quinzena</th>}
                  {[
                    { label:'Cliente', w:170 }, { label:'Obra/Projeto', w:90 },
                    { label:'Nº Fatura', w:130 }, { label:'Data Emissão', w:100 },
                    { label:'Cond. Pagamento', w:130 }, { label:'Valor Fatura', w:120, right:true },
                    { label:'Valor Parcial', w:120, right:true }, { label:'Fluxo Validação', w:180 },
                    { label:'Estado', w:140 },
                    { label:'Prev. Recebimento', w:140 }, { label:'Data Recebimento', w:130 },
                    { label:'Confirmar Recebimento', w:190 }, { label:'Ações', w:130 },
                  ].map(col=>(
                    <th key={col.label} style={{ padding:'8px 10px', textAlign:col.right?'right':'left', fontWeight:600, fontSize:11, color:'var(--text-secondary)', borderBottom:'1px solid var(--border)', borderRight:'0.5px solid var(--border)', whiteSpace:'nowrap', minWidth:col.w, textTransform:'uppercase', letterSpacing:'0.03em', background:'var(--bg-app)' }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...recsFiltrados].sort((a,b)=>{const da=parseMesDia(a.dataEmissao||''),db=parseMesDia(b.dataEmissao||'');return (da?.dia||0)-(db?.dia||0);}).map((r,i)=>{
                  const vencida = r.estadoRec==='vencida';
                  const rowBg = r.estadoRec==='recebido'?'rgba(46,125,82,0.10)':r.estadoRec==='vencida'?'rgba(184,50,50,0.06)':i%2===0?'var(--bg-card)':'rgba(0,0,0,0.018)';
                  const rowBorder = r.estadoRec==='recebido'?'3px solid var(--color-success)':r.estadoRec==='vencida'?'3px solid var(--color-danger)':'none';
                  const dia = parseMesDia(r.dataEmissao||'')?.dia||0;
                  const quinzena = dia>0&&dia<=15?`1ª quinzena`:`2ª quinzena`;
                  const TD = (ex={}) => ({ padding:'7px 10px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)', ...ex });
                  const TDE = { padding:'4px 6px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)' };
                  const IS = { width:'100%', fontFamily:'var(--font-body)', fontSize:11, color:'var(--text-muted)', background:'transparent', border:'none', outline:'none', padding:'3px 4px', borderRadius:4 };
                  const onFI = e => { e.target.style.background='var(--bg-card)'; e.target.style.border='1px solid var(--brand-primary)'; e.target.style.color='var(--text-primary)'; };
                  const onFO = e => { e.target.style.background='transparent'; e.target.style.border='none'; e.target.style.color='var(--text-muted)'; };
                  return (
                    <tr key={r.id} style={{ background: rowBg }}>
                      {vista==='quinzenal' && <td style={{ ...TD(), whiteSpace:'nowrap', borderLeft:rowBorder }}><span className={`badge ${quinzena.startsWith('1')?'badge-i':'badge-n'}`}>{quinzena}</span></td>}
                      <td style={TD({ fontWeight:500, whiteSpace:'nowrap', borderLeft:vista!=='quinzenal'?rowBorder:undefined })}>
                        <span onClick={() => navigate('/clientes', { state: { abrirCliente: r.clienteId } })}
                          style={{ cursor:'pointer', color:'var(--color-success)', textDecoration:'underline', textDecorationStyle:'dotted' }}
                          title="Abrir cliente">
                          {r.cliente}
                        </span>
                      </td>
                      <td style={TD()}><span className="badge badge-n">{r.obra}</span></td>
                      <td style={TD({ fontFamily:'var(--font-mono)', fontSize:11, whiteSpace:'nowrap' })}>
                        <span onClick={() => navigate('/clientes', { state: { abrirFatura: { faturaId: r.id, clienteId: r.clienteId } } })}
                          style={{ cursor:'pointer', color:'var(--brand-primary)', textDecoration:'underline', textDecorationStyle:'dotted' }}
                          title="Abrir fatura">
                          {r.nFatura}
                        </span>
                      </td>
                      <td style={TD({ color:'var(--text-muted)', whiteSpace:'nowrap' })}>{r.dataEmissao||'—'}</td>
                      <td style={TDE}><input key={r.id+'_cond'} defaultValue={r.condPag||''} placeholder="—" style={IS} onFocus={onFI} onBlur={e=>{const v=e.target.value.trim();setRecebimentos(prev=>prev.map(x=>x.id===r.id?{...x,condPag:v||x.condPag}:x));onFO(e);}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}/></td>
                      <td style={TD({ textAlign:'right', fontWeight:600 })}>{fmt(r.valor)}</td>
                      <td style={TDE}><input key={r.id+'_vp'} defaultValue={r.valorParcial||''} placeholder="—" style={{...IS,textAlign:'right',fontFamily:'var(--font-mono)'}} onFocus={onFI} onBlur={e=>{const v=parseFloat(e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))||null;setRecebimentos(prev=>prev.map(x=>x.id===r.id?{...x,valorParcial:v}:x));onFO(e);}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}/></td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)', minWidth:180 }}>
                        <FluxoValidacao
                          estadoAtual={r.fluxoVal||'pendente_req'}
                          tipo="cli"
                          pago={r.confirmado}
                          user={user}
                          requerente={r.requerente}
                          onAvancar={novoEstado => {
                            setRecebimentos(prev => prev.map(x => x.id===r.id ? {...x, fluxoVal: novoEstado, estadoRec: novoEstado === 'recebido' ? 'recebido' : x.estadoRec} : x));
                          }}
                        />
                      </td>
                      <td style={TD()}><span className={`badge ${REC_EST[r.estadoRec]?.cls||'badge-n'}`}>{REC_EST[r.estadoRec]?.label||'—'}</span></td>
                      <td style={TDE}>
                        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                          <input type="date" value={r.prevRecebimento&&/^\d{4}-\d{2}-\d{2}$/.test(r.prevRecebimento)?r.prevRecebimento:''} onChange={e=>setRecebimentos(prev=>prev.map(x=>x.id===r.id?{...x,prevRecebimento:e.target.value}:x))} style={{...IS,cursor:'pointer'}} onFocus={e=>{e.target.style.background='var(--bg-card)';e.target.style.border='1px solid var(--brand-accent)';}} onBlur={e=>{e.target.style.background='transparent';e.target.style.border='none';}}/>
                          {vencida&&<span style={{ color:'var(--color-danger)', flexShrink:0 }}>⚠</span>}
                        </div>
                      </td>
                      <td style={TD({ color:'var(--color-success)', fontWeight:r.dataRecebimento?500:400, whiteSpace:'nowrap' })}>{r.dataRecebimento||'—'}</td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border)', borderRight:'0.5px solid var(--border)', minWidth:190 }}>
                        <ConfirmarLiquidacao
                          id={r.id} tipo="cli"
                          estadoFluxo={r.fluxoVal||'pendente_req'}
                          confirmado={r.confirmado}
                          dataConfirmacao={r.dataConfirmacao}
                          comprovativo={r.comprovativo}
                          userId={user?.id}
                          user={user}
                          onConfirmar={({data,comprovativo:comp}) => setRecebimentos(prev => prev.map(x => x.id===r.id ? {...x, confirmado:true, dataConfirmacao:data, comprovativo:comp||x.comprovativo, estadoRec:'recebido'} : x))}
                        />
                      </td>
                      <td style={{ padding:'7px 10px', borderBottom:'0.5px solid var(--border)' }}>
                        <AcoesRecebimento r={r} onChange={mudaEstadoRec}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Rodapé */}
          <div style={{ padding:'8px 16px', borderTop:'0.5px solid var(--border)', display:'flex', gap:20, fontSize:12, background:'var(--bg-app)', flexShrink:0 }}>
            {[{label:'Pendente',val:recsFiltrados.filter(r=>r.estadoRec==='pendente').length,cls:'badge-i'},{label:'Parcial',val:recsFiltrados.filter(r=>r.estadoRec==='parcial').length,cls:'badge-w'},{label:'Vencida',val:recsFiltrados.filter(r=>r.estadoRec==='vencida').length,cls:'badge-d'},{label:'Recebido',val:recsFiltrados.filter(r=>r.estadoRec==='recebido').length,cls:'badge-s'}].map(s=>(
              <span key={s.label} style={{ color:'var(--text-muted)' }}>{s.label}: <span className={`badge ${s.cls}`}>{s.val}</span></span>
            ))}
            <span style={{ marginLeft:'auto', color:'var(--text-muted)' }}>Por receber: <strong style={{ color:'var(--color-warning)' }}>{fmt(recsFiltrados.filter(r=>r.estadoRec!=='recebido').reduce((s,r)=>s+r.valor,0))}</strong></span>
          </div>
        </div>
      )}

      {/* ── TAB RESUMO ── */}
      {tab === 'resumo' && <ResumoGrelha pagamentos={pagamentos} recebimentos={recebimentos} anoAtivo={anoAtivo} dadosSimulados={dadosSimulados} temSimulacao={temSimulacao} vistaGlobal={vista} mesGlobal={mesAtivo} quinzenaGlobal={quinzenaAtiva} canEditPrevDatas={podeEditarDataPrev} onUpdateRecebimentoPrev={actualizarPrevRecebimento} />}

      {/* ── TABS DETALHE MANUAL ── */}
      {tab === 'financiamentos' && (
        <DetalheManualGrelha
          chave="financiamentos"
          titulo="Financiamentos & Amortizações"
          colunas={[
            { key: 'financiamentos_entrada', label: 'Financiamentos (entrada)', tipo: 'entrada' },
            { key: 'financiamentos_saida',   label: 'Financiamentos (saída)',   tipo: 'saida'   },
          ]}
          anoAtivo={anoAtivo}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          periodoLabel={formatDateRangeLabel(periodoInicio, periodoFim)}
          dadosExternos={dadosSimulados}
          onPendingChange={adicionarPendingChange}
        />
      )}
      {tab === 'colaboradores' && (
        <DetalheManualGrelha
          chave="colaboradores"
          titulo="Custos com Colaboradores"
          colunas={[
            { key: 'ordenados',              label: 'Ordenados',                    tipo: 'saida' },
            { key: 'subsidio_ferias',        label: 'Subsídio de férias',           tipo: 'saida' },
            { key: 'subsidio_natal',         label: 'Subsídio de Natal',            tipo: 'saida' },
            { key: 'deslocacoes',            label: 'Deslocações',                  tipo: 'saida' },
            { key: 'Edenred',               label: 'Edenred',                      tipo: 'saida' },
            { key: 'formacao',              label: 'Formação',                     tipo: 'saida' },
            { key: 'premios',               label: 'Prémios',                      tipo: 'saida' },
            { key: 'subsidio_alimentacao',  label: 'Subsídio de Alimentação',      tipo: 'saida' },
            { key: 'despesas_do_pessoal',   label: 'Despesas do pessoal',          tipo: 'saida' },
            { key: 'outros',                label: 'Outros',                       tipo: 'saida' },
          ]}
          anoAtivo={anoAtivo}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          periodoLabel={formatDateRangeLabel(periodoInicio, periodoFim)}
          dadosExternos={dadosSimulados}
          onPendingChange={adicionarPendingChange}
        />
      )}
      {tab === 'impostos' && (
        <DetalheManualGrelha
          chave="impostos"
          titulo="Impostos"
          colunas={[
            { key: 'IVA',          label: 'IVA',                  tipo: 'saida' },
            { key: 'irc',          label: 'IRC',                  tipo: 'saida' },
            { key: 'irs',          label: 'IRS',                  tipo: 'saida' },
            { key: 'imi',          label: 'IMI',                  tipo: 'saida' },
            { key: 'tsu',          label: 'TSU',                  tipo: 'saida' },
            { key: 'iuc',          label: 'IUC',                  tipo: 'saida' },
            { key: 'outros',       label: 'Outros',               tipo: 'saida' },
          ]}
          anoAtivo={anoAtivo}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          periodoLabel={formatDateRangeLabel(periodoInicio, periodoFim)}
          dadosExternos={dadosSimulados}
          onPendingChange={adicionarPendingChange}
        />
      )}
      {tab === 'investimentos' && (
        <DetalheManualGrelha
          chave="investimentos"
          titulo="Investimentos"
          colunas={[
            { key: 'investimentos_saida',   label: 'Investimentos (saída)',   tipo: 'saida'   },
            { key: 'investimentos_entrada', label: 'Investimentos (entrada)', tipo: 'entrada' },
          ]}
          anoAtivo={anoAtivo}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          periodoLabel={formatDateRangeLabel(periodoInicio, periodoFim)}
          dadosExternos={dadosSimulados}
          onPendingChange={adicionarPendingChange}
        />
      )}
      {tab === 'diversos' && (
        <DetalheManualGrelha
          chave="diversos"
          titulo="Diversos"
          colunas={[
            { key: 'alvaras',        label: 'Alvarás & licenças',     tipo: 'saida' },
            { key: 'bancos',         label: 'Bancos - Juros + comissões', tipo: 'saida' },
            { key: 'imoveis',   label: 'Imóveis',      tipo: 'saida' },
            { key: 'contabilidade',    label: 'Contabilidade',            tipo: 'saida' },
            { key: 'escritorio', label: 'Escritório',    tipo: 'saida' },
            { key: 'viaturas',     label: 'Viaturas',        tipo: 'saida' },
            { key: 'outros',     label: 'Outros',        tipo: 'saida' },
          ]}
          anoAtivo={anoAtivo}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          periodoLabel={formatDateRangeLabel(periodoInicio, periodoFim)}
          dadosExternos={dadosSimulados}
          onPendingChange={adicionarPendingChange}
        />
      )}

      {/* ── TAB CASHFLOW ── */}
    </div>
  );
}

// ─── DETALHE MANUAL GRELHA ────────────────────────────────────────────────────
// Grelha editável por quinzena para categorias manuais
// dados: { [ano]: { [colKey]: [[q1,q2], ...12meses] } }
const LS_KEY_MANUAL = 'sis_tesouraria_manual';

function loadManual() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_MANUAL) || '{}'); } catch { return {}; }
}
function saveManual(data) {
  localStorage.setItem(LS_KEY_MANUAL, JSON.stringify(data));
}

function DetalheManualGrelha({ chave, titulo, descricao, colunas, anoAtivo, periodoInicio, periodoFim, periodoLabel, dadosExternos, onPendingChange }) {
  // colunas = grupos fixos, cada um com subitens personalizáveis
  // estrutura storage: { [ano]: { [chave]: { grupos: [{key,label,tipo,itens:[{key,label,origem}]}], valores: {[itemKey]: [[q1,q2]×12]} } } }
  const [dadosLocais, setDadosLocais] = useState(() => loadManual());
  // Usa dadosExternos (simulação) se disponível, senão os dados guardados
  const dados = dadosExternos || dadosLocais;
  const [expandido, setExpandido] = useState({});
  const [editCell, setEditCell]   = useState(null); // {itemKey, mi, q}
  const [addingTo, setAddingTo]   = useState(null); // grupoKey — a adicionar item
  const [novoItem, setNovoItem]   = useState({ label: '', origem: '' });
  const [editLabel, setEditLabel] = useState(null); // {itemKey, grupoKey}
  const [toast, setToast]         = useState(null);
  const parseIsoDate = (value) => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const rangeStartRaw = parseIsoDate(periodoInicio) || new Date((anoAtivo || 2026), 0, 1);
  const rangeEndRaw = parseIsoDate(periodoFim) || new Date((anoAtivo || 2026), 11, 31);
  const rangeStart = rangeStartRaw <= rangeEndRaw ? rangeStartRaw : rangeEndRaw;
  const rangeEnd = rangeStartRaw <= rangeEndRaw ? rangeEndRaw : rangeStartRaw;
  const timelineMeses = [];
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const finalCursor = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cursor <= finalCursor) {
    timelineMeses.push({ ano: cursor.getFullYear(), mi: cursor.getMonth(), label: NOMES_MES[cursor.getMonth()] });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  const timelineYears = [...new Set(timelineMeses.map(m => m.ano))];
  const anoReferencia = timelineMeses[0]?.ano || anoAtivo || 2026;

  // ── Grupos & itens ───────────────────────────────────────────────────────────
  // Os grupos base vêm das colunas. Os itens de cada grupo vêm do localStorage.
  const getGrupos = () => {
    const saved = timelineYears
      .map(ano => dados?.[ano]?.[chave]?.grupos)
      .find(entry => entry && entry.length > 0);
    const colunaKeys = colunas.map(c => c.key);
    if (saved && saved.length > 0) {
      const savedKeys = saved.map(g => g.key);
      const match = colunaKeys.length === savedKeys.length &&
        colunaKeys.every(k => savedKeys.includes(k));
      if (match) return saved;
      // Colunas mudaram — reconstrói preservando itens onde a chave ainda existe
      return colunas.map(c => {
        const existing = saved.find(g => g.key === c.key);
        return { key: c.key, label: c.label, tipo: c.tipo, auto: c.auto, itens: existing?.itens || [] };
      });
    }
    return colunas.map(c => ({ key: c.key, label: c.label, tipo: c.tipo, auto: c.auto, itens: [] }));
  };
  const grupos = getGrupos();

  useEffect(() => {
    setExpandido(prev => {
      const next = { ...prev };
      grupos.forEach(g => {
        if (g.auto && next[g.key] === undefined) next[g.key] = true;
      });
      return next;
    });
  }, [grupos]);

  const saveGrupos = (newGrupos) => {
    setDadosLocais(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const anosDestino = timelineYears.length > 0 ? timelineYears : [anoReferencia];
      anosDestino.forEach(ano => {
        if (!next[ano]) next[ano] = {};
        if (!next[ano][chave]) next[ano][chave] = { grupos: [], valores: {} };
        next[ano][chave].grupos = newGrupos;
      });
      saveManual(next);
      return next;
    });
  };

  const getVal = (ano, itemKey, mi, q) => dados?.[ano]?.[chave]?.valores?.[itemKey]?.[mi]?.[q] || 0;

  const setVal = (ano, itemKey, mi, q, v) => {
    const num = parseFloat((v || '0').replace(/\s/g,'').replace(',','.')) || 0;
    const valorAnterior = getVal(ano, itemKey, mi, q);
    if (num === valorAnterior) { setEditCell(null); return; }
    const grupo = grupos.find(g => (g.itens||[]).some(i => i.key === itemKey));
    const item = grupo?.itens?.find(i => i.key === itemKey);
    if (onPendingChange) {
      // Modo simulação global — passa para o pai
      onPendingChange({
        chave, anoSel: ano, itemKey, mi, q,
        valorNovo: num, valorAnterior,
        itemLabel: item?.label || itemKey,
        grupoLabel: grupo?.label || chave,
        tipo: grupo?.tipo || 'saida',
      });
      setEditCell(null);
      showToast('👁 Simulação activa — verifica o impacto e valida');
    } else {
      // Fallback: guarda directamente
      setDadosLocais(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        if (!next[ano]) next[ano] = {};
        if (!next[ano][chave]) next[ano][chave] = { grupos: getGrupos(), valores: {} };
        if (!next[ano][chave].valores) next[ano][chave].valores = {};
        if (!next[ano][chave].valores[itemKey]) next[ano][chave].valores[itemKey] = Array(12).fill(null).map(() => [0,0]);
        next[ano][chave].valores[itemKey][mi][q] = num;
        saveManual(next);
        return next;
      });
      setEditCell(null);
      showToast('✓ Guardado');
    }
  };

  const adicionarItem = (grupoKey) => {
    if (!novoItem.label.trim()) return;
    const itemKey = `${grupoKey}_${Date.now()}`;
    const newGrupos = grupos.map(g => g.key === grupoKey
      ? { ...g, itens: [...(g.itens || []), { key: itemKey, label: novoItem.label.trim(), origem: novoItem.origem.trim() || '' }] }
      : g
    );
    saveGrupos(newGrupos);
    setAddingTo(null);
    setNovoItem({ label: '', origem: '' });
    setExpandido(e => ({ ...e, [grupoKey]: true }));
    showToast('✓ Adicionado');
  };

  const removerItem = (grupoKey, itemKey) => {
    const newGrupos = grupos.map(g => g.key === grupoKey
      ? { ...g, itens: g.itens.filter(i => i.key !== itemKey) }
      : g
    );
    saveGrupos(newGrupos);
    showToast('Removido');
  };

  const updateItemLabel = (grupoKey, itemKey, newLabel, newOrigem) => {
    const newGrupos = grupos.map(g => g.key === grupoKey
      ? { ...g, itens: g.itens.map(i => i.key === itemKey ? { ...i, label: newLabel, origem: newOrigem !== undefined ? newOrigem : i.origem } : i) }
      : g
    );
    saveGrupos(newGrupos);
    setEditLabel(null);
    showToast('✓ Guardado');
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // Totais
  const totalItem = (itemKey) => timelineMeses.reduce((s, col) => s + getVal(col.ano, itemKey, col.mi, 0) + getVal(col.ano, itemKey, col.mi, 1), 0);
  const totalGrupo = (g) => (g.itens || []).reduce((s, i) => s + totalItem(i.key), 0);
  const totalGrupoQ = (g, ano, mi, q) => (g.itens || []).reduce((s, i) => s + getVal(ano, i.key, mi, q), 0);
  const totalGeralQ = (ano, mi, q) => grupos.reduce((s, g) => s + totalGrupoQ(g, ano, mi, q), 0);
  const totalGeral = () => grupos.reduce((s, g) => s + totalGrupo(g), 0);
  const totalEntradas = () => grupos.filter(g => g.tipo === 'entrada').reduce((s, g) => s + totalGrupo(g), 0);
  const totalSaidas = () => grupos.filter(g => g.tipo === 'saida').reduce((s, g) => s + totalGrupo(g), 0);

  const fmtV = (v) => v === 0 ? '—' : v.toLocaleString('pt-PT') + ' €';
  const fmtT = (v, tipo) => v === 0 ? '—' : (tipo === 'entrada' ? '+' : '−') + v.toLocaleString('pt-PT') + ' €';

  const STICKY = { position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.07)' };
  const TH = {
    fontSize: 10, fontWeight: 700, textAlign: 'right', padding: '7px 8px',
    background: 'var(--bg-app)', borderRight: '0.5px solid var(--border)',
    borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)',
    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
    position: 'sticky', top: 0, zIndex: 4,
  };
  const LABEL_W = 280;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--color-success)', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{titulo}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periodoLabel || descricao}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', borderLeft: '0.5px solid var(--border)', paddingLeft: 10, display: 'flex', gap: 12 }}>
              <span>Entradas: <strong style={{ color: 'var(--color-success)' }}>{fmtV(totalEntradas())}</strong></span>
              <span>Saídas: <strong style={{ color: 'var(--color-danger)' }}>{fmtV(totalSaidas())}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Grelha */}
      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 310px)' }}>
        <table id="tes-tabela-resumo" style={{ borderCollapse: 'collapse', width: '100%', minWidth: LABEL_W + timelineMeses.length * 2 * 100 + 120 }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left', minWidth: LABEL_W, ...STICKY, zIndex: 5, background: 'var(--bg-app)' }}>Rubrica</th>
              {timelineMeses.map(col => (
                <th key={`${col.ano}-${col.mi}`} colSpan={2} style={{ ...TH, textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--brand-primary)', fontWeight: 700 }}>
                  {col.label} {col.ano}
                </th>
              ))}
              <th style={{ ...TH, borderLeft: '1px solid var(--border)', minWidth: 130 }}>TOTAL PERÍODO</th>
            </tr>
            <tr>
              <th style={{ ...TH, textAlign: 'left', ...STICKY, zIndex: 3, background: 'var(--bg-app)' }} />
              {timelineMeses.flatMap((col) => ['1–15','16–fim'].map((q, qi) => (
                <th key={`${col.ano}-${col.mi}-${qi}`} style={{ ...TH, fontSize: 10, color: 'var(--text-muted)', borderLeft: qi===0 ? '1px solid var(--border)' : undefined }}>{q}</th>
              )))}
              <th style={{ ...TH, borderLeft: '1px solid var(--border)' }} />
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo, gi) => {
              const isEntrada = grupo.tipo === 'entrada';
              const exp = expandido[grupo.key];
              const gTotal = totalGrupo(grupo);
              const grupoBg = isEntrada ? '#edf7f1' : gi % 2 === 0 ? 'var(--bg-app)' : '#faf8f8';
              const itemBg  = isEntrada ? '#f5fbf8' : '#fef9f9';

              return (
                <React.Fragment key={grupo.key}>
                  {/* ── Linha de grupo ── */}
                  <tr style={{ background: grupoBg }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: grupoBg, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setExpandido(e => ({ ...e, [grupo.key]: !e[grupo.key] }))}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, opacity: 0.5, width: 12 }}>{exp ? '▼' : '▶'}</span>
                        <span style={{ color: isEntrada ? 'var(--color-success)' : 'var(--text-primary)' }}>{grupo.label}</span>
                        {grupo.auto && <span style={{ fontSize: 10, background: '#2E7D52', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 400 }}>auto</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 2 }}>({(grupo.itens||[]).length} itens)</span>
                      </div>
                    </td>
                    {timelineMeses.flatMap((col) => [0,1].map(qi => {
                      const v = totalGrupoQ(grupo, col.ano, col.mi, qi);
                      return (
                        <td key={`${col.ano}-${col.mi}-${qi}`} style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '0.5px solid var(--border)', borderRight: qi===1 ? '1px solid var(--border)' : '0.5px solid var(--border)', borderLeft: qi===0 ? '1px solid var(--border)' : undefined, fontWeight: 600, fontSize: 12, color: v > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
                          {v > 0 ? (isEntrada ? '+' : '−') + v.toLocaleString('pt-PT') + ' €' : '—'}
                        </td>
                      );
                    }))}
                    <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '0.5px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 700, fontSize: 12, color: gTotal > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)', background: gTotal > 0 ? (isEntrada ? 'rgba(46,125,82,0.08)' : 'rgba(184,50,50,0.06)') : undefined }}>
                      {fmtT(gTotal, grupo.tipo)}
                    </td>
                  </tr>

                  {/* ── Itens expandidos ── */}
                  {exp && (grupo.itens || []).map((item, ii) => {
                    const iTotal = totalItem(item.key);
                    const isEdit = editLabel?.itemKey === item.key;
                    return (
                      <tr key={item.key} style={{ background: itemBg }}>
                        <td style={{ padding: '6px 12px 6px 36px', fontSize: 12, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: itemBg }}>
                          {isEdit ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input autoFocus defaultValue={item.label}
                                id={`lbl_${item.key}`}
                                style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, padding: '3px 6px', border: '1.5px solid var(--brand-primary)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)' }}
                                onKeyDown={e => { if (e.key === 'Escape') setEditLabel(null); }}
                              />
                              <input defaultValue={item.origem}
                                id={`orig_${item.key}`}
                                placeholder="origem"
                                style={{ width: 100, fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 6px', border: '1.5px solid var(--border-strong)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                              />
                              <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => {
                                  const l = document.getElementById(`lbl_${item.key}`)?.value || item.label;
                                  const o = document.getElementById(`orig_${item.key}`)?.value || item.origem;
                                  updateItemLabel(grupo.key, item.key, l, o);
                                }}>✓</button>
                              <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditLabel(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ opacity: 0.3, fontSize: 10 }}>└</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
                                  onClick={() => setEditLabel({ itemKey: item.key, grupoKey: grupo.key })}>
                                  {item.label}
                                  <span style={{ fontSize: 10, opacity: 0.3, marginLeft: 4 }}>✎</span>
                                </span>
                                {item.origem && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8, opacity: 0.7 }}>{item.origem}</span>}
                              </div>
                              <button onClick={() => removerItem(grupo.key, item.key)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, opacity: 0.4, padding: '0 4px', lineHeight: 1 }}
                                onMouseEnter={e => e.currentTarget.style.opacity='1'}
                                onMouseLeave={e => e.currentTarget.style.opacity='0.4'}
                              >✕</button>
                            </div>
                          )}
                        </td>
                        {timelineMeses.flatMap((col) => [0,1].map(qi => {
                          const v = getVal(col.ano, item.key, col.mi, qi);
                          const isEditing = editCell?.itemKey === item.key && editCell?.ano === col.ano && editCell?.mi === col.mi && editCell?.q === qi;
                          return (
                            <td key={`${col.ano}-${col.mi}-${qi}`}
                              style={{ padding: '5px 8px', borderBottom: '0.5px solid var(--border)', borderRight: qi===1 ? '1px solid var(--border)' : '0.5px solid var(--border)', borderLeft: qi===0 ? '1px solid var(--border)' : undefined, textAlign: 'right', cursor: 'pointer', minWidth: 95 }}
                              onClick={() => !isEditing && setEditCell({ itemKey: item.key, ano: col.ano, mi: col.mi, q: qi })}
                            >
                              {isEditing ? (
                                <input autoFocus defaultValue={v > 0 ? String(v) : ''}
                                  style={{ width: '100%', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 4px', border: '1.5px solid var(--brand-primary)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)' }}
                                  onBlur={e => setVal(col.ano, item.key, col.mi, qi, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') setVal(col.ano, item.key, col.mi, qi, e.target.value); if (e.key === 'Escape') setEditCell(null); }}
                                />
                              ) : (
                                <span style={{ fontSize: 12, color: v > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)', fontFamily: v > 0 ? 'var(--font-mono)' : 'inherit' }}>
                                  {v > 0 ? (isEntrada ? '+' : '−') + v.toLocaleString('pt-PT') + ' €' : <span style={{ opacity: 0.2, fontSize: 11 }}>+ inserir</span>}
                                </span>
                              )}
                            </td>
                          );
                        }))}
                        <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '0.5px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: 600, fontSize: 12, color: iTotal > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
                          {fmtT(iTotal, grupo.tipo)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── Linha de adicionar item ── */}
                  {exp && (
                    addingTo === grupo.key ? (
                      <tr style={{ background: itemBg }}>
                        <td colSpan={timelineMeses.length * 2 + 2} style={{ padding: '8px 36px', borderBottom: '0.5px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input autoFocus value={novoItem.label} onChange={e => setNovoItem(n => ({ ...n, label: e.target.value }))}
                              placeholder="Nome do item (ex: Casa PG, Viatura Toyota…)"
                              style={{ flex: 2, fontFamily: 'var(--font-body)', fontSize: 13, padding: '5px 10px', border: '1.5px solid var(--brand-primary)', borderRadius: 6, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              onKeyDown={e => { if (e.key === 'Enter') adicionarItem(grupo.key); if (e.key === 'Escape') { setAddingTo(null); setNovoItem({ label:'', origem:'' }); } }}
                            />
                            <input value={novoItem.origem} onChange={e => setNovoItem(n => ({ ...n, origem: e.target.value }))}
                              placeholder="Origem / banco (opcional)"
                              style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 6, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => adicionarItem(grupo.key)}>Adicionar</button>
                            <button className="btn btn-sm" onClick={() => { setAddingTo(null); setNovoItem({ label:'', origem:'' }); }}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr style={{ background: itemBg }}>
                        <td colSpan={timelineMeses.length * 2 + 2} style={{ padding: '5px 36px', borderBottom: '0.5px solid var(--border)' }}>
                          <button onClick={() => setAddingTo(grupo.key)}
                            style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brand-primary)', background: 'none', border: '0.5px dashed var(--brand-primary)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', opacity: 0.7 }}
                            onMouseEnter={e => e.currentTarget.style.opacity='1'}
                            onMouseLeave={e => e.currentTarget.style.opacity='0.7'}
                          >+ Adicionar item a «{grupo.label}»</button>
                        </td>
                      </tr>
                    )
                  )}
                </React.Fragment>
              );
            })}

            {/* Total geral */}
            <tr style={{ background: 'var(--brand-primary)' }}>
              <td style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', borderRight: '0.5px solid rgba(255,255,255,0.2)', ...STICKY, background: 'var(--brand-primary)', zIndex: 1 }}>Total Geral</td>
              {timelineMeses.flatMap((col) => [0,1].map(qi => {
                const v = totalGeralQ(col.ano, col.mi, qi);
                return (
                  <td key={`${col.ano}-${col.mi}-${qi}`} style={{ padding: '9px 10px', textAlign: 'right', borderRight: qi===1 ? '1px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.1)', borderLeft: qi===0 ? '1px solid rgba(255,255,255,0.15)' : undefined, fontWeight: 700, fontSize: 12, color: v > 0 ? '#ffdddd' : 'rgba(255,255,255,0.4)', background: 'var(--brand-primary)' }}>
                    {v > 0 ? `${v.toLocaleString('pt-PT')} €` : '—'}
                  </td>
                );
              }))}
              <td style={{ padding: '9px 10px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 13, color: totalGeral() > 0 ? '#ffdddd' : 'rgba(255,255,255,0.4)', background: 'var(--brand-primary)' }}>
                {totalGeral() > 0 ? totalGeral().toLocaleString('pt-PT') + ' €' : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RESUMO GRELHA ────────────────────────────────────────────────────────────
const RESUMO_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const LS_RESUMO = 'sis_tesouraria_resumo';

function loadResumo() {
  try { return JSON.parse(localStorage.getItem(LS_RESUMO) || '{}'); } catch { return {}; }
}
function saveResumo(data) { localStorage.setItem(LS_RESUMO, JSON.stringify(data)); }

// Grupos default na primeira abertura
// manualChave: chave do sis_tesouraria_manual; manualGrupo: key do grupo específico (null = todos)
const RESUMO_GRUPOS_DEFAULT = withDemoSeed([
  { key: 'clientes',              label: 'Clientes',                 tipo: 'entrada', auto: true,  itens: [] },
  { key: 'financiamentos_ent',    label: 'Financiamentos (entrada)', tipo: 'entrada', auto: 'manual', manualChave: 'financiamentos', manualGrupo: 'financiamentos_entrada', itens: [] },
  { key: 'investimentos_ent',     label: 'Investimentos (entrada)',  tipo: 'entrada', auto: 'manual', manualChave: 'investimentos',  manualGrupo: 'investimentos_entrada',  itens: [] },
  { key: 'fornecedores',          label: 'Fornecedores',             tipo: 'saida',   auto: true,  itens: [] },
  { key: 'financiamentos_sai',    label: 'Financiamentos (saída)',   tipo: 'saida',   auto: 'manual', manualChave: 'financiamentos', manualGrupo: 'financiamentos_saida',  itens: [] },
  { key: 'investimentos_sai',     label: 'Investimentos (saída)',    tipo: 'saida',   auto: 'manual', manualChave: 'investimentos',  manualGrupo: 'investimentos_saida',   itens: [] },
  { key: 'colaboradores',         label: 'Colaboradores',            tipo: 'saida',   auto: 'manual', manualChave: 'colaboradores',  manualGrupo: null,                    itens: [] },
  { key: 'impostos',              label: 'Impostos',           tipo: 'saida',   auto: 'manual', manualChave: 'impostos',       manualGrupo: null,                    itens: [] },
  { key: 'diversos',              label: 'Diversos',                 tipo: 'saida',   auto: 'manual', manualChave: 'diversos',       manualGrupo: null,                    itens: [] },
]);

function ResumoGrelha({ pagamentos, recebimentos, anoAtivo, dadosSimulados, temSimulacao, vistaGlobal, mesGlobal, quinzenaGlobal, canEditPrevDatas = false, onUpdateRecebimentoPrev = null }) {
  const navigate = useNavigate();
  const [anoSel, setAnoSel]       = useState(anoAtivo || 2026);
  const [numMeses, setNumMeses]   = useState(6);
  const [vistaLocal, setVistaLocal] = useState('quinzenal');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const vista = vistaGlobal || vistaLocal;
  const setVista = setVistaLocal;
  const [dados, setDados]         = useState(() => loadResumo());
  const [expandido, setExpandido] = useState({});
  const [editCell, setEditCell]   = useState(null);
  const [addingTo, setAddingTo]   = useState(null);
  const [novoItem, setNovoItem]   = useState({ label: '', origem: '' });
  const [editLabel, setEditLabel] = useState(null); // {tipo: 'grupo'|'item', key, grupoKey?}
  const [addingGrupo, setAddingGrupo] = useState(null); // 'entrada' | 'saida' | null
  const [novoGrupo, setNovoGrupo]     = useState({ label: '', tipo: 'saida' });
  const [toast, setToast]         = useState(null);
  const [recebimentoDateEdit, setRecebimentoDateEdit] = useState(null);
  const [recebimentosCellPicker, setRecebimentosCellPicker] = useState(null);
  const [resumoInfoDetail, setResumoInfoDetail] = useState(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const recebimentoDateInputRef = useRef(null);
  const resumoScrollRef = useRef(null);
  const resumoFullscreenScrollRef = useRef(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };
  const timelineYears = [2025, 2026, 2027];
  const meses = RESUMO_MESES;
  const hoje = new Date();
  const anoReal = hoje.getFullYear();
  const mesActualIdx = hoje.getMonth();
  const quinzenaActualIdx = hoje.getDate() <= 15 ? 0 : 1;
  // Colunas da grelha dependem da vista seleccionada
  const colunas = vista === 'quinzenal'
    ? timelineYears.flatMap(ano => meses.flatMap((m, mi) => [
        { label: '1–15',   mes: m, mi, q: 0, span: false, ano },
        { label: '16–fim', mes: m, mi, q: 1, span: false, ano },
      ]))
    : vista === 'mensal'
    ? timelineYears.flatMap(ano => meses.map((m, mi) => ({ label: m, mes: m, mi, q: null, span: true, ano })))
    : timelineYears.map(ano => ({ label: String(ano), mes: 'Ano', mi: null, q: null, span: true, anual: true, ano }));
  // quinzenas alias para compatibilidade com saldos
  const quinzenas = colunas;
  const isMesActual = (mi) => mi === mesActualIdx;
  const isColunaActual = (mesLabel, q, ano) => {
    const mi = RESUMO_MESES.indexOf(mesLabel);
    if (ano !== anoReal || mi !== mesActualIdx) return false;
    if (vista === 'quinzenal') return q === quinzenaActualIdx;
    return true;
  };

  // ── Grupos ──────────────────────────────────────────────────────────────────
  const getGrupos = () => {
    const saved = dados?.[anoSel]?.grupos;
    if (saved && saved.length > 0) return saved;
    return RESUMO_GRUPOS_DEFAULT;
  };
  const grupos = getGrupos();

  useEffect(() => {
    setExpandido(prev => {
      const next = { ...prev };
      grupos.forEach(g => {
        if (g.auto && next[g.key] === undefined) next[g.key] = true;
      });
      return next;
    });
  }, [grupos]);

  const saveGrupos = (newGrupos) => {
    setDados(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[anoSel]) next[anoSel] = { grupos: [], valores: {} };
      next[anoSel].grupos = newGrupos;
      saveResumo(next);
      return next;
    });
  };

  // ── Valores ─────────────────────────────────────────────────────────────────
  // Grupos automáticos (Clientes, Fornecedores) calculam dos dados reais
  const MES_NUM = { Jan:0,Fev:1,Mar:2,Abr:3,Mai:4,Jun:5,Jul:6,Ago:7,Set:8,Out:9,Nov:10,Dez:11 };
  const extractYear = (...values) => {
    for (const value of values) {
      const str = String(value || '');
      const iso = str.match(/\b(20\d{2})-\d{2}-\d{2}\b/);
      if (iso) return parseInt(iso[1], 10);
      const slash = str.match(/\b\d{1,2}\/\d{1,2}\/(20\d{2})\b/);
      if (slash) return parseInt(slash[1], 10);
      const year = str.match(/\b(20\d{2})\b/);
      if (year) return parseInt(year[1], 10);
    }
    return anoReal || anoAtivo || anoSel || 2026;
  };
  const parseDia = (str, fallbackYear = anoReal) => {
    if (!str || str === '—') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      return { dia: day, mi: month - 1, ano: year };
    }
    const slashFull = str.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (slashFull) return { dia: parseInt(slashFull[1]), mi: parseInt(slashFull[2], 10) - 1, ano: parseInt(slashFull[3], 10) };
    const m1 = str.match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (m1) return { dia: parseInt(m1[1]), mi: MES_NUM[m1[2]] ?? -1, ano: fallbackYear };
    const m2 = str.match(/(\d{1,2})\/(\d{1,2})/);
    if (m2) return { dia: parseInt(m2[1]), mi: parseInt(m2[2]) - 1, ano: fallbackYear };
    return null;
  };
  const createYearBuckets = () => Object.fromEntries(timelineYears.map(ano => [ano, Array(12).fill(null).map(() => [0,0])]));
  const valCli = createYearBuckets();
  recebimentos.forEach(r => {
    const fallbackYear = extractYear(r.dataEmissao, r.prevRecebimento, r.nFatura, r.id);
    const d = parseDia(r.prevRecebimento || r.dataEmissao || '', fallbackYear);
    if (!d || d.mi < 0 || d.mi > 11) return;
    if (!valCli[d.ano]) valCli[d.ano] = Array(12).fill(null).map(() => [0,0]);
    valCli[d.ano][d.mi][d.dia <= 15 ? 0 : 1] += r.valor || 0;
  });
  const valForn = createYearBuckets();
  pagamentos.forEach(p => {
    const fallbackYear = extractYear(p.dataFatura, p.prevPagamento, p.nFatura, p.id);
    const d = parseDia(p.prevPagamento || p.dataFatura || '', fallbackYear);
    if (!d || d.mi < 0 || d.mi > 11) return;
    if (!valForn[d.ano]) valForn[d.ano] = Array(12).fill(null).map(() => [0,0]);
    valForn[d.ano][d.mi][d.dia <= 15 ? 0 : 1] += p.valor || 0;
  });

  // Lê do sis_tesouraria_manual (ou dadosSimulados) para grupos auto='manual'
  const manualData = dadosSimulados || (() => { try { return JSON.parse(localStorage.getItem('sis_tesouraria_manual') || '{}'); } catch { return {}; } })();

  const getManualGrupoVal = (manualChave, manualGrupo, ano, mi, q) => {
    const cat = manualData?.[ano]?.[manualChave];
    if (!cat) return 0;
    const grupos_m = cat.grupos || [];
    const alvo = manualGrupo ? grupos_m.filter(g => g.key === manualGrupo) : grupos_m;
    return alvo.reduce((s, grupo) => {
      return s + (grupo.itens || []).reduce((s2, item) => {
        return s2 + (cat.valores?.[item.key]?.[mi]?.[q] || 0);
      }, 0);
    }, 0);
  };

  const getAutoVal = (g, ano, mi, q) => {
    if (g.key === 'clientes')     return valCli[ano]?.[mi]?.[q] || 0;
    if (g.key === 'fornecedores') return valForn[ano]?.[mi]?.[q] || 0;
    if (g.auto === 'manual')      return getManualGrupoVal(g.manualChave, g.manualGrupo, ano, mi, q);
    return 0;
  };

  const getVal = (ano, itemKey, mi, q) => dados?.[ano]?.valores?.[itemKey]?.[mi]?.[q] || 0;

  const setVal = (ano, itemKey, mi, q, v) => {
    const num = parseFloat((v || '0').replace(/\s/g,'').replace(',','.')) || 0;
    setDados(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[ano]) next[ano] = { grupos: getGrupos(), valores: {} };
      if (!next[ano].valores) next[ano].valores = {};
      if (!next[ano].valores[itemKey]) next[ano].valores[itemKey] = Array(12).fill(null).map(() => [0,0]);
      next[ano].valores[itemKey][mi][q] = num;
      saveResumo(next);
      return next;
    });
    setEditCell(null);
    showToast('✓ Guardado');
  };

  // ── CRUD Grupos ─────────────────────────────────────────────────────────────
  const adicionarGrupo = () => {
    if (!novoGrupo.label.trim()) return;
    const key = `grupo_${Date.now()}`;
    saveGrupos([...grupos, { key, label: novoGrupo.label.trim(), tipo: novoGrupo.tipo, auto: false, itens: [] }]);
    setAddingGrupo(null);
    setNovoGrupo({ label: '', tipo: 'saida' });
    showToast('✓ Grupo adicionado');
  };

  const removerGrupo = (grupoKey) => {
    saveGrupos(grupos.filter(g => g.key !== grupoKey));
    showToast('Grupo removido');
  };

  const updateGrupoLabel = (grupoKey, newLabel, newTipo) => {
    saveGrupos(grupos.map(g => g.key === grupoKey ? { ...g, label: newLabel, tipo: newTipo ?? g.tipo } : g));
    setEditLabel(null);
    showToast('✓ Guardado');
  };

  // ── CRUD Itens ──────────────────────────────────────────────────────────────
  const adicionarItem = (grupoKey) => {
    if (!novoItem.label.trim()) return;
    const itemKey = `${grupoKey}_${Date.now()}`;
    saveGrupos(grupos.map(g => g.key === grupoKey
      ? { ...g, itens: [...(g.itens || []), { key: itemKey, label: novoItem.label.trim(), origem: novoItem.origem.trim() }] }
      : g
    ));
    setAddingTo(null);
    setNovoItem({ label: '', origem: '' });
    setExpandido(e => ({ ...e, [grupoKey]: true }));
    showToast('✓ Adicionado');
  };

  const removerItem = (grupoKey, itemKey) => {
    saveGrupos(grupos.map(g => g.key === grupoKey
      ? { ...g, itens: g.itens.filter(i => i.key !== itemKey) }
      : g
    ));
    showToast('Removido');
  };

  const updateItemLabel = (grupoKey, itemKey, newLabel) => {
    saveGrupos(grupos.map(g => g.key === grupoKey
      ? { ...g, itens: g.itens.map(i => i.key === itemKey ? { ...i, label: newLabel } : i) }
      : g
    ));
    setEditLabel(null);
    showToast('✓ Guardado');
  };

  // ── Totais ───────────────────────────────────────────────────────────────────
  // getColVal: lê o valor de um grupo para uma coluna (quinzenal, mensal ou anual)
  const getColVal = (g, col) => {
    if (col.anual) {
      return meses.reduce((s, _, mi) => s + _getGQ(g, col.ano, mi, 0) + _getGQ(g, col.ano, mi, 1), 0);
    }
    if (col.q === null) {
      return _getGQ(g, col.ano, col.mi, 0) + _getGQ(g, col.ano, col.mi, 1);
    }
    return _getGQ(g, col.ano, col.mi, col.q);
  };
  const _getGQ = (g, ano, mi, q) => {
    if (g.auto) return getAutoVal(g, ano, mi, q);
    return (g.itens || []).reduce((s, i) => s + getVal(ano, i.key, mi, q), 0);
  };
  // Mantém alias para compatibilidade
  const totalGrupoQ = (g, ano, mi, q) => _getGQ(g, ano, mi, q);
  const totalGrupo = (g) => timelineYears.reduce((sum, ano) => sum + meses.reduce((s, _, mi) => s + _getGQ(g, ano, mi, 0) + _getGQ(g, ano, mi, 1), 0), 0);
  const totalEntradasCol = (col) => grupos.filter(g => g.tipo === 'entrada').reduce((s, g) => s + getColVal(g, col), 0);
  const totalSaidasCol   = (col) => grupos.filter(g => g.tipo === 'saida').reduce((s, g) => s + getColVal(g, col), 0);
  const totalEntradas = (ano, mi, q) => grupos.filter(g => g.tipo === 'entrada').reduce((s, g) => s + _getGQ(g, ano, mi, q), 0);
  const totalSaidas   = (ano, mi, q) => grupos.filter(g => g.tipo === 'saida').reduce((s,   g) => s + _getGQ(g, ano, mi, q), 0);

  let acum = 0;
  const saldos = colunas.map((col) => {
    const s = totalEntradasCol(col) - totalSaidasCol(col);
    acum += s;
    return { quinzenal: s, acumulado: acum };
  });

  // ── Estilos ──────────────────────────────────────────────────────────────────
  const STICKY = { position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 5px rgba(0,0,0,0.07)' };
  const LABEL_W = 220;
  const Q_W = 100;
  const thStyle = (highlight) => ({
    padding: '7px 8px', fontSize: 10, fontWeight: 700, textAlign: 'right',
    background: highlight ? '#dce8f0' : 'var(--bg-app)',
    borderRight: highlight ? '1px solid var(--border)' : '0.5px solid var(--border)',
    borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)',
    whiteSpace: 'nowrap', minWidth: Q_W, textTransform: 'uppercase', letterSpacing: '0.04em',
    position: 'sticky', top: 0, zIndex: 4,
  });
  const tdStyle = (highlight) => ({
    padding: '7px 10px', fontSize: 12, textAlign: 'right',
    borderRight: highlight ? '1px solid var(--border)' : '0.5px solid var(--border)',
    borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap',
  });
  const fmtS = (v) => v === 0 ? '—' : (v > 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-PT') + ' €';
  const activeColumnBg = '#eef0f3';
  const activeColumnBgStrong = '#e4e7eb';
  const resumoMonthHeaderStyle = () => ({
    ...thStyle(false),
    textAlign: 'center',
    borderLeft: '1px solid var(--border)',
    color: 'var(--brand-primary)',
    fontWeight: 700,
    background: 'var(--bg-app)',
  });
  const resumoColumnHeaderStyle = (col) => {
    const active = isColunaActual(col.mes, col.q, col.ano);
    return {
      ...thStyle(col.q===1),
      borderLeft: (col.q===0||col.q===null||col.anual) ? '1px solid var(--border)' : undefined,
      fontSize: 10,
      textAlign: 'center',
      color: 'var(--text-muted)',
      background: active ? activeColumnBgStrong : (col.q===1 ? '#dce8f0' : 'var(--bg-app)'),
    };
  };
  const resumoColumnCellBg = (col, baseBg = null) => {
    if (!isColunaActual(col.mes, col.q, col.ano)) return baseBg;
    return baseBg === '#e0f2ea' || baseBg === '#fce8e8' ? activeColumnBgStrong : activeColumnBg;
  };
  const activeResumoColIndex = Math.max(0, colunas.findIndex(col => isColunaActual(col.mes, col.q, col.ano)));

  const recebimentoInCol = (recebimento, col) => {
    const fallbackYear = extractYear(recebimento.prevRecebimento, recebimento.dataEmissao, recebimento.nFatura, recebimento.id);
    const d = parseDia(recebimento.prevRecebimento || recebimento.dataEmissao || '', fallbackYear);
    if (!d) return false;
    if (col.anual) return col.ano === d.ano;
    if (col.q === null) return col.ano === d.ano && col.mi === d.mi;
    return col.ano === d.ano && col.mi === d.mi && col.q === (d.dia <= 15 ? 0 : 1);
  };

  const getRecebimentosForCol = (col) => recebimentos.filter(r => recebimentoInCol(r, col));
  const getPagamentosForCol = (col) => pagamentos.filter(p => {
    const fallbackYear = extractYear(p.prevPagamento, p.dataFatura, p.nFatura, p.id);
    const d = parseDia(p.prevPagamento || p.dataFatura || '', fallbackYear);
    if (!d) return false;
    if (col.anual) return col.ano === d.ano;
    if (col.q === null) return col.ano === d.ano && col.mi === d.mi;
    return col.ano === d.ano && col.mi === d.mi && col.q === (d.dia <= 15 ? 0 : 1);
  });

  const openRecebimentoEditor = (recebimento) => {
    setRecebimentoDateEdit({
      recebimentoId: recebimento.id,
      nome: `${recebimento.cliente} — ${recebimento.nFatura || recebimento.id}`,
      currentDate: /^\d{4}-\d{2}-\d{2}$/.test(recebimento.prevRecebimento || '') ? recebimento.prevRecebimento : '',
    });
  };

  const handleClientesCellClick = (col) => {
    if (!canEditPrevDatas) return;
    const matches = getRecebimentosForCol(col);
    handleRecebimentosItemsClick(matches);
  };

  const handleRecebimentosItemsClick = (matches) => {
    if (!canEditPrevDatas) return;
    if (!matches.length) return;
    if (matches.length === 1) {
      openRecebimentoEditor(matches[0]);
      return;
    }
    setRecebimentosCellPicker({ items: matches });
  };

  const openResumoDetailFromItems = (title, items) => {
    if (!items?.length) return;
    setResumoInfoDetail({ title, items });
  };

  const goToResumoOrigin = (item) => {
    setResumoInfoDetail(null);
    if (item.tipo === 'recebimento') {
      navigate('/clientes', { state: item.clienteId ? { abrirFatura: { faturaId: item.id, clienteId: item.clienteId } } : undefined });
      return;
    }
    if (item.tipo === 'pagamento') {
      navigate('/fornecedores', { state: item.fornId ? { abrirFaturaForn: { faturaId: item.id, fornecedorId: item.fornId } } : undefined });
      return;
    }
  };

  useEffect(() => {
    const target = resumoScrollRef.current;
    if (!target) return;
    const viewportWidth = target.clientWidth || 0;
    const targetCenter = LABEL_W + (activeResumoColIndex * Q_W) + (Q_W / 2);
    const nextScrollLeft = Math.max(0, targetCenter - (viewportWidth / 2));
    target.scrollLeft = nextScrollLeft;
  }, [vista, activeResumoColIndex]);

  useEffect(() => {
    if (!showFullscreen) return;
    const target = resumoFullscreenScrollRef.current;
    if (!target) return;
    const viewportWidth = target.clientWidth || 0;
    const targetCenter = LABEL_W + (activeResumoColIndex * Q_W) + (Q_W / 2);
    const nextScrollLeft = Math.max(0, targetCenter - (viewportWidth / 2));
    target.scrollLeft = nextScrollLeft;
  }, [showFullscreen, vista, activeResumoColIndex]);

  useEffect(() => {
    if (!recebimentoDateEdit) return;
    const timer = setTimeout(() => {
      const input = recebimentoDateInputRef.current;
      if (!input) return;
      input.focus();
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch {}
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [recebimentoDateEdit]);

  // ── Render grupos ────────────────────────────────────────────────────────────
  const renderGrupo = (g) => {
    const isEntrada = g.tipo === 'entrada';
    const exp = expandido[g.key];
    const gTotal = totalGrupo(g);
    const grupoBg = isEntrada ? 'var(--bg-card)' : 'var(--bg-card)';
    const itemBg  = isEntrada ? '#f5fbf8' : '#fef9f9';
    const isEditG = editLabel?.tipo === 'grupo' && editLabel.key === g.key;

    return (
      <React.Fragment key={g.key}>
        <tr style={{ background: grupoBg }}>
          <td style={{ padding: '7px 10px 7px 12px', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: grupoBg, userSelect: 'none' }}>
            {isEditG ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input autoFocus id={`glbl_${g.key}`} defaultValue={g.label}
                  style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, padding: '3px 6px', border: '1.5px solid var(--brand-primary)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)' }}
                  onKeyDown={e => { if (e.key === 'Escape') setEditLabel(null); if (e.key === 'Enter') { updateGrupoLabel(g.key, document.getElementById(`glbl_${g.key}`)?.value || g.label); } }}
                />
                <select id={`gtipo_${g.key}`} defaultValue={g.tipo}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '3px 6px', border: '1.5px solid var(--border)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  <option value="entrada">↑ Entrada</option>
                  <option value="saida">↓ Saída</option>
                </select>
                <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => updateGrupoLabel(g.key, document.getElementById(`glbl_${g.key}`)?.value || g.label, document.getElementById(`gtipo_${g.key}`)?.value)}>✓</button>
                <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditLabel(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ cursor: 'pointer', fontSize: 11, opacity: 0.4, width: 12 }}
                  onClick={() => setExpandido(e => ({ ...e, [g.key]: !e[g.key] }))}>{exp ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: isEntrada ? 'var(--color-success)' : 'var(--text-primary)', cursor: 'pointer', flex: 1 }}
                  onClick={() => setExpandido(e => ({ ...e, [g.key]: !e[g.key] }))}>
                  {g.label}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>({(g.itens||[]).length} itens)</span>
                </span>
                {!g.auto && (
                  <div style={{ display: 'flex', gap: 3, opacity: 0, transition: 'opacity .15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity='1'}
                    onMouseLeave={e => e.currentTarget.style.opacity='0'}
                    className="grupo-actions">
                    <button onClick={() => setEditLabel({ tipo: 'grupo', key: g.key })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '0 3px' }} title="Renomear">✎</button>
                    <button onClick={() => removerGrupo(g.key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-danger)', padding: '0 3px', opacity: 0.6 }} title="Eliminar">✕</button>
                  </div>
                )}
              </div>
            )}
          </td>
          {colunas.map((col, ci) => {
            const v = getColVal(g, col);
            const isLast = col.q===1 || col.q===null || col.anual;
            const isFirst = col.q===0 || col.q===null || col.anual;
            return (
              <td
                key={col.mes+(col.q??'m')+ci}
                style={{ ...tdStyle(isLast), borderLeft: isFirst ? '1px solid var(--border)' : undefined,
                  background: resumoColumnCellBg(col),
                  fontWeight: 600,
                  color: v > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)',
                  cursor: g.key === 'clientes' && canEditPrevDatas && v > 0 ? 'pointer' : 'default',
                  textDecoration: g.key === 'clientes' && canEditPrevDatas && v > 0 ? 'underline dotted rgba(25,118,210,0.45)' : 'none',
                  textUnderlineOffset: g.key === 'clientes' && canEditPrevDatas && v > 0 ? 3 : undefined,
                }}
                onClick={() => {
                  if (g.key !== 'clientes' || !v) return;
                  handleClientesCellClick(col);
                }}
                title={g.key === 'clientes' && canEditPrevDatas && v > 0 ? 'Alterar data prevista dos recebimentos desta célula' : undefined}
              >
                {v > 0 ? (isEntrada ? '+' : '−') + v.toLocaleString('pt-PT') + ' €' : '—'}
              </td>
            );
          })}
        </tr>

        {/* Itens expandidos */}
        {exp && !g.auto && (g.itens || []).map(item => {
          const isEditI = editLabel?.tipo === 'item' && editLabel.key === item.key;
          return (
            <tr key={item.key} style={{ background: itemBg }}>
              <td style={{ padding: '5px 10px 5px 32px', fontSize: 12, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: itemBg }}>
                {isEditI ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input autoFocus id={`ilbl_${item.key}`} defaultValue={item.label}
                      style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, padding: '2px 6px', border: '1.5px solid var(--brand-primary)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)' }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditLabel(null); if (e.key === 'Enter') { updateItemLabel(g.key, item.key, document.getElementById(`ilbl_${item.key}`)?.value || item.label); } }}
                    />
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 7px' }}
                      onClick={() => updateItemLabel(g.key, item.key, document.getElementById(`ilbl_${item.key}`)?.value || item.label)}>✓</button>
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 7px' }} onClick={() => setEditLabel(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ opacity: 0.3, fontSize: 10 }}>└</span>
                    <span style={{ flex: 1, color: 'var(--text-secondary)', cursor: 'pointer' }}
                      onClick={() => setEditLabel({ tipo: 'item', key: item.key, grupoKey: g.key })}>
                      {item.label}<span style={{ fontSize: 10, opacity: 0.3, marginLeft: 4 }}>✎</span>
                    </span>
                    <button onClick={() => removerItem(g.key, item.key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-danger)', opacity: 0.4, padding: '0 3px' }}
                      onMouseEnter={e => e.currentTarget.style.opacity='1'}
                      onMouseLeave={e => e.currentTarget.style.opacity='0.4'}>✕</button>
                  </div>
                )}
              </td>
              {colunas.map((col, ci) => {
                const v = col.anual
                  ? meses.reduce((s, _, mi) => s + getVal(col.ano, item.key, mi, 0) + getVal(col.ano, item.key, mi, 1), 0)
                  : col.q === null ? getVal(col.ano, item.key, col.mi, 0) + getVal(col.ano, item.key, col.mi, 1)
                  : getVal(col.ano, item.key, col.mi, col.q);
                const isEditing = !col.anual && col.q !== null && editCell?.itemKey === item.key && editCell?.mi === col.mi && editCell?.q === col.q && editCell?.ano === col.ano;
                const isLast = col.q===1 || col.q===null || col.anual;
                const isFirst = col.q===0 || col.q===null || col.anual;
                return (
                  <td key={col.mes+(col.q??'m')+ci} style={{ ...tdStyle(isLast), borderLeft: isFirst ? '1px solid var(--border)' : undefined, background: resumoColumnCellBg(col, itemBg), cursor: (!col.anual && col.q !== null) ? 'pointer' : 'default', minWidth: Q_W }}
                    onClick={() => !col.anual && col.q !== null && !isEditing && setEditCell({ itemKey: item.key, ano: col.ano, mi: col.mi, q: col.q })}>
                    {isEditing ? (
                      <input autoFocus defaultValue={v > 0 ? String(v) : ''}
                        style={{ width: '100%', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 4px', border: '1.5px solid var(--brand-primary)', borderRadius: 4, outline: 'none', background: 'var(--bg-card)' }}
                        onBlur={e => setVal(col.ano, item.key, col.mi, col.q, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setVal(col.ano, item.key, col.mi, col.q, e.target.value); if (e.key === 'Escape') setEditCell(null); }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: v > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)', fontFamily: v > 0 ? 'var(--font-mono)' : 'inherit' }}>
                        {v > 0 ? (isEntrada ? '+' : '−') + v.toLocaleString('pt-PT') + ' €' : <span style={{ opacity: 0.2, fontSize: 11 }}>+ inserir</span>}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}

        {/* Sub-linhas automáticas */}
        {exp && g.auto && (() => {
          let subLinhas = [];

          if (g.key === 'clientes') {
            const subMap = {};
            recebimentos.forEach(x => {
              const nome = x.cliente || 'Cliente';
              if (!subMap[nome]) subMap[nome] = [];
              subMap[nome].push({ ...x, tipo: 'recebimento' });
            });
            subLinhas = Object.entries(subMap).map(([nome, items]) => ({
              nome,
              editavel: canEditPrevDatas,
              getDetails: (col) => items.filter(item => recebimentoInCol(item, col)),
              getV: (col) => items
                .filter(item => recebimentoInCol(item, col))
                .reduce((sum, item) => sum + (item.valor || 0), 0),
            }));
          } else if (g.key === 'fornecedores') {
            const subMap = {};
            pagamentos.forEach(x => {
              const nome = x.fornecedor;
              if (!subMap[nome]) subMap[nome] = [];
              subMap[nome].push({ ...x, tipo: 'pagamento' });
            });
            subLinhas = Object.entries(subMap).map(([nome, items]) => ({
              nome,
              getDetails: (col) => items.filter(item => getPagamentosForCol(col).some(p => p.id === item.id)),
              getV: (col) => items
                .filter(item => getPagamentosForCol(col).some(p => p.id === item.id))
                .reduce((sum, item) => sum + (item.valor || 0), 0),
            }));
          } else if (g.auto === 'manual' && g.manualChave) {
            // Manual: lê itens do sis_tesouraria_manual
            timelineYears.forEach(ano => {
              const cat = manualData?.[ano]?.[g.manualChave];
              if (!cat) return;
              const grupos_m = cat.grupos || [];
              const alvo = g.manualGrupo ? grupos_m.filter(gr => gr.key === g.manualGrupo) : grupos_m;
              alvo.forEach(grupo_m => {
                (grupo_m.itens || []).forEach(item => {
                  if (subLinhas.some(line => line.nome === (alvo.length > 1 ? `${grupo_m.label} — ${item.label}` : item.label))) return;
                  subLinhas.push({
                    nome: alvo.length > 1 ? `${grupo_m.label} — ${item.label}` : item.label,
                    getV: (col) => {
                      const vals = manualData?.[col.ano]?.[g.manualChave]?.valores?.[item.key];
                      if (!vals) return 0;
                      return col.anual
                        ? meses.reduce((s, _, mi) => s + (vals[mi]?.[0]||0) + (vals[mi]?.[1]||0), 0)
                        : col.q === null ? (vals[col.mi]?.[0]||0) + (vals[col.mi]?.[1]||0)
                        : vals[col.mi]?.[col.q] || 0;
                    },
                  });
                });
              });
            });
          }

          return subLinhas.map(({ nome, getV, getDetails, editavel }) => (
            <tr key={nome} style={{ background: itemBg }}>
              <td style={{ padding: '5px 10px 5px 32px', fontSize: 12, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: itemBg, color: 'var(--text-muted)' }}>
                <span style={{ opacity: 0.3, marginRight: 6, fontSize: 10 }}>└</span>{nome}
              </td>
              {colunas.map((col, ci) => {
                const v = getV(col);
                const details = getDetails ? getDetails(col) : [];
                const isLast = col.q===1 || col.q===null || col.anual;
                const isFirst = col.q===0 || col.q===null || col.anual;
                return (
                  <td
                    key={col.mes+(col.q??'m')+ci}
                    style={{
                      ...tdStyle(isLast),
                      borderLeft: isFirst ? '1px solid var(--border)' : undefined,
                      background: resumoColumnCellBg(col, itemBg),
                      fontSize: 11,
                      color: v > 0 ? (isEntrada ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)',
                      cursor: editavel && v > 0 ? 'pointer' : 'default',
                      textDecoration: editavel && v > 0 ? 'underline dotted rgba(25,118,210,0.45)' : 'none',
                      textUnderlineOffset: editavel && v > 0 ? 3 : undefined,
                    }}
                    onClick={() => {
                      if (!editavel || !v) return;
                      handleRecebimentosItemsClick(details.filter(item => item.clienteId));
                    }}
                    title={editavel && v > 0 ? 'Alterar data prevista' : undefined}
                  >
                    {v > 0 ? (
                      <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                        <span>{(isEntrada ? '+' : '−') + v.toLocaleString('pt-PT') + ' €'}</span>
                        {details.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openResumoDetailFromItems(nome, details);
                            }}
                            title="Ver origem do valor"
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              border: '0.5px solid var(--border-strong)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                              fontSize: 9,
                              lineHeight: '12px',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            i
                          </button>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                );
              })}
            </tr>
          ));
        })()}

        {/* Linha adicionar item */}
        {exp && !g.auto && (
          addingTo === g.key ? (
            <tr style={{ background: itemBg }}>
              <td colSpan={colunas.length + 1} style={{ padding: '7px 32px', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input autoFocus value={novoItem.label} onChange={e => setNovoItem(n => ({ ...n, label: e.target.value }))}
                    placeholder="Nome do item…"
                    style={{ flex: 2, fontFamily: 'var(--font-body)', fontSize: 13, padding: '5px 10px', border: '1.5px solid var(--brand-primary)', borderRadius: 6, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    onKeyDown={e => { if (e.key === 'Enter') adicionarItem(g.key); if (e.key === 'Escape') { setAddingTo(null); setNovoItem({ label: '', origem: '' }); } }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => adicionarItem(g.key)}>Adicionar</button>
                  <button className="btn btn-sm" onClick={() => { setAddingTo(null); setNovoItem({ label: '', origem: '' }); }}>Cancelar</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr style={{ background: itemBg }}>
              <td colSpan={colunas.length + 1} style={{ padding: '4px 32px', borderBottom: '0.5px solid var(--border)' }}>
                <button onClick={() => setAddingTo(g.key)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brand-primary)', background: 'none', border: '0.5px dashed var(--brand-primary)', borderRadius: 5, padding: '2px 10px', cursor: 'pointer', opacity: 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.opacity='1'}
                  onMouseLeave={e => e.currentTarget.style.opacity='0.6'}
                >+ Adicionar item a «{g.label}»</button>
              </td>
            </tr>
          )
        )}
      </React.Fragment>
    );
  };

  const entradas = grupos.filter(g => g.tipo === 'entrada');
  const saidas   = grupos.filter(g => g.tipo === 'saida');

  const renderResumoTabela = (isFullscreen = false) => (
    <div
      ref={isFullscreen ? resumoFullscreenScrollRef : resumoScrollRef}
      className="card"
      style={{ padding: 0, overflow: 'auto', maxHeight: isFullscreen ? 'none' : 'calc(100vh - 300px)', flex: isFullscreen ? 1 : undefined, minHeight: isFullscreen ? 0 : undefined }}
    >
      <table id="tes-tabela-resumo-q" style={{ width: '100%', borderCollapse: 'collapse', minWidth: LABEL_W + quinzenas.length * Q_W }}>
        <thead>
          {vista === 'quinzenal' && (
            <tr>
              <th style={{ ...thStyle(false), textAlign: 'left', minWidth: LABEL_W, ...STICKY, zIndex: 5, background: 'var(--bg-app)' }}>DESCRIÇÃO</th>
              {timelineYears.flatMap(ano => meses.map(m => (
                <th key={`${m}-${ano}`} colSpan={2} style={resumoMonthHeaderStyle()}>
                  {m.toUpperCase()} {ano}
                </th>
              )))}
            </tr>
          )}
          <tr>
            <th style={{ ...thStyle(false), textAlign: 'left', minWidth: LABEL_W, ...STICKY, zIndex: 5, background: 'var(--bg-app)' }}>{vista !== 'quinzenal' ? 'DESCRIÇÃO' : ''}</th>
            {colunas.map((col, ci) => (
              <th key={col.mes+(col.q??'m')+ci} style={resumoColumnHeaderStyle(col)}>
                {vista === 'quinzenal' ? col.label : col.anual ? String(anoSel) : `${col.label} ${anoSel}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '6px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-success)', background: '#edf7f1', borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', ...STICKY }}>▲ Entradas</td>
            {colunas.map((col, ci) => {
              const isLast=col.q===1||col.q===null||col.anual; const isFirst=col.q===0||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+ci} style={{ ...tdStyle(isLast), background: resumoColumnCellBg(col, 'rgba(46,125,82,0.04)'), borderLeft: isFirst ? '1px solid var(--border)' : undefined }} />;
            })}
          </tr>
          {entradas.map(g => renderGrupo(g))}
          <tr style={{ background: '#e0f2ea' }}>
            <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-success)', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: '#e0f2ea' }}>Total Entradas</td>
            {colunas.map((col, ci) => {
              const v = totalEntradasCol(col);
              const isLast = col.q===1||col.q===null||col.anual; const isFirst = col.q===0||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+ci} style={{ ...tdStyle(isLast), borderLeft: isFirst ? '1px solid var(--border)' : undefined, fontWeight: 700, color: 'var(--color-success)', background: resumoColumnCellBg(col, '#e0f2ea') }}>{v > 0 ? `${v.toLocaleString('pt-PT')} €` : '—'}</td>;
            })}
          </tr>
          <tr><td colSpan={colunas.length + 1} style={{ height: 3, background: 'var(--border)' }} /></tr>
          <tr>
            <td style={{ padding: '6px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-danger)', background: '#fdf0f0', borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', ...STICKY }}>▼ Saídas</td>
            {colunas.map((col, ci) => {
              const isLast=col.q===1||col.q===null||col.anual; const isFirst=col.q===0||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+ci} style={{ ...tdStyle(isLast), background: resumoColumnCellBg(col, 'rgba(184,50,50,0.04)'), borderLeft: isFirst ? '1px solid var(--border)' : undefined }} />;
            })}
          </tr>
          {saidas.map(g => renderGrupo(g))}
          <tr style={{ background: '#fce8e8' }}>
            <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-danger)', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: '#fce8e8' }}>Total Saídas</td>
            {colunas.map((col, ci) => {
              const v = totalSaidasCol(col);
              const isLast = col.q===1||col.q===null||col.anual; const isFirst = col.q===0||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+ci} style={{ ...tdStyle(isLast), borderLeft: isFirst ? '1px solid var(--border)' : undefined, fontWeight: 700, color: 'var(--color-danger)', background: resumoColumnCellBg(col, '#fce8e8') }}>{v > 0 ? `${v.toLocaleString('pt-PT')} €` : '—'}</td>;
            })}
          </tr>
          <tr><td colSpan={colunas.length + 1} style={{ height: 3, background: 'var(--border)' }} /></tr>
          <tr style={{ background: 'var(--bg-app)' }}>
            <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', ...STICKY, background: 'var(--bg-app)' }}>Saldo Quinzenal</td>
            {colunas.map((col, idx) => {
              const s = saldos[idx].quinzenal;
              const isLast = col.q===1||col.q===null||col.anual; const isFirst = col.q===0||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+idx} style={{ ...tdStyle(isLast), borderLeft: isFirst ? '1px solid var(--border)' : undefined, fontWeight: 700, color: s >= 0 ? 'var(--color-success)' : 'var(--color-danger)', background: resumoColumnCellBg(col, s >= 0 ? 'rgba(46,125,82,0.07)' : 'rgba(184,50,50,0.07)') }}>{fmtS(s)}</td>;
            })}
          </tr>
          <tr>
            <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: 'var(--brand-primary)', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '0.5px solid rgba(255,255,255,0.15)', ...STICKY, zIndex: 1 }}>Saldo Acumulado</td>
            {colunas.map((col, idx) => {
              const s = saldos[idx].acumulado;
              const isFirst = col.q===0||col.q===null||col.anual; const isLast = col.q===1||col.q===null||col.anual;
              return <td key={col.mes+(col.q??'m')+idx} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', borderLeft: isFirst ? '1px solid rgba(255,255,255,0.15)' : undefined, borderRight: isLast ? '1px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.1)', borderBottom: '0.5px solid rgba(255,255,255,0.1)', background: isColunaActual(col.mes, col.q) ? '#7c8590' : 'var(--brand-primary)', color: s >= 0 ? '#a8f0c6' : '#ffb3b3' }}>{fmtS(s)}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--color-success)', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>{toast}</div>
      )}

      {recebimentoDateEdit && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.12)', zIndex:950, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={() => setRecebimentoDateEdit(null)}
        >
          <div
            style={{ width:'auto', minWidth:220, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:14, boxShadow:'0 18px 48px rgba(0,0,0,0.12)', padding:'14px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', justifyContent:'center' }}>
              <input
                ref={recebimentoDateInputRef}
                type="date"
                value={recebimentoDateEdit.currentDate || ''}
                className="sis-input"
                onChange={e => {
                  const nextValue = e.target.value || '';
                  if (!nextValue || !onUpdateRecebimentoPrev) return;
                  onUpdateRecebimentoPrev(recebimentoDateEdit.recebimentoId, nextValue);
                  setRecebimentoDateEdit(null);
                  showToast('✓ Data prevista actualizada');
                }}
                style={{ minWidth: 180 }}
                onKeyDown={e => {
                  if (e.key === 'Escape') setRecebimentoDateEdit(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {recebimentosCellPicker && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:949, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ width:'100%', maxWidth:620, maxHeight:'70vh', overflow:'auto', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'0 18px 48px rgba(0,0,0,0.18)' }}>
            <div style={{ padding:'16px 18px', borderBottom:'0.5px solid var(--border)' }}>
              <div style={{ fontSize:15, fontWeight:700 }}>Escolher recebimento</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Esta célula tem vários recebimentos. Escolhe qual queres reagendar.</div>
            </div>
            <div style={{ padding:'10px 12px', display:'grid', gap:8 }}>
              {recebimentosCellPicker.items.map(item => (
                <button
                  key={item.id}
                  className="btn"
                  style={{ justifyContent:'space-between', textAlign:'left', padding:'12px 14px' }}
                  onClick={() => {
                    setRecebimentosCellPicker(null);
                    openRecebimentoEditor(item);
                  }}
                >
                  <span>
                    <strong>{item.cliente}</strong> {item.nFatura ? `· ${item.nFatura}` : ''}
                  </span>
                  <span style={{ fontFamily:'var(--font-mono)', color:'var(--brand-primary)' }}>
                    {(item.valor || 0).toLocaleString('pt-PT')} €
                  </span>
                </button>
              ))}
            </div>
            <div style={{ padding:'12px 18px', borderTop:'0.5px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setRecebimentosCellPicker(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {resumoInfoDetail && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.18)', zIndex:948, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={() => setResumoInfoDetail(null)}
        >
          <div
            style={{ width:'100%', maxWidth:560, maxHeight:'70vh', overflow:'auto', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'0 18px 48px rgba(0,0,0,0.16)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{resumoInfoDetail.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Origem dos valores desta célula</div>
              </div>
              <button className="btn btn-sm" onClick={() => setResumoInfoDetail(null)}>Fechar</button>
            </div>
            <div style={{ padding:'10px 12px', display:'grid', gap:8 }}>
              {resumoInfoDetail.items.map(item => (
                <div key={`${item.tipo}-${item.id}`} style={{ border:'0.5px solid var(--border)', borderRadius:10, padding:'10px 12px', display:'grid', gap:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center' }}>
                    <strong style={{ fontSize:13 }}>
                      {item.tipo === 'recebimento' ? (item.nFatura || item.id) : (item.nFatura || item.id)}
                    </strong>
                    <span style={{ fontFamily:'var(--font-mono)', color:'var(--brand-primary)', fontSize:12 }}>
                      {(item.valor || 0).toLocaleString('pt-PT')} €
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {item.tipo === 'recebimento' ? `Recebimento · ${item.cliente}` : `Pagamento · ${item.fornecedor}`}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {item.tipo === 'recebimento'
                      ? `Fatura ${item.nFatura || item.id} · Previsto ${item.prevRecebimento || '—'}`
                      : `Fatura ${item.nFatura || item.id} · Previsto ${item.prevPagamento || '—'}`}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    {item.obra && <span className="badge badge-n">{item.obra}</span>}
                    <button className="btn btn-sm" onClick={() => goToResumoOrigin(item)}>
                      Abrir origem
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar Resumo — filtro de período vem do selector global da página */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {canEditPrevDatas && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Nos valores de <strong style={{ color: 'var(--text-primary)' }}>Clientes</strong>, podes clicar para alterar a data prevista.
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          A mostrar: <strong style={{ color: 'var(--text-primary)' }}>
            {vista === 'anual'
              ? `Horizonte activo · destaque ${anoReal}`
              : vista === 'mensal'
                ? `${RESUMO_MESES[mesActualIdx]} ${anoReal}`
                : `${quinzenaActualIdx === 0 ? '1–15' : '16–fim'} ${RESUMO_MESES[mesActualIdx]} ${anoReal}`}
          </strong>
          {' — o destaque cinzento segue sempre a data real'}
        </span>
        {temSimulacao && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(196,122,26,0.12)', border: '1px solid #C47A1A', borderRadius: 7, padding: '5px 12px' }}>
            <span style={{ fontSize: 14 }}>👁</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#C47A1A' }}>A mostrar simulação</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowFullscreen(true)}>Janela completa</button>
          <div style={{ position:'relative' }}>
            <button className="btn btn-sm" onClick={() => setDownloadMenuOpen(v => !v)}>⬇ Descarregar</button>
            {downloadMenuOpen && (
              <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', minWidth:140, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 10px 24px rgba(0,0,0,0.12)', padding:6, zIndex:20 }}>
                <button className="btn btn-sm" style={{ width:'100%', justifyContent:'flex-start' }} onClick={() => { exportTableToExcel('tes-tabela-resumo', 'Resumo-Tesouraria'); setDownloadMenuOpen(false); }}>Excel</button>
                <button className="btn btn-sm" style={{ width:'100%', justifyContent:'flex-start' }} onClick={() => { printTable('tes-tabela-resumo', 'Resumo de Tesouraria'); setDownloadMenuOpen(false); }}>PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal novo grupo */}
      {addingGrupo && (
        <div style={{ marginBottom: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--brand-primary)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Novo grupo:</span>
          <input autoFocus value={novoGrupo.label} onChange={e => setNovoGrupo(n => ({ ...n, label: e.target.value }))}
            placeholder="Nome do grupo (ex: Subsídios, Rendas…)"
            style={{ flex: 2, minWidth: 200, fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '1.5px solid var(--brand-primary)', borderRadius: 6, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            onKeyDown={e => { if (e.key === 'Enter') adicionarGrupo(); if (e.key === 'Escape') setAddingGrupo(null); }}
          />
          <select value={novoGrupo.tipo} onChange={e => setNovoGrupo(n => ({ ...n, tipo: e.target.value }))}
            style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            <option value="entrada">↑ Entrada</option>
            <option value="saida">↓ Saída</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={adicionarGrupo}>Criar grupo</button>
          <button className="btn btn-sm" onClick={() => setAddingGrupo(null)}>Cancelar</button>
        </div>
      )}

      {renderResumoTabela()}

      {showFullscreen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ width:'98vw', height:'96vh', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>Resumo do mapa de tesouraria</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Vista em janela completa</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ position:'relative' }}>
                  <button className="btn btn-sm" onClick={() => setDownloadMenuOpen(v => !v)}>⬇ Descarregar</button>
                  {downloadMenuOpen && (
                    <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', minWidth:140, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 10px 24px rgba(0,0,0,0.12)', padding:6, zIndex:20 }}>
                      <button className="btn btn-sm" style={{ width:'100%', justifyContent:'flex-start' }} onClick={() => { exportTableToExcel('tes-tabela-resumo', 'Resumo-Tesouraria'); setDownloadMenuOpen(false); }}>Excel</button>
                      <button className="btn btn-sm" style={{ width:'100%', justifyContent:'flex-start' }} onClick={() => { printTable('tes-tabela-resumo', 'Resumo de Tesouraria'); setDownloadMenuOpen(false); }}>PDF</button>
                    </div>
                  )}
                </div>
                <button className="btn btn-sm" onClick={() => setShowFullscreen(false)}>Fechar</button>
              </div>
            </div>
            <div style={{ padding:'16px', minHeight:0, flex:1, display:'flex' }}>
              {renderResumoTabela(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── CASHFLOW GRELHA ──────────────────────────────────────────────────────────
const MESES_GRID = ['Jan 2026','Fev 2026','Mar 2026','Abr 2026','Mai 2026','Jun 2026'];

// Dados estruturados por quinzena: { mes, q1, q2 } onde q1 = 1-15, q2 = 16-fim
const CASHFLOW_DATA = {
  entradas: {
    'Cliente': {
      'Jan 2026': [48500, 16000],
      'Fev 2026': [75000, 0],
      'Mar 2026': [78750, 27500],
      'Abr 2026': [98000, 70000],
      'Mai 2026': [27500, 31500],
      'Jun 2026': [0, 0],
    },
    'Devolução IVA': {
      'Jan 2026': [0, 0],
      'Fev 2026': [0, 0],
      'Mar 2026': [0, 18340],
      'Abr 2026': [0, 0],
      'Mai 2026': [0, 0],
      'Jun 2026': [0, 0],
    },
    'Financiamento': {
      'Jan 2026': [0, 0], 'Fev 2026': [0, 0], 'Mar 2026': [0, 0],
      'Abr 2026': [0, 0], 'Mai 2026': [0, 0], 'Jun 2026': [0, 0],
    },
  },
  saidas: {
    'Fornecedor': {
      'Jan 2026': [22400, 1850],
      'Fev 2026': [189000, 0],
      'Mar 2026': [93871, 420],
      'Abr 2026': [3200, 0],
      'Mai 2026': [3800, 0],
      'Jun 2026': [0, 0],
    },
    'Salário': {
      'Jan 2026': [0, 0], 'Fev 2026': [0, 8900], 'Mar 2026': [0, 0],
      'Abr 2026': [0, 24500], 'Mai 2026': [0, 0], 'Jun 2026': [0, 0],
    },
    'Imposto': {
      'Jan 2026': [0, 0], 'Fev 2026': [0, 0], 'Mar 2026': [0, 0],
      'Abr 2026': [0, 0], 'Mai 2026': [31200, 0], 'Jun 2026': [0, 0],
    },
    'Vencimentos': {
      'Jan 2026': [0, 0], 'Fev 2026': [0, 0], 'Mar 2026': [0, 0],
      'Abr 2026': [0, 0], 'Mai 2026': [0, 0], 'Jun 2026': [0, 0],
    },
  },
};

function fmtCell(v) {
  if (!v || v === 0) return '—';
  const abs = Math.abs(v).toLocaleString('pt-PT') + ' €';
  return (v > 0 ? '+' : '−') + abs;
}
function fmtCellNeg(v) {
  if (!v || v === 0) return '—';
  return '−' + Math.abs(v).toLocaleString('pt-PT') + ' €';
}
function fmtSaldo(v) {
  if (v === 0) return '—';
  return (v > 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-PT') + ' €';
}

function CashflowGrelha({ pagamentos, recebimentos, dadosSimulados, temSimulacao }) {
  const [periodo, setPeriodo] = useState({ inicio: 0, fim: 5 });
  const [projecto, setProjecto] = useState('Todos');

  const meses = MESES_GRID.slice(periodo.inicio, periodo.fim + 1);
  // Índice mês: MESES_GRID = ['Jan 2026', 'Fev 2026', ...]
  const MESES_IDX = { 'Jan 2026':0,'Fev 2026':1,'Mar 2026':2,'Abr 2026':3,'Mai 2026':4,'Jun 2026':5,'Jul 2026':6,'Ago 2026':7,'Set 2026':8,'Out 2026':9,'Nov 2026':10,'Dez 2026':11 };
  const MES_NUM = { 'Jan':0,'Fev':1,'Mar':2,'Abr':3,'Mai':4,'Jun':5,'Jul':6,'Ago':7,'Set':8,'Out':9,'Nov':10,'Dez':11 };

  // Lê dados manuais (simulados ou reais)
  const manualData = dadosSimulados || (() => { try { return JSON.parse(localStorage.getItem('sis_tesouraria_manual') || '{}'); } catch { return {}; } })();
  const ANO = 2026;

  // Soma todos os itens de todas as categorias manuais de saída para um mês/quinzena
  const getManualSaidas = (mesLabel, q) => {
    const mi = MESES_IDX[mesLabel];
    if (mi === undefined) return 0;
    const CHAVES_SAIDA = ['colaboradores','impostos','diversos','financiamentos','investimentos'];
    return CHAVES_SAIDA.reduce((total, chave) => {
      const cat = manualData?.[ANO]?.[chave];
      if (!cat) return total;
      const grupos = cat.grupos || [];
      return total + grupos.reduce((s, grupo) => {
        if (grupo.tipo === 'entrada') return s; // skip entradas
        return s + (grupo.itens || []).reduce((s2, item) => {
          return s2 + (cat.valores?.[item.key]?.[mi]?.[q] || 0);
        }, 0);
      }, 0);
    }, 0);
  };

  const getManualEntradas = (mesLabel, q) => {
    const mi = MESES_IDX[mesLabel];
    if (mi === undefined) return 0;
    const CHAVES_ENTRADA = ['financiamentos','investimentos'];
    return CHAVES_ENTRADA.reduce((total, chave) => {
      const cat = manualData?.[ANO]?.[chave];
      if (!cat) return total;
      const grupos = cat.grupos || [];
      return total + grupos.reduce((s, grupo) => {
        if (grupo.tipo !== 'entrada') return s;
        return s + (grupo.itens || []).reduce((s2, item) => {
          return s2 + (cat.valores?.[item.key]?.[mi]?.[q] || 0);
        }, 0);
      }, 0);
    }, 0);
  };

  // Recebimentos de clientes por mês/quinzena
  const parseMesLabel = (str) => {
    if (!str || str === '—') return null;
    const m1 = str.match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (m1) return { dia: parseInt(m1[1]), mi: MES_NUM[m1[2]] ?? -1 };
    const m2 = str.match(/(\d{1,2})\/(\d{1,2})/);
    if (m2) return { dia: parseInt(m2[1]), mi: parseInt(m2[2]) - 1 };
    return null;
  };
  const valCli = Array(12).fill(null).map(() => [0,0]);
  (recebimentos || []).forEach(r => {
    const d = parseMesLabel(r.dataEmissao || r.prevRecebimento || '');
    if (!d || d.mi < 0 || d.mi > 11) return;
    valCli[d.mi][d.dia <= 15 ? 0 : 1] += r.valor || 0;
  });
  const valForn = Array(12).fill(null).map(() => [0,0]);
  (pagamentos || []).forEach(p => {
    const d = parseMesLabel(p.dataFatura || p.prevPagamento || '');
    if (!d || d.mi < 0 || d.mi > 11) return;
    valForn[d.mi][d.dia <= 15 ? 0 : 1] += p.valor || 0;
  });

  // Calcula totais reais por mês/quinzena
  function totalEntradas(mes, q) {
    const mi = MESES_IDX[mes] ?? -1;
    if (mi < 0) return 0;
    const cli = valCli[mi]?.[q] || 0;
    const manual_ent = getManualEntradas(mes, q);
    // Fallback to CASHFLOW_DATA se não há dados reais
    const cf = Object.values(CASHFLOW_DATA.entradas).reduce((s, d) => s + (d[mes]?.[q] || 0), 0);
    return (cli + manual_ent) > 0 ? cli + manual_ent : cf;
  }
  function totalSaidas(mes, q) {
    const mi = MESES_IDX[mes] ?? -1;
    if (mi < 0) return 0;
    const forn = valForn[mi]?.[q] || 0;
    const manual_sai = getManualSaidas(mes, q);
    const cf = Object.values(CASHFLOW_DATA.saidas).reduce((s, d) => s + (d[mes]?.[q] || 0), 0);
    return (forn + manual_sai) > 0 ? forn + manual_sai : cf;
  }

  // Cashflow quinzenal e acumulado
  const quinzenas = meses.flatMap(m => [{ mes: m, q: 0 }, { mes: m, q: 1 }]);
  let acumulado = 0;
  const saldosAcumulados = quinzenas.map(({ mes, q }) => {
    const s = totalEntradas(mes, q) - totalSaidas(mes, q);
    acumulado += s;
    return { quinzenal: s, acumulado };
  });

  const CELL = {
    base: { fontSize: 12, textAlign: 'right', padding: '7px 10px', whiteSpace: 'nowrap', borderRight: '0.5px solid var(--border)' },
    header: { fontSize: 11, fontWeight: 600, textAlign: 'center', padding: '6px 8px', background: 'var(--bg-app)', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' },
    label: { fontSize: 13, padding: '7px 14px', fontWeight: 500, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-card)' },
    section: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 14px', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-app)' },
    total: { fontSize: 12, fontWeight: 700, padding: '8px 10px', textAlign: 'right', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-app)', whiteSpace: 'nowrap' },
    saldo: { fontSize: 12, fontWeight: 700, padding: '8px 10px', textAlign: 'right', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' },
  };

  const nCols = meses.length * 2;
  const COL_W = 110;
  const LABEL_W = 160;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          Período:
          <strong style={{ color: 'var(--text-primary)', marginLeft: 6 }}>
            {MESES_GRID[periodo.inicio]} — {MESES_GRID[periodo.fim]}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: '3 meses', i: 0, f: 2 },
            { label: '6 meses', i: 0, f: 5 },
          ].map(p => (
            <button key={p.label} onClick={() => setPeriodo({ inicio: p.i, fim: p.f })} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', borderRadius: 6,
              border: '0.5px solid', cursor: 'pointer', transition: 'all .15s',
              borderColor: periodo.inicio === p.i && periodo.fim === p.f ? 'var(--brand-primary)' : 'var(--border)',
              background: periodo.inicio === p.i && periodo.fim === p.f ? 'var(--brand-primary)' : 'var(--bg-card)',
              color: periodo.inicio === p.i && periodo.fim === p.f ? '#fff' : 'var(--text-secondary)',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select value={projecto} onChange={e => setProjecto(e.target.value)} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
            {['Todos','O138','O142','O143','O145'].map(o => <option key={o}>{o}</option>)}
          </select>
          {temSimulacao && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(196,122,26,0.12)', border: '1px solid #C47A1A', borderRadius: 7, padding: '5px 12px' }}>
              <span style={{ fontSize: 13 }}>👁</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#C47A1A' }}>Simulação activa</span>
            </div>
          )}
          <button className="btn btn-sm" onClick={() => exportTableToExcel('tes-tabela-resumo', 'Resumo-Tesouraria')}>📥 Excel</button>
          <button className="btn btn-sm" onClick={() => printTable('tes-tabela-resumo', 'Resumo de Tesouraria')}>⬇ Descarregar</button>
        </div>
      </div>

      {/* Grelha */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table id="tes-tabela-cashflow" style={{ width: '100%', borderCollapse: 'collapse', minWidth: LABEL_W + nCols * COL_W }}>
          <thead>
            {/* Linha 1: meses */}
            <tr>
              <th style={{ ...CELL.header, textAlign: 'left', width: LABEL_W, position: 'sticky', left: 0, zIndex: 2 }}>DESCRIÇÃO</th>
              {meses.map(m => (
                <th key={m} colSpan={2} style={{
                  ...CELL.header, textAlign: 'center',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '0.5px solid var(--border)',
                  color: 'var(--brand-primary)', fontWeight: 700, fontSize: 12,
                }}>
                  {m.toUpperCase()}
                </th>
              ))}
            </tr>
            {/* Linha 2: quinzenas */}
            <tr>
              <th style={{ ...CELL.header, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 }} />
              {meses.map(m => (
                ['1–15', '16–FIM'].map((q, qi) => (
                  <th key={m + q} style={{
                    ...CELL.header,
                    borderLeft: qi === 0 ? '1px solid var(--border)' : '0.5px solid var(--border)',
                    fontSize: 11, color: 'var(--text-muted)',
                  }}>{q}</th>
                ))
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── ENTRADAS ── */}
            <tr>
              <td style={{ ...CELL.section, color: 'var(--color-success)', background: '#edf7f1', position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.07)' }}>▲ ENTRADAS</td>
              {meses.map(m => [0,1].map((qi) => (
                <td key={m+qi} style={{ ...CELL.base, borderLeft: qi===0 ? '1px solid var(--border)' : undefined, borderBottom: '0.5px solid var(--border)', background: 'rgba(46,125,82,0.12)' }} />
              )))}
            </tr>
            {Object.entries(CASHFLOW_DATA.entradas).map(([cat, dados]) => (
              <tr key={cat}>
                <td style={{ ...CELL.label, paddingLeft: 24, color: 'var(--text-secondary)', fontWeight: 400, borderBottom: '0.5px solid var(--border)' }}>{cat}</td>
                {meses.map(m => [0,1].map((qi) => {
                  const v = dados[m]?.[qi] || 0;
                  return (
                    <td key={m+qi} style={{
                      ...CELL.base,
                      borderLeft: qi===0 ? '1px solid var(--border)' : undefined,
                      borderBottom: '0.5px solid var(--border)',
                      color: v > 0 ? 'var(--color-success)' : 'var(--text-muted)',
                    }}>
                      {v > 0 ? `+${v.toLocaleString('pt-PT')} €` : '—'}
                    </td>
                  );
                }))}
              </tr>
            ))}
            {/* Total entradas */}
            <tr style={{ background: '#e8f5ee' }}>
              <td style={{ ...CELL.total, textAlign: 'left', paddingLeft: 14, color: 'var(--color-success)', position: 'sticky', left: 0, background: '#e8f5ee', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL ENTRADAS</td>
              {meses.map(m => [0,1].map((qi) => {
                const v = totalEntradas(m, qi);
                return (
                  <td key={m+qi} style={{ ...CELL.total, borderLeft: qi===0 ? '1px solid var(--border)' : undefined, color: 'var(--color-success)' }}>
                    {v > 0 ? `${v.toLocaleString('pt-PT')} €` : '—'}
                  </td>
                );
              }))}
            </tr>

            {/* Espaçador */}
            <tr><td colSpan={nCols + 1} style={{ height: 4, background: 'var(--border)' }} /></tr>

            {/* ── SAÍDAS ── */}
            <tr>
              <td style={{ ...CELL.section, color: 'var(--color-danger)', background: '#fdf0f0', position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.07)' }}>▼ SAÍDAS</td>
              {meses.map(m => [0,1].map((qi) => (
                <td key={m+qi} style={{ ...CELL.base, borderLeft: qi===0 ? '1px solid var(--border)' : undefined, borderBottom: '0.5px solid var(--border)', background: 'rgba(184,50,50,0.04)' }} />
              )))}
            </tr>
            {Object.entries(CASHFLOW_DATA.saidas).map(([cat, dados]) => (
              <tr key={cat}>
                <td style={{ ...CELL.label, paddingLeft: 24, color: 'var(--text-secondary)', fontWeight: 400, borderBottom: '0.5px solid var(--border)' }}>{cat}</td>
                {meses.map(m => [0,1].map((qi) => {
                  const v = dados[m]?.[qi] || 0;
                  return (
                    <td key={m+qi} style={{
                      ...CELL.base,
                      borderLeft: qi===0 ? '1px solid var(--border)' : undefined,
                      borderBottom: '0.5px solid var(--border)',
                      color: v > 0 ? 'var(--color-danger)' : 'var(--text-muted)',
                    }}>
                      {v > 0 ? `−${v.toLocaleString('pt-PT')} €` : '—'}
                    </td>
                  );
                }))}
              </tr>
            ))}
            {/* Total saídas */}
            <tr style={{ background: '#fceaea' }}>
              <td style={{ ...CELL.total, textAlign: 'left', paddingLeft: 14, color: 'var(--color-danger)', position: 'sticky', left: 0, background: '#fceaea', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL SAÍDAS</td>
              {meses.map(m => [0,1].map((qi) => {
                const v = totalSaidas(m, qi);
                return (
                  <td key={m+qi} style={{ ...CELL.total, borderLeft: qi===0 ? '1px solid var(--border)' : undefined, color: 'var(--color-danger)' }}>
                    {v > 0 ? `${v.toLocaleString('pt-PT')} €` : '—'}
                  </td>
                );
              }))}
            </tr>

            {/* Espaçador */}
            <tr><td colSpan={nCols + 1} style={{ height: 4, background: 'var(--border)' }} /></tr>

            {/* ── CASHFLOW QUINZENAL ── */}
            <tr style={{ background: 'var(--bg-app)' }}>
              <td style={{ ...CELL.saldo, textAlign: 'left', paddingLeft: 14, position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-app)', boxShadow: '2px 0 5px rgba(0,0,0,0.07)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700 , zIndex: 1, boxShadow: '2px 0 5px var(--bg-card)' }}>
                CASHFLOW QUINZENAL
              </td>
              {quinzenas.map(({ mes, q }, idx) => {
                const s = saldosAcumulados[idx].quinzenal;
                return (
                  <td key={mes+q} style={{
                    ...CELL.saldo,
                    borderLeft: q===0 ? '1px solid var(--border)' : undefined,
                    background: s >= 0 ? 'rgba(46,125,82,0.08)' : 'rgba(184,50,50,0.08)',
                    color: s >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {s !== 0 ? (s > 0 ? '+' : '−') + Math.abs(s).toLocaleString('pt-PT') + ' €' : '—'}
                  </td>
                );
              })}
            </tr>

            {/* ── CASHFLOW ACUMULADO ── */}
            <tr style={{ background: 'var(--brand-primary)' }}>
              <td style={{ ...CELL.saldo, textAlign: 'left', paddingLeft: 14, position: 'sticky', left: 0, zIndex: 1, background: 'var(--brand-primary)', boxShadow: '2px 0 5px rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 , zIndex: 1, boxShadow: '2px 0 5px var(--bg-card)' }}>
                CASHFLOW ACUMULADO
              </td>
              {quinzenas.map(({ mes, q }, idx) => {
                const s = saldosAcumulados[idx].acumulado;
                return (
                  <td key={mes+q} style={{
                    ...CELL.saldo,
                    borderLeft: q===0 ? '1px solid rgba(255,255,255,0.2)' : undefined,
                    borderRight: '0.5px solid rgba(255,255,255,0.15)',
                    background: 'var(--brand-primary)',
                    color: s >= 0 ? '#a8f0c6' : '#ffb3b3',
                    fontWeight: 700,
                  }}>
                    {s !== 0 ? (s > 0 ? '+' : '−') + Math.abs(s).toLocaleString('pt-PT') + ' €' : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MODAL OBSERVAÇÕES ────────────────────────────────────────────────────────
function ObsModal({ inicial, onClose, onSave }) {
  const [texto, setTexto] = useState(inicial || '');
  return (
    <div
      onClick={undefined}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Observações MS</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '2px 6px' }}>✕</button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={4}
            placeholder="Questões ou observações sobre este pagamento..."
            style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ padding: '12px 18px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(texto)}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
