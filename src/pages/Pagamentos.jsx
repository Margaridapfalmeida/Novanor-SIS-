import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FORNECEDORES_DATA } from './Fornecedores';
import {
  advanceFornecedorInvoiceWorkflow,
  downloadFornecedorPaymentDoc,
  formatFornecedorPaymentDate,
  getFornecedorInvoiceDocs,
  getFornecedorWorkflowMemory,
  nextActionLabelFornecedorPagamento,
  rejectFornecedorInvoiceWorkflow,
  returnFornecedorInvoiceWorkflow,
  saveFornecedorInvoiceMutation,
  saveFornecedorInvoiceNote,
  statusMetaFornecedorPagamento,
} from '../utils/fornecedorPayments';

const FAT_KEY_FORN = 'sis_faturas_forn';
const STORAGE_KEY_FORN_EXTRA = 'sis_fornecedores_extra';

const fmt = (v) => '€ ' + Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 });

function loadFornecedoresExtras() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_FORN_EXTRA) || '[]'); }
  catch { return []; }
}

function loadAllSupplierInvoices() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
    const fornecedores = [...FORNECEDORES_DATA, ...loadFornecedoresExtras()];
    return fornecedores.flatMap((fornecedor) => {
      const faturas = raw[fornecedor.id] ?? fornecedor.faturas ?? [];
      return (faturas || []).map((fatura) => ({
        ...fatura,
        fornecedorId: fornecedor.id,
        fornecedorNome: fornecedor.nome,
        fornecedorCategoria: fornecedor.categoria,
        fornecedorNif: fornecedor.nif,
      }));
    });
  } catch {
    return [];
  }
}

function saveInvoiceUpdate(fornecedorId, faturaId, updater) {
  const raw = JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
  const fornecedorBase = [...FORNECEDORES_DATA, ...loadFornecedoresExtras()].find((item) => item.id === fornecedorId);
  const baseList = raw[fornecedorId] ?? fornecedorBase?.faturas ?? [];
  const nextList = baseList.map((fatura) => (
    fatura.id === faturaId ? updater({ ...fatura }) : fatura
  ));
  raw[fornecedorId] = nextList;
  const json = JSON.stringify(raw);
  localStorage.setItem(FAT_KEY_FORN, json);
  window.dispatchEvent(new StorageEvent('storage', { key: FAT_KEY_FORN, newValue: json }));
  return nextList.find((fatura) => fatura.id === faturaId) || null;
}

function actorName(user) {
  if (!user) return 'SIS';
  return user.nome || user.initials || user.id || 'SIS';
}

