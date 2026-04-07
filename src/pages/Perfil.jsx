import { useState, useRef } from 'react';
import { Avatar } from '../context/useProfilePhoto.js';
import { useAuth } from '../context/AuthContext';
import { OBRAS_DATA } from './Obras';
import { CLIENTES_DATA } from './Clientes';
import EntityAccessEditorModal from '../components/access/EntityAccessEditorModal.jsx';
import {
  ACCESS_LEVELS,
  MODULES_SIS,
  loadPerfis,
  savePerfis,
  TODAS_PAGINAS,
  NOTIF_TIPOS,
  DEPARTAMENTOS,
  HIERARCHY_TYPES,
  normalizePerfil,
  canViewPage,
  getEntityAccess,
} from '../context/PermissionsConfig';
import { prepareSystemForDelivery } from '../utils/deliveryMode';

const MANAGED_PAGES = TODAS_PAGINAS.filter((page) => page.path !== '/');
const MANAGED_MODULES = MODULES_SIS.filter((module) => module.key !== 'dashboard');

const inp = err => ({
  width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
  padding: '7px 10px',
  border: `0.5px solid ${err ? 'var(--color-danger)' : 'var(--border-strong)'}`,
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
});

// Cores vêm dos departamentos — ver DEPARTAMENTOS em PermissionsConfig

function AccessLevelSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ACCESS_LEVELS.map(level => (
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

function buildEmptyProfile() {
  return normalizePerfil({
    id: '',
    initials: '',
    nome: '',
    email: '',
    role: '',
    departamento: 'outro',
    cor: '#9CA3AF',
    isAdmin: false,
    isColaborador: false,
    pin: '',
    idade: '',
    genero: '',
    colaboradorId: '',
    hierarquia: {
      tipo: 'colaborador',
      nivel: 10,
      departamentosGeridos: [],
    },
    paginas: ['/'],
    acoes: [],
  });
}

function GestaoAcessosModal({ onClose }) {
  const [tab, setTab] = useState('paginas');
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const pages = MANAGED_PAGES.map((page) => ({
    id: page.path,
    nome: page.label,
    categoria: 'Página do SIS',
    descricao: page.path,
  }));
  const modules = MANAGED_MODULES.map((module) => ({
    id: module.key,
    nome: module.label,
    categoria: 'Módulo funcional',
    descricao: module.path,
  }));
  const entityMeta = {
    paginas: { list: pages, title: 'página', entityType: 'paginas' },
  };
  const entities = entityMeta[tab].list;
  const filtered = entities.filter((item) => {
    const q = search.trim().toLowerCase();
    const label = `${item.id} ${item.nome} ${item.categoria || ''} ${item.descricao || ''}`;
    return !q || label.toLowerCase().includes(q);
  });

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 820, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Gerir acessos</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Escolhe uma página do SIS e define logo ali quem pode vê-la e quem pode usar as respetivas funcionalidades internas.
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-app)' }}>
            <span className="badge badge-i" style={{ fontSize: 11 }}>Páginas ({pages.length})</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Pesquisar ${entityMeta[tab].title}...`}
              style={{ marginLeft: 'auto', minWidth: 260, fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 12px', border: '0.5px solid var(--border)', borderRadius: 999, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {filtered.map((item) => {
              const access = getEntityAccess(entityMeta[tab].entityType, item.id);
              const assignedCount = Object.values(access.members || {}).filter((level) => level !== 'none').length;
              return (
                <div key={item.id} className="card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.nome}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => setSelectedEntity(item)}>Gerir acessos</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedEntity && (
        <EntityAccessEditorModal
          entityType={entityMeta[tab].entityType}
          entityId={selectedEntity.id}
          title={`Acessos — ${selectedEntity.nome}`}
          subtitle=""
          secondaryAccess={(() => {
            const module = modules.find((item) => item.descricao === selectedEntity.id);
            if (!module) return null;
            return {
              entityType: 'modulos',
              entityId: module.id,
              label: 'Acesso funcional dentro da página',
              description: `Aqui defines se a pessoa só entra na página ou se também pode trabalhar dentro da área ${module.nome}.`,
            };
          })()}
          sections={[]}
          onClose={() => setSelectedEntity(null)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}

// ─── MODAL EDITAR PERFIL ──────────────────────────────────────────────────────
function EditarPerfilModal({ perfil, onClose, onSave, isNew }) {
  const [form, setForm] = useState(perfil ? normalizePerfil({ ...perfil }) : buildEmptyProfile());
  const [tab, setTab] = useState('info');
  const [errors, setErrors] = useState({});
  const fotoRef = useRef(null);
  const obrasDisponiveis = [
    ...OBRAS_DATA,
    ...(() => { try { return JSON.parse(localStorage.getItem('sis_obras_extra') || '[]'); } catch { return []; } })(),
  ];
  const PERFIL_EXTRA_KEY = 'sis_perfil_extra';
  const [fotoPreview, setFotoPreview] = useState(() => {
    if (!perfil?.id) return null;
    try { return JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}')[perfil.id]?.foto || null; } catch { return null; }
  });

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };



  const setPageLevel = (path, level) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        paginas: { ...f.permissoes.paginas, [path]: level },
      },
    }));
  };
  const setAllPageLevels = (level) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        paginas: {
          ...f.permissoes.paginas,
          ...Object.fromEntries(MANAGED_PAGES.map(page => [page.path, level])),
        },
      },
    }));
  };

  const setModuleLevel = (key, level) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        modulos: { ...f.permissoes.modulos, [key]: level },
      },
    }));
  };
  const setAllModuleLevels = (level) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        modulos: {
          ...f.permissoes.modulos,
          ...Object.fromEntries(MANAGED_MODULES.map(module => [module.key, level])),
        },
      },
    }));
  };

  const setObrasScope = (mode) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        obras: { ...f.permissoes.obras, mode, ids: mode === 'selected' ? f.permissoes.obras.ids : [] },
      },
    }));
  };

  const setObrasLevel = (level) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        obras: { ...f.permissoes.obras, level },
      },
    }));
  };

  const toggleObra = (obraId) => {
    setForm(f => ({
      ...f,
      permissoes: {
        ...f.permissoes,
        obras: {
          ...f.permissoes.obras,
          ids: f.permissoes.obras.ids.includes(obraId)
            ? f.permissoes.obras.ids.filter(id => id !== obraId)
            : [...f.permissoes.obras.ids, obraId],
        },
      },
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Campo obrigatório';
    if (!form.initials.trim()) e.initials = 'Campo obrigatório';
    if (!form.role.trim()) e.role = 'Campo obrigatório';
    if (isNew && !form.pin.trim()) e.pin = 'Campo obrigatório';
    if (isNew && (!form.id.trim() || !/^[a-z0-9_]+$/.test(form.id))) e.id = 'ID inválido (letras minúsculas, números, _)';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (fotoPreview && form.id) {
      try {
        const all = JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}');
        all[form.id] = { ...(all[form.id] || {}), foto: fotoPreview };
        localStorage.setItem(PERFIL_EXTRA_KEY, JSON.stringify(all));
        window.dispatchEvent(new Event('perfil_foto_updated'));
      } catch {}
    }
    onSave(form);
  };

  return (
    <div onClick={undefined} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)', width: '100%', maxWidth: 620,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{isNew ? 'Novo utilizador' : `Editar — ${perfil.nome}`}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Configura acessos, ações </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', padding: '0 22px', flexShrink: 0 }}>
          {[
            { key: 'info',    label: 'Dados' },

          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
              padding: '8px 14px', border: 'none', background: 'none',
              color: tab === t.key ? 'var(--brand-primary)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {/* Tab: Dados */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', borderRadius: 12, border: '0.5px solid var(--border)', background: 'var(--bg-app)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {fotoPreview ? (
                    <img src={fotoPreview} alt={form.initials || form.nome || 'perfil'} style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 76, height: 76, borderRadius: '50%', background: form.cor || 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                      {(form.initials || form.nome?.slice(0, 2) || '?').slice(0, 3)}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fotografia do perfil</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>O administrador pode definir ou atualizar a fotografia desta pessoa diretamente aqui.</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" type="button" onClick={() => fotoRef.current?.click()}>Escolher fotografia</button>
                    {fotoPreview && <button className="btn btn-sm" type="button" onClick={() => setFotoPreview(null)}>Remover</button>}
                    <input
                      ref={fotoRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setFotoPreview(ev.target?.result || null);
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Nome completo *</label>
                <input value={form.nome} onChange={e => set('nome', e.target.value)} style={inp(errors.nome)} />
                {errors.nome && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.nome}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Iniciais (ex: MS) *</label>
                <input value={form.initials} onChange={e => set('initials', e.target.value.toUpperCase().slice(0, 3))} placeholder="MS" style={inp(errors.initials)} />
                {errors.initials && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.initials}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Cargo / Departamento *</label>
                <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="ex: Tesouraria" style={inp(errors.role)} />
                {errors.role && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.role}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="nome@novanor.pt" style={inp(false)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>PIN {isNew ? '*' : '(deixa em branco para manter)'}</label>
                <input type="password" value={form.pin} onChange={e => set('pin', e.target.value)} placeholder="4+ dígitos" maxLength={8} style={inp(errors.pin)} />
                {errors.pin && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.pin}</div>}
              </div>
              {isNew && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>ID interno * (ex: lg, dp2)</label>
                  <input value={form.id} onChange={e => set('id', e.target.value.toLowerCase())} placeholder="ex: dp2" style={inp(errors.id)} />
                  {errors.id && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.id}</div>}
                </div>
              )}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Departamento</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEPARTAMENTOS.map(d => (
                    <button key={d.id} type="button"
                      onClick={() => { set('departamento', d.id); set('cor', d.cor); }}
                      style={{
                        fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', borderRadius: 20,
                        border: `2px solid ${form.departamento === d.id ? d.cor : 'transparent'}`,
                        background: d.cor, color: d.corTexto, cursor: 'pointer',
                        opacity: form.departamento === d.id ? 1 : 0.55,
                        fontWeight: form.departamento === d.id ? 700 : 400,
                        transition: 'all .15s',
                      }}>{d.label}</button>
                  ))}
                </div>
                {form.departamento && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    O departamento ajuda a organizar o perfil, mas os acessos passam a ser geridos pelos níveis definidos nos separadores seguintes.
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isAdmin} onChange={e => set('isAdmin', e.target.checked)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Administrador</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Acesso total a todas as páginas e acessos</div>
                  </div>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isColaborador || false} onChange={e => set('isColaborador', e.target.checked)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Colaborador NOVANOR</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aparece em Recursos Humanos (férias, despesas, passagens)</div>
                  </div>
                </label>
              </div>

              <div style={{ gridColumn: 'span 2', height: '0.5px', background: 'var(--border)', margin: '4px 0' }} />
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Hierarquia e Gestão</label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Posição hierárquica</label>
                <select
                  value={form.hierarquia?.tipo || 'colaborador'}
                  onChange={(e) => setForm(f => normalizePerfil({
                    ...f,
                    hierarquia: { ...(f.hierarquia || {}), tipo: e.target.value },
                  }))}
                  style={inp(false)}
                >
                  {HIERARCHY_TYPES.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Nível interno</label>
                <input
                  type="number"
                  value={form.hierarquia?.nivel || ''}
                  onChange={(e) => setForm(f => ({
                    ...f,
                    hierarquia: { ...(f.hierarquia || {}), nivel: Number(e.target.value) || 0 },
                  }))}
                  style={inp(false)}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Áreas geridas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEPARTAMENTOS.filter(d => d.id !== 'outro').map(d => {
                    const active = (form.hierarquia?.departamentosGeridos || []).includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          hierarquia: {
                            ...(f.hierarquia || {}),
                            departamentosGeridos: active
                              ? (f.hierarquia?.departamentosGeridos || []).filter(id => id !== d.id)
                              : [...(f.hierarquia?.departamentosGeridos || []), d.id],
                          },
                        }))}
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12,
                          padding: '5px 12px',
                          borderRadius: 20,
                          border: `1px solid ${active ? d.cor : 'var(--border)'}`,
                          background: active ? d.cor : 'var(--bg-card)',
                          color: active ? d.corTexto : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  A chefia de área gere a sua equipa, a gestão fica acima das áreas e o CEO fica acima da gestão. O admin pode ajustar isto por perfil.
                </div>
              </div>

              {/* Dados de colaborador */}
              <div style={{ gridColumn: 'span 2', height: '0.5px', background: 'var(--border)', margin: '4px 0' }} />
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Dados de Colaborador</label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>ID Colaborador</label>
                <input value={form.colaboradorId||''} onChange={e => set('colaboradorId', e.target.value)} placeholder="ex: COL-001" style={inp(false)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Idade</label>
                <input type="number" value={form.idade||''} onChange={e => set('idade', e.target.value)} placeholder="ex: 35" min={16} max={100} style={inp(false)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Género</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: 'M', label: 'Masculino' }, { val: 'F', label: 'Feminino' }, { val: 'Outro', label: 'Outro' }, { val: '', label: 'Não indicado' }].map(g => (
                    <button key={g.val} type="button" onClick={() => set('genero', g.val)}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 14px', borderRadius: 20,
                        border: `0.5px solid ${form.genero === g.val ? 'var(--brand-primary)' : 'var(--border)'}`,
                        background: form.genero === g.val ? 'var(--brand-primary)' : 'transparent',
                        color: form.genero === g.val ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isNew ? 'Criar utilizador' : 'Guardar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PERFIL ────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const { user, logout, refreshUser } = useAuth();
  const [perfis, setPerfis] = useState(loadPerfis);
  const [editando, setEditando] = useState(null);
  const [criando, setCriando] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showGestaoAcessos, setShowGestaoAcessos] = useState(false);

  const isAdmin = user?.isAdmin || user?.id === 'ms';
  const [filtroDept, setFiltroDept] = useState('todos');
  const [searchPerfil, setSearchPerfil] = useState('');

  // Personal profile extra data (stored per user in localStorage)
  const PERFIL_EXTRA_KEY = 'sis_perfil_extra';
  const loadExtra = () => {
    try { return JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}')[user?.id] || {}; } catch { return {}; }
  };
  const saveExtra = (data) => {
    try {
      const all = JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}');
      all[user?.id] = data;
      localStorage.setItem(PERFIL_EXTRA_KEY, JSON.stringify(all));
    } catch {}
  };
  const [extra, setExtra] = useState(loadExtra);
  const [editExtra, setEditExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({});
  const fileRef = useRef(null);

  const removeExtraPerfil = (perfilId) => {
    try {
      const all = JSON.parse(localStorage.getItem(PERFIL_EXTRA_KEY) || '{}');
      if (!all[perfilId]) return;
      delete all[perfilId];
      localStorage.setItem(PERFIL_EXTRA_KEY, JSON.stringify(all));
      window.dispatchEvent(new Event('perfil_foto_updated'));
    } catch {}
  };

  const updateExtra = (campos) => {
    const novo = { ...extra, ...campos };
    setExtra(novo);
    saveExtra(novo);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = (form) => {
    const updated = criando
      ? [...perfis, form]
      : perfis.map(p => p.id === form.id ? { ...p, ...form, pin: form.pin || p.pin } : p);
    savePerfis(updated);
    setPerfis(loadPerfis());
    window.dispatchEvent(new Event('sis_perfis_updated'));
    refreshUser();
    setEditando(null);
    setCriando(false);
    showToast(criando ? `"${form.nome}" criado com sucesso` : 'Perfil actualizado');
  };

  const handleDelete = (id) => {
    if (id === 'ms') { showToast('Não é possível remover o administrador principal'); return; }
    const updated = perfis.filter(p => p.id !== id);
    setPerfis(updated);
    savePerfis(updated);
    removeExtraPerfil(id);
    window.dispatchEvent(new Event('sis_perfis_updated'));
    setConfirmDelete(null);
    showToast('Utilizador removido');
  };

  const handlePrepareDelivery = () => {
    const ok = window.confirm(
      'Preparar sistema para entrega?\n\nIsto vai limpar obras, clientes, fornecedores, faturas, tesouraria, logística, arquivo, notificações e restantes dados operacionais. Os colaboradores/perfis ficam mantidos.'
    );
    if (!ok) return;
    prepareSystemForDelivery();
    showToast('Sistema limpo para entrega. A recarregar...');
    window.setTimeout(() => window.location.reload(), 700);
  };

  const meuPerfil = perfis.find(p => p.id === user?.id) || user;
  const filteredPerfis = perfis.filter(p => {
    const matchDept = filtroDept === 'todos' || p.departamento === filtroDept;
    const q = searchPerfil.trim().toLowerCase();
    const matchSearch = !q
      || p.nome.toLowerCase().includes(q)
      || (p.role || '').toLowerCase().includes(q)
      || (p.colaboradorId || '').toLowerCase().includes(q);
    return matchDept && matchSearch;
  });
  const deptCounts = Object.fromEntries(
    DEPARTAMENTOS.map(d => [d.id, perfis.filter(p => p.departamento === d.id).length]),
  );

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 700, background: 'var(--color-success)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>{toast}</div>
      )}

      {(editando || criando) && (
        <EditarPerfilModal
          perfil={criando ? null : editando}
          isNew={criando}
          onClose={() => { setEditando(null); setCriando(false); }}
          onSave={handleSave}
        />
      )}

      {showGestaoAcessos && <GestaoAcessosModal onClose={() => setShowGestaoAcessos(false)} />}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', padding: '24px', maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Remover utilizador?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Esta acção remove o acesso de <strong>{confirmDelete.nome}</strong> ao SIS. Não pode ser desfeita.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Remover</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">{isAdmin ? 'Perfis & Acessos' : 'O meu perfil'}</div>
          <div className="page-subtitle">{isAdmin ? `${perfis.length} utilizadores · Gestão de permissões e departamentos` : `${meuPerfil?.role} · ${meuPerfil?.email}`}</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handlePrepareDelivery}>Preparar entrega</button>
            <button className="btn" onClick={() => setShowGestaoAcessos(true)}>Gerir acessos</button>
            <button className="btn btn-primary" onClick={() => setCriando(true)}>+ Novo utilizador</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'minmax(320px, 1fr) minmax(0, 1.6fr)' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* Meu perfil — visão pessoal completa */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>O meu perfil</div>

          {/* Card principal */}
          <div className="card" style={{ marginBottom: 12 }}>
            {/* Avatar + foto */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {extra.foto ? (
                  <img src={extra.foto} alt="foto" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: meuPerfil?.cor || 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff' }}>
                    {meuPerfil?.initials}
                  </div>
                )}
                <label title="Alterar foto" style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-card)' }}>
                  📷
                  <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileRef}
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                      updateExtra({ foto: ev.target.result });
                      window.dispatchEvent(new Event('perfil_foto_updated'));
                    };
                      reader.readAsDataURL(f);
                    }} />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{meuPerfil?.nome}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>{meuPerfil?.role}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meuPerfil?.email}</div>
              </div>
            </div>

            <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 14 }} />

            {/* Contactos */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>Contactos</div>
              {editExtra ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                  {[
                    { key: 'telefone', placeholder: '+351 9xx xxx xxx', label: 'Telemóvel' },
                    { key: 'telExtensao', placeholder: 'ex: 210', label: 'Extensão interna' },
                    { key: 'linkedin', placeholder: 'linkedin.com/in/...', label: 'LinkedIn' },
                    { key: 'localizacao', placeholder: 'ex: Lisboa', label: 'Localização' },
                  ].map(({ key, placeholder, label }) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <input value={extraForm[key] ?? extra[key] ?? ''} onChange={e => setExtraForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 8px', border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    { icon: '📱', val: extra.telefone,    label: 'Telemóvel' },
                    { icon: '☎',  val: extra.telExtensao, label: 'Ext.' },
                    { icon: '💼', val: extra.linkedin,    label: 'LinkedIn' },
                    { icon: '📍', val: extra.localizacao, label: 'Local' },
                  ].map(({ icon, val, label }) => val ? (
                    <div key={label} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                      <span>{icon}</span><span style={{ color: 'var(--text-muted)' }}>{label}:</span><span>{val}</span>
                    </div>
                  ) : null)}
                  {!extra.telefone && !extra.localizacao && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem contactos adicionados. Clica em "Editar" para adicionar.</div>
                  )}
                </div>
              )}
            </div>

            {/* Bio / Sobre mim */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>Sobre mim</div>
              {editExtra ? (
                <textarea value={extraForm.bio ?? extra.bio ?? ''} onChange={e => setExtraForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Breve descrição profissional..."
                  rows={3}
                  style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 10px', border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              ) : (
                <div style={{ fontSize: 12, color: extra.bio ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: extra.bio ? 'normal' : 'italic', lineHeight: 1.5 }}>
                  {extra.bio || 'Sem descrição. Clica em "Editar" para adicionar.'}
                </div>
              )}
            </div>

            {/* Skills */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>Skills / Competências</div>
              {editExtra ? (
                <input value={extraForm.skills ?? extra.skills ?? ''} onChange={e => setExtraForm(f => ({ ...f, skills: e.target.value }))}
                  placeholder="ex: Excel, Gestão financeira, AutoCAD (separar por vírgula)"
                  style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 8px', border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              ) : (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {extra.skills ? extra.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="badge badge-n">{s}</span>
                  )) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem skills adicionadas.</span>}
                </div>
              )}
            </div>
          </div>


          {/* Documentos profissionais */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>Documentos profissionais</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(extra.documentos || []).map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-app)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.data}</div>
                  </div>
                  <button onClick={() => updateExtra({ documentos: extra.documentos.filter((_, j) => j !== i) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>✕</button>
                </div>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1.5px dashed var(--border-strong)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <span>+</span> Adicionar documento
                <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const docEntry = { nome: f.name, data: new Date().toLocaleDateString('pt-PT') };
                    updateExtra({ documentos: [...(extra.documentos || []), docEntry] });
                    e.target.value = '';
                  }} />
              </label>
            </div>
          </div>
        </div>

        {/* Lista de utilizadores — só admin */}
        {isAdmin && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Todos os utilizadores ({perfis.length})
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                  <input
                    value={searchPerfil}
                    onChange={e => setSearchPerfil(e.target.value)}
                    placeholder="Pesquisar utilizador por nome, cargo ou ID..."
                    style={{ flex:1, minWidth:220, fontFamily:'var(--font-body)', fontSize:12, padding:'7px 12px', border:'0.5px solid var(--border)', borderRadius:20, background:'var(--bg-card)', color:'var(--text-primary)', outline:'none' }}
                  />
                  <button onClick={() => setFiltroDept('todos')}
                    style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'5px 11px', borderRadius:20, border:'0.5px solid', borderColor:filtroDept==='todos'?'var(--brand-primary)':'var(--border)', background:filtroDept==='todos'?'var(--brand-primary)':'transparent', color:filtroDept==='todos'?'#fff':'var(--text-muted)', cursor:'pointer' }}>
                    Todos ({perfis.length})
                  </button>
                  {DEPARTAMENTOS.map(d => {
                    const count = deptCounts[d.id] || 0;
                    if (count === 0) return null;
                    return (
                      <button key={d.id} onClick={() => setFiltroDept(filtroDept === d.id ? 'todos' : d.id)}
                        style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'5px 11px', borderRadius:20, border:`0.5px solid ${d.cor}`, background:filtroDept===d.id?d.cor:'transparent', color:filtroDept===d.id?d.corTexto:d.cor, cursor:'pointer', fontWeight:filtroDept===d.id?700:500 }}>
                        {d.label} ({count})
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  A mostrar <strong style={{ color: 'var(--text-secondary)' }}>{filteredPerfis.length}</strong> de <strong style={{ color: 'var(--text-secondary)' }}>{perfis.length}</strong> utilizadores
                </div>
              </div>

              <div className="perfil-admin-table-wrap">
                <table className="sis-table perfil-admin-table" style={{ minWidth: 960 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 280 }}>Colaborador</th>
                      <th style={{ width: 90 }}>ID</th>
                      <th>Cargo</th>
                      <th style={{ width: 130 }}>Departamento</th>
                      <th className="perfil-admin-col-idade" style={{ width: 70, textAlign: 'center' }}>Idade</th>
                      <th className="perfil-admin-col-genero" style={{ width: 80 }}>Género</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerfis.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: 13 }}>
                          Sem resultados para os filtros atuais.
                        </td>
                      </tr>
                    ) : filteredPerfis.map(p => {
                      let foto = null;
                      try { foto = JSON.parse(localStorage.getItem('sis_perfil_extra') || '{}')[p.id]?.foto; } catch {}
                      const dept = DEPARTAMENTOS.find(d => d.id === p.departamento);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="perfil-admin-user">
                              {foto
                                ? <img src={foto} alt={p.initials} className="perfil-admin-avatar" style={{ borderColor: p.cor }} />
                                : <div className="perfil-admin-avatar" style={{ background: p.cor, color: '#fff' }}>{p.initials}</div>
                              }
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom: 2 }}>
                                  <span style={{ fontWeight: 600 }}>{p.nome}</span>
                                  {p.isAdmin && <span className="badge badge-i" style={{ fontSize:9 }}>Admin</span>}
                                  {p.isColaborador && <span className="badge badge-s" style={{ fontSize:9 }}>RH</span>}
                                  {p.id === user?.id && <span className="badge badge-s" style={{ fontSize:9 }}>Eu</span>}
                                </div>
                                <div style={{ fontSize:11, color:'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>
                              {p.colaboradorId || '—'}
                            </span>
                          </td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 210 }}>{p.role || '—'}</div>
                          </td>
                          <td>
                            {dept
                              ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, background:dept.cor, color:dept.corTexto, whiteSpace:'nowrap' }}>{dept.label}</span>
                              : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
                            }
                          </td>
                          <td className="perfil-admin-col-idade" style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>{p.idade || '—'}</td>
                          <td className="perfil-admin-col-genero" style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {p.genero === 'M' ? '♂ M' : p.genero === 'F' ? '♀ F' : p.genero || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-i" title="Paginas visiveis para este utilizador">
                              {TODAS_PAGINAS.filter(pg => canViewPage(p, pg.path)).length}
                            </span>
                          </td>
                          <td>
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="btn btn-sm" onClick={() => setEditando(p)}>Perfil</button>
                              {p.id !== 'ms' && p.id !== user?.id && (
                                <button className="btn btn-sm" style={{ color:'var(--color-danger)', borderColor:'var(--color-danger)' }}
                                  onClick={() => setConfirmDelete(p)}>✕</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
