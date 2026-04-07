import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotifPanel from '../components/shared/NotifPanel';
import { FORNECEDORES_DATA } from './Fornecedores';
import { CLIENTES_DATA } from './Clientes';
import { OBRAS_DATA } from './Obras';
import { useNotifications } from '../context/NotificationsContext';
import { loadPerfis } from '../context/PermissionsConfig';

// widgets disponíveis
const WIDGETS_DISPONIVEIS = [
  { id: 'kpis',         label: 'KPIs de Tesouraria',          defaultOn: true  },
  { id: 'notifs',       label: 'As minhas notificações',       defaultOn: true  },
  { id: 'tarefas',      label: 'Gestor de Tarefas',            defaultOn: true  },
  { id: 'obras',        label: 'Obras em curso',               defaultOn: true  },
  { id: 'alertas',      label: 'Alertas e notificações',       defaultOn: true  },
  { id: 'pagamentos',   label: 'Próximos pagamentos',          defaultOn: true  },
];

const DASH_PREFS_KEY = 'sis_dashboard_prefs';
const TAREFAS_KEY    = 'sis_tarefas';

function loadPrefs(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(DASH_PREFS_KEY) || '{}');
    return all[userId] || null;
  } catch { return null; }
}
function savePrefs(userId, prefs) {
  try {
    const all = JSON.parse(localStorage.getItem(DASH_PREFS_KEY) || '{}');
    all[userId] = prefs;
    localStorage.setItem(DASH_PREFS_KEY, JSON.stringify(all));
  } catch {}
}
function loadTarefas(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(TAREFAS_KEY) || '{}');
    return all[userId] || [];
  } catch { return []; }
}
function saveTarefas(userId, tarefas) {
  try {
    const all = JSON.parse(localStorage.getItem(TAREFAS_KEY) || '{}');
    all[userId] = tarefas;
    localStorage.setItem(TAREFAS_KEY, JSON.stringify(all));
  } catch {}
}