export function PaymentDetailModal({ item, onClose, onValidate, onReturn, onReject, onSaveNote, canFinalize }) {
  const docs = getFornecedorInvoiceDocs(item);
  const memory = getFornecedorWorkflowMemory(item);
  const [note, setNote] = useState(item.notasPagamento || '');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 920, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Pagamentos</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.fornecedorNome} · {item.nFatura || item.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Dados da fatura</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                {[
                  ['Fornecedor', item.fornecedorNome],
                  ['Documento', item.nFatura || item.id],
                  ['Obra', item.obra || '—'],
                  ['Valor', fmt(item.valor || 0)],
                  ['Data', formatFornecedorPaymentDate(item.data)],
                  ['Vencimento', formatFornecedorPaymentDate(item.venc)],
                  ['Estado actual', statusMetaFornecedorPagamento(item.estado).label],
                  ['Condição de pagamento', item.condPag || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Documentos relativos à fatura</div>
              {docs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem documentos anexados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map((doc) => (
                    <div key={doc.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-app)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.label}</div>
                      <button className="btn btn-sm" onClick={() => downloadFornecedorPaymentDoc(doc)}>Descarregar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Notas e observações</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                placeholder="Regista notas internas, observações de pagamento ou contexto da validação..."
                style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn btn-sm" onClick={() => onSaveNote(note)}>Guardar nota</button>
              </div>
            </div>
          </div>

          <div>
            <div className="card" style={{ padding: '16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Memória do workflow</div>
              {memory.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ainda não existe histórico registado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {memory.map((entry) => (
                    <div key={entry.id} style={{ borderLeft: '3px solid var(--brand-primary)', paddingLeft: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{entry.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.actor || 'SIS'} · {formatFornecedorPaymentDate(entry.date || entry.timestamp)}</div>
                      {entry.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{entry.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Ações</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <button className="btn" onClick={onReturn}>↩ Mandar para a pessoa anterior</button>
                <button className="btn" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={onReject}>Não validar</button>
                <button className="btn btn-primary" onClick={onValidate}>{canFinalize ? '✓ Registar como concluído' : `✓ ${nextActionLabelFornecedorPagamento(item.estado)}`}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallAction({ children, onClick, danger = false, primary = false, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        border: 'none',
        cursor: 'pointer',
        width: 26,
        height: 26,
        borderRadius: 6,
        background: primary ? '#2E7D52' : danger ? '#B83232' : '#1C5F9A',
        color: '#fff',
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

export default function PagamentosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [items, setItems] = useState(() => loadAllSupplierInvoices());
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const refresh = () => setItems(loadAllSupplierInvoices());

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === FAT_KEY_FORN) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const meta = location.state?.abrirPagamentoForn || location.state?.abrirFaturaForn;
    if (!meta?.faturaId) return;
    const next = loadAllSupplierInvoices().find((item) => item.id === meta.faturaId && (!meta.fornecedorId || item.fornecedorId === meta.fornecedorId));
    if (next) setSelected(next);
    window.history.replaceState({}, '');
  }, [location.state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => ['pending-dp', 'pending-lg', 'standby-lg', 'pending-ms', 'autorizado', 'pago', 'concluido', 'rejeitado_dp'].includes(item.estado))
      .filter((item) => estadoFiltro === 'todos' || item.estado === estadoFiltro)
      .filter((item) => {
        if (!q) return true;
        return [
          item.fornecedorNome,
          item.nFatura || item.id,
          item.descricao,
          item.obra,
          item.valor,
          item.data,
          item.venc,
          item.notasPagamento,
          ...(getFornecedorInvoiceDocs(item).map((doc) => doc.label)),
        ].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => String(a.venc || a.data || '').localeCompare(String(b.venc || b.data || '')));
  }, [items, search, estadoFiltro]);

  const total = filtered.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const inCourse = filtered.filter((item) => !['pago', 'concluido'].includes(item.estado)).length;
  const awaitingBank = filtered.filter((item) => item.estado === 'autorizado').length;

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const persistSelected = (fornecedorId, faturaId, updater, successMessage) => {
    const updated = saveInvoiceUpdate(fornecedorId, faturaId, updater);
    refresh();
    if (updated && selected?.id === faturaId) {
      setSelected({
        ...updated,
        fornecedorId,
        fornecedorNome: selected.fornecedorNome,
        fornecedorCategoria: selected.fornecedorCategoria,
        fornecedorNif: selected.fornecedorNif,
      });
    }
    if (successMessage) showToast(successMessage);
  };

  const saveNote = (item, note) => {
    const updated = saveFornecedorInvoiceNote(item.fornecedorId, item.id, note, actorName(user));
    refresh();
    if (updated && selected?.id === item.id) setSelected(s => ({ ...s, ...updated }));
    showToast('Nota guardada');
  };

  const advance = (item) => {
    const updated = advanceFornecedorInvoiceWorkflow(item.fornecedorId, item.id, actorName(user));
    refresh();
    if (updated && selected?.id === item.id) setSelected(s => ({ ...s, ...updated }));
    showToast(item.estado === 'autorizado' ? 'Pagamento concluído' : 'Workflow atualizado');
  };

  const sendPrevious = (item) => {
    const updated = returnFornecedorInvoiceWorkflow(item.fornecedorId, item.id, actorName(user));
    refresh();
    if (updated && selected?.id === item.id) setSelected(s => ({ ...s, ...updated }));
    showToast('Pagamento devolvido à etapa anterior');
  };

  const reject = (item) => {
    const updated = rejectFornecedorInvoiceWorkflow(item.fornecedorId, item.id, actorName(user));
    refresh();
    if (updated && selected?.id === item.id) setSelected(s => ({ ...s, ...updated }));
    showToast('Fatura marcada como não validada');
  };

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:24, right:24, zIndex:800, background:'var(--color-success)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>{toast}</div>}
      {selected && (
        <PaymentDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onValidate={() => advance(selected)}
          onReturn={() => sendPrevious(selected)}
          onReject={() => reject(selected)}
          onSaveNote={(note) => saveNote(selected, note)}
          canFinalize={selected.estado === 'autorizado'}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Pagamentos</div>
          <div className="page-subtitle">Pagamentos em curso · memória de validações, notas e ações operacionais</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginBottom:18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Pagamentos em curso</div>
          <div className="kpi-value">{inCourse}</div>
          <div className="kpi-delta up">Faturas ainda por concluir</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Aguardam assinatura / banco</div>
          <div className="kpi-value" style={{ color:'var(--color-warning)' }}>{awaitingBank}</div>
          <div className="kpi-delta dn">Estado autorizado</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Valor total filtrado</div>
          <div className="kpi-value">{fmt(total)}</div>
          <div className="kpi-delta up">{filtered.length} registos</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por fornecedor, documento, descrição, valor ou documentos..."
            style={{ flex:'1 1 320px', fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-app)', color:'var(--text-primary)', outline:'none' }}
          />
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={{ fontFamily:'var(--font-body)', fontSize:13, padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:8, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}>
            <option value="todos">Todos os estados</option>
            {['pending-dp','pending-lg','pending-ms','autorizado','pago','rejeitado_dp'].map((estado) => (
              <option key={estado} value={estado}>{statusMetaFornecedorPagamento(estado).label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="sis-table">
          <thead>
            <tr>
              <th>Data Sit.</th>
              <th>Doc.</th>
              <th>Fornecedor / Descrição</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Info</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:13 }}>Sem pagamentos para os filtros actuais.</td></tr>
            ) : filtered.map((item) => {
              const docs = getFornecedorInvoiceDocs(item);
              const memory = getFornecedorWorkflowMemory(item);
              return (
                <tr key={`${item.fornecedorId}-${item.id}`}>
                  <td style={{ whiteSpace:'nowrap' }}>{formatFornecedorPaymentDate(item.data)}</td>
                  <td>
                    <div style={{ fontWeight:600, color:'var(--brand-primary)', cursor:'pointer' }} onClick={() => setSelected(item)}>{item.nFatura || item.id}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{docs.length} doc.</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                      {docs.map((doc) => (
                        <button key={doc.key} className="btn btn-sm" onClick={() => downloadFornecedorPaymentDoc(doc)}>{doc.label}</button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:600 }}>{item.fornecedorNome}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{item.descricao || 'Sem descrição'}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{item.obra || 'Sem obra'} · {item.fornecedorCategoria || '—'}</div>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700 }}>{fmt(item.valor || 0)}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Venc. {formatFornecedorPaymentDate(item.venc)}</div>
                  </td>
                  <td>
                    <div><span className={`badge ${statusMetaFornecedorPagamento(item.estado).cls}`}>{statusMetaFornecedorPagamento(item.estado).label}</span></div>
                    <div style={{ fontSize:12, marginTop:6, color:'var(--text-secondary)' }}>{memory[0]?.label || 'Sem memória'}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{item.notasPagamento ? item.notasPagamento.slice(0, 60) : 'Sem observações registadas'}</div>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <SmallAction title="Memória / detalhes" onClick={() => setSelected(item)}>i</SmallAction>
                      <SmallAction title="Guardar nota rápida" onClick={() => {
                        const nextNote = window.prompt('Escreve a nota ou observação para esta fatura:', item.notasPagamento || '');
                        if (nextNote === null) return;
                        saveNote(item, nextNote);
                      }}>✎</SmallAction>
                      <SmallAction title="Mandar para a pessoa anterior" onClick={() => sendPrevious(item)}>↩</SmallAction>
                      <SmallAction title="Não validar" danger onClick={() => reject(item)}>✕</SmallAction>
                      {!['pago', 'concluido'].includes(item.estado) && (
                        <SmallAction title={nextActionLabelFornecedorPagamento(item.estado)} primary onClick={() => advance(item)}>✓</SmallAction>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight:700 }}>TOTAL GERAL</td>
              <td />
              <td />
              <td style={{ textAlign:'right', fontWeight:700 }}>{fmt(total)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Mostrando {filtered.length} registo{filtered.length === 1 ? '' : 's'}.
        <button onClick={() => navigate('/fornecedores')} style={{ marginLeft: 8, fontFamily:'var(--font-body)', fontSize:12, color:'var(--brand-primary)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
          Voltar a fornecedores →
        </button>
      </div>
    </div>
  );
}
