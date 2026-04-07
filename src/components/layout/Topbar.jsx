import { useState, useRef, useEffect } from 'react';
import { Avatar } from '../../context/useProfilePhoto.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { TIPO_COR, buildNotifNavState } from '../shared/notifUi';
import logoNovanor from '../../img/logonovanor.png';
import { OBRAS_DATA } from '../../pages/Obras';
import { CLIENTES_DATA } from '../../pages/Clientes';
import { FORNECEDORES_DATA } from '../../pages/Fornecedores';
import { canViewPage, loadPerfis } from '../../context/PermissionsConfig';

const TITLES = {
  '/':             'Dashboard',
  '/tesouraria':   'Mapa de Tesouraria',
  '/obras':        'Obras',
  '/fornecedores': 'Fornecedores',
  '/clientes':     'Clientes',
  '/arquivo':      'Arquivo',
  '/rh':           'Recursos Humanos',
  '/logistica':    'Logística',
  '/perfil':       'Perfis & Acessos',
};

// ─── BOOKMARKS HELPERS ────────────────────────────────────────────────────────
const BK_KEY = 'sis_bookmarks';
function loadBookmarks(userId) {
  try { return JSON.parse(localStorage.getItem(BK_KEY) || '{}')[userId] || []; }
  catch { return []; }
}
function saveBookmarks(userId, list) {
  try {
    const all = JSON.parse(localStorage.getItem(BK_KEY) || '{}');
    all[userId] = list;
    localStorage.setItem(BK_KEY, JSON.stringify(all));
  } catch {}
}

function tempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function readLsArray(key) {
  try {
    const val = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function readLsObject(key) {
  try {
    const val = JSON.parse(localStorage.getItem(key) || '{}');
    return val && typeof val === 'object' ? val : {};
  } catch {
    return {};
  }
}

function buildSearchText(parts) {
  return normalizeText(parts.filter(Boolean).join(' '));
}

export default function Topbar({ agentOpen, sidebarOpen }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getNotifsParaUser, naoLidasParaUser, marcarLida, marcarTodasLidas, dispensarNotificacao, limparTodas } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bkOpen, setBkOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks(user?.id || ''));
  const ref = useRef(null);
  const searchRef = useRef(null);
  const bkRef = useRef(null);

  // Reload bookmarks when user changes
  useEffect(() => {
    setBookmarks(loadBookmarks(user?.id || ''));
  }, [user?.id]);

  const isBookmarked = bookmarks.some(b => b.path === pathname);
  const [bkNomeInput, setBkNomeInput] = useState('');
  const [bkNomeOpen, setBkNomeOpen] = useState(false);

  const toggleBookmark = () => {
    if (isBookmarked) {
      const updated = bookmarks.filter(b => b.path !== pathname);
      setBookmarks(updated);
      saveBookmarks(user?.id || '', updated);
    } else {
      // Open name input
      setBkNomeInput(title);
      setBkNomeOpen(true);
    }
  };

  const confirmarBookmark = () => {
    const nome = bkNomeInput.trim() || title;
    const updated = [...bookmarks, { path: pathname, label: nome, addedAt: Date.now() }];
    setBookmarks(updated);
    saveBookmarks(user?.id || '', updated);
    setBkNomeOpen(false);
    setBkNomeInput('');
  };

  const removeBookmark = (path) => {
    const updated = bookmarks.filter(b => b.path !== path);
    setBookmarks(updated);
    saveBookmarks(user?.id || '', updated);
  };

  const PAGES = [
    { label: 'Dashboard',        path: '/',             desc: 'Página principal' },
    { label: 'Mapa de Tesouraria', path: '/tesouraria', desc: 'Pagamentos, recebimentos, cashflow' },
    { label: 'Obras',            path: '/obras',         desc: 'Controlo de gestão por obra' },
    { label: 'Fornecedores',     path: '/fornecedores',  desc: 'Faturas e pagamentos a fornecedores' },
    { label: 'Clientes',         path: '/clientes',      desc: 'Faturas e recebimentos de clientes' },
    { label: 'Arquivo',          path: '/arquivo',       desc: 'Histório de documentos e faturas' },
    { label: 'Recursos Humanos', path: '/rh',            desc: 'Colaboradores, férias, passagens e despesas' },
    { label: 'Logística',        path: '/logistica',     desc: 'Frota, imóveis e contratos de utilidades' },
    { label: 'Perfis & Acessos', path: '/perfil',        desc: 'Gestão de utilizadores e permissões' },
  ];

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (bkRef.current && !bkRef.current.contains(e.target)) setBkOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const title = Object.entries(TITLES).find(([k]) =>
    k === '/' ? pathname === '/' : pathname === k || pathname.startsWith(k + '/')
  )?.[1] || 'NOVANOR SIS';

  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const minhasNotifs = user ? getNotifsParaUser(user) : [];
  const naoLidas = user ? naoLidasParaUser(user) : 0;
  const query = normalizeText(searchVal);
  const canSeePath = (path) => canViewPage(user, path);

  const searchResults = query
    ? (() => {
        const results = [];
        const pushResult = (result) => {
          if (!result?.path || !canSeePath(result.path)) return;
          if (!result.searchText?.includes(query)) return;
          results.push(result);
        };

        PAGES.forEach((p) => {
          pushResult({
            key: `page-${p.path}`,
            icon: '⌕',
            typeLabel: 'Pagina',
            label: p.label,
            sublabel: p.desc,
            path: p.path,
            searchText: buildSearchText([p.label, p.desc, p.path]),
            rank: 1,
          });
        });

        const obras = [...OBRAS_DATA, ...readLsArray('sis_obras_extra')];
        obras.forEach((obra) => {
          pushResult({
            key: `obra-${obra.id}`,
            icon: '◈',
            typeLabel: 'Obra',
            label: obra.nome || obra.id,
            sublabel: [obra.id, obra.cliente].filter(Boolean).join(' · '),
            path: `/obras/${obra.id}`,
            searchText: buildSearchText([obra.id, obra.nome, obra.cliente, obra.dp, obra.controller]),
            rank: 0,
          });
        });

        const clientes = [...CLIENTES_DATA, ...readLsArray('sis_clientes_extra')];
        clientes.forEach((cliente) => {
          pushResult({
            key: `cliente-${cliente.id}`,
            icon: '↑',
            typeLabel: 'Cliente',
            label: cliente.nome,
            sublabel: [cliente.contacto, cliente.nif, ...(cliente.obras || [])].filter(Boolean).join(' · '),
            path: '/clientes',
            navState: { abrirCliente: cliente.id },
            searchText: buildSearchText([cliente.nome, cliente.nif, cliente.contacto, cliente.email, cliente.morada, ...(cliente.obras || [])]),
            rank: 2,
          });
        });

        const fornecedores = [...FORNECEDORES_DATA, ...readLsArray('sis_fornecedores_extra')];
        fornecedores.forEach((fornecedor) => {
          pushResult({
            key: `fornecedor-${fornecedor.id}`,
            icon: '↓',
            typeLabel: 'Fornecedor',
            label: fornecedor.nome,
            sublabel: [fornecedor.contacto, fornecedor.nif, ...(fornecedor.obras || [])].filter(Boolean).join(' · '),
            path: '/fornecedores',
            navState: { abrirFornecedor: fornecedor.id },
            searchText: buildSearchText([fornecedor.nome, fornecedor.nif, fornecedor.contacto, fornecedor.email, fornecedor.morada, ...(fornecedor.obras || [])]),
            rank: 2,
          });
        });

        const perfis = loadPerfis();
        perfis
          .filter((perfil) => perfil.isColaborador)
          .forEach((perfil) => {
            pushResult({
              key: `colab-${perfil.id}`,
              icon: '👤',
              typeLabel: 'Colaborador',
              label: perfil.nome,
              sublabel: [perfil.role, perfil.email].filter(Boolean).join(' · '),
              path: '/rh',
              navState: { rhTab: 'colaboradores', abrirColaborador: perfil.id },
              searchText: buildSearchText([perfil.nome, perfil.role, perfil.email, perfil.departamento, perfil.colaboradorId]),
              rank: 2,
            });
          });

        const faturasCliLs = readLsObject('sis_faturas_cli');
        clientes.forEach((cliente) => {
          const faturas = [
            ...(cliente.faturas || []),
            ...(Array.isArray(faturasCliLs[cliente.id]) ? faturasCliLs[cliente.id] : []),
          ];
          faturas.forEach((fatura) => {
            pushResult({
              key: `fat-cli-${cliente.id}-${fatura.id}`,
              icon: '🧾',
              typeLabel: 'Fatura Cliente',
              label: fatura.id || fatura.descricao || 'Fatura cliente',
              sublabel: [cliente.nome, fatura.obra, fatura.descricao].filter(Boolean).join(' · '),
              path: '/clientes',
              navState: { abrirFatura: { clienteId: cliente.id, clienteNome: cliente.nome, faturaId: fatura.id } },
              searchText: buildSearchText([fatura.id, fatura.descricao, fatura.obra, cliente.nome, cliente.contacto]),
              rank: 1,
            });
          });
        });

        const faturasFornLs = readLsObject('sis_faturas_forn');
        fornecedores.forEach((fornecedor) => {
          const faturas = [
            ...(fornecedor.faturas || []),
            ...(Array.isArray(faturasFornLs[fornecedor.id]) ? faturasFornLs[fornecedor.id] : []),
          ];
          faturas.forEach((fatura) => {
            pushResult({
              key: `fat-forn-${fornecedor.id}-${fatura.id}`,
              icon: '📄',
              typeLabel: 'Fatura Fornecedor',
              label: fatura.id || fatura.descricao || 'Fatura fornecedor',
              sublabel: [fornecedor.nome, fatura.obra, fatura.descricao].filter(Boolean).join(' · '),
              path: '/fornecedores',
              navState: { abrirFaturaForn: { faturaId: fatura.id, fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome } },
              searchText: buildSearchText([fatura.id, fatura.descricao, fatura.obra, fornecedor.nome, fornecedor.contacto]),
              rank: 1,
            });
          });
        });

        [
          { key: 'rh-colaboradores', icon: '👥', typeLabel: 'RH', label: 'Colaboradores', sublabel: 'Lista e fichas detalhadas de colaboradores', path: '/rh', navState: { rhTab: 'colaboradores' } },
          { key: 'rh-ferias', icon: '🌴', typeLabel: 'RH', label: 'Calendario de ferias', sublabel: 'Planeamento de férias e faltas', path: '/rh', navState: { rhTab: 'ferias' } },
          { key: 'rh-despesas', icon: '🧾', typeLabel: 'RH', label: 'Despesas internas', sublabel: 'Gestão interna de despesas e reembolsos', path: '/rh', navState: { rhTab: 'despesas' } },
          { key: 'tes-resumo', icon: '⊞', typeLabel: 'Tesouraria', label: 'Mapa tesouraria', sublabel: 'Resumo geral do mapa de tesouraria', path: '/tesouraria', navState: { tesTab: 'resumo' } },
          { key: 'tes-fornecedores', icon: '↓', typeLabel: 'Tesouraria', label: 'Mapa tesouraria fornecedores', sublabel: 'Pagamentos a fornecedores', path: '/tesouraria', navState: { tesTab: 'pagamentos' } },
          { key: 'tes-clientes', icon: '↑', typeLabel: 'Tesouraria', label: 'Mapa tesouraria clientes', sublabel: 'Recebimentos de clientes', path: '/tesouraria', navState: { tesTab: 'recebimentos' } },
          { key: 'tes-investimentos', icon: '📈', typeLabel: 'Tesouraria', label: 'Mapa tesouraria investimentos', sublabel: 'Entradas e saídas de investimentos', path: '/tesouraria', navState: { tesTab: 'investimentos' } },
        ].forEach((item) => {
          pushResult({
            ...item,
            searchText: buildSearchText([item.label, item.sublabel]),
            rank: 1,
          });
        });

        return results
          .sort((a, b) => {
            const aStarts = a.searchText.startsWith(query) ? 0 : 1;
            const bStarts = b.searchText.startsWith(query) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.label.localeCompare(b.label, 'pt-PT');
          })
          .filter((result, index, arr) => arr.findIndex((item) => item.key === result.key) === index)
          .slice(0, 10);
      })()
    : [];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClickNotif = (n) => {
    marcarLida(n.id);
    const state = buildNotifNavState(n);
    navigate(n.path || '/', Object.keys(state).length ? { state } : {});
    setNotifOpen(false);
  };

  const handleSearchSelect = (result) => {
    navigate(
      result.path,
      result.path.startsWith('/obras/')
        ? undefined
        : { state: { globalSearch: result.label, globalSearchType: result.typeLabel, ...(result.navState || {}) } }
    );
    setSearchVal('');
    setSearchOpen(false);
  };

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'var(--bg-card)',
      borderBottom: '0.5px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      position: 'fixed', top: 0,
      left: sidebarOpen ? 'var(--sidebar-width)' : 0,
      right: agentOpen ? 'var(--agent-width)' : 0,
      zIndex: 300,
      transition: 'left 0.25s ease, right 0.25s ease',
      gap: 14,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {!sidebarOpen && (
          <img
            src={logoNovanor}
            alt="Novanor"
            style={{ width: 132, height: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
        )}
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{today}</div>

      {/* Pesquisa funcional */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <input
          placeholder="Pesquisar obras, colaboradores, faturas, clientes..."
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              handleSearchSelect(searchResults[0]);
            }
            if (e.key === 'Escape') { setSearchOpen(false); setSearchVal(''); }
          }}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 13,
            padding: '6px 10px 6px 30px',
            border: `0.5px solid ${searchOpen && searchVal ? 'var(--brand-primary)' : 'var(--border)'}`,
            borderRadius: 20, background: 'var(--bg-app)',
            color: 'var(--text-primary)', outline: 'none', width: 200,
            transition: 'border-color .15s',
          }}
        />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>⌕</span>
        {searchOpen && query && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 280,
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 400, overflow: 'hidden',
          }}>
            {searchResults.length > 0 ? searchResults.map((result, index) => (
              <div key={result.key} onClick={() => handleSearchSelect(result)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: index < searchResults.length - 1 ? '0.5px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {result.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--brand-primary)', background: 'var(--bg-info)', borderRadius: 999, padding: '2px 6px', flexShrink: 0 }}>{result.typeLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.sublabel}</div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                Sem resultados para "{searchVal.trim()}".
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bookmarks */}
      <div ref={bkRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Star toggle for current page */}
          <button
            onClick={toggleBookmark}
            title={isBookmarked ? 'Remover marcador' : 'Adicionar marcador'}
            style={{
              width: 30, height: 30, borderRadius: 7, border: '0.5px solid var(--border)',
              background: isBookmarked ? 'var(--bg-warning)' : 'var(--bg-app)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, transition: 'all .15s',
              color: isBookmarked ? '#C47A1A' : 'var(--text-muted)',
            }}
          >{isBookmarked ? '★' : '☆'}</button>

          {/* Bookmarks list dropdown */}
          {bookmarks.length > 0 && (
            <button
              onClick={() => setBkOpen(o => !o)}
              title="Os meus marcadores"
              style={{
                width: 30, height: 30, borderRadius: 7,
                border: bkOpen ? '0.5px solid var(--brand-primary)' : '0.5px solid var(--border)',
                background: bkOpen ? 'var(--bg-info)' : 'var(--bg-app)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                color: bkOpen ? 'var(--brand-primary)' : 'var(--text-muted)',
                transition: 'all .15s',
              }}
            >{bookmarks.length}</button>
          )}
        </div>

        {/* Nome do marcador — popup inline */}
        {bkNomeOpen && (
          <div style={{
            position: 'fixed', right: 24, top: 'calc(var(--topbar-height) + 4px)',
            width: 280, background: 'var(--bg-card)',
            border: '0.5px solid var(--brand-primary)', borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)', zIndex: 9999, padding: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dar nome ao marcador</div>
            <input
              autoFocus
              value={bkNomeInput}
              onChange={e => setBkNomeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarBookmark(); if (e.key === 'Escape') setBkNomeOpen(false); }}
              placeholder="Nome do marcador..."
              style={{
                width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
                padding: '7px 10px', border: '0.5px solid var(--border-strong)',
                borderRadius: 8, background: 'var(--bg-app)',
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setBkNomeOpen(false)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" onClick={confirmarBookmark}>★ Guardar</button>
            </div>
          </div>
        )}

        {bkOpen && (
          <div style={{
            position: 'fixed', right: 24, top: 'calc(var(--topbar-height) + 4px)',
            width: 300, background: 'var(--bg-card)',
            border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)', zIndex: 9999, overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Marcadores
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {bookmarks.map((bk, i) => (
                <div key={bk.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderBottom: i < bookmarks.length - 1 ? '0.5px solid var(--border)' : 'none',
                    background: bk.path === pathname ? 'var(--bg-app)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (bk.path !== pathname) e.currentTarget.style.background = 'var(--bg-app)'; }}
                  onMouseLeave={e => { if (bk.path !== pathname) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 14, color: '#C47A1A' }}>★</span>
                  <span
                    onClick={() => { navigate(bk.path); setBkOpen(false); }}
                    style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: bk.path === pathname ? 600 : 400 }}
                  >{bk.label}</span>
                  <button
                    onClick={() => removeBookmark(bk.path)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >✕</button>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 14px', borderTop: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Clica ★ em qualquer página para guardar
            </div>
          </div>
        )}
      </div>

      {/* Notificações */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setNotifOpen(o => !o)} style={{
          width: 34, height: 34, borderRadius: 8,
          border: notifOpen ? '0.5px solid var(--brand-primary)' : '0.5px solid var(--border)',
          background: notifOpen ? 'var(--bg-info)' : 'var(--bg-app)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', transition: 'all .15s',
        }}>
          <span style={{ fontSize: 15 }}>🔔</span>
          {naoLidas > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--color-danger)',
              border: '1.5px solid var(--bg-card)',
            }} />
          )}
        </button>

        {notifOpen && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 380, background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
            zIndex: 9999, overflow: 'hidden',
          }}>
            {/* Header dropdown */}
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Notificações
                {naoLidas > 0 && (
                  <span style={{ marginLeft: 8, background: 'var(--color-danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{naoLidas}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {naoLidas > 0 && (
                  <button onClick={marcarTodasLidas} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Marcar todas como lidas
                  </button>
                )}
                {minhasNotifs.length > 0 && (
                  <button onClick={() => { if (window.confirm('Limpar as tuas notificações?')) limparTodas(user); }}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Limpar tudo
                  </button>
                )}
              </div>
            </div>

            {/* Lista — scroll fixo a 5 itens */}
            <div style={{ maxHeight: 5 * 58, overflowY: 'auto' }}>
              {minhasNotifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                  Sem notificações
                </div>
              ) : minhasNotifs.map((n, i) => {
                const cor = TIPO_COR[n.tipo] || TIPO_COR['info'];
                const isAcao = n.accionavel && !n.done;
                const isAlerta = n.alerta;
                const isDone = n.accionavel && n.done;
                return (
                  <div key={n.id}
                    style={{
                      display: 'flex', gap: 12, padding: '11px 16px',
                      borderBottom: i < minhasNotifs.length - 1 ? '0.5px solid var(--border)' : 'none',
                      background: isDone ? 'var(--bg-app)' : n.lida ? 'transparent' : `${cor.bg}88`,
                      opacity: isDone ? 0.6 : 1,
                    }}
                  >
                    <div onClick={() => handleClickNotif(n)} style={{ cursor: 'pointer', display: 'flex', gap: 12, flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isDone ? 'var(--border)' : cor.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, position: 'relative',
                      }}>
                        {isDone ? '✓' : n.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: isAcao ? 700 : n.lida ? 400 : 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1.3 }}>
                            {isDone && <span style={{ fontSize: 11, color: 'var(--color-success)', marginRight: 4 }}>✓</span>}
                            {n.titulo}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{tempoRelativo(n.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</div>
                        {isAcao && (
                          <div style={{ marginTop: 4, fontSize: 11, color: cor.dot, fontWeight: 600 }}>→ {n.acao || 'Acção necessária'}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {!n.lida && !isAcao && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: cor.dot, marginTop: 5 }} />
                      )}
                      <button onClick={e => { e.stopPropagation(); dispensarNotificacao(n.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4, lineHeight: 1, opacity: 0, transition: 'opacity .15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                        title="Dispensar notificação">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div onClick={() => navigate('/perfil')} style={{ cursor: 'pointer', flexShrink: 0 }} title="O meu perfil">
        <Avatar userId={user?.id} initials={user?.initials || 'SIS'} cor={user?.cor} size={32} />
      </div>
    </header>
  );
}
