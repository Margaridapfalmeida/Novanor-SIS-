import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadPerfis, wantsNotif } from './PermissionsConfig';

const NOTIF_KEY = 'sis_notificacoes';
const OBRAS_DATA_KEY = 'sis_obras_data';
const FAT_FORN_KEY = 'sis_faturas_forn';
const FAT_CLI_KEY = 'sis_faturas_cli';
const PROCESSOS_KEY = 'sis_processos_encomenda';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
// accionavel: true  → desaparece quando a acção é feita (fat. estado muda)
// accionavel: false → informativa, expira ao fim de 30 dias
// alerta: true      → fica até ser dispensado manualmente
//
// DESTINATARIOS por role (exacto):
// 'ca' = Carla      'lg' = Leonor     'ms' = Miguel     'dp' = DP (qualquer)
// ou id de utilizador específico

const DIAS_INFO   = 30;   // notificações informativas expiram em 30 dias
const DIAS_ACCION = 1;    // accionáveis concluídas desaparecem após 1 dia (se marcadas done)

function agora() { return Date.now(); }

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function parseDateToTime(value) {
  if (!value || value === '—') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const slash = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (slash) {
    const d = new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]), 12);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const mesDia = String(value).match(/(\d{1,2})\s+([A-Za-zç]{3})/);
  if (mesDia) {
    const meses = { Jan:0, Fev:1, Mar:2, Abr:3, Mai:4, Jun:5, Jul:6, Ago:7, Set:8, Out:9, Nov:10, Dez:11 };
    const d = new Date(new Date().getFullYear(), meses[mesDia[2]] || 0, Number(mesDia[1]), 12);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function hasActiveJado(jadoNum) {
  if (!jadoNum) return false;
  const obras = Object.values(loadJson(OBRAS_DATA_KEY, {}));
  return obras.some((obra) =>
    (obra?.jados || []).some((jado) =>
      jado.num === jadoNum && !['validado-ms', 'env-comercial', 'resolvido'].includes(jado.estado)
    )
  );
}

function hasPendingFornecedorFatura(faturaId) {
  if (!faturaId) return false;
  const raw = loadJson(FAT_FORN_KEY, {});
  return Object.values(raw).some((faturas) =>
    (faturas || []).some((fat) => fat.id === faturaId && fat.estado !== 'pago' && fat.estado !== 'concluido' && fat.validDP !== 'Validada')
  );
}

function hasNegativeCashflowWindow() {
  const now = Date.now();
  const limit = now + (30 * 86400000);
  const pagamentosFaturas = Object.values(loadJson(FAT_FORN_KEY, {})).flatMap((faturas) => (faturas || []).map((fat) => ({
    valor: Number(fat.valor) || 0,
    estado: fat.estado,
    time: parseDateToTime(fat.dataPrevisaoPagamento || fat.venc || fat.data),
  })));
  const pagamentosProcessos = (loadJson(PROCESSOS_KEY, []) || []).map((processo) => ({
    valor: Math.max(0, Number(processo.valorPrevisto || 0) - Number(processo.totalFaturado || 0)),
    estado: processo.estadoFinanceiro,
    time: parseDateToTime(processo.dataPrevistaPagamento || processo.dataPrevistaFatura || processo.dataPrevistaCalculada),
  }));
  const recebimentos = Object.values(loadJson(FAT_CLI_KEY, {})).flatMap((faturas) => (faturas || []).map((fat) => ({
    valor: Number(fat.valor) || 0,
    estado: fat.estado,
    time: parseDateToTime(fat.venc || fat.dataPrevistaRecebimento || fat.data),
  })));

  const quinzenas = [
    { from: now, to: now + (15 * 86400000) },
    { from: now + (15 * 86400000), to: limit },
  ];

  return quinzenas.some((janela) => {
    const saidas = [...pagamentosFaturas, ...pagamentosProcessos]
      .filter((item) => item.time && item.time >= janela.from && item.time <= janela.to)
      .filter((item) => !['pago', 'concluido'].includes(item.estado))
      .reduce((sum, item) => sum + item.valor, 0);
    const entradas = recebimentos
      .filter((item) => item.time && item.time >= janela.from && item.time <= janela.to)
      .filter((item) => !['recebido', 'concluido'].includes(item.estado))
      .reduce((sum, item) => sum + item.valor, 0);
    return (entradas - saidas) < 0;
  });
}

function notifStillActive(notif) {
  const kind = notif?.meta?.alertKind;
  if (!kind) return notif.alerta ? true : true;
  if (kind === 'jado_validacao') return hasActiveJado(notif.meta?.jadoNum);
  if (kind === 'fatura_dp_pendente') return hasPendingFornecedorFatura(notif.meta?.faturaId);
  if (kind === 'cashflow_negativo') return hasNegativeCashflowWindow();
  return true;
}

function loadNotifs() {
  try {
    const todas = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
    const now = agora();
    return todas.filter(n => {
      if (n.alerta) return notifStillActive(n);            // alertas ficam até a condição deixar de existir
      if (n.accionavel && !n.done) return true;             // accionáveis pendentes ficam
      if (n.accionavel && n.done) {                         // accionáveis feitas: 1 dia
        return (now - new Date(n.doneAt||n.timestamp).getTime()) < DIAS_ACCION * 86400000;
      }
      // informativas: 30 dias
      return (now - new Date(n.timestamp).getTime()) < DIAS_INFO * 86400000;
    });
  } catch { return []; }
}

function inferNotifPrefKey(notif) {
  if (notif.prefKey) return notif.prefKey;
  const t = String(notif.tipo || '').toLowerCase();
  const ttl = String(notif.titulo || '').toLowerCase();

  if (t === 'draft_emitido' || t === 'acao_req') return 'novo_draft_fatura';
  if (ttl.includes('jado crítico')) return 'jado_critico';
  if (ttl.includes('jado')) return 'jado_validacao';
  if (t === 'alerta' && ttl.includes('cashflow')) return 'cashflow_negativo';
  if (t === 'alerta' && (ttl.includes('vencid') || ttl.includes('atras'))) return 'faturas_vencidas';
  if (ttl.includes('pagamento efectuado')) return 'pagamento_efectuado';
  if (ttl.includes('recebimento')) return 'recebimentos';
  if (ttl.includes('fatura aprovada') || ttl.includes('draft aprovado')) return 'fatura_aprovada';
  if (ttl.includes('nova fatura') && (ttl.includes('fornecedor') || notif.path === '/fornecedores')) return 'fatura_forn_recebida';
  if (notif.accionavel) return 'tarefa_atribuida';
  return null;
}

function normalizeDestinatario(dest) {
  if (dest == null || dest === '' || dest === 'all' || dest === '*') return null;
  if (Array.isArray(dest)) return dest;
  return dest;
}

function normalizeMeta(meta) {
  const m = meta ? { ...meta } : {};
  if (m.fornId && !m.fornecedorId) m.fornecedorId = m.fornId;
  if (m.cliente && !m.clienteNome) m.clienteNome = m.cliente;
  if (!m.entityId && m.faturaId) m.entityId = m.faturaId;
  if (!m.entityType && m.faturaId) m.entityType = 'fatura';
  return m;
}

function normalizeNotif(notif) {
  const meta = normalizeMeta(notif.meta);
  return {
    ...notif,
    destinatario: normalizeDestinatario(notif.destinatario),
    meta,
    prefKey: inferNotifPrefKey(notif),
  };
}

function resolveUser(input, perfis) {
  if (!input) return null;
  if (typeof input === 'object') {
    if (input?.id) return perfis.find(p => p.id === input.id) || input;
    return input;
  }
  return perfis.find(p => p.id === input) || null;
}

function userMatchesDestinatario(user, destinatario) {
  if (!destinatario) return true;
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const dept = String(user.departamento || '').toLowerCase();

  if (Array.isArray(destinatario)) return destinatario.some(d => userMatchesDestinatario(user, d));
  if (destinatario === user.id) return true;
  if (destinatario === 'dp') {
    return user.id === 'dp' || (dept === 'producao' && /(diretor|gestor)/.test(role));
  }
  if (typeof destinatario === 'string' && destinatario.startsWith('role:')) {
    const val = destinatario.slice(5).trim().toLowerCase();
    return role.includes(val);
  }
  if (typeof destinatario === 'string' && destinatario.startsWith('dept:')) {
    const val = destinatario.slice(5).trim().toLowerCase();
    return dept === val;
  }
  return false;
}

function shouldDeliverToUser(notif, user) {
  if (!userMatchesDestinatario(user, notif.destinatario)) return false;
  if (notif.prefKey && !wantsNotif(user, notif.prefKey)) return false;
  return true;
}

function dedupeKeyFromNotif(n) {
  if (n.dedupeKey) return n.dedupeKey;
  const entityId = n.meta?.entityId || n.meta?.faturaId || n.meta?.fornecedorId || n.meta?.clienteId || '';
  const acao = n.acao || '';
  return `${n.tipo || 'info'}|${n.path || ''}|${JSON.stringify(n.destinatario || null)}|${entityId}|${acao}|${n.titulo || ''}`;
}

function saveNotifs(list) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0,150))); } catch {}
}

