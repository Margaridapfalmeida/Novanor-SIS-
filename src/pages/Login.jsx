import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadPerfis } from '../context/PermissionsConfig';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const perfis    = loadPerfis();

  const [selected, setSelected] = useState(null);
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');

  const handleLogin = () => {
    if (!selected) { setError('Selecciona um perfil'); return; }
    if (pin.length < 4) { setError('PIN incorreto'); return; }
    const result = login(selected.id, pin);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.erro);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-app)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--brand-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 24, fontWeight: 700, color: '#fff',
          }}>N</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>NOVANOR SIS</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Sistema Integrado de Gestão</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Selecciona o teu perfil
          </div>

          {/* Grid de perfis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {perfis.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setPin(''); setError(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: selected?.id === p.id ? `1.5px solid ${p.cor}` : '0.5px solid var(--border)',
                  background: selected?.id === p.id ? `${p.cor}11` : 'var(--bg-app)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all .15s', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: p.cor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{p.initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.role}</div>
                </div>
              </button>
            ))}
          </div>

          {/* PIN */}
          {selected && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                PIN de acesso — {selected.nome}
              </div>
              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                maxLength={8}
                placeholder="• • • •"
                autoFocus
                style={{
                  width: '100%', fontFamily: 'var(--font-body)',
                  fontSize: 20, letterSpacing: 10, textAlign: 'center',
                  padding: '8px 10px', border: `0.5px solid ${error ? 'var(--color-danger)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', outline: 'none', display: 'block',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            onClick={handleLogin}
          >
            Entrar no SIS
          </button>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Acesso restrito a colaboradores NOVANOR
          </div>
        </div>
      </div>
    </div>
  );
}
