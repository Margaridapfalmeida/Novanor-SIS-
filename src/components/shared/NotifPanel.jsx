import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useNavigate } from 'react-router-dom';
import { TIPO_COR, buildNotifNavState } from './notifUi';

function tempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotifPanel({ tiposFiltro, max = 5, titulo = 'Notificações' }) {
  const { user } = useAuth();
  const { getNotifsParaUser, marcarLida, dispensarNotificacao } = useNotifications();
  const navigate = useNavigate();

  const todas    = user ? getNotifsParaUser(user) : [];
  const filtradas = tiposFiltro ? todas.filter(n => tiposFiltro.includes(n.tipo)) : todas;
  const naoLidas  = filtradas.filter(n => !n.lida).length;

  if (filtradas.length === 0) return null;

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          {titulo}
          {naoLidas > 0 && (
            <span style={{ background: 'var(--color-danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{naoLidas} novas</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtradas.length} notificaç{filtradas.length === 1 ? 'ão' : 'ões'}</span>
      </div>

      <div style={{ maxHeight: max * 58, overflowY: 'auto' }}>
        {filtradas.map((n, i) => {
          const cor = TIPO_COR[n.tipo] || TIPO_COR['info'];
          const isAcao = n.accionavel && !n.done;
          const isDone = n.accionavel && n.done;
          return (
            <div key={n.id}
              style={{
                display: 'flex', gap: 12, padding: '10px 16px',
                borderBottom: i < filtradas.length - 1 ? '0.5px solid var(--border)' : 'none',
                background: isDone ? 'var(--bg-app)' : n.lida ? 'transparent' : `${cor.bg}66`,
                opacity: isDone ? 0.7 : 1,
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-app)';
                e.currentTarget.querySelector('.dismiss-btn')?.style && (e.currentTarget.querySelector('.dismiss-btn').style.opacity = '1');
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isDone ? 'var(--bg-app)' : n.lida ? 'transparent' : `${cor.bg}66`;
                e.currentTarget.querySelector('.dismiss-btn')?.style && (e.currentTarget.querySelector('.dismiss-btn').style.opacity = '0');
              }}
            >
              {/* Icon */}
              <div style={{ width: 30, height: 30, borderRadius: 8, background: isDone ? 'var(--border)' : cor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {isDone ? '✓' : n.icon}
              </div>

              {/* Body — clicável para navegar */}
              <div style={{ flex: 1, minWidth: 0, cursor: n.path ? 'pointer' : 'default' }}
                onClick={() => { marcarLida(n.id); if (n.path) navigate(n.path, { state: buildNotifNavState(n) }); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: isAcao ? 700 : n.lida ? 400 : 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {isDone && <span style={{ color: 'var(--color-success)', marginRight: 4 }}>✓</span>}
                    {n.titulo}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{tempoRelativo(n.timestamp)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</div>
                {isAcao && <div style={{ fontSize: 11, color: cor.dot, fontWeight: 600, marginTop: 2 }}>→ {n.acao || 'Acção necessária'}</div>}
              </div>

              {/* Dismiss ✕ — aparece ao hover */}
              <button
                className="dismiss-btn"
                onClick={e => { e.stopPropagation(); dispensarNotificacao(n.id); }}
                style={{
                  position: 'absolute', top: 6, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-muted)', padding: '2px 5px',
                  borderRadius: 4, lineHeight: 1, opacity: 0, transition: 'opacity .15s',
                }}
                title="Dispensar notificação"
              >✕</button>

              {!n.lida && !isAcao && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cor.dot, flexShrink: 0, marginTop: 5 }} />
              )}
            </div>
          );
        })}
      </div>

      {filtradas.length > max && (
        <div style={{ padding: '8px 16px', borderTop: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          ↕ Scroll para ver todas as {filtradas.length} notificações
        </div>
      )}
    </div>
  );
}