const Ctx = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifs, setNotifs] = useState(loadNotifs);

  const persist = useCallback((list) => {
    // actually filter the provided list
    const now = agora();
    const filtrada = list.filter(n => {
      if (n.alerta) return notifStillActive(n);
      if (n.accionavel && !n.done) return true;
      if (n.accionavel && n.done) return (now - new Date(n.doneAt||n.timestamp).getTime()) < DIAS_ACCION * 86400000;
      return (now - new Date(n.timestamp).getTime()) < DIAS_INFO * 86400000;
    });
    saveNotifs(filtrada);
    return filtrada;
  }, []);

  // Adiciona notificação
  const addNotif = useCallback((notif) => {
    if (Array.isArray(notif)) {
      return notif.map((item) => addNotif(item)).filter(Boolean);
    }
    if (!notif?.titulo) return null;
    const base = normalizeNotif(notif);
    const dupeWindow = Number(base.dedupeWindowMs) || 2 * 60 * 1000;
    const nova = {
      id: `N-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      timestamp: new Date().toISOString(),
      lida: false,
      done: false,
      accionavel: base.accionavel ?? false,
      alerta: base.alerta ?? false,
      dedupeKey: dedupeKeyFromNotif(base),
      ...base,
    };
    setNotifs(prev => {
      const dupe = prev.some(n =>
        (n.dedupeKey || dedupeKeyFromNotif(n)) === nova.dedupeKey &&
        (Date.now() - new Date(n.timestamp).getTime()) < dupeWindow
      );
      if (dupe) return prev;
      const updated = [nova, ...prev];
      saveNotifs(updated);
      return updated;
    });
    return nova;
  }, []);

  // Marcar como lida (sem remover)
  const marcarLida = useCallback((id) => {
    setNotifs(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, lida: true } : n);
      saveNotifs(updated);
      return updated;
    });
  }, []);

  // Marcar acção como feita (accionável resolvida)
  const marcarFeita = useCallback((refOrFaturaId, path) => {
    const ref = typeof refOrFaturaId === 'object'
      ? refOrFaturaId
      : { entityType: 'fatura', entityId: refOrFaturaId, path };

    const matches = (n) => {
      if (!(n.accionavel && !n.done)) return false;
      if (ref.path && n.path !== ref.path) return false;
      if (ref.entityType && ref.entityId) {
        const nType = n.meta?.entityType || (n.meta?.faturaId ? 'fatura' : null);
        const nId = n.meta?.entityId || n.meta?.faturaId;
        return nType === ref.entityType && nId === ref.entityId;
      }
      if (ref.faturaId) return n.meta?.faturaId === ref.faturaId;
      return false;
    };

    setNotifs(prev => {
      const updated = prev.map(n =>
        matches(n)
          ? { ...n, done: true, lida: true, doneAt: new Date().toISOString() }
          : n
      );
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const marcarTodasLidas = useCallback(() => {
    setNotifs(prev => {
      const updated = prev.map(n => ({ ...n, lida: true }));
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const dispensarNotificacao = useCallback((id) => {
    setNotifs(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const dispensarAlerta = useCallback((id) => {
    setNotifs(prev => {
      const updated = prev.filter(n => !(n.id === id && n.alerta));
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const limparTodas = useCallback((userOrId) => {
    if (!userOrId) {
      setNotifs([]); saveNotifs([]);
      return;
    }
    const perfis = loadPerfis();
    const user = resolveUser(userOrId, perfis);
    if (!user) return;
    setNotifs(prev => {
      const updated = prev.filter(n => !shouldDeliverToUser(n, user));
      saveNotifs(updated);
      return updated;
    });
  }, []);

  // Notificações para um utilizador (por destinatario exacto, ou null = todos)
  const getNotifsParaUser = useCallback((userOrId) => {
    const now = agora();
    const perfis = loadPerfis();
    const user = resolveUser(userOrId, perfis);
    if (!user) return [];
    return notifs.filter(n => {
      if (!shouldDeliverToUser(n, user)) return false;
      if (n.alerta) return notifStillActive(n);
      if (n.accionavel && !n.done) return true;
      if (n.accionavel && n.done) return (now - new Date(n.doneAt||n.timestamp).getTime()) < DIAS_ACCION * 86400000;
      return (now - new Date(n.timestamp).getTime()) < DIAS_INFO * 86400000;
    });
  }, [notifs]);

  const naoLidasParaUser = useCallback((userId) => {
    return getNotifsParaUser(userId).filter(n => !n.lida).length;
  }, [getNotifsParaUser]);

  // Accionáveis pendentes para o utilizador (para GestorTarefas)
  const accionaveisPendentes = useCallback((userId) => {
    return getNotifsParaUser(userId).filter(n => n.accionavel && !n.done);
  }, [getNotifsParaUser]);

  useEffect(() => {
    const sync = (e) => {
      if (e?.key && ![NOTIF_KEY, OBRAS_DATA_KEY, FAT_FORN_KEY, FAT_CLI_KEY, PROCESSOS_KEY].includes(e.key)) return;
      setNotifs(loadNotifs());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNotifs(loadNotifs());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Ctx.Provider value={{
      notifs, addNotif, marcarLida, marcarFeita, marcarTodasLidas,
      dispensarNotificacao, dispensarAlerta, limparTodas,
      getNotifsParaUser, naoLidasParaUser, accionaveisPendentes,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() { return useContext(Ctx); }

// ─── FACTORIES ────────────────────────────────────────────────────────────────
// Cada factory retorna um objecto (ou array) pronto para addNotif()
// accionavel: true  = requer acção, desaparece ao marcarFeita
// alerta: true      = fica até ser dispensado
// meta.faturaId     = usado para cruzar com marcarFeita

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export function notifReqValidarDraft({ fatura, cliente, criadoPor, requerenteId, clienteId }) {
  return {
    tipo: 'acao_req', icon: '📄', accionavel: true,
    titulo: `Valida o draft da fatura — ${cliente}`,
    sub: `${cliente} · ${fatura.id} · ${fatura.obra} · Emitido por ${criadoPor}`,
    path: '/clientes',
    destinatario: requerenteId,
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
    acao: 'Validar draft',
  };
}

export function notifLGConfirmarFatura({ fatura, cliente, clienteId }) {
  return {
    tipo: 'acao_lg', icon: '📋', accionavel: true,
    titulo: `Confirma a emissão da fatura — ${cliente}`,
    sub: `${cliente} · ${fatura.id} · ${fatura.obra}`,
    path: '/clientes',
    destinatario: 'lg',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
    acao: 'Confirmar emissão',
  };
}

export function notifMSAprovarFatura({ fatura, cliente, clienteId }) {
  return {
    tipo: 'acao_ms', icon: '✅', accionavel: true,
    titulo: `Aprova a fatura para envio ao cliente — ${cliente}`,
    sub: `${cliente} · ${fatura.id} · ${fatura.obra} · Confirmado por LG`,
    path: '/clientes',
    destinatario: 'ms',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
    acao: 'Aprovar fatura',
  };
}

export function notifLGRegistarRecebimento({ fatura, cliente, clienteId }) {
  return {
    tipo: 'acao_lg', icon: '💰', accionavel: true,
    titulo: `Regista o recebimento — ${cliente}`,
    sub: `${cliente} · ${fatura.id} · Fatura enviada ao cliente`,
    path: '/clientes',
    destinatario: 'lg',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
    acao: 'Registar recebimento',
  };
}

export function notifCADoc51Cliente({ fatura, cliente, clienteId, registadoPor }) {
  return {
    tipo: 'acao_ca', icon: '🏁', accionavel: true,
    titulo: `Actualiza Centralgest e emite Doc. 51 — ${cliente}`,
    sub: `${cliente} · ${fatura.id} · Recebimento confirmado por ${registadoPor}`,
    path: '/clientes',
    destinatario: 'ca',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
    acao: 'Emitir Doc. 51',
  };
}

// Informativas clientes
export function notifInfoFaturaAprovadaReq({ fatura, cliente, clienteId, aprovadoPor, destinatario }) {
  return {
    tipo: 'info', icon: '✅', accionavel: false,
    titulo: `Draft aprovado por ${aprovadoPor}`,
    sub: `${cliente} · ${fatura.id}`,
    path: '/clientes',
    destinatario,
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
  };
}

export function notifInfoFaturaAprovadaMS({ fatura, cliente, clienteId }) {
  return {
    tipo: 'info', icon: '📤', accionavel: false,
    titulo: `Fatura aprovada pelo MS — enviar ao cliente`,
    sub: `${cliente} · ${fatura.id} · ${fatura.obra}`,
    path: '/clientes',
    destinatario: 'ca',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
  };
}

export function notifInfoRecebimentoMS({ fatura, cliente, clienteId, registadoPor }) {
  return {
    tipo: 'info', icon: '💰', accionavel: false,
    titulo: `Recebimento registado — ${cliente}`,
    sub: `${fatura.id} · ${fatura.obra} · por ${registadoPor}`,
    path: '/clientes',
    destinatario: 'ms',
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
  };
}

export function notifInfoFaturaRejeitada({ fatura, cliente, clienteId, rejeitadoPor, comentario, destinatario }) {
  return {
    tipo: 'info', icon: '↩', accionavel: false,
    titulo: `Fatura devolvida por ${rejeitadoPor}`,
    sub: `${cliente} · ${fatura.id}${comentario ? ' · ' + comentario.slice(0,60) : ''}`,
    path: '/clientes',
    destinatario,
    meta: { faturaId: fatura.id, clienteId, clienteNome: cliente },
  };
}

// ── FORNECEDORES ──────────────────────────────────────────────────────────────

export function notifDPValidarFatura({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'acao_dp', icon: '📋', accionavel: true,
    titulo: `Valida a fatura do fornecedor — ${fornecedor}`,
    sub: `${fornecedor} · ${fatura.nFatura || fatura.id} · ${fatura.obra}`,
    path: '/fornecedores',
    destinatario: 'dp',
    meta: { faturaId: fatura.id, fornecedorId: fornId, fornecedorNome: fornecedor },
    acao: 'Validar fatura',
  };
}

export function notifLGAprovarPagamento({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'acao_lg', icon: '✅', accionavel: true,
    titulo: `Aprova o pagamento — ${fornecedor}`,
    sub: `${fornecedor} · ${fatura.nFatura || fatura.id} · Validado pelo DP`,
    path: '/fornecedores',
    destinatario: 'lg',
    meta: { faturaId: fatura.id, fornecedorId: fornId, fornecedorNome: fornecedor },
    acao: 'Aprovar pagamento',
  };
}

export function notifMSAutorizarPagamento({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'acao_ms', icon: '💶', accionavel: true,
    titulo: `Autoriza o pagamento — ${fornecedor}`,
    sub: `${fornecedor} · ${fatura.nFatura || fatura.id} · Aprovado por LG`,
    path: '/fornecedores',
    destinatario: 'ms',
    meta: { faturaId: fatura.id, fornecedorId: fornId, fornecedorNome: fornecedor },
    acao: 'Autorizar pagamento',
  };
}

export function notifLGEfectuarPagamento({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'acao_lg', icon: '🏦', accionavel: true,
    titulo: `Efectua o pagamento — ${fornecedor}`,
    sub: `${fornecedor} · ${fatura.nFatura || fatura.id} · Autorizado pelo MS`,
    path: '/fornecedores',
    destinatario: 'lg',
    meta: { faturaId: fatura.id, fornecedorId: fornId, fornecedorNome: fornecedor },
    acao: 'Efectuar pagamento',
  };
}

export function notifCADoc51Forn({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'acao_ca', icon: '🏁', accionavel: true,
    titulo: `Actualiza Centralgest e emite Doc. 51 — ${fornecedor}`,
    sub: `${fornecedor} · ${fatura.nFatura || fatura.id} · Pagamento efectuado`,
    path: '/fornecedores',
    destinatario: 'ca',
    meta: { faturaId: fatura.id, fornecedorId: fornId, fornecedorNome: fornecedor },
    acao: 'Emitir Doc. 51',
  };
}

// Informativas fornecedores
export function notifInfoFaturaValidadaDP({ fatura, fornecedor, fornId, validadoPor }) {
  return [
    { tipo: 'info', icon: '✅', accionavel: false, titulo: `Fatura validada pelo DP`, sub: `${fornecedor} · ${fatura.nFatura||fatura.id}`, path: '/tesouraria', destinatario: 'lg', meta: { faturaId: fatura.id, fornecedorId: fornId } },
    { tipo: 'info', icon: '✅', accionavel: false, titulo: `Fatura validada — ${fornecedor}`, sub: `${fatura.nFatura||fatura.id} · Validado por ${validadoPor}`, path: '/fornecedores', destinatario: 'ca', meta: { faturaId: fatura.id, fornecedorId: fornId } },
  ];
}

export function notifInfoPagamentoEfectuado({ fatura, fornecedor, fornId }) {
  return {
    tipo: 'info', icon: '💶', accionavel: false,
    titulo: `Pagamento efectuado — ${fornecedor}`,
    sub: `${fatura.nFatura||fatura.id} · ${fatura.obra} · Comprovativo disponível`,
    path: '/tesouraria',
    destinatario: 'ms',
    meta: { faturaId: fatura.id, fornecedorId: fornId },
  };
}

// ── ALERTAS AUTOMÁTICOS ───────────────────────────────────────────────────────

export function notifAlertaFaturaAtrasadaDP({ fatura, fornecedor, fornId, diasAtraso }) {
  return [
    { tipo: 'alerta', alerta: true, icon: '⏰', titulo: `Fatura sem validação há ${diasAtraso} dias`, sub: `${fornecedor} · ${fatura.nFatura||fatura.id}`, path: '/fornecedores', destinatario: 'dp', meta: { faturaId: fatura.id, fornecedorId: fornId, alertKind: 'fatura_dp_pendente' } },
    { tipo: 'alerta', alerta: true, icon: '⏰', titulo: `DP não validou há ${diasAtraso} dias — ${fornecedor}`, sub: `${fatura.nFatura||fatura.id} · ${fatura.obra}`, path: '/fornecedores', destinatario: 'lg', meta: { faturaId: fatura.id, fornecedorId: fornId, alertKind: 'fatura_dp_pendente' } },
  ];
}

export function notifAlertaCashflowNegativo({ quinzena, valorPrevisto }) {
  const fmt = v => '€ ' + Math.abs(v).toLocaleString('pt-PT');
  return [
    { tipo: 'alerta', alerta: true, icon: '⚠️', titulo: `Cashflow negativo previsto`, sub: `${quinzena} · Défice de ${fmt(valorPrevisto)} · Rever mapa`, path: '/tesouraria', destinatario: 'ms', meta: { tab: 'resumo', alertKind: 'cashflow_negativo', quinzena } },
    { tipo: 'alerta', alerta: true, icon: '⚠️', titulo: `Cashflow negativo previsto`, sub: `${quinzena} · Défice de ${fmt(valorPrevisto)}`, path: '/tesouraria', destinatario: 'lg', meta: { tab: 'resumo', alertKind: 'cashflow_negativo', quinzena } },
  ];
}

// ── LEGACY COMPATIBILITY (manter imports antigos a funcionar) ─────────────────
export const notifDraftEmitido = ({ fatura, cliente, criadoPor, requerenteId }) =>
  notifReqValidarDraft({ fatura, cliente, criadoPor, requerenteId });
export const notifDraftAprovado = ({ fatura, cliente, aprovadoPor, criadoPorId }) =>
  notifInfoFaturaAprovadaReq({ fatura, cliente, aprovadoPor, destinatario: criadoPorId });
export const notifFaturaEmitida = ({ fatura, cliente, emitidoPor }) =>
  notifLGConfirmarFatura({ fatura, cliente });
export const notifConfirmarEmissao = ({ fatura, cliente }) =>
  notifLGConfirmarFatura({ fatura, cliente });
export const notifPagamentoEfectuado = ({ fatura, cliente, registadoPor }) =>
  notifCADoc51Cliente({ fatura, cliente, registadoPor });
export const notifFaturaFornRecebida = ({ fatura, fornecedor }) => [
  notifDPValidarFatura({ fatura, fornecedor }),
  { tipo: 'info', icon: '📥', titulo: `Nova fatura — ${fornecedor}`, sub: `${fatura.nFatura||fatura.id} · Disponível`, path: '/fornecedores', destinatario: 'lg', meta: { faturaId: fatura.id, fornecedorNome: fornecedor } },
];
export const notifFaturaFornValidadaDP = ({ fatura, fornecedor, validadoPor, fornId }) =>
  notifInfoFaturaValidadaDP({ fatura, fornecedor, fornId, validadoPor });
export const notifPagamentoAutorizadoMS = ({ fatura, fornecedor, fornId }) =>
  notifLGEfectuarPagamento({ fatura, fornecedor, fornId });
export const notifLembreteFaturaDP = ({ fatura, fornecedor, fornId, diasAtraso }) =>
  notifAlertaFaturaAtrasadaDP({ fatura, fornecedor, fornId, diasAtraso });
export const notifCashflowNegativo = ({ quinzena, valorPrevisto }) =>
  notifAlertaCashflowNegativo({ quinzena, valorPrevisto });
export const notifFaturaClienteEmitidaTesouraria = ({ fatura, cliente, requerenteId, emitidoPor }) => [];
export const notifRecebimentoConfirmado = ({ fatura, cliente, confirmadoPor, clienteId }) => [
  notifCADoc51Cliente({ fatura, cliente, clienteId, registadoPor: confirmadoPor }),
  notifInfoRecebimentoMS({ fatura, cliente, clienteId, registadoPor: confirmadoPor }),
];

export function verificarAlertasTesouraria({ pagamentos, addNotif, notifs }) {
  const agora = Date.now();
  const MES = { Jan:0,Fev:1,Mar:2,Abr:3,Mai:4,Jun:5,Jul:6,Ago:7,Set:8,Out:9,Nov:10,Dez:11 };
  pagamentos.forEach(p => {
    if (p.estadoPag === 'pago' || p.validDP === 'Validada') return;
    const m = (p.dataFatura || '').match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (!m) return;
    const dataFat = new Date(2026, MES[m[2]] || 0, parseInt(m[1]));
    const diasAtraso = Math.floor((agora - dataFat.getTime()) / 86400000);
    if (diasAtraso < 5) return;
    const jaNotif = notifs.some(n => n.meta?.faturaId === p.id && n.alerta && (agora - new Date(n.timestamp).getTime()) < 2 * 86400000);
    if (jaNotif) return;
    notifAlertaFaturaAtrasadaDP({ fatura: p, fornecedor: p.fornecedor, fornId: p.fornId, diasAtraso }).forEach(n => addNotif(n));
  });
}
