import { loadProcessosEncomenda, updateProcessoEncomenda } from './encomendaWorkflow';

const FAT_KEY_FORN = 'sis_faturas_forn';

export function loadFornecedorInvoicesMap() {
  try {
    return JSON.parse(localStorage.getItem(FAT_KEY_FORN) || '{}');
  } catch {
    return {};
  }
}

export function saveFornecedorInvoicesMap(map) {
  const json = JSON.stringify(map);
  localStorage.setItem(FAT_KEY_FORN, json);
  window.dispatchEvent(new StorageEvent('storage', { key: FAT_KEY_FORN, newValue: json }));
  return map;
}

export function statusMetaFornecedorPagamento(estado) {
  if (estado === 'pago' || estado === 'concluido') return { label: 'Pago', cls: 'badge-s' };
  if (estado === 'autorizado') return { label: 'Autorizado', cls: 'badge-s' };
  if (estado === 'pending-ms') return { label: 'Aguarda MS', cls: 'badge-w' };
  if (estado === 'pending-lg' || estado === 'standby-lg') return { label: 'Aguarda LG', cls: 'badge-w' };
  if (estado === 'rejeitado_dp') return { label: 'Não validada', cls: 'badge-d' };
  return { label: 'Aguarda DP', cls: 'badge-i' };
}

export function nextActionLabelFornecedorPagamento(estado) {
  if (estado === 'pending-dp' || estado === 'rejeitado_dp') return 'Validar';
  if (estado === 'pending-lg' || estado === 'standby-lg') return 'Aprovar';
  if (estado === 'pending-ms') return 'Autorizar';
  if (estado === 'autorizado') return 'Concluir';
  return 'Fechado';
}

export function getFornecedorInvoiceDocs(fatura) {
  return [
    fatura?.pdf ? { key: 'fatura', label: fatura.pdf.name || 'Fatura', data: fatura.pdf.base64 } : null,
    fatura?.pdfValidadoDP ? { key: 'validada', label: fatura.pdfValidadoDP.name || 'Validada DP', data: fatura.pdfValidadoDP.base64 } : null,
    fatura?.comprovativoPagamento ? { key: 'comprovativo', label: fatura.comprovativoPagamento.name || 'Comprovativo', data: fatura.comprovativoPagamento.base64 } : null,
    fatura?.doc51 ? { key: 'doc51', label: fatura.doc51.name || 'Doc. 51', data: fatura.doc51.base64 } : null,
  ].filter(Boolean);
}

export function downloadFornecedorPaymentDoc(doc) {
  if (!doc?.data) return;
  const a = document.createElement('a');
  a.href = doc.data;
  a.download = doc.label || 'documento';
  a.click();
}

export function formatFornecedorPaymentDate(value) {
  if (!value) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).toLocaleDateString('pt-PT');
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-PT');
}

