import { useMemo, useState } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { withDemoSeed } from '../utils/deliveryMode';

const LS_FROTA = 'sis_logistica_frota';
const LS_IMOVEIS = 'sis_logistica_imoveis';
const LS_CONTRATOS = 'sis_logistica_contratos';

const FROTA_DEFAULT = withDemoSeed([
  { id: 'v001', matricula: 'AA-00-BB', marcaModelo: 'Toyota Hilux', tipo: 'Pick-up', estado: 'ativo', km: 84210, proximaInspecao: '2026-09-15', seguroAte: '2026-12-31', colaborador: 'Pedro Serrão', docs: [] },
  { id: 'v002', matricula: '11-CC-22', marcaModelo: 'Renault Clio', tipo: 'Ligeiro', estado: 'manutencao', km: 127500, proximaInspecao: '2026-05-20', seguroAte: '2026-10-12', colaborador: 'Carla Sousa', docs: [] },
]);

const IMOVEIS_DEFAULT = withDemoSeed([
  { id: 'i001', nome: 'Sede Lisboa', tipo: 'Escritório', morada: 'Av. da República, Lisboa', estado: 'operacional', area: 420, rendaMensal: 0, responsavel: 'Miguel Seabra', docs: [] },
  { id: 'i002', nome: 'Armazém Loures', tipo: 'Armazém', morada: 'Zona Industrial de Loures', estado: 'arrendado', area: 980, rendaMensal: 3200, responsavel: 'Leonor Gomes', docs: [] },
]);

const CONTRATOS_DEFAULT = withDemoSeed([
  { id: 'c001', imovel: 'Sede Lisboa', servico: 'Luz', fornecedor: 'EDP Comercial', numeroContrato: 'PT-EDP-110283', custoMensal: 780, vencimento: '2026-04-12', estado: 'ativo', docs: [] },
  { id: 'c002', imovel: 'Sede Lisboa', servico: 'Água', fornecedor: 'EPAL', numeroContrato: 'PT-EPAL-42818', custoMensal: 145, vencimento: '2026-04-18', estado: 'ativo', docs: [] },
  { id: 'c003', imovel: 'Armazém Loures', servico: 'Gás', fornecedor: 'Galp', numeroContrato: 'PT-GALP-83910', custoMensal: 230, vencimento: '2026-04-08', estado: 'pendente', docs: [] },
]);

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch { return def; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

const fmt = v => '€ ' + Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 });

