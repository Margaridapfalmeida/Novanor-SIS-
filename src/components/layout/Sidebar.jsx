import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../context/useProfilePhoto.js';
import logoNovanor from '../../img/logonovanor.png';
import { canViewPage } from '../../context/PermissionsConfig';

const ALL_NAV = [
  { group: 'Principal', items: [
    { path: '/',           label: 'Dashboard',          icon: '▦', exact: true },
    { path: '/tesouraria', label: 'Mapa de Tesouraria', icon: '⬡', badge: 2 },
    { path: '/obras',      label: 'Obras',              icon: '◈', badge: 1 },
  ]},
  { group: 'Financeiro', items: [
    { path: '/fornecedores', label: 'Fornecedores', icon: '↓', badge: 3 },
    { path: '/clientes',     label: 'Clientes',     icon: '↑', badge: 1 },
  ]},
  { group: 'Gestão', items: [
    { path: '/arquivo', label: 'Arquivo', icon: '◻' },
    { path: '/rh',      label: 'Recursos Humanos', icon: '👥' },
    { path: '/logistica', label: 'Logística', icon: '🚚' },
    { path: '/perfil',  label: 'Perfil',  icon: '○' },
  ]},
];

export default function Sidebar({ agentOpen, setAgentOpen, open, onToggle }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const nav = ALL_NAV.map(group => ({
    ...group,
    items: group.items.filter(item =>
      canViewPage(user, item.path)
    ).map(item =>
      item.path === '/perfil'
        ? { ...item, label: user?.isAdmin ? 'Perfis & Admin' : 'O meu perfil' }
        : item
    ),
  })).filter(group => group.items.length > 0);

  return (
    <aside style={{
      width: 'var(--sidebar-width)', background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 320, overflowY: 'auto',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.25s ease',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 18px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <img
              src={logoNovanor}
              alt="Novanor"
              style={{ width: 156, height: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: 1.3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              SIS - Smart Information System
            </div>
          </div>
          {/* Botão fechar sidebar */}
          <button
            onClick={onToggle}
            title="Recolher menu"
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)', fontSize: 14, transition: 'background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >‹</button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {nav.map(group => (
          <div key={group.group} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', padding: '10px 18px 4px' }}>
              {group.group}
            </div>
            {group.items.map(item => {
              const isActive = item.exact
                ? pathname === item.path
                : pathname === item.path || pathname.startsWith(item.path + '/');
              return (
                <NavLink key={item.path} to={item.path} end={item.exact} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 18px',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 500 : 400,
                  background: isActive ? 'rgba(255,255,255,0.13)' : 'transparent',
                  borderLeft: isActive ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
                  transition: 'all 0.12s',
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{ background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(184,50,50,0.85)', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{item.badge}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={() => setAgentOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 12px', borderRadius: 8, marginBottom: 6,
          border: agentOpen ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
          background: agentOpen ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
          color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-body)', transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 15 }}>✦</span>
          <span>Agente SIS</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px', borderRadius: 10, background: agentOpen ? 'rgba(255,255,255,0.18)' : 'transparent', color: agentOpen ? '#fff' : 'rgba(255,255,255,0.5)', border: agentOpen ? 'none' : '0.5px solid rgba(255,255,255,0.2)' }}>
            {agentOpen ? 'activo' : 'abrir'}
          </span>
        </button>

        {/* Utilizador */}
        <NavLink to="/perfil" style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
          borderRadius: 8, textDecoration: 'none',
          background: pathname === '/perfil' ? 'rgba(255,255,255,0.1)' : 'transparent',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = pathname === '/perfil' ? 'rgba(255,255,255,0.1)' : 'transparent'; }}
        >
          <Avatar userId={user?.id} initials={user?.initials || '?'} cor={user?.cor || 'rgba(255,255,255,0.2)'} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.nome || 'Utilizador'}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{user?.role || ''}</div>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>›</span>
        </NavLink>
      </div>
    </aside>
  );
}
