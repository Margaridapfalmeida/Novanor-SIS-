import { useMemo, useState } from 'react';
import {
  ACCESS_LEVELS,
  getEntityAccess,
  loadPerfis,
  saveEntityAccess,
} from '../../context/PermissionsConfig';

function LevelPills({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {ACCESS_LEVELS.map((level) => (
        <button
          key={level.value}
          type="button"
          onClick={() => onChange(level.value)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            padding: '5px 10px',
            borderRadius: 999,
            border: `0.5px solid ${value === level.value ? 'var(--brand-primary)' : 'var(--border)'}`,
            background: value === level.value ? 'var(--brand-primary)' : 'var(--bg-app)',
            color: value === level.value ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}

export default function EntityAccessEditorModal({
  entityType,
  entityId,
  title,
  subtitle,
  sections = [],
  secondaryAccess = null,
  onClose,
  onSaved,
}) {
  const existing = useMemo(() => getEntityAccess(entityType, entityId), [entityType, entityId]);
  const secondaryExisting = useMemo(
    () => secondaryAccess ? getEntityAccess(secondaryAccess.entityType, secondaryAccess.entityId) : null,
    [secondaryAccess],
  );
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState(existing.members || {});
  const [sectionMembers, setSectionMembers] = useState(existing.sections || {});
  const [secondaryMembers, setSecondaryMembers] = useState(secondaryExisting?.members || {});
  const colaboradores = useMemo(
    () => loadPerfis().filter((perfil) => perfil.isColaborador || perfil.isAdmin),
    [],
  );

  const filtered = colaboradores.filter((perfil) => {
    const q = search.trim().toLowerCase();
    return !q
      || perfil.nome.toLowerCase().includes(q)
      || (perfil.role || '').toLowerCase().includes(q)
      || (perfil.email || '').toLowerCase().includes(q);
  });

  const setMemberLevel = (userId, level) => setMembers((prev) => ({ ...prev, [userId]: level }));
  const setSecondaryMemberLevel = (userId, level) => setSecondaryMembers((prev) => ({ ...prev, [userId]: level }));
  const setSectionLevel = (sectionKey, userId, level) => {
    setSectionMembers((prev) => ({
      ...prev,
      [sectionKey]: {
        members: {
          ...(prev[sectionKey]?.members || {}),
          [userId]: level,
        },
      },
    }));
  };

  const handleSave = () => {
    saveEntityAccess(entityType, entityId, {
      members,
      sections: sectionMembers,
    });
    if (secondaryAccess) {
      saveEntityAccess(secondaryAccess.entityType, secondaryAccess.entityId, {
        members: secondaryMembers,
      });
    }
    window.dispatchEvent(new Event('sis_access_matrix_updated'));
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 1080, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-app)' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar colaborador..."
            style={{ flex: 1, minWidth: 240, fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 12px', border: '0.5px solid var(--border)', borderRadius: 999, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admins mantêm sempre acesso total.</div>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ margin: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Acesso à página / entidade
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((perfil) => (
                <div key={perfil.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-app)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{perfil.nome}</span>
                      {perfil.isAdmin && <span className="badge badge-i" style={{ fontSize: 9 }}>Admin</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[perfil.role, perfil.email].filter(Boolean).join(' · ')}</div>
                  </div>
                  <LevelPills value={perfil.isAdmin ? 'edit' : (members[perfil.id] || 'none')} onChange={(level) => !perfil.isAdmin && setMemberLevel(perfil.id, level)} />
                </div>
              ))}
            </div>
          </div>

          {secondaryAccess && (
            <div className="card" style={{ margin: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{secondaryAccess.label}</div>
                {secondaryAccess.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{secondaryAccess.description}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((perfil) => (
                  <div key={`secondary-${perfil.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-app)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{perfil.nome}</span>
                        {perfil.isAdmin && <span className="badge badge-i" style={{ fontSize: 9 }}>Admin</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{perfil.role || 'Sem cargo'}</div>
                    </div>
                    <LevelPills
                      value={perfil.isAdmin ? 'edit' : (secondaryMembers[perfil.id] || 'none')}
                      onChange={(level) => !perfil.isAdmin && setSecondaryMemberLevel(perfil.id, level)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.key} className="card" style={{ margin: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{section.label}</div>
                {section.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{section.description}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((perfil) => (
                  <div key={`${section.key}-${perfil.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-app)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{perfil.nome}</span>
                        {perfil.isAdmin && <span className="badge badge-i" style={{ fontSize: 9 }}>Admin</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{perfil.role || 'Sem cargo'}</div>
                    </div>
                    <LevelPills
                      value={perfil.isAdmin ? 'edit' : (sectionMembers[section.key]?.members?.[perfil.id] || 'none')}
                      onChange={(level) => !perfil.isAdmin && setSectionLevel(section.key, perfil.id, level)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar acessos</button>
        </div>
      </div>
    </div>
  );
}
