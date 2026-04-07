import { useState } from 'react';

const DOCS_KEY = 'sis_documentos_extra';

export function loadDocumentos(entidadeId) {
  try {
    const all = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}');
    return all[entidadeId] ?? [];
  } catch { return []; }
}

export function saveDocumentos(entidadeId, docs) {
  try {
    const all = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}');
    all[entidadeId] = docs;
    localStorage.setItem(DOCS_KEY, JSON.stringify(all));
  } catch {}
}

export const TIPOS_DOC = [
  { value: 'fatura',    label: 'Fatura',               icon: '🧾' },
  { value: 'contrato',  label: 'Contrato',             icon: '📋' },
  { value: 'proposta',  label: 'Proposta/Orçamento',   icon: '📝' },
  { value: 'comp',      label: 'Comprovativo',         icon: '✅' },
  { value: 'relatorio', label: 'Relatório',            icon: '📊' },
  { value: 'outro',     label: 'Outro',                icon: '📄' },
];

const OBRAS_LISTA = ['O138', 'O142', 'O143', 'O145'];

const inp = err => ({
  width: '100%', fontFamily: 'var(--font-body)', fontSize: 13,
  padding: '7px 10px',
  border: `0.5px solid ${err ? 'var(--color-danger)' : 'var(--border-strong)'}`,
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
});

export default function AdicionarDocumentoModal({ entidade, tipoEntidade, onClose, onSave }) {
  const [tipoDoc, setTipoDoc] = useState('fatura');
  const [form, setForm] = useState({
    descricao: '', obra: '', valor: '',
    data: new Date().toISOString().split('T')[0],
    venc: '', condPag: '30 dias',
    isDraft: false,
    validDP: 'Pendente', estadoPag: 'pending-dp',
    ficheiro: null,
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const isFatura = tipoDoc === 'fatura';

  const validate = () => {
    const e = {};
    if (!form.descricao.trim()) e.descricao = 'Campo obrigatório';
    if (isFatura) {
      if (!form.obra) e.obra = 'Selecciona uma obra';
      if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido';
    }
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const doc = {
      id: `DOC-${Date.now()}`,
      tipo: tipoDoc,
      descricao: form.descricao,
      data: form.data,
      ficheiro: form.ficheiro ? { name: form.ficheiro.name, size: form.ficheiro.size } : null,
      ...(isFatura ? {
        obra: form.obra,
        valor: Number(form.valor),
        venc: form.venc || '—',
        condPag: form.condPag,
        pdf: form.ficheiro ? { name: form.ficheiro.name, size: form.ficheiro.size } : null,
        ...(tipoEntidade === 'cliente'
          ? { estado: form.isDraft ? 'draft' : 'pendente' }
          : { estado: form.estadoPag, validDP: form.validDP }),
      } : {}),
    };
    onSave(doc, isFatura);
  };

  return (
    <div onClick={undefined} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)', width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Adicionar documento</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{entidade.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Selector tipo */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Tipo de documento</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {TIPOS_DOC.map(t => (
                <button key={t.value} onClick={() => setTipoDoc(t.value)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                  border: tipoDoc === t.value ? '1.5px solid var(--brand-primary)' : '0.5px solid var(--border)',
                  background: tipoDoc === t.value ? 'var(--bg-info)' : 'var(--bg-app)',
                  color: tipoDoc === t.value ? 'var(--color-info)' : 'var(--text-secondary)',
                  transition: 'all .15s',
                }}>
                  <span style={{ fontSize: 15 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            {/* Descrição */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Descrição <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input value={form.descricao} onChange={e => set('descricao', e.target.value)}
                placeholder={isFatura ? 'ex: Medição nº3 — Fase estrutura' : 'ex: Contrato de empreitada — O142'}
                style={inp(errors.descricao)} />
              {errors.descricao && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.descricao}</div>}
            </div>

            {/* Data */}
            <div style={{ gridColumn: isFatura ? 'span 1' : 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inp(false)} />
            </div>

            {/* Campos só para fatura */}
            {isFatura && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Obra <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select value={form.obra} onChange={e => set('obra', e.target.value)} style={inp(errors.obra)}>
                    <option value="">Selecciona...</option>
                    {OBRAS_LISTA.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {errors.obra && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.obra}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Valor (€) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="ex: 50000" style={inp(errors.valor)} />
                  {errors.valor && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errors.valor}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Vencimento</label>
                  <input type="date" value={form.venc} onChange={e => set('venc', e.target.value)} style={inp(false)} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Condições pagamento</label>
                  <select value={form.condPag} onChange={e => set('condPag', e.target.value)} style={inp(false)}>
                    {['15 dias','30 dias','45 dias','60 dias','90 dias'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>

                {tipoEntidade === 'cliente' && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Tipo de fatura</div>
                    <div style={{ display: 'flex', background: 'var(--bg-app)', borderRadius: 8, padding: 3, gap: 3 }}>
                      {[{ val: true, label: 'Draft', sub: 'Aguarda validação' }, { val: false, label: 'Fatura final', sub: 'Emissão imediata' }].map(opt => (
                        <button key={String(opt.val)} onClick={() => set('isDraft', opt.val)} style={{
                          flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                          border: form.isDraft === opt.val ? '1px solid var(--brand-primary)' : '1px solid transparent',
                          background: form.isDraft === opt.val ? 'var(--bg-card)' : 'transparent',
                          fontFamily: 'var(--font-body)', textAlign: 'left', transition: 'all .15s',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: form.isDraft === opt.val ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tipoEntidade === 'fornecedor' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Validação DP</label>
                      <select value={form.validDP} onChange={e => set('validDP', e.target.value)} style={inp(false)}>
                        <option value="Pendente">Pendente</option>
                        <option value="Validada">Validada</option>
                        <option value="Atrasada">Atrasada</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Estado pagamento</label>
                      <select value={form.estadoPag} onChange={e => set('estadoPag', e.target.value)} style={inp(false)}>
                        <option value="pending-dp">Aguarda DP</option>
                        <option value="pending-ms">Aguarda MS</option>
                        <option value="autorizado">Autorizado</option>
                        <option value="pago">Pago</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Upload ficheiro */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Ficheiro <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: `1.5px dashed ${form.ficheiro ? 'var(--color-success)' : 'var(--border-strong)'}`,
                background: form.ficheiro ? 'var(--bg-success)' : 'var(--bg-app)',
                cursor: 'pointer', transition: 'all .15s',
              }}>
                <span style={{ fontSize: 20 }}>{form.ficheiro ? '✅' : '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {form.ficheiro ? (
                    <><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-success)' }}>{form.ficheiro.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(form.ficheiro.size / 1024).toFixed(0)} KB</div></>
                  ) : (
                    <><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Clica para seleccionar</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF, imagem ou outro formato</div></>
                  )}
                </div>
                {form.ficheiro && (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); set('ficheiro', null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '2px 4px' }}>✕</button>
                )}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) set('ficheiro', f); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isFatura ? '📄 Guardar fatura' : '📎 Guardar documento'}
          </button>
        </div>
      </div>
    </div>
  );
}