// ─── GESTOR DE TAREFAS ────────────────────────────────────────────────────────
function GestorTarefas({ userId, user, navigate }) {
  const { accionaveisPendentes, marcarFeita } = useNotifications();
  const acoesNotif = accionaveisPendentes ? accionaveisPendentes(userId) : [];
  const [tarefas, setTarefas] = useState(() => loadTarefas(userId));
  const [novaTexto, setNovaTexto] = useState('');
  const [filtro, setFiltro] = useState('todas'); // todas | pendentes | concluidas

  const update = (list) => { setTarefas(list); saveTarefas(userId, list); };

  // Load pending SIS actions based on user role
  // acoesPendentes now come from NotificationsContext.accionaveisPendentes

  const podeAtribuirTarefas = user?.isAdmin || user?.acoes?.includes('criar_tarefa_outros') ||
    (() => { try { const p = loadPerfis().find(x => x.id === user?.id); return p?.acoes?.includes('criar_tarefa_outros') || p?.isAdmin || false; } catch { return false; } })();

  const [showAtribuir, setShowAtribuir] = useState(false);
  const [atribuirPara, setAtribuirPara] = useState('');
  const [atribuirTexto, setAtribuirTexto] = useState('');

  const adicionarParaOutro = () => {
    if (!atribuirTexto.trim() || !atribuirPara) return;
    const todos = loadPerfis();
    const destino = todos.find(p => p.id === atribuirPara);
    if (!destino) return;
    // Save task to destino's task list
    const TAREFAS_KEY_OUT = 'sis_tarefas';
    try {
      const all = JSON.parse(localStorage.getItem(TAREFAS_KEY_OUT) || '{}');
      const nova = { id: Date.now(), texto: atribuirTexto.trim(), concluida: false, criada: new Date().toISOString(), criadaPor: user?.nome || 'SIS', atribuida: true };
      all[atribuirPara] = [nova, ...(all[atribuirPara] || [])];
      localStorage.setItem(TAREFAS_KEY_OUT, JSON.stringify(all));
    } catch {}
    setAtribuirTexto(''); setAtribuirPara(''); setShowAtribuir(false);
  };

  const adicionar = () => {
    if (!novaTexto.trim()) return;
    const nova = { id: Date.now(), texto: novaTexto.trim(), concluida: false, criada: new Date().toISOString() };
    update([nova, ...tarefas]);
    setNovaTexto('');
  };

  const toggleConcluida = (id) => update(tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t));
  const remover = (id) => update(tarefas.filter(t => t.id !== id));

  const filtered = tarefas.filter(t =>
    filtro === 'todas' ? true : filtro === 'pendentes' ? !t.concluida : t.concluida
  );
  const pendentes = tarefas.filter(t => !t.concluida).length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Gestor de Tarefas</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{pendentes} pendente{pendentes !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['todas','pendentes','concluidas'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .12s',
                borderColor: filtro === f ? 'var(--brand-primary)' : 'var(--border)',
                background: filtro === f ? 'var(--brand-primary)' : 'transparent',
                color: filtro === f ? '#fff' : 'var(--text-muted)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Input nova tarefa */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: podeAtribuirTarefas ? 6 : 0 }}>
          <input
            value={novaTexto}
            onChange={e => setNovaTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            placeholder="Adicionar tarefa para mim... (Enter)"
            style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 10px', border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button onClick={adicionar} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>+</button>
          {podeAtribuirTarefas && (
            <button onClick={() => setShowAtribuir(s => !s)} className="btn" style={{ fontSize: 12, padding: '6px 10px' }} title="Atribuir tarefa a outra pessoa">👤</button>
          )}
        </div>
        {showAtribuir && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={atribuirPara} onChange={e => setAtribuirPara(e.target.value)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">Seleccionar pessoa...</option>
              {loadPerfis().filter(p => p.id !== userId).map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <input value={atribuirTexto} onChange={e => setAtribuirTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarParaOutro()}
              placeholder="Tarefa para atribuir..."
              style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <button onClick={adicionarParaOutro} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>Atribuir</button>
          </div>
        )}
      </div>

      {/* Acções SIS pendentes — vindas das notificações accionáveis */}
      {acoesNotif.length > 0 && (
        <div style={{ borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)', background: 'var(--bg-info)' }}>
            Acções pendentes no SIS ({acoesNotif.length})
          </div>
          {acoesNotif.map((a, i) => (
            <div key={a.id || i}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '0.5px solid var(--border)', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
              <span
                style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                onClick={() => {
                  if (!navigate) return;
                  if (a.path === '/fornecedores') navigate('/fornecedores', { state: { abrirFaturaForn: a.meta } });
                  else if (a.path === '/clientes') navigate('/clientes', { state: { abrirFatura: a.meta } });
                  else navigate(a.path || '/');
                }}
              >{a.titulo}</span>
              <span style={{ fontSize: 11, color: 'var(--brand-primary)', flexShrink: 0 }}>→</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista de tarefas pessoais */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>

      {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
            {filtro === 'concluidas' ? '✓ Sem tarefas concluídas' : '🎉 Sem tarefas pendentes'}
          </div>
        ) : filtered.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < filtered.length - 1 ? '0.5px solid var(--border)' : 'none', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <button onClick={() => toggleConcluida(t.id)}
              style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${t.concluida ? 'var(--color-success)' : 'var(--border-strong)'}`, background: t.concluida ? 'var(--color-success)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', transition: 'all .12s' }}>
              {t.concluida ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.concluida ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.concluida ? 'line-through' : 'none' }}>{t.texto}</div>
              {t.atribuida && t.criadaPor && (
                <div style={{ fontSize: 11, color: 'var(--brand-primary)', marginTop: 2 }}>👤 Atribuída por {t.criadaPor}</div>
              )}
            </div>
            <button onClick={() => remover(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 4px', opacity: 0, transition: 'opacity .12s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--color-danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--text-muted)'; }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PAINEL DE PERSONALIZAÇÃO ─────────────────────────────────────────────────
function PersonalizarModal({ widgets, onSave, onClose }) {
  const [estado, setEstado] = useState({ ...widgets });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Personalizar Dashboard</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Escolhe os widgets que queres ver no teu dashboard.</div>
          {WIDGETS_DISPONIVEIS.map(w => (
            <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}>
              <div onClick={() => setEstado(s => ({ ...s, [w.id]: !s[w.id] }))}
                style={{ width: 36, height: 20, borderRadius: 10, background: estado[w.id] ? 'var(--brand-primary)' : 'var(--border-strong)', position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: estado[w.id] ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{w.label}</span>
            </label>
          ))}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(estado); onClose(); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
const statusBadge = s => {
  if (s === 'ok')     return <span className="badge badge-success">✓ Normal</span>;
  if (s === 'warn')   return <span className="badge badge-warning">⚠ Atenção</span>;
  return <span className="badge badge-danger">✕ Crítico</span>;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'default';

  // Load per-user widget preferences
  const [widgets, setWidgets] = useState(() => {
    const saved = loadPrefs(userId);
    if (saved) return saved;
    return Object.fromEntries(WIDGETS_DISPONIVEIS.map(w => [w.id, w.defaultOn]));
  });
  const [showPersonalizar, setShowPersonalizar] = useState(false);

  const show = (id) => widgets[id] !== false;

  // ── Dynamic data from localStorage ───────────────────────────────────────
  const { obras, kpis, pagamentos, alertas } = useMemo(() => {
    const fmt = v => '€ ' + Number(v || 0).toLocaleString('pt-PT');

    // Obras
    let extrasObras = [];
    try { extrasObras = JSON.parse(localStorage.getItem('sis_obras_extra') || '[]'); } catch {}
    const allObras = [...OBRAS_DATA, ...extrasObras];
    const obras = allObras.slice(0, 5).map(o => ({
      code: o.id, nome: o.nome, cliente: o.cliente,
      exec: o.execFinanceiraReal || 0,
      margem: o.margemPrevista || 0,
      status: o.estado || 'ok',
    }));

    // Faturas fornecedores
    let fatForn = [];
    try {
      const raw = JSON.parse(localStorage.getItem('sis_faturas_forn') || '{}');
      const extras = JSON.parse(localStorage.getItem('sis_fornecedores_extra') || '[]');
      const todos = [...FORNECEDORES_DATA, ...extras];
      Object.entries(raw).forEach(([fornId, fats]) => {
        const forn = todos.find(f => f.id === fornId);
        (fats || []).forEach(fat => fatForn.push({ ...fat, fornNome: forn?.nome || fornId }));
      });
    } catch {}

    // Faturas clientes
    let fatCli = [];
    try {
      const raw = JSON.parse(localStorage.getItem('sis_faturas_cli') || '{}');
      const extras = JSON.parse(localStorage.getItem('sis_clientes_extra') || '[]');
      const todos = [...CLIENTES_DATA, ...extras];
      Object.entries(raw).forEach(([cliId, fats]) => {
        const cli = todos.find(c => c.id === cliId);
        (fats || []).forEach(fat => fatCli.push({ ...fat, cliNome: cli?.nome || cliId }));
      });
    } catch {}

    // KPIs
    const pagPendente = fatForn.filter(f => !['pago','concluido'].includes(f.estado)).reduce((s, f) => s + (f.valor || 0), 0);
    const pagVencidas = fatForn.filter(f => f.estado === 'vencida').length;
    const pagPendentes = fatForn.filter(f => !['pago','concluido'].includes(f.estado)).length;
    const recPendente = fatCli.filter(f => !['recebido','concluido'].includes(f.estado)).reduce((s, f) => s + (f.valor || 0), 0);
    const recTotal = fatCli.filter(f => !['recebido','concluido'].includes(f.estado)).length;
    const kpis = [
      { label: 'Pagamentos Pendentes',   value: fmt(pagPendente),  delta: `${pagPendentes} faturas${pagVencidas ? ' · ' + pagVencidas + ' vencidas' : ''}`, up: false },
      { label: 'Recebimentos Pendentes', value: fmt(recPendente),  delta: `${recTotal} faturas por receber`, up: recTotal === 0 },
      { label: 'Faturas Fornecedores',   value: String(fatForn.length), delta: `${fatForn.filter(f => f.estado === 'pago').length} pagas`, up: true },
      { label: 'Faturas Clientes',       value: String(fatCli.length),  delta: `${fatCli.filter(f => f.estado === 'recebido').length} recebidas`, up: true },
    ];

    // Pagamentos (fornecedores pendentes, ordenados por vencimento)
    const pagamentos = fatForn
      .filter(f => !['pago','concluido'].includes(f.estado))
      .sort((a, b) => (a.venc || '').localeCompare(b.venc || ''))
      .slice(0, 5)
      .map(f => ({
        forn: f.fornNome, obra: f.obra, fatura: f.nFatura || f.id,
        valor: fmt(f.valor), venc: f.venc || '—', estado: f.estado,
        fornId: f.fornId, faturaId: f.id,
      }));

    // Alertas — faturas vencidas e obras em estado crítico
    const alertas = [
      ...fatForn.filter(f => f.estado === 'vencida' || (f.estado === 'pending-dp' && f.venc)).slice(0,2).map(f => ({
        tipo: 'warn', texto: `Fatura ${f.nFatura || f.id} — ${f.fornNome} aguarda validação`, ator: 'DP', tempo: f.venc || '—'
      })),
      ...allObras.filter(o => o.estado === 'critico').slice(0,2).map(o => ({
        tipo: 'danger', texto: `${o.id} — ${o.nome} em estado crítico`, ator: 'CG', tempo: 'Agora'
      })),
      ...fatCli.filter(f => f.estado === 'vencida').slice(0,2).map(f => ({
        tipo: 'warn', texto: `Fatura ${f.id} — ${f.cliNome} por receber`, ator: 'LG', tempo: f.venc || '—'
      })),
    ].slice(0, 5);

    return { obras, kpis, pagamentos, alertas };
  }, []);

  const handleSavePrefs = (novoEstado) => {
    setWidgets(novoEstado);
    savePrefs(userId, novoEstado);
  };

  return (
    <div>
      {showPersonalizar && (
        <PersonalizarModal widgets={widgets} onSave={handleSavePrefs} onClose={() => setShowPersonalizar(false)} />
      )}

      {/* Header com botão personalizar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn" style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }} onClick={() => setShowPersonalizar(true)}>
          ⚙ Personalizar dashboard
        </button>
      </div>

      {/* KPIs */}
      {show('kpis') && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className={`kpi-delta ${k.up ? 'up' : 'down'}`}>{k.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Notificações */}
      {show('notifs') && <NotifPanel titulo="As minhas notificações" max={5} />}

      {/* Gestor de Tarefas */}
      {show('tarefas') && (
        <div style={{ marginBottom: 16 }}>
          <GestorTarefas userId={userId} user={user} navigate={navigate} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Obras */}
        {show('obras') && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Obras em curso</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Estado financeiro por obra</div>
              </div>
              <button onClick={() => navigate('/obras')} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todas →</button>
            </div>
            <table className="sis-table">
              <thead>
                <tr>
                  <th>Obra</th><th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Execução</th>
                  <th style={{ textAlign: 'right' }}>Margem</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
              {obras.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Sem obras em curso</td></tr>
              ) : obras.map(o => (
                  <tr key={o.code} style={{ cursor: 'pointer' }} onClick={() => navigate(`/obras/${o.code}`)}>
                    <td><div style={{ fontWeight: 500 }}>{o.code}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.nome}</div></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{o.cliente}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{o.exec}%</div>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 4, width: 60, marginLeft: 'auto' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(o.exec,100)}%`, background: o.exec > 60 ? 'var(--color-success)' : 'var(--brand-primary)' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: o.margem < 0 ? 'var(--color-danger)' : o.margem < 5 ? 'var(--color-warning)' : 'var(--color-success)' }}>{o.margem}%</td>
                    <td>{statusBadge(o.status)}</td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Alertas */}
        {show('alertas') && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Alertas e notificações</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Requer atenção</div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {alertas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>✓ Sem alertas activos</div>
              ) : alertas.map((a, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: i < alertas.length - 1 ? '0.5px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: a.tipo === 'danger' ? 'var(--color-danger)' : a.tipo === 'warn' ? 'var(--color-warning)' : 'var(--color-info)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.texto}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      <span className={`wf-actor ${a.ator.toLowerCase()}`}>{a.ator}</span>
                      <span style={{ marginLeft: 6 }}>· {a.tempo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Próximos pagamentos */}
      {show('pagamentos') && (
        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Próximos pagamentos a fornecedores</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Esta semana · Aguardam autorização ou execução</div>
            </div>
            <button onClick={() => navigate('/fornecedores')} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver mapa →</button>
          </div>
          <table className="sis-table">
            <thead>
              <tr><th>Fornecedor</th><th>Obra</th><th>Nº Fatura</th><th style={{ textAlign: 'right' }}>Valor</th><th>Vencimento</th><th>Estado</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {pagamentos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>✓ Sem pagamentos pendentes</td></tr>
              ) : pagamentos.map((p, i) => (
                <tr key={i} onClick={() => navigate('/fornecedores', { state: { abrirFaturaForn: { faturaId: p.faturaId, fornecedorId: p.fornId } } })} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 500 }}>{p.forn}</td>
                  <td><span className="badge badge-neutral">{p.obra}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{p.fatura}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.valor}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.venc}</td>
                  <td>
                    <span className={`badge ${p.estado === 'autorizado' ? 'badge-success' : p.estado === 'pending-ms' ? 'badge-warning' : 'badge-info'}`}>
                      {p.estado === 'autorizado' ? 'Autorizado' : p.estado === 'pending-ms' ? 'Aguarda MS' : p.estado === 'pending-lg' ? 'Aguarda LG' : 'Aguarda DP'}
                    </span>
                  </td>
                  <td>
                    {p.estado === 'pending-ms' && <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); navigate('/fornecedores'); }}>Autorizar</button>}
                    {p.estado === 'autorizado' && <button className="btn btn-sm" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }} onClick={e => { e.stopPropagation(); navigate('/fornecedores'); }}>Pagar</button>}
                    {(p.estado === 'pending-dp' || p.estado === 'pending-lg') && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aguarda validação</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}