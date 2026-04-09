const PROCESSOS_KEY = 'sis_processos_encomenda';
const FATURAS_FORN_KEY = 'sis_faturas_forn';

function loadJson(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emitProcessosUpdated(value) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sis_processos_encomenda_updated'));
  window.dispatchEvent(new StorageEvent('storage', { key: PROCESSOS_KEY, newValue: JSON.stringify(value) }));
}

function parseLocalDateToIso(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/');
    return `${y}-${m}-${d}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const base = parseLocalDateToIso(iso);
  if (!base) return '';
  const date = new Date(`${base}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function derivePrevPagamento(encomenda) {
  const baseDate = parseLocalDateToIso(encomenda.documentoGeradoEm || encomenda.criadaEm);
  const cond = String(encomenda.condPagamento || '').trim().toLowerCase();
  if (!baseDate) return '';
  if (!cond || cond === 'pronto pagamento') return baseDate;
  const dias = parseInt(cond, 10);
  if (Number.isFinite(dias)) return addDays(baseDate, dias);
  return baseDate;
}

function mapWorkflowEstado(encomenda, anterior) {
  if (encomenda.estado === 'draft') return 'draft';
  if (encomenda.estado === 'standby-jado') return 'draft_jado';
  if (anterior?.estadoWorkflow === 'pagamento_efetuado') return 'pagamento_efetuado';
  if (anterior?.estadoWorkflow === 'pagamento_autorizado') return 'pagamento_autorizado';
  if (anterior?.estadoWorkflow === 'fatura_recebida') return 'fatura_recebida';
  if (encomenda.estado === 'parcial') return 'rececao_parcial';
  if (encomenda.estado === 'satisfeita') return 'rececao_total';
  return 'aguardando_rececao_material';
}

function mapEstadoFinanceiro(processo) {
  if (processo.estadoWorkflow === 'pagamento_efetuado') return 'pago';
  if (processo.estadoWorkflow === 'pagamento_autorizado') return 'autorizado';
  if ((processo.faturaIds || []).length > 0 || (processo.totalFaturado || 0) > 0) return 'fatura_por_pagar';
  return 'pagamento_previsto';
}

function sumItens(itens = [], field) {
  return (itens || []).reduce((sum, item) => sum + (Number(item?.[field]) || 0), 0);
}

function normalizeProcesso(processo) {
  const normalized = {
    ...processo,
    faturaIds: Array.isArray(processo.faturaIds) ? processo.faturaIds : [],
    quantidadeArtigos: Number(processo.quantidadeArtigos) || 0,
    quantidadeFaturada: Number(processo.quantidadeFaturada) || 0,
    quantidadePaga: Number(processo.quantidadePaga) || 0,
    totalFaturado: Number(processo.totalFaturado) || 0,
    valorPrevisto: Number(processo.valorPrevisto) || 0,
    valorBase: Number(processo.valorBase) || 0,
    ivaTotal: Number(processo.ivaTotal) || 0,
  };
  return {
    ...normalized,
    estadoFinanceiro: normalized.estadoFinanceiro || mapEstadoFinanceiro(normalized),
  };
}

function deriveBaseProcesso(obra, encomenda, anterior = {}) {
  const itens = encomenda.itens || [];
  const fases = [...new Set(itens.map(item => item.fase || encomenda.fase).filter(Boolean))];
  const valorBase = Number(encomenda.subtotal) || sumItens(itens, 'preco');
  const ivaTotal = Number(encomenda.ivaTotal) || 0;
  const valorPrevisto = Number(encomenda.total) || (valorBase + ivaTotal);
  const dataPrevistaCalculada = derivePrevPagamento(encomenda);
  const dataPrevistaPagamento = anterior.dataPrevistaManual || anterior.dataPrevistaFatura || dataPrevistaCalculada;
  const dataPrevistaFonte = anterior.dataPrevistaManual
    ? 'manual'
    : anterior.dataPrevistaFatura
      ? 'fatura'
      : 'encomenda';

  const processo = normalizeProcesso({
    ...anterior,
    id: anterior.id || `PROC-${obra.id}-${encomenda.id}`,
    obraId: obra.id,
    obraNome: obra.nome,
    encomendaId: encomenda.id,
    fornecedor: encomenda.fornecedor,
    fornecedorId: encomenda.fornecedorId || anterior.fornecedorId || null,
    fases,
    fasePrincipal: fases[0] || obra.fases?.[0]?.nome || '',
    descricaoResumo: itens.map(item => item.descricao).filter(Boolean).slice(0, 3).join(' · '),
    condPagamento: encomenda.condPagamento || '',
    valorBase,
    ivaTotal,
    valorPrevisto,
    dataCriacao: parseLocalDateToIso(encomenda.criadaEm),
    documentoGeradoEm: parseLocalDateToIso(encomenda.documentoGeradoEm),
    emitidaEm: parseLocalDateToIso(encomenda.documentoGeradoEm) || anterior.emitidaEm || '',
    dataPrevistaCalculada,
    dataPrevistaPagamento,
    dataPrevistaFonte,
    estadoWorkflow: mapWorkflowEstado(encomenda, anterior),
    isDraft: encomenda.estado === 'draft',
    isJado: encomenda.estado === 'standby-jado',
    jadoId: encomenda.jadoId || null,
    jadoAprovadoEm: parseLocalDateToIso(encomenda.jadoAprovadoEm),
    quantidadeArtigos: itens.reduce((sum, item) => sum + (Number(item.qtd) || 0), 0),
    quantidadeFaturada: anterior.quantidadeFaturada || 0,
    quantidadePaga: anterior.quantidadePaga || 0,
    faturaIds: anterior.faturaIds || [],
    totalFaturado: anterior.totalFaturado || 0,
    ultimaSyncEm: new Date().toISOString(),
  });
  return {
    ...processo,
    estadoFinanceiro: mapEstadoFinanceiro(processo),
  };
}

function buildFaturasByEncomenda(raw) {
  const map = new Map();
  Object.entries(raw || {}).forEach(([fornId, faturas]) => {
    (faturas || []).forEach(fatura => {
      if (!fatura?.encomendaId) return;
      const list = map.get(fatura.encomendaId) || [];
      list.push({ ...fatura, fornId });
      map.set(fatura.encomendaId, list);
    });
  });
  return map;
}

export function loadProcessosEncomenda() {
  return loadJson(PROCESSOS_KEY, []).map(normalizeProcesso);
}

export function saveProcessosEncomenda(list) {
  const normalized = (list || []).map(normalizeProcesso);
  saveJson(PROCESSOS_KEY, normalized);
  emitProcessosUpdated(normalized);
  return normalized;
}

export function syncProcessosEncomendaWithFaturas(rawFaturas = null) {
  const processos = loadProcessosEncomenda();
  const raw = rawFaturas || loadJson(FATURAS_FORN_KEY, {});
  const faturasByEncomenda = buildFaturasByEncomenda(raw);
  const updated = processos.map(processo => {
    const faturas = faturasByEncomenda.get(processo.encomendaId) || [];
    const totalFaturado = faturas.reduce((sum, fatura) => sum + (Number(fatura.valor) || 0), 0);
    const quantidadeFaturada = faturas.reduce((sum, fatura) => sum + ((fatura.itens || []).reduce((acc, item) => acc + (Number(item.qtd) || 0), 0)), 0);
    const faturaIds = faturas.map(fatura => fatura.id);
    const anyPaid = faturas.some(fatura => ['pago', 'concluido'].includes(fatura.estado));
    const anyAuthorized = faturas.some(fatura => fatura.estado === 'autorizado');
    const dataPrevistaFatura = faturas
      .map(fatura => parseLocalDateToIso(fatura.dataPrevisaoPagamento || fatura.venc || fatura.data))
      .find(Boolean) || '';
    const estadoWorkflowBase = processo.isDraft || processo.isJado
      ? processo.estadoWorkflow
      : anyPaid
        ? 'pagamento_efetuado'
        : anyAuthorized
          ? 'pagamento_autorizado'
          : faturas.length > 0
            ? 'fatura_recebida'
            : processo.estadoWorkflow;
    const next = normalizeProcesso({
      ...processo,
      faturaIds,
      totalFaturado,
      quantidadeFaturada,
      dataPrevistaFatura,
      dataPrevistaPagamento: processo.dataPrevistaManual || dataPrevistaFatura || processo.dataPrevistaCalculada || processo.dataPrevistaPagamento,
      dataPrevistaFonte: processo.dataPrevistaManual ? 'manual' : dataPrevistaFatura ? 'fatura' : processo.dataPrevistaFonte,
      estadoWorkflow: estadoWorkflowBase,
      estadoFinanceiro: anyPaid ? 'pago' : anyAuthorized ? 'autorizado' : faturas.length > 0 ? 'fatura_por_pagar' : 'pagamento_previsto',
    });
    return {
      ...next,
      quantidadePaga: anyPaid ? next.quantidadeFaturada : next.quantidadePaga,
    };
  });
  const prevSerialized = JSON.stringify(processos);
  const nextSerialized = JSON.stringify(updated);
  if (prevSerialized === nextSerialized) return updated;
  return saveProcessosEncomenda(updated);
}

export function syncProcessosEncomendaFromObra({ obra, encomendas }) {
  if (!obra?.id) return [];
  const existentes = loadProcessosEncomenda();
  const restantes = existentes.filter(processo => processo.obraId !== obra.id);
  const antigosDaObra = new Map(
    existentes
      .filter(processo => processo.obraId === obra.id)
      .map(processo => [processo.encomendaId, processo])
  );
  const synced = (encomendas || []).map(encomenda => deriveBaseProcesso(obra, encomenda, antigosDaObra.get(encomenda.id)));
  return saveProcessosEncomenda([...restantes, ...synced]);
}

export function updateProcessoEncomenda(id, campos) {
  const existentes = loadProcessosEncomenda();
  const updated = existentes.map(processo => {
    if (processo.id !== id) return processo;
    const next = normalizeProcesso({
      ...processo,
      ...campos,
      dataPrevistaPagamento: campos.dataPrevistaManual || campos.dataPrevistaPagamento || processo.dataPrevistaPagamento,
      dataPrevistaFonte: campos.dataPrevistaManual ? 'manual' : campos.dataPrevistaFonte || processo.dataPrevistaFonte,
    });
    return {
      ...next,
      estadoFinanceiro: mapEstadoFinanceiro({ ...next, estadoWorkflow: next.estadoWorkflow }),
    };
  });
  return saveProcessosEncomenda(updated);
}