const IS = {
  fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 10px',
  border: '0.5px solid var(--border-strong)', borderRadius: 8,
  background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function statusBadge(v, type = 'frota') {
  if (type === 'frota') return v === 'ativo' ? 'badge-s' : v === 'manutencao' ? 'badge-w' : 'badge-d';
  if (type === 'imoveis') return v === 'operacional' ? 'badge-s' : v === 'arrendado' ? 'badge-i' : v === 'em-obras' ? 'badge-w' : 'badge-n';
  return v === 'ativo' ? 'badge-s' : v === 'pendente' ? 'badge-w' : 'badge-d';
}

export default function LogisticaPage() {
  const { addNotif } = useNotifications();
  const [tab, setTab] = useState('frota');
  const [docsModal, setDocsModal] = useState(null); // {scope,id,title}
  const [docForm, setDocForm] = useState(null); // {scope,id,title,titulo,descricao,file}
  const [search, setSearch] = useState('');
  const [frotaEstadoFiltro, setFrotaEstadoFiltro] = useState('todos');
  const [frotaTipoFiltro, setFrotaTipoFiltro] = useState('todos');
  const [imovelEstadoFiltro, setImovelEstadoFiltro] = useState('todos');
  const [imovelTipoFiltro, setImovelTipoFiltro] = useState('todos');
  const [contratoEstadoFiltro, setContratoEstadoFiltro] = useState('todos');
  const [contratoServicoFiltro, setContratoServicoFiltro] = useState('todos');

  const [frota, setFrota] = useState(() => load(LS_FROTA, FROTA_DEFAULT));
  const [showFrota, setShowFrota] = useState(false);
  const [editFrotaId, setEditFrotaId] = useState(null);
  const [frotaForm, setFrotaForm] = useState({ matricula: '', marcaModelo: '', tipo: 'Ligeiro', estado: 'ativo', km: '', proximaInspecao: '', seguroAte: '', colaborador: '' });

  const [imoveis, setImoveis] = useState(() => load(LS_IMOVEIS, IMOVEIS_DEFAULT));
  const [showImovel, setShowImovel] = useState(false);
  const [editImovelId, setEditImovelId] = useState(null);
  const [imovelForm, setImovelForm] = useState({ nome: '', tipo: 'Escritório', morada: '', estado: 'operacional', area: '', rendaMensal: '', responsavel: '' });

  const [contratos, setContratos] = useState(() => load(LS_CONTRATOS, CONTRATOS_DEFAULT));
  const [showContrato, setShowContrato] = useState(false);
  const [editContratoId, setEditContratoId] = useState(null);
  const [contratoForm, setContratoForm] = useState({ imovel: '', servico: 'Luz', fornecedor: '', numeroContrato: '', custoMensal: '', vencimento: '', estado: 'ativo' });

  const persistFrota = list => { setFrota(list); save(LS_FROTA, list); };
  const persistImoveis = list => { setImoveis(list); save(LS_IMOVEIS, list); };
  const persistContratos = list => { setContratos(list); save(LS_CONTRATOS, list); };

  const notifyLogistica = (titulo, sub, extras = {}) => {
    if (!addNotif) return;
    addNotif({
      tipo: extras.accionavel ? 'acao_lg' : 'info',
      icon: extras.icon || '📦',
      accionavel: extras.accionavel || false,
      titulo,
      sub,
      path: '/logistica',
      destinatario: extras.destinatario || 'lg',
      acao: extras.acao,
      prefKey: 'tarefa_atribuida',
      meta: extras.meta || {},
    });
  };

  const upsertDocs = (scope, id, updater) => {
    if (scope === 'frota') {
      persistFrota(frota.map(r => r.id === id ? { ...r, docs: updater(r.docs || []) } : r));
      return;
    }
    if (scope === 'imoveis') {
      persistImoveis(imoveis.map(r => r.id === id ? { ...r, docs: updater(r.docs || []) } : r));
      return;
    }
    persistContratos(contratos.map(r => r.id === id ? { ...r, docs: updater(r.docs || []) } : r));
  };

  const getRecord = (scope, id) => {
    const base = scope === 'frota' ? frota : scope === 'imoveis' ? imoveis : contratos;
    return base.find(r => r.id === id);
  };

  const openDocForm = (scope, id, title = '') => {
    setDocForm({ scope, id, title, titulo: '', descricao: '', file: null });
  };

  const onSaveDoc = () => {
    if (!docForm?.file) return;
    const r = new FileReader();
    r.onload = e => {
      upsertDocs(docForm.scope, docForm.id, docs => [
        {
          name: docForm.file.name,
          base64: e.target.result,
          uploadedAt: new Date().toISOString(),
          size: docForm.file.size,
          mime: docForm.file.type || 'application/octet-stream',
          titulo: (docForm.titulo || '').trim() || docForm.file.name,
          descricao: (docForm.descricao || '').trim(),
        },
        ...docs,
      ]);
      window.dispatchEvent(new Event('sis_logistica_docs_updated'));
      notifyLogistica(
        'Documento adicionado em Logística',
        `${docForm.title || docForm.scope} · ${(docForm.titulo || '').trim() || docForm.file.name}`,
        { icon: '📎', destinatario: 'ca' }
      );
      if (docsModal && docsModal.scope === docForm.scope && docsModal.id === docForm.id) {
        setDocsModal({ ...docsModal });
      }
      setDocForm(null);
    };
    r.readAsDataURL(docForm.file);
  };

  const removeDoc = (scope, id, idx) => {
    const rec = getRecord(scope, id);
    const doc = (rec?.docs || [])[idx];
    upsertDocs(scope, id, docs => docs.filter((_, i) => i !== idx));
    window.dispatchEvent(new Event('sis_logistica_docs_updated'));
    setDocsModal(m => (m && m.scope === scope && m.id === id ? { ...m } : m));
    notifyLogistica(
      'Documento removido de Logística',
      `${rec?.nome || rec?.matricula || rec?.imovel || 'Registo'} · ${doc?.titulo || doc?.name || 'documento'}`,
      { icon: '🗑', destinatario: 'ca' }
    );
  };

  const proximosVencimentos = useMemo(
    () => contratos.filter(c => c.estado !== 'terminado').sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')).slice(0, 5),
    [contratos],
  );

  const matchDocsText = (docs = [], query) => {
    if (!query) return true;
    return (docs || []).some(doc =>
      `${doc?.name || ''} ${doc?.titulo || ''} ${doc?.descricao || ''}`.toLowerCase().includes(query)
    );
  };

  const searchQuery = search.trim().toLowerCase();

  const frotaFiltrada = useMemo(() => (
    frota.filter(v => {
      const matchesSearch = !searchQuery || [
        v.matricula,
        v.marcaModelo,
        v.tipo,
        v.estado,
        v.colaborador,
        v.proximaInspecao,
        v.seguroAte,
      ].join(' ').toLowerCase().includes(searchQuery) || matchDocsText(v.docs, searchQuery);
      const matchesEstado = frotaEstadoFiltro === 'todos' || v.estado === frotaEstadoFiltro;
      const matchesTipo = frotaTipoFiltro === 'todos' || v.tipo === frotaTipoFiltro;
      return matchesSearch && matchesEstado && matchesTipo;
    })
  ), [frota, searchQuery, frotaEstadoFiltro, frotaTipoFiltro]);

  const imoveisFiltrados = useMemo(() => (
    imoveis.filter(i => {
      const matchesSearch = !searchQuery || [
        i.nome,
        i.tipo,
        i.morada,
        i.estado,
        i.responsavel,
        i.area,
        i.rendaMensal,
      ].join(' ').toLowerCase().includes(searchQuery) || matchDocsText(i.docs, searchQuery);
      const matchesEstado = imovelEstadoFiltro === 'todos' || i.estado === imovelEstadoFiltro;
      const matchesTipo = imovelTipoFiltro === 'todos' || i.tipo === imovelTipoFiltro;
      return matchesSearch && matchesEstado && matchesTipo;
    })
  ), [imoveis, searchQuery, imovelEstadoFiltro, imovelTipoFiltro]);

  const contratosFiltrados = useMemo(() => (
    contratos.filter(c => {
      const matchesSearch = !searchQuery || [
        c.imovel,
        c.servico,
        c.fornecedor,
        c.numeroContrato,
        c.vencimento,
        c.estado,
        c.custoMensal,
      ].join(' ').toLowerCase().includes(searchQuery) || matchDocsText(c.docs, searchQuery);
      const matchesEstado = contratoEstadoFiltro === 'todos' || c.estado === contratoEstadoFiltro;
      const matchesServico = contratoServicoFiltro === 'todos' || c.servico === contratoServicoFiltro;
      return matchesSearch && matchesEstado && matchesServico;
    })
  ), [contratos, searchQuery, contratoEstadoFiltro, contratoServicoFiltro]);

  const frotaTipos = [...new Set(frota.map(v => v.tipo).filter(Boolean))];
  const imovelTipos = [...new Set(imoveis.map(i => i.tipo).filter(Boolean))];
  const contratoServicos = [...new Set(contratos.map(c => c.servico).filter(Boolean))];

  return (
    <div>
      {docForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 710, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 520, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Adicionar documento</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{docForm.title}</div>
              </div>
              <button onClick={() => setDocForm(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Título *</label>
                <input value={docForm.titulo} onChange={e => setDocForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Contrato de seguro 2026" style={IS} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Descrição</label>
                <textarea value={docForm.descricao} onChange={e => setDocForm(f => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Ex: Apólice anual da viatura AA-00-BB" style={{ ...IS, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Ficheiro *</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" onChange={e => setDocForm(f => ({ ...f, file: e.target.files?.[0] || null }))} style={IS} />
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setDocForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={onSaveDoc} disabled={!docForm.file || !(docForm.titulo || '').trim()}>Guardar documento</button>
            </div>
          </div>
        </div>
      )}

      {docsModal && (() => {
        const rec = getRecord(docsModal.scope, docsModal.id);
        const docs = rec?.docs || [];
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)', width: '100%', maxWidth: 620, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Documentos</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{docsModal.title}</div>
                </div>
                <button onClick={() => setDocsModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => openDocForm(docsModal.scope, docsModal.id, docsModal.title)}>+ Adicionar documento</button>
                </div>
                {docs.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem documentos anexados.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {docs.map((d, idx) => (
                      <div key={`${d.name}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-app)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.titulo || d.name}</div>
                          {d.descricao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{d.descricao}</div>}
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{d.name} · {new Date(d.uploadedAt).toLocaleString('pt-PT')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a className="btn btn-sm" href={d.base64} download={d.name} style={{ textDecoration: 'none' }}>Descarregar</a>
                          <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => removeDoc(docsModal.scope, docsModal.id, idx)}>Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="page-header">
        <div>
          <div className="page-title">Logística</div>
          <div className="page-subtitle">Gestão de frota automóvel, imóveis e contratos de utilidades</div>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        {[
          { key: 'frota', label: '🚘 Frota Automóvel' },
          { key: 'imoveis', label: '🏢 Imóveis' },
          { key: 'contratos', label: '⚡ Água / Luz / Gás' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: 'none', borderRight: '0.5px solid var(--border)', background: tab === t.key ? 'var(--brand-primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              padding: '10px 14px', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar informação e documentos guardados..."
            style={{ ...IS, flex: '1 1 280px', background: 'var(--bg-app)' }}
          />

          {tab === 'frota' && (
            <>
              <select value={frotaEstadoFiltro} onChange={e => setFrotaEstadoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os estados</option>
                {['ativo', 'manutencao', 'indisponivel'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={frotaTipoFiltro} onChange={e => setFrotaTipoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os tipos</option>
                {frotaTipos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}

          {tab === 'imoveis' && (
            <>
              <select value={imovelEstadoFiltro} onChange={e => setImovelEstadoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os estados</option>
                {['operacional', 'arrendado', 'em-obras', 'vago'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={imovelTipoFiltro} onChange={e => setImovelTipoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os tipos</option>
                {imovelTipos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}

          {tab === 'contratos' && (
            <>
              <select value={contratoEstadoFiltro} onChange={e => setContratoEstadoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os estados</option>
                {['ativo', 'pendente', 'terminado'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={contratoServicoFiltro} onChange={e => setContratoServicoFiltro(e.target.value)} style={{ ...IS, width: 180 }}>
                <option value="todos">Todos os serviços</option>
                {contratoServicos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {tab === 'frota' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <div className="kpi-card"><div className="kpi-label">Viaturas</div><div className="kpi-value">{frotaFiltrada.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Ativas</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{frotaFiltrada.filter(v => v.estado === 'ativo').length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Em manutenção</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{frotaFiltrada.filter(v => v.estado === 'manutencao').length}</div></div>
            <div className="kpi-card"><div className="kpi-label">KM Totais</div><div className="kpi-value">{frotaFiltrada.reduce((s, v) => s + Number(v.km || 0), 0).toLocaleString('pt-PT')}</div></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => { setShowFrota(s => !s); if (showFrota) setEditFrotaId(null); }}>+ Viatura</button>
          </div>

          {showFrota && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{editFrotaId ? 'Editar viatura' : 'Nova viatura'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px 12px' }}>
                <div><label style={{ fontSize: 11 }}>Matrícula *</label><input value={frotaForm.matricula} onChange={e => setFrotaForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Marca / Modelo *</label><input value={frotaForm.marcaModelo} onChange={e => setFrotaForm(f => ({ ...f, marcaModelo: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Tipo</label><select value={frotaForm.tipo} onChange={e => setFrotaForm(f => ({ ...f, tipo: e.target.value }))} style={IS}>{['Ligeiro', 'Pick-up', 'Comercial', 'Carrinha', 'Outro'].map(v => <option key={v}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11 }}>Estado</label><select value={frotaForm.estado} onChange={e => setFrotaForm(f => ({ ...f, estado: e.target.value }))} style={IS}>{['ativo', 'manutencao', 'indisponivel'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11 }}>KM</label><input type="number" value={frotaForm.km} onChange={e => setFrotaForm(f => ({ ...f, km: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Próxima inspeção</label><input type="date" value={frotaForm.proximaInspecao} onChange={e => setFrotaForm(f => ({ ...f, proximaInspecao: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Seguro até</label><input type="date" value={frotaForm.seguroAte} onChange={e => setFrotaForm(f => ({ ...f, seguroAte: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Responsável</label><input value={frotaForm.colaborador} onChange={e => setFrotaForm(f => ({ ...f, colaborador: e.target.value }))} style={IS} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => { setShowFrota(false); setEditFrotaId(null); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!frotaForm.matricula || !frotaForm.marcaModelo) return;
                  if (editFrotaId) {
                    persistFrota(frota.map(v => v.id === editFrotaId ? { ...v, ...frotaForm, km: Number(frotaForm.km || 0), docs: v.docs || [] } : v));
                    notifyLogistica('Viatura atualizada', `${frotaForm.matricula} · ${frotaForm.marcaModelo}`, { icon: '🚘' });
                  } else {
                    persistFrota([{ id: `v${Date.now()}`, ...frotaForm, km: Number(frotaForm.km || 0), docs: [] }, ...frota]);
                    notifyLogistica('Nova viatura registada', `${frotaForm.matricula} · ${frotaForm.marcaModelo}`, { icon: '🚘' });
                  }
                  setFrotaForm({ matricula: '', marcaModelo: '', tipo: 'Ligeiro', estado: 'ativo', km: '', proximaInspecao: '', seguroAte: '', colaborador: '' });
                  setShowFrota(false); setEditFrotaId(null);
                }}>{editFrotaId ? 'Guardar alterações' : 'Adicionar viatura'}</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="sis-table">
              <thead><tr><th>Matrícula</th><th>Viatura</th><th>Tipo</th><th>KM</th><th>Inspeção</th><th>Seguro</th><th>Responsável</th><th>Estado</th><th>Docs</th><th>Ações</th></tr></thead>
              <tbody>
                {frotaFiltrada.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{v.matricula}</td>
                    <td style={{ fontWeight: 600 }}>{v.marcaModelo}</td>
                    <td>{v.tipo}</td>
                    <td>{Number(v.km || 0).toLocaleString('pt-PT')}</td>
                    <td>{v.proximaInspecao || '—'}</td>
                    <td>{v.seguroAte || '—'}</td>
                    <td>{v.colaborador || '—'}</td>
                    <td><span className={`badge ${statusBadge(v.estado, 'frota')}`}>{v.estado}</span></td>
                    <td><button className="btn btn-sm" onClick={() => setDocsModal({ scope: 'frota', id: v.id, title: `${v.matricula} · ${v.marcaModelo}` })}>📎 {(v.docs || []).length}</button></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => { setFrotaForm({ ...v }); setEditFrotaId(v.id); setShowFrota(true); }}>Editar</button>
                        <button className="btn btn-sm" onClick={() => openDocForm('frota', v.id, `${v.matricula} · ${v.marcaModelo}`)}>+Doc</button>
                        <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => { if (window.confirm('Remover viatura?')) { persistFrota(frota.filter(x => x.id !== v.id)); notifyLogistica('Viatura removida', `${v.matricula} · ${v.marcaModelo}`, { icon: '🗑', destinatario: 'ms' }); } }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {frotaFiltrada.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '18px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>Sem resultados para os filtros actuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'imoveis' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <div className="kpi-card"><div className="kpi-label">Imóveis</div><div className="kpi-value">{imoveisFiltrados.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Operacionais</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{imoveisFiltrados.filter(i => i.estado === 'operacional').length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Área total (m²)</div><div className="kpi-value">{imoveisFiltrados.reduce((s, i) => s + Number(i.area || 0), 0)}</div></div>
            <div className="kpi-card"><div className="kpi-label">Renda mensal</div><div className="kpi-value">{fmt(imoveisFiltrados.reduce((s, i) => s + Number(i.rendaMensal || 0), 0))}</div></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => { setShowImovel(s => !s); if (showImovel) setEditImovelId(null); }}>+ Imóvel</button>
          </div>

          {showImovel && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{editImovelId ? 'Editar imóvel' : 'Novo imóvel'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px 12px' }}>
                <div><label style={{ fontSize: 11 }}>Nome *</label><input value={imovelForm.nome} onChange={e => setImovelForm(f => ({ ...f, nome: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Tipo</label><select value={imovelForm.tipo} onChange={e => setImovelForm(f => ({ ...f, tipo: e.target.value }))} style={IS}>{['Escritório', 'Armazém', 'Loja', 'Habitação', 'Terreno', 'Outro'].map(v => <option key={v}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11 }}>Estado</label><select value={imovelForm.estado} onChange={e => setImovelForm(f => ({ ...f, estado: e.target.value }))} style={IS}>{['operacional', 'arrendado', 'em-obras', 'vago'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11 }}>Área (m²)</label><input type="number" value={imovelForm.area} onChange={e => setImovelForm(f => ({ ...f, area: e.target.value }))} style={IS} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: 11 }}>Morada</label><input value={imovelForm.morada} onChange={e => setImovelForm(f => ({ ...f, morada: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Renda mensal (€)</label><input type="number" value={imovelForm.rendaMensal} onChange={e => setImovelForm(f => ({ ...f, rendaMensal: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Responsável</label><input value={imovelForm.responsavel} onChange={e => setImovelForm(f => ({ ...f, responsavel: e.target.value }))} style={IS} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => { setShowImovel(false); setEditImovelId(null); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!imovelForm.nome) return;
                  if (editImovelId) {
                    persistImoveis(imoveis.map(i => i.id === editImovelId ? { ...i, ...imovelForm, area: Number(imovelForm.area || 0), rendaMensal: Number(imovelForm.rendaMensal || 0), docs: i.docs || [] } : i));
                    notifyLogistica('Imóvel atualizado', `${imovelForm.nome} · ${imovelForm.estado}`, { icon: '🏢' });
                  } else {
                    persistImoveis([{ id: `i${Date.now()}`, ...imovelForm, area: Number(imovelForm.area || 0), rendaMensal: Number(imovelForm.rendaMensal || 0), docs: [] }, ...imoveis]);
                    notifyLogistica('Novo imóvel registado', `${imovelForm.nome} · ${imovelForm.tipo}`, { icon: '🏢' });
                  }
                  setImovelForm({ nome: '', tipo: 'Escritório', morada: '', estado: 'operacional', area: '', rendaMensal: '', responsavel: '' });
                  setShowImovel(false); setEditImovelId(null);
                }}>{editImovelId ? 'Guardar alterações' : 'Adicionar imóvel'}</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="sis-table">
              <thead><tr><th>Imóvel</th><th>Tipo</th><th>Morada</th><th>Área</th><th>Renda</th><th>Responsável</th><th>Estado</th><th>Docs</th><th>Ações</th></tr></thead>
              <tbody>
                {imoveisFiltrados.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.nome}</td>
                    <td>{i.tipo}</td>
                    <td>{i.morada || '—'}</td>
                    <td>{i.area ? `${i.area} m²` : '—'}</td>
                    <td>{fmt(i.rendaMensal || 0)}</td>
                    <td>{i.responsavel || '—'}</td>
                    <td><span className={`badge ${statusBadge(i.estado, 'imoveis')}`}>{i.estado}</span></td>
                    <td><button className="btn btn-sm" onClick={() => setDocsModal({ scope: 'imoveis', id: i.id, title: i.nome })}>📎 {(i.docs || []).length}</button></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => { setImovelForm({ ...i }); setEditImovelId(i.id); setShowImovel(true); }}>Editar</button>
                        <button className="btn btn-sm" onClick={() => openDocForm('imoveis', i.id, i.nome)}>+Doc</button>
                        <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => { if (window.confirm('Remover imóvel?')) { persistImoveis(imoveis.filter(x => x.id !== i.id)); notifyLogistica('Imóvel removido', `${i.nome}`, { icon: '🗑', destinatario: 'ms' }); } }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {imoveisFiltrados.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '18px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>Sem resultados para os filtros actuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'contratos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <div className="kpi-card"><div className="kpi-label">Contratos</div><div className="kpi-value">{contratosFiltrados.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Ativos</div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{contratosFiltrados.filter(c => c.estado === 'ativo').length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Pendentes</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{contratosFiltrados.filter(c => c.estado === 'pendente').length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Custo mensal</div><div className="kpi-value">{fmt(contratosFiltrados.reduce((s, c) => s + Number(c.custoMensal || 0), 0))}</div></div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Próximos vencimentos</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {proximosVencimentos.map(c => (
                <span key={c.id} className="badge badge-i">{c.servico} · {c.imovel} · {c.vencimento || 'sem data'}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => { setShowContrato(s => !s); if (showContrato) setEditContratoId(null); }}>+ Contrato</button>
          </div>

          {showContrato && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{editContratoId ? 'Editar contrato' : 'Novo contrato'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px 12px' }}>
                <div><label style={{ fontSize: 11 }}>Imóvel *</label><input value={contratoForm.imovel} onChange={e => setContratoForm(f => ({ ...f, imovel: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Serviço</label><select value={contratoForm.servico} onChange={e => setContratoForm(f => ({ ...f, servico: e.target.value }))} style={IS}>{['Luz', 'Água', 'Gás'].map(v => <option key={v}>{v}</option>)}</select></div>
                <div><label style={{ fontSize: 11 }}>Fornecedor *</label><input value={contratoForm.fornecedor} onChange={e => setContratoForm(f => ({ ...f, fornecedor: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Nº Contrato</label><input value={contratoForm.numeroContrato} onChange={e => setContratoForm(f => ({ ...f, numeroContrato: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Custo mensal (€)</label><input type="number" value={contratoForm.custoMensal} onChange={e => setContratoForm(f => ({ ...f, custoMensal: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Vencimento</label><input type="date" value={contratoForm.vencimento} onChange={e => setContratoForm(f => ({ ...f, vencimento: e.target.value }))} style={IS} /></div>
                <div><label style={{ fontSize: 11 }}>Estado</label><select value={contratoForm.estado} onChange={e => setContratoForm(f => ({ ...f, estado: e.target.value }))} style={IS}>{['ativo', 'pendente', 'terminado'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => { setShowContrato(false); setEditContratoId(null); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  if (!contratoForm.imovel || !contratoForm.fornecedor) return;
                  if (editContratoId) {
                    persistContratos(contratos.map(c => c.id === editContratoId ? { ...c, ...contratoForm, custoMensal: Number(contratoForm.custoMensal || 0), docs: c.docs || [] } : c));
                    notifyLogistica('Contrato atualizado', `${contratoForm.servico} · ${contratoForm.imovel}`, { icon: '⚡' });
                  } else {
                    persistContratos([{ id: `c${Date.now()}`, ...contratoForm, custoMensal: Number(contratoForm.custoMensal || 0), docs: [] }, ...contratos]);
                    notifyLogistica('Novo contrato registado', `${contratoForm.servico} · ${contratoForm.imovel}`, { icon: '⚡' });
                  }
                  setContratoForm({ imovel: '', servico: 'Luz', fornecedor: '', numeroContrato: '', custoMensal: '', vencimento: '', estado: 'ativo' });
                  setShowContrato(false); setEditContratoId(null);
                }}>{editContratoId ? 'Guardar alterações' : 'Adicionar contrato'}</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="sis-table">
              <thead><tr><th>Imóvel</th><th>Serviço</th><th>Fornecedor</th><th>Nº Contrato</th><th>Custo</th><th>Vencimento</th><th>Estado</th><th>Docs</th><th>Ações</th></tr></thead>
              <tbody>
                {contratosFiltrados.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.imovel}</td>
                    <td>{c.servico}</td>
                    <td>{c.fornecedor}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.numeroContrato || '—'}</td>
                    <td>{fmt(c.custoMensal || 0)}</td>
                    <td>{c.vencimento || '—'}</td>
                    <td><span className={`badge ${statusBadge(c.estado, 'contratos')}`}>{c.estado}</span></td>
                    <td><button className="btn btn-sm" onClick={() => setDocsModal({ scope: 'contratos', id: c.id, title: `${c.servico} · ${c.imovel}` })}>📎 {(c.docs || []).length}</button></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => { setContratoForm({ ...c }); setEditContratoId(c.id); setShowContrato(true); }}>Editar</button>
                        <button className="btn btn-sm" onClick={() => openDocForm('contratos', c.id, `${c.servico} · ${c.imovel}`)}>+Doc</button>
                        <button className="btn btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => { if (window.confirm('Remover contrato?')) { persistContratos(contratos.filter(x => x.id !== c.id)); notifyLogistica('Contrato removido', `${c.servico} · ${c.imovel} · ${c.fornecedor}`, { icon: '🗑', destinatario: 'ms' }); } }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contratosFiltrados.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '18px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>Sem resultados para os filtros actuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