export function appendFornecedorWorkflowHistory(fatura, entry) {
  const current = Array.isArray(fatura.workflowHistory) ? fatura.workflowHistory : [];
  return [
    {
      id: `hist-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...current,
  ];
}

function buildDerivedHistory(fatura) {
  const derived = [];
  if (fatura.dataPagamento) derived.push({ id: `pag-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Pagamento registado', actor: 'LG', note: `Pago em ${fatura.dataPagamento}` });
  if (fatura.dataAutorizacaoMS) derived.push({ id: `ms-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Autorizado por MS', actor: 'MS', note: fatura.dataAutorizacaoMS });
  if (fatura.dataAprovacaoLG) derived.push({ id: `lg-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Aprovado por LG', actor: 'LG', note: fatura.dataAprovacaoLG });
  if (fatura.dataValidacaoDP) derived.push({ id: `dp-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Validado por DP', actor: 'DP', note: fatura.dataValidacaoDP });
  if (fatura.observacaoMS) derived.push({ id: `obsms-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Nota de MS', actor: 'MS', note: fatura.observacaoMS });
  if (fatura.observacaoLG) derived.push({ id: `obslg-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Nota de LG', actor: 'LG', note: fatura.observacaoLG });
  if (fatura.observacaoDP) derived.push({ id: `obsdp-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Nota de DP', actor: 'DP', note: fatura.observacaoDP });
  if (fatura.notasPagamento) derived.push({ id: `notapag-${fatura.id}`, timestamp: new Date().toISOString(), label: 'Nota de pagamento', actor: 'SIS', note: fatura.notasPagamento });
  return derived;
}

export function getFornecedorWorkflowMemory(fatura) {
  const explicit = Array.isArray(fatura.workflowHistory) ? fatura.workflowHistory : [];
  const merged = [...explicit, ...buildDerivedHistory(fatura)];
  const unique = [];
  const seen = new Set();
  merged.forEach((item) => {
    const key = `${item.label || ''}|${item.actor || ''}|${item.note || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  return unique;
}

export function saveFornecedorInvoiceMutation(fornecedorId, faturaId, updater) {
  const map = loadFornecedorInvoicesMap();
  const list = Array.isArray(map[fornecedorId]) ? map[fornecedorId] : [];
  let updatedInvoice = null;
  map[fornecedorId] = list.map((fatura) => {
    if (fatura.id !== faturaId) return fatura;
    updatedInvoice = updater({ ...fatura });
    return updatedInvoice;
  });
  saveFornecedorInvoicesMap(map);
  return updatedInvoice;
}

export function syncFornecedorInvoiceWithProcesso(fatura) {
  if (!fatura?.encomendaId) return;
  const processo = loadProcessosEncomenda().find((item) => item.encomendaId === fatura.encomendaId);
  if (!processo) return;
  if (fatura.estado === 'pago' || fatura.estado === 'concluido') {
    updateProcessoEncomenda(processo.id, { estadoWorkflow: 'pagamento_efetuado' });
    return;
  }
  if (fatura.estado === 'autorizado') {
    updateProcessoEncomenda(processo.id, { estadoWorkflow: 'pagamento_autorizado' });
    return;
  }
  if (['pending-ms', 'pending-lg', 'standby-lg', 'pending-dp', 'rejeitado_dp'].includes(fatura.estado)) {
    updateProcessoEncomenda(processo.id, { estadoWorkflow: 'fatura_recebida' });
  }
}

export function saveFornecedorInvoiceNote(fornecedorId, faturaId, note, actor = 'SIS') {
  const updated = saveFornecedorInvoiceMutation(fornecedorId, faturaId, (fatura) => ({
    ...fatura,
    notasPagamento: note,
    workflowHistory: appendFornecedorWorkflowHistory(fatura, {
      label: 'Nota adicionada',
      actor,
      note,
    }),
  }));
  if (updated) syncFornecedorInvoiceWithProcesso(updated);
  return updated;
}

export function advanceFornecedorInvoiceWorkflow(fornecedorId, faturaId, actor = 'SIS') {
  const today = new Date().toLocaleDateString('pt-PT');
  const updated = saveFornecedorInvoiceMutation(fornecedorId, faturaId, (fatura) => {
    let next = { ...fatura };
    if (fatura.estado === 'pending-dp' || fatura.estado === 'rejeitado_dp') next = { ...next, estado: 'pending-lg', validDP: 'Validada', dataValidacaoDP: today };
    else if (fatura.estado === 'pending-lg' || fatura.estado === 'standby-lg') next = { ...next, estado: 'pending-ms', aprovadoLG: true, dataAprovacaoLG: today };
    else if (fatura.estado === 'pending-ms') next = { ...next, estado: 'autorizado', autorizadoMS: true, dataAutorizacaoMS: today };
    else if (fatura.estado === 'autorizado') next = { ...next, estado: 'pago', dataPagamento: today, comprovativoPagamento: fatura.comprovativoPagamento || { name: 'Registo manual SIS', base64: null } };
    return {
      ...next,
      workflowHistory: appendFornecedorWorkflowHistory(next, {
        label: fatura.estado === 'autorizado' ? 'Pagamento concluído' : `${nextActionLabelFornecedorPagamento(fatura.estado)} executado`,
        actor,
        note: `${statusMetaFornecedorPagamento(fatura.estado).label} → ${statusMetaFornecedorPagamento(next.estado).label}`,
      }),
    };
  });
  if (updated) syncFornecedorInvoiceWithProcesso(updated);
  return updated;
}

export function returnFornecedorInvoiceWorkflow(fornecedorId, faturaId, actor = 'SIS') {
  const updated = saveFornecedorInvoiceMutation(fornecedorId, faturaId, (fatura) => {
    let previousState = fatura.estado;
    if (fatura.estado === 'pending-lg' || fatura.estado === 'standby-lg') previousState = 'pending-dp';
    if (fatura.estado === 'pending-ms') previousState = 'pending-lg';
    if (fatura.estado === 'autorizado') previousState = 'pending-ms';
    if (fatura.estado === 'pago') previousState = 'autorizado';
    const next = { ...fatura, estado: previousState };
    return {
      ...next,
      workflowHistory: appendFornecedorWorkflowHistory(next, {
        label: 'Devolvido à pessoa anterior',
        actor,
        note: `${statusMetaFornecedorPagamento(fatura.estado).label} → ${statusMetaFornecedorPagamento(previousState).label}`,
      }),
    };
  });
  if (updated) syncFornecedorInvoiceWithProcesso(updated);
  return updated;
}

export function rejectFornecedorInvoiceWorkflow(fornecedorId, faturaId, actor = 'SIS') {
  const updated = saveFornecedorInvoiceMutation(fornecedorId, faturaId, (fatura) => {
    let next = { ...fatura };
    if (fatura.estado === 'pending-dp' || fatura.estado === 'rejeitado_dp') next = { ...next, estado: 'rejeitado_dp', validDP: 'Rejeitada' };
    else if (fatura.estado === 'pending-lg' || fatura.estado === 'standby-lg') next = { ...next, estado: 'pending-dp', validDP: 'Pendente', aprovadoLG: false };
    else if (fatura.estado === 'pending-ms') next = { ...next, estado: 'pending-lg', autorizadoMS: false };
    else if (fatura.estado === 'autorizado') next = { ...next, estado: 'pending-ms', autorizadoMS: false };
    return {
      ...next,
      workflowHistory: appendFornecedorWorkflowHistory(next, {
        label: 'Não validado',
        actor,
        note: `Ação marcada como não validada em ${statusMetaFornecedorPagamento(fatura.estado).label}`,
      }),
    };
  });
  if (updated) syncFornecedorInvoiceWithProcesso(updated);
  return updated;
}
