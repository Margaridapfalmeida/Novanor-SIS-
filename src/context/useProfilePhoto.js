// ─── useProfilePhoto ──────────────────────────────────────────────────────────
// Returns the profile photo (base64) for a given userId, or null.
// Listens to storage events so avatars update across all open components
// when the user uploads a new photo on the Perfil page.

import { useState, useEffect } from 'react';

const PERFIL_EXTRA_KEY = 'sis_perfil_extra';

function getFoto(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}');
    return all[userId]?.foto || null;
  } catch { return null; }
}

export function useProfilePhoto(userId) {
  const [foto, setFoto] = useState(() => getFoto(userId));

  useEffect(() => {
    setFoto(getFoto(userId));
    const handler = () => setFoto(getFoto(userId));
    window.addEventListener('storage', handler);
    window.addEventListener('perfil_foto_updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('perfil_foto_updated', handler);
    };
  }, [userId]);

  return foto;
}

// Avatar component — used everywhere a user avatar is needed
export function Avatar({ userId, initials, cor, size = 32, style = {} }) {
  const foto = useProfilePhoto(userId);
  const s = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...style,
  };
  if (foto) {
    return <img src={foto} alt={initials} style={{ ...s, objectFit: 'cover' }} />;
  }
  return (
    <div style={{ ...s, background: cor || 'var(--brand-primary)', color: '#fff', fontSize: Math.round(size * 0.375), fontWeight: 700 }}>
      {initials || '?'}
    </div>
  );
}