// ─── CONFIGURAÇÃO DE PERFIS E PERMISSÕES ─────────────────────────────────────
// Fonte de verdade para todos os acessos do SIS NOVANOR
// Admin pode editar na página Perfis & Acessos

const PERFIS_KEY = 'sis_perfis';
const PERFIS_REMOVED_KEY = 'sis_perfis_removed';
const ACCESS_MATRIX_KEY = 'sis_access_matrix';

// ─── DEPARTAMENTOS ───────────────────────────────────────────────────────────
// Cada departamento tem cor própria para identificação visual
export const DEPARTAMENTOS = [
  { id: 'direcao',      label: 'Direcção',              cor: '#1C3A5E', corTexto: '#fff' },
  { id: 'financeiro',   label: 'Financeiro',             cor: '#2E7D52', corTexto: '#fff' },
  { id: 'producao',     label: 'Produção',               cor: '#8B4A12', corTexto: '#fff' },
  { id: 'comercial',    label: 'Comercial',              cor: '#0F766E', corTexto: '#fff' },
  { id: 'projeto_el',   label: 'Projecto Eléctrico',    cor: '#6B2E7A', corTexto: '#fff' },
  { id: 'projeto',      label: 'Projecto',               cor: '#1C5F9A', corTexto: '#fff' },
  { id: 'tecnico',      label: 'Técnico',                cor: '#374151', corTexto: '#fff' },
  { id: 'rh',           label: 'Recursos Humanos',       cor: '#B83232', corTexto: '#fff' },
  { id: 'outro',        label: 'Outro',                  cor: '#9CA3AF', corTexto: '#fff' },
];

export const HIERARCHY_TYPES = [
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'chefia_area', label: 'Chefia da área' },
  { value: 'gestao', label: 'Gestão' },
  { value: 'ceo', label: 'CEO' },
];

const HIERARCHY_RANK = {
  colaborador: 10,
  chefia_area: 20,
  gestao: 30,
  ceo: 40,
};

export const getDeptCor = (deptId) =>
  DEPARTAMENTOS.find(d => d.id === deptId)?.cor || '#9CA3AF';

export const ACCESS_LEVELS = [
  { value: 'none', label: 'Nao ver' },
  { value: 'view', label: 'Pode ver' },
  { value: 'edit', label: 'Pode editar' },
];

export const ACCESS_LEVEL_ORDER = { none: 0, view: 1, edit: 2 };

export const MODULES_SIS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'tesouraria', label: 'Mapa de Tesouraria', path: '/tesouraria' },
  { key: 'obras', label: 'Obras', path: '/obras' },
  { key: 'fornecedores', label: 'Fornecedores', path: '/fornecedores' },
  { key: 'clientes', label: 'Clientes', path: '/clientes' },
  { key: 'arquivo', label: 'Arquivo', path: '/arquivo' },
  { key: 'rh', label: 'Recursos Humanos', path: '/rh' },
  { key: 'logistica', label: 'Logistica', path: '/logistica' },
  { key: 'perfil', label: 'Perfil e Acessos', path: '/perfil' },
];

const PATH_TO_MODULE = Object.fromEntries(MODULES_SIS.map(m => [m.path, m.key]));

const ACTION_MODULE_MAP = {
  emitir_fatura_cli: 'clientes',
  aprovar_fatura_cli_req: 'clientes',
  aprovar_fatura_cli_lg: 'clientes',
  aprovar_fatura_cli_ms: 'clientes',
  assinalar_recebimento_cli: 'clientes',
  colocar_doc51: 'clientes',
  editar_cliente: 'clientes',
  colocar_fatura_forn: 'fornecedores',
  validar_fatura_forn: 'fornecedores',
  aprovar_pagamento_lg: 'fornecedores',
  autorizar_pagamento: 'fornecedores',
  assinalar_pago: 'fornecedores',
  confirmar_pagamento: 'fornecedores',
  editar_fornecedor: 'fornecedores',
  ver_tesouraria: 'tesouraria',
  alterar_dados_tesouraria: 'tesouraria',
  confirmar_recebimento: 'tesouraria',
  editar_data_previsao_pag: 'tesouraria',
  criar_obra: 'obras',
  ver_obras_todas: 'obras',
  ver_obras_proprias: 'obras',
  editar_dados_obra: 'obras',
  descarregar_relatorios: 'obras',
  emitir_jado: 'obras',
  aprovar_jado: 'obras',
  responder_jado: 'obras',
  criar_encomenda: 'obras',
  satisfazer_encomenda: 'obras',
  ver_relatorios: 'obras',
  gerir_perfis: 'perfil',
  assinalar_admin: 'perfil',
  criar_tarefa_outros: 'dashboard',
  comentar_aprovacao: 'arquivo',
  adicionar_doc_pasta: 'arquivo',
};

const EDIT_ACTIONS = new Set([
  'emitir_fatura_cli',
  'aprovar_fatura_cli_req',
  'aprovar_fatura_cli_lg',
  'aprovar_fatura_cli_ms',
  'assinalar_recebimento_cli',
  'colocar_doc51',
  'editar_cliente',
  'colocar_fatura_forn',
  'validar_fatura_forn',
  'aprovar_pagamento_lg',
  'autorizar_pagamento',
  'assinalar_pago',
  'confirmar_pagamento',
  'editar_fornecedor',
  'alterar_dados_tesouraria',
  'confirmar_recebimento',
  'editar_data_previsao_pag',
  'criar_obra',
  'editar_dados_obra',
  'emitir_jado',
  'aprovar_jado',
  'responder_jado',
  'criar_encomenda',
  'satisfazer_encomenda',
  'gerir_perfis',
  'assinalar_admin',
  'criar_tarefa_outros',
  'comentar_aprovacao',
  'adicionar_doc_pasta',
]);

function compareAccessLevel(current, next) {
  return ACCESS_LEVEL_ORDER[next] > ACCESS_LEVEL_ORDER[current] ? next : current;
}

function isAtLeastLevel(current, required) {
  return ACCESS_LEVEL_ORDER[current || 'none'] >= ACCESS_LEVEL_ORDER[required || 'none'];
}

function createDefaultPermissoes() {
  return {
    paginas: Object.fromEntries(TODAS_PAGINAS.map(p => [p.path, p.path === '/' ? 'view' : 'none'])),
    modulos: Object.fromEntries(MODULES_SIS.map(m => [m.key, m.key === 'dashboard' ? 'view' : 'none'])),
    obras: { mode: 'all', ids: [], level: 'none' },
  };
}

function normalizeHierarchyType(type) {
  return HIERARCHY_RANK[type] ? type : 'colaborador';
}

function inferHierarchyType(perfil = {}) {
  const role = String(perfil.role || '').toLowerCase();
  const departamento = String(perfil.departamento || '').toLowerCase();
  if (perfil?.isAdmin || role.includes('ceo') || perfil?.id === 'ms') return 'ceo';
  if (departamento === 'direcao') return 'gestao';
  if (
    role.includes('diretor')
    || role.includes('diretora')
    || role.includes('chef')
    || role.includes('chefe')
  ) {
    return 'chefia_area';
  }
  return 'colaborador';
}

function getAllDepartmentIds() {
  return DEPARTAMENTOS.map(d => d.id).filter(id => id !== 'outro');
}

function deriveManagedDepartments(perfil = {}, hierarchyType = inferHierarchyType(perfil)) {
  if (hierarchyType === 'ceo' || perfil?.isAdmin) return getAllDepartmentIds();
  if (hierarchyType === 'gestao') return getAllDepartmentIds().filter(id => id !== 'direcao');
  if (hierarchyType === 'chefia_area' && perfil?.departamento && perfil.departamento !== 'outro') return [perfil.departamento];
  return [];
}

function normalizeManagedDepartments(departments, perfil = {}, hierarchyType = inferHierarchyType(perfil)) {
  const source = Array.isArray(departments) && departments.length > 0
    ? departments
    : deriveManagedDepartments(perfil, hierarchyType);
  return [...new Set(source.filter(Boolean))];
}

function createEmptyAccessMatrix() {
  return {
    entities: {
      obras: {},
      clientes: {},
      fornecedores: {},
      tesouraria: {},
    },
  };
}

function normalizeEntityConfig(config = {}) {
  const members = Object.fromEntries(
    Object.entries(config.members || {}).map(([userId, level]) => [userId, normalizeAccessLevel(level)]),
  );
  const sections = Object.fromEntries(
    Object.entries(config.sections || {}).map(([sectionKey, sectionConfig]) => [
      sectionKey,
      {
        members: Object.fromEntries(
          Object.entries(sectionConfig?.members || {}).map(([userId, level]) => [userId, normalizeAccessLevel(level)]),
        ),
      },
    ]),
  );
  return { members, sections };
}

function normalizeAccessLevel(level) {
  return ACCESS_LEVEL_ORDER[level] !== undefined ? level : 'none';
}

function deriveLegacyPermissoes(perfil) {
  const permissoes = createDefaultPermissoes();

  if (perfil?.isAdmin) {
    TODAS_PAGINAS.forEach(p => { permissoes.paginas[p.path] = 'edit'; });
    MODULES_SIS.forEach(m => { permissoes.modulos[m.key] = 'edit'; });
    permissoes.obras = { mode: 'all', ids: [], level: 'edit' };
    return permissoes;
  }

  (perfil?.paginas || []).forEach(path => {
    permissoes.paginas[path] = compareAccessLevel(permissoes.paginas[path] || 'none', path === '/' ? 'view' : 'view');
    const moduleKey = PATH_TO_MODULE[path];
    if (moduleKey) {
      permissoes.modulos[moduleKey] = compareAccessLevel(permissoes.modulos[moduleKey] || 'none', 'view');
    }
  });

  (perfil?.acoes || []).forEach(actionId => {
    const moduleKey = ACTION_MODULE_MAP[actionId];
    if (!moduleKey) return;
    const nextLevel = EDIT_ACTIONS.has(actionId) ? 'edit' : 'view';
    permissoes.modulos[moduleKey] = compareAccessLevel(permissoes.modulos[moduleKey] || 'none', nextLevel);
    const pagePath = MODULES_SIS.find(m => m.key === moduleKey)?.path;
    if (pagePath) {
      permissoes.paginas[pagePath] = compareAccessLevel(permissoes.paginas[pagePath] || 'none', nextLevel);
    }
  });

  if ((perfil?.acoes || []).includes('ver_obras_todas')) {
    permissoes.obras = { mode: 'all', ids: [], level: compareAccessLevel(permissoes.modulos.obras, 'view') };
  } else if ((perfil?.acoes || []).includes('ver_obras_proprias')) {
    permissoes.obras = { mode: 'owned', ids: [], level: compareAccessLevel(permissoes.modulos.obras, 'view') };
  } else if (perfil?.paginas?.includes('/obras')) {
    permissoes.obras = { mode: 'all', ids: [], level: permissoes.modulos.obras };
  }

  return permissoes;
}

export function normalizePerfil(perfil) {
  const legacy = deriveLegacyPermissoes(perfil);
  const incoming = perfil?.permissoes || {};
  const paginas = { ...legacy.paginas, ...(incoming.paginas || {}) };
  const modulos = { ...legacy.modulos, ...(incoming.modulos || {}) };
  const obras = {
    ...legacy.obras,
    ...(incoming.obras || {}),
    ids: Array.isArray(incoming.obras?.ids) ? incoming.obras.ids : legacy.obras.ids,
  };

  const normalized = {
    ...perfil,
    hierarquia: {
      tipo: normalizeHierarchyType(perfil?.hierarquia?.tipo || perfil?.hierarquiaTipo || inferHierarchyType(perfil)),
      nivel: Number(
        perfil?.hierarquia?.nivel
        || perfil?.hierarquiaNivel
        || HIERARCHY_RANK[normalizeHierarchyType(perfil?.hierarquia?.tipo || perfil?.hierarquiaTipo || inferHierarchyType(perfil))]
      ),
      departamentosGeridos: normalizeManagedDepartments(
        perfil?.hierarquia?.departamentosGeridos || perfil?.departamentosGeridos,
        perfil,
        normalizeHierarchyType(perfil?.hierarquia?.tipo || perfil?.hierarquiaTipo || inferHierarchyType(perfil)),
      ),
    },
    notificacoes: {
      ...createDefaultNotificacoes(),
      ...(perfil?.notificacoes || {}),
    },
    permissoes: {
      paginas: Object.fromEntries(Object.entries(paginas).map(([k, v]) => [k, normalizeAccessLevel(v)])),
      modulos: Object.fromEntries(Object.entries(modulos).map(([k, v]) => [k, normalizeAccessLevel(v)])),
      obras: {
        mode: ['all', 'owned', 'selected'].includes(obras.mode) ? obras.mode : legacy.obras.mode,
        ids: Array.isArray(obras.ids) ? [...new Set(obras.ids)] : [],
        level: normalizeAccessLevel(obras.level || modulos.obras || legacy.obras.level),
      },
    },
  };

  return normalized;
}

function enrichLegacyCollections(perfil) {
  const normalized = normalizePerfil(perfil);
  const paginas = TODAS_PAGINAS
    .filter(p => isAtLeastLevel(normalized.permissoes.paginas[p.path], 'view'))
    .map(p => p.path);
  return {
    ...normalized,
    paginas,
  };
}

export function getPageLevel(perfil, path) {
  if (path === '/') return 'view';
  if (perfil?.isAdmin) return 'edit';
  const legacyLevel = normalizePerfil(perfil).permissoes.paginas[path] || 'none';
  return getEntityLevel(perfil, 'paginas', path, legacyLevel);
}

export function getModuleLevel(perfil, moduleKey) {
  if (perfil?.isAdmin) return 'edit';
  const legacyLevel = normalizePerfil(perfil).permissoes.modulos[moduleKey] || 'none';
  return getEntityLevel(perfil, 'modulos', moduleKey, legacyLevel);
}

export function canViewPage(perfil, path) {
  if (path === '/') return true;
  return isAtLeastLevel(getPageLevel(perfil, path), 'view');
}

export function canEditPage(perfil, path) {
  if (path === '/') return true;
  return isAtLeastLevel(getPageLevel(perfil, path), 'edit');
}

export function canViewModule(perfil, moduleKey) {
  return isAtLeastLevel(getModuleLevel(perfil, moduleKey), 'view');
}

export function canEditModule(perfil, moduleKey) {
  return isAtLeastLevel(getModuleLevel(perfil, moduleKey), 'edit');
}

export function getAccessibleObraIds(perfil, obras = []) {
  if (perfil?.isAdmin) return obras.map(o => o.id);
  const normalized = normalizePerfil(perfil);
  const scope = normalized.permissoes.obras || { mode: 'all', ids: [], level: 'none' };
  let legacyIds = [];
  if (isAtLeastLevel(scope.level, 'view')) {
    if (scope.mode === 'all') legacyIds = obras.map(o => o.id);
    else if (scope.mode === 'selected') legacyIds = scope.ids;
    else {
      const nome = (perfil?.nome || '').toLowerCase();
      legacyIds = obras
        .filter(obra => [obra.dp, obra.controller].some(v => String(v || '').toLowerCase() === nome))
        .map(obra => obra.id);
    }
  }

  return obras
    .filter((obra) => isAtLeastLevel(getEntityLevel(perfil, 'obras', obra.id, legacyIds.includes(obra.id) ? 'view' : 'none'), 'view'))
    .map(obra => obra.id);
}

export function canAccessObra(perfil, obraId, obras = []) {
  return getAccessibleObraIds(perfil, obras).includes(obraId);
}

export function canEditObra(perfil, obraId, obras = []) {
  if (perfil?.isAdmin) return true;
  const normalized = normalizePerfil(perfil);
  const legacyCanEdit = isAtLeastLevel(normalized.permissoes.obras?.level, 'edit') && canAccessObra(normalized, obraId, obras);
  return isAtLeastLevel(getEntityLevel(perfil, 'obras', obraId, legacyCanEdit ? 'edit' : 'none'), 'edit');
}

export function getHierarchyType(perfil) {
  return normalizePerfil(perfil).hierarquia?.tipo || 'colaborador';
}

export function getHierarchyRank(perfil) {
  return Number(normalizePerfil(perfil).hierarquia?.nivel || HIERARCHY_RANK[getHierarchyType(perfil)] || 0);
}

export function getManagedDepartments(perfil) {
  return normalizePerfil(perfil).hierarquia?.departamentosGeridos || [];
}

export function isAreaChief(perfil, deptId = null) {
  const normalized = normalizePerfil(perfil);
  if (normalized.isAdmin) return true;
  if (normalized.hierarquia?.tipo !== 'chefia_area') return false;
  if (!deptId) return true;
  return getManagedDepartments(normalized).includes(deptId);
}

export function isGestao(perfil) {
  const type = getHierarchyType(perfil);
  return type === 'gestao' || type === 'ceo' || Boolean(perfil?.isAdmin);
}

export function getManagedCollaboratorIds(manager, perfis = loadPerfis()) {
  if (!manager) return [];
  const normalizedManager = normalizePerfil(manager);
  const managerType = getHierarchyType(normalizedManager);
  const managerRank = getHierarchyRank(normalizedManager);
  const managedDepartments = getManagedDepartments(normalizedManager);

  return perfis
    .filter(perfil => perfil?.isColaborador)
    .filter((perfil) => {
      if (perfil.id === normalizedManager.id) return false;
      if (normalizedManager.isAdmin || managerType === 'ceo') return true;

      const normalizedPerfil = normalizePerfil(perfil);
      const perfilRank = getHierarchyRank(normalizedPerfil);
      if (normalizedPerfil.isAdmin || getHierarchyType(normalizedPerfil) === 'ceo') return false;

      if (managerType === 'gestao') return perfilRank < managerRank;
      if (managerType === 'chefia_area') {
        return perfilRank < managerRank && managedDepartments.includes(normalizedPerfil.departamento);
      }
      return false;
    })
    .map(perfil => perfil.id);
}

export function canManageCollaborator(manager, collaborator, perfis = loadPerfis()) {
  if (!manager || !collaborator) return false;
  if (manager?.isAdmin) return true;
  return getManagedCollaboratorIds(manager, perfis).includes(collaborator.id);
}

export function canAccessCollaboratorProfile(viewer, collaborator, perfis = loadPerfis()) {
  if (!viewer || !collaborator) return false;
  if (viewer.id === collaborator.id) return true;
  return canManageCollaborator(viewer, collaborator, perfis);
}

export function getHierarchyManagers(collaborator, perfis = loadPerfis()) {
  if (!collaborator) return [];
  const normalizedCollaborator = normalizePerfil(collaborator);
  const type = getHierarchyType(normalizedCollaborator);
  const deptId = normalizedCollaborator.departamento;
  const isEligible = (perfil) => perfil?.id !== normalizedCollaborator.id && perfil?.isColaborador;

  const uniqueById = (list) => {
    const seen = new Set();
    return list.filter((perfil) => {
      if (!perfil || seen.has(perfil.id)) return false;
      seen.add(perfil.id);
      return true;
    });
  };

  const ceoOrAdmins = perfis.filter((perfil) => isEligible(perfil) && (perfil.isAdmin || getHierarchyType(perfil) === 'ceo'));
  const gestao = perfis.filter((perfil) => isEligible(perfil) && getHierarchyType(perfil) === 'gestao');
  const chefiasArea = perfis.filter((perfil) =>
    isEligible(perfil)
    && getHierarchyType(perfil) === 'chefia_area'
    && getManagedDepartments(perfil).includes(deptId),
  );

  if (normalizedCollaborator.isAdmin || type === 'ceo') return uniqueById(ceoOrAdmins.filter(p => p.id !== normalizedCollaborator.id));
  if (type === 'gestao') return uniqueById(ceoOrAdmins);
  if (type === 'chefia_area') return uniqueById([...gestao, ...ceoOrAdmins]);
  return uniqueById([...chefiasArea, ...gestao, ...ceoOrAdmins]);
}

export function canApproveFeriasFor(manager, collaborator, perfis = loadPerfis()) {
  if (!manager || !collaborator || manager.id === collaborator.id) return false;
  return canManageCollaborator(manager, collaborator, perfis);
}

// ─── TODAS AS ACÇÕES DO SISTEMA ───────────────────────────────────────────────
// Baseado no PDF: Ações/Notificações/Gestão de tarefas
export const TODAS_ACOES = [
  // ── Clientes
  { id: 'emitir_fatura_cli',          label: 'Emitir fatura a cliente',                       grupo: 'Clientes' },
  { id: 'aprovar_fatura_cli_req',     label: 'Aprovar fatura de cliente (requerente)',          grupo: 'Clientes' },
  { id: 'aprovar_fatura_cli_lg',      label: 'Confirmar emissão de fatura (LG)',               grupo: 'Clientes' },
  { id: 'aprovar_fatura_cli_ms',      label: 'Aprovar fatura de cliente (MS)',                  grupo: 'Clientes' },
  { id: 'assinalar_recebimento_cli',  label: 'Assinalar recebimento de cliente',                grupo: 'Clientes' },
  { id: 'colocar_doc51',              label: 'Colocar Doc. 51 (Centralgest)',                   grupo: 'Clientes' },
  // ── Fornecedores
  { id: 'colocar_fatura_forn',        label: 'Registar fatura de fornecedor',                   grupo: 'Fornecedores' },
  { id: 'validar_fatura_forn',        label: 'Validar fatura de fornecedor (DP)',               grupo: 'Fornecedores' },
  { id: 'aprovar_pagamento_lg',       label: 'Aprovar pagamento a fornecedor (LG)',              grupo: 'Fornecedores' },
  { id: 'autorizar_pagamento',        label: 'Autorizar pagamento (MS)',                         grupo: 'Fornecedores' },
  { id: 'assinalar_pago',             label: 'Assinalar pagamento efectuado (LG)',               grupo: 'Fornecedores' },
  { id: 'confirmar_pagamento',        label: 'Confirmar pagamento / recebimento',                grupo: 'Fornecedores' },
  { id: 'editar_data_previsao_pag',   label: 'Editar data de previsão de pagamento',             grupo: 'Tesouraria' },
  // ── Tesouraria
  { id: 'ver_tesouraria',             label: 'Ver mapa de tesouraria',                           grupo: 'Tesouraria' },
  { id: 'alterar_dados_tesouraria',   label: 'Alterar dados nas tabelas de tesouraria',          grupo: 'Tesouraria' },
  { id: 'confirmar_recebimento',      label: 'Confirmar recebimentos de clientes',               grupo: 'Tesouraria' },
  // ── Obras
  { id: 'criar_obra',                 label: 'Criar obra',                                       grupo: 'Obras' },
  { id: 'ver_obras_todas',            label: 'Ver todas as obras',                               grupo: 'Obras' },
  { id: 'ver_obras_proprias',         label: 'Ver obras atribuídas',                             grupo: 'Obras' },
  { id: 'editar_dados_obra',          label: 'Editar dados de obra (Controller)',                grupo: 'Obras' },
  { id: 'descarregar_relatorios',     label: 'Descarregar relatórios de obra',                   grupo: 'Obras' },
  { id: 'emitir_jado',                label: 'Emitir JADO',                                      grupo: 'Obras' },
  { id: 'aprovar_jado',               label: 'Aprovar JADO',                                     grupo: 'Obras' },
  { id: 'responder_jado',             label: 'Responder a JADO',                                 grupo: 'Obras' },
  { id: 'criar_encomenda',            label: 'Criar encomenda',                                   grupo: 'Obras' },
  { id: 'satisfazer_encomenda',       label: 'Satisfazer encomenda',                             grupo: 'Obras' },
  // ── Perfis / Admin
  { id: 'gerir_perfis',               label: 'Gerir perfis e acessos',                           grupo: 'Admin' },
  { id: 'assinalar_admin',            label: 'Assinalar novo administrador',                      grupo: 'Admin' },
  // ── Tarefas
  { id: 'criar_tarefa_outros',        label: 'Criar tarefas para outros',                        grupo: 'Tarefas' },
  { id: 'ver_relatorios',             label: 'Ver relatórios automáticos',                       grupo: 'Obras' },
  // ── Comentários nas aprovações
  { id: 'comentar_aprovacao',         label: 'Escrever comentário nas aprovações de faturas',    grupo: 'Geral' },
  // ── Clientes/Fornecedores dados
  { id: 'editar_cliente',             label: 'Alterar dados de cliente',                         grupo: 'Clientes' },
  { id: 'editar_fornecedor',          label: 'Alterar dados de fornecedor',                      grupo: 'Fornecedores' },
  { id: 'adicionar_doc_pasta',        label: 'Adicionar documento à pasta de fatura',            grupo: 'Arquivo' },
];

// ─── NOTIFICAÇÕES DISPONÍVEIS ─────────────────────────────────────────────────
export const NOTIF_TIPOS = [
  { id: 'pagamentos_pendentes',     label: 'Pagamentos pendentes de autorização' },
  { id: 'faturas_vencidas',         label: 'Faturas vencidas' },
  { id: 'novo_draft_fatura',        label: 'Novo draft de fatura para validar' },
  { id: 'fatura_aprovada',          label: 'Fatura aprovada (avança no fluxo)' },
  { id: 'recebimentos',             label: 'Recebimentos confirmados' },
  { id: 'jado_critico',             label: 'JADO crítico emitido' },
  { id: 'jado_validacao',           label: 'JADO aguarda validação' },
  { id: 'alertas_obra',             label: 'Alertas de obra (desvios de custo)' },
  { id: 'cashflow_negativo',        label: 'Cashflow negativo previsto' },
  { id: 'fatura_forn_recebida',     label: 'Nova fatura de fornecedor no SIS' },
  { id: 'pagamento_efectuado',      label: 'Pagamento efectuado' },
  { id: 'tarefa_atribuida',         label: 'Nova tarefa atribuída por outrem' },
];

function createDefaultNotificacoes() {
  return Object.fromEntries(NOTIF_TIPOS.map((tipo) => [tipo.id, true]));
}

// ─── PÁGINAS DO SIS ───────────────────────────────────────────────────────────
export const TODAS_PAGINAS = [
  { path: '/',             label: 'Dashboard' },
  { path: '/tesouraria',   label: 'Mapa de Tesouraria' },
  { path: '/obras',        label: 'Obras' },
  { path: '/fornecedores', label: 'Fornecedores' },
  { path: '/clientes',     label: 'Clientes' },
  { path: '/arquivo',      label: 'Arquivo' },
  { path: '/rh',           label: 'Recursos Humanos' },
  { path: '/logistica',    label: 'Logística' },
  { path: '/perfil',       label: 'Perfil & Acessos' },
];

// ─── PERFIS DEFAULT ───────────────────────────────────────────────────────────
// Baseado na lista de pessoas do PDF
export const PERFIS_DEFAULT = [
  {
    id: 'ms', initials: 'MS', colaboradorId: 'COL-001', isColaborador: true, nome: 'Miguel Seabra', email: 'ms@novanor.pt',
    role: 'CEO', departamento: 'direcao', cor: '#1C3A5E', isAdmin: true, pin: '1234',
    paginas: ['/', '/tesouraria', '/obras', '/fornecedores', '/clientes', '/arquivo', '/rh', '/logistica', '/perfil'],
    acoes: ['emitir_fatura_cli','aprovar_fatura_cli_ms','assinalar_recebimento_cli','colocar_doc51','validar_fatura_forn','aprovar_pagamento_lg','autorizar_pagamento','assinalar_pago','confirmar_pagamento','editar_data_previsao_pag','ver_tesouraria','alterar_dados_tesouraria','confirmar_recebimento','criar_obra','ver_obras_todas','editar_dados_obra','descarregar_relatorios','emitir_jado','aprovar_jado','gerir_perfis','assinalar_admin','criar_tarefa_outros','comentar_aprovacao','editar_cliente','editar_fornecedor','adicionar_doc_pasta','ver_relatorios'],
    notificacoes: { pagamentos_pendentes:true, faturas_vencidas:true, novo_draft_fatura:false, fatura_aprovada:true, recebimentos:true, jado_critico:true, jado_validacao:true, alertas_obra:true, cashflow_negativo:true, fatura_forn_recebida:false, pagamento_efectuado:true, tarefa_atribuida:true },
  },
  {
    id: 'lg', initials: 'LG', colaboradorId: 'COL-002', isColaborador: true, nome: 'Leonor Gomes', email: 'lg@novanor.pt',
    role: 'Diretora Financeira / RH', departamento: 'financeiro', cor: '#2E7D52', isAdmin: false, pin: '1234',
    paginas: ['/', '/tesouraria', '/obras', '/fornecedores', '/clientes', '/arquivo', '/rh', '/logistica', '/perfil'],
    acoes: ['emitir_fatura_cli','aprovar_fatura_cli_lg','assinalar_recebimento_cli','editar_data_previsao_pag','ver_tesouraria','alterar_dados_tesouraria','confirmar_recebimento','aprovar_pagamento_lg','assinalar_pago','confirmar_pagamento','ver_obras_todas','descarregar_relatorios','comentar_aprovacao','editar_cliente','adicionar_doc_pasta'],
    notificacoes: { pagamentos_pendentes:true, faturas_vencidas:true, novo_draft_fatura:false, fatura_aprovada:true, recebimentos:true, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:true, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'ca', initials: 'CA', colaboradorId: 'COL-003', isColaborador: true, nome: 'Carla Sousa', email: 'ca@novanor.pt',
    role: 'Assistente Administrativa', departamento: 'financeiro', cor: '#1C5F9A', isAdmin: false, pin: '1234',
    paginas: ['/', '/fornecedores', '/clientes', '/arquivo', '/tesouraria', '/logistica', '/perfil'],
    acoes: ['emitir_fatura_cli','colocar_fatura_forn','colocar_doc51','ver_tesouraria','confirmar_recebimento','confirmar_pagamento','adicionar_doc_pasta','comentar_aprovacao'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:true, novo_draft_fatura:false, fatura_aprovada:true, recebimentos:true, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'cg', initials: 'CG', colaboradorId: 'COL-004', isColaborador: true, nome: 'Ana Rodrigues', email: 'cg@novanor.pt',
    role: 'Controller de Gestão', departamento: 'direcao', cor: '#6B2E7A', isAdmin: false, pin: '1234',
    paginas: ['/', '/tesouraria', '/obras', '/fornecedores', '/clientes', '/arquivo', '/perfil'],
    acoes: ['ver_tesouraria','ver_obras_todas','editar_dados_obra','descarregar_relatorios','emitir_jado','ver_relatorios','criar_obra'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:true, jado_validacao:true, alertas_obra:true, cashflow_negativo:true, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'dp', initials: 'PS', colaboradorId: 'COL-005', isColaborador: true, nome: 'Pedro Serrão', email: 'ps@novanor.pt',
    role: 'Diretor de Produção', departamento: 'producao', cor: '#8B4A12', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/clientes', '/arquivo', '/perfil'],
    acoes: ['validar_fatura_forn','ver_obras_proprias','responder_jado','criar_encomenda','satisfazer_encomenda','comentar_aprovacao'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:true, jado_validacao:true, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'ga', initials: 'GA', colaboradorId: 'COL-006', isColaborador: true, nome: 'Gilberta Alves', email: 'ga@novanor.pt',
    role: 'Assistente Administrativa', departamento: 'financeiro', cor: '#2E7D52', isAdmin: false, pin: '1234',
    paginas: ['/', '/fornecedores', '/clientes', '/arquivo', '/logistica', '/perfil'],
    acoes: ['emitir_fatura_cli','colocar_fatura_forn','ver_tesouraria','adicionar_doc_pasta'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:false, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'jms', initials: 'JMS', colaboradorId: 'COL-007', isColaborador: true, nome: 'José Manuel Silva', email: 'jms@novanor.pt',
    role: 'Técnico Comercial', departamento: 'comercial', cor: '#0F766E', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/clientes', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','emitir_fatura_cli','aprovar_fatura_cli_req'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:true, fatura_aprovada:true, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:false, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'pr', initials: 'PR', colaboradorId: 'COL-008', isColaborador: true, nome: 'Pedro Raimundo', email: 'pr@novanor.pt',
    role: 'Diretor de Projecto Eléctrico', departamento: 'projeto_el', cor: '#6B2E7A', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/clientes', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn','aprovar_fatura_cli_req','criar_encomenda','satisfazer_encomenda'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:true, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'fs', initials: 'FS', colaboradorId: 'COL-009', isColaborador: true, nome: 'Frederico Seabra', email: 'fs@novanor.pt',
    role: 'Gestor Comercial', departamento: 'comercial', cor: '#0F766E', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/clientes', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','emitir_fatura_cli','aprovar_fatura_cli_req'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:true, fatura_aprovada:true, recebimentos:true, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:false, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'js', initials: 'JS', colaboradorId: 'COL-010', isColaborador: true, nome: 'José Simão', email: 'js@novanor.pt',
    role: 'Diretor Comercial', departamento: 'comercial', cor: '#0F766E', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/clientes', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','emitir_fatura_cli','aprovar_fatura_cli_req','criar_tarefa_outros'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:true, fatura_aprovada:true, recebimentos:true, jado_critico:false, jado_validacao:false, alertas_obra:false, cashflow_negativo:false, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'ap', initials: 'AP', colaboradorId: 'COL-011', isColaborador: true, nome: 'André Palma', email: 'ap@novanor.pt',
    role: 'Diretor de Assistência Técnica', departamento: 'projeto_el', cor: '#6B2E7A', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn','criar_encomenda'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'db', initials: 'DB', colaboradorId: 'COL-012', isColaborador: true, nome: 'Daniel Bandeira', email: 'db@novanor.pt',
    role: 'Diretor de Obra', departamento: 'producao', cor: '#8B4A12', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn','criar_encomenda','satisfazer_encomenda'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'ha', initials: 'HA', colaboradorId: 'COL-013', isColaborador: true, nome: 'Hamilton Ascensão', email: 'ha@novanor.pt',
    role: 'Diretor de Contrato', departamento: 'producao', cor: '#8B4A12', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn','criar_encomenda'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'mrm', initials: 'MRM', colaboradorId: 'COL-014', isColaborador: true, nome: 'Manuel Rhodes Mendonça', email: 'mrm@novanor.pt',
    role: 'Diretor de Projecto', departamento: 'projeto', cor: '#1C5F9A', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn','criar_encomenda'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:true, pagamento_efectuado:false, tarefa_atribuida:true },
  },
  {
    id: 'cd', initials: 'CD', colaboradorId: 'COL-015', isColaborador: true, nome: 'Carlos Duque', email: 'cd@novanor.pt',
    role: 'Diretor Técnico', departamento: 'tecnico', cor: '#374151', isAdmin: false, pin: '1234',
    paginas: ['/', '/obras', '/fornecedores', '/arquivo', '/perfil'],
    acoes: ['ver_obras_proprias','validar_fatura_forn'],
    notificacoes: { pagamentos_pendentes:false, faturas_vencidas:false, novo_draft_fatura:false, fatura_aprovada:false, recebimentos:false, jado_critico:false, jado_validacao:false, alertas_obra:true, cashflow_negativo:false, fatura_forn_recebida:false, pagamento_efectuado:false, tarefa_atribuida:true },
  },
];

// ─── LOAD/SAVE ────────────────────────────────────────────────────────────────
export function loadPerfis() {
  try {
    const saved = localStorage.getItem(PERFIS_KEY);
    const removedIds = new Set(JSON.parse(localStorage.getItem(PERFIS_REMOVED_KEY) || '[]'));
    const defaultsDisponiveis = PERFIS_DEFAULT.filter(p => !removedIds.has(p.id));
    if (!saved) return defaultsDisponiveis.map(enrichLegacyCollections);
    const parsed = JSON.parse(saved);
    // Merge: keep any new default profiles not yet in saved list, except the ones explicitly removed
    const savedIds = new Set(parsed.map(p => p.id));
    const novos = defaultsDisponiveis.filter(p => !savedIds.has(p.id));
    return (novos.length > 0 ? [...parsed, ...novos] : parsed).map(enrichLegacyCollections);
  } catch { return PERFIS_DEFAULT.map(enrichLegacyCollections); }
}

export function loadAccessMatrix() {
  try {
    const saved = localStorage.getItem(ACCESS_MATRIX_KEY);
    if (!saved) return createEmptyAccessMatrix();
    const parsed = JSON.parse(saved);
    return {
      entities: {
        ...createEmptyAccessMatrix().entities,
        ...Object.fromEntries(
          Object.entries(parsed.entities || {}).map(([entityType, entityMap]) => [
            entityType,
            Object.fromEntries(
              Object.entries(entityMap || {}).map(([entityId, entityConfig]) => [entityId, normalizeEntityConfig(entityConfig)]),
            ),
          ]),
        ),
      },
    };
  } catch {
    return createEmptyAccessMatrix();
  }
}

export function saveAccessMatrix(matrix) {
  const normalized = {
    entities: Object.fromEntries(
      Object.entries({ ...createEmptyAccessMatrix().entities, ...(matrix?.entities || {}) }).map(([entityType, entityMap]) => [
        entityType,
        Object.fromEntries(
          Object.entries(entityMap || {}).map(([entityId, entityConfig]) => [entityId, normalizeEntityConfig(entityConfig)]),
        ),
      ]),
    ),
  };
  localStorage.setItem(ACCESS_MATRIX_KEY, JSON.stringify(normalized));
}

export function getEntityAccess(entityType, entityId) {
  const matrix = loadAccessMatrix();
  return normalizeEntityConfig(matrix.entities?.[entityType]?.[entityId] || {});
}

export function saveEntityAccess(entityType, entityId, config) {
  const matrix = loadAccessMatrix();
  matrix.entities[entityType] = matrix.entities[entityType] || {};
  matrix.entities[entityType][entityId] = normalizeEntityConfig(config);
  saveAccessMatrix(matrix);
}

export function getEntityLevel(perfil, entityType, entityId, fallbackLevel = 'none') {
  if (perfil?.isAdmin) return 'edit';
  const config = getEntityAccess(entityType, entityId);
  const memberIds = Object.keys(config.members || {});
  if (memberIds.length === 0) return normalizeAccessLevel(fallbackLevel);
  return normalizeAccessLevel(config.members?.[perfil?.id] || 'none');
}

export function canViewEntity(perfil, entityType, entityId, fallbackLevel = 'none') {
  return isAtLeastLevel(getEntityLevel(perfil, entityType, entityId, fallbackLevel), 'view');
}

export function canEditEntity(perfil, entityType, entityId, fallbackLevel = 'none') {
  return isAtLeastLevel(getEntityLevel(perfil, entityType, entityId, fallbackLevel), 'edit');
}

export function getEntitySectionLevel(perfil, entityType, entityId, sectionKey, fallbackLevel = 'none') {
  if (perfil?.isAdmin) return 'edit';
  const config = getEntityAccess(entityType, entityId);
  const sectionMembers = config.sections?.[sectionKey]?.members || {};
  if (Object.keys(sectionMembers).length === 0) return getEntityLevel(perfil, entityType, entityId, fallbackLevel);
  return normalizeAccessLevel(sectionMembers[perfil?.id] || 'none');
}

export function canViewEntitySection(perfil, entityType, entityId, sectionKey, fallbackLevel = 'none') {
  return isAtLeastLevel(getEntitySectionLevel(perfil, entityType, entityId, sectionKey, fallbackLevel), 'view');
}

export function canEditEntitySection(perfil, entityType, entityId, sectionKey, fallbackLevel = 'none') {
  return isAtLeastLevel(getEntitySectionLevel(perfil, entityType, entityId, sectionKey, fallbackLevel), 'edit');
}

export function savePerfis(perfis) {
  const normalized = perfis.map(enrichLegacyCollections);
  const perfisIds = new Set(normalized.map(p => p.id));
  const removedDefaults = PERFIS_DEFAULT
    .map(p => p.id)
    .filter(id => !perfisIds.has(id));
  localStorage.setItem(PERFIS_KEY, JSON.stringify(normalized));
  localStorage.setItem(PERFIS_REMOVED_KEY, JSON.stringify(removedDefaults));
}

export function resetPerfis() {
  localStorage.removeItem(PERFIS_KEY);
  localStorage.removeItem(PERFIS_REMOVED_KEY);
}

export function canDo(perfil, acao) {
  if (perfil?.isAdmin || perfil?.acoes?.includes(acao)) return true;
  const moduleKey = ACTION_MODULE_MAP[acao];
  if (!moduleKey) return false;
  return canEditModule(perfil, moduleKey);
}

export function canSee(perfil, path) {
  return canViewPage(perfil, path);
}

export function wantsNotif(perfil, tipo) {
  return perfil?.notificacoes?.[tipo] || false;
}

// Acções por departamento (para sugerir ao criar perfil)
// ─── COLABORADORES ────────────────────────────────────────────────────────────
// Retorna apenas perfis marcados como colaboradores (isColaborador: true)
export function loadColaboradores() {
  return loadPerfis().filter(p => p.isColaborador);
}

// Mapa de foto: { [userId]: base64 }
export function getFotoColaborador(userId) {
  try {
    return JSON.parse(localStorage.getItem('sis_perfil_extra') || '{}')[userId]?.foto || null;
  } catch { return null; }
}

// Sync: quando se adiciona perfil em Perfil.jsx com isColaborador=true,
// aparece automaticamente em RH (não precisa de sync manual — leem do mesmo store)

export const ACOES_POR_DEPT = {
  direcao:    ['ver_tesouraria','ver_obras_todas','autorizar_pagamento','aprovar_jado','gerir_perfis','criar_tarefa_outros','comentar_aprovacao'],
  financeiro: ['emitir_fatura_cli','aprovar_fatura_cli_lg','assinalar_recebimento_cli','colocar_doc51','ver_tesouraria','alterar_dados_tesouraria','confirmar_recebimento','aprovar_pagamento_lg','assinalar_pago','confirmar_pagamento','editar_data_previsao_pag','comentar_aprovacao','adicionar_doc_pasta'],
  producao:   ['validar_fatura_forn','ver_obras_proprias','responder_jado','criar_encomenda','satisfazer_encomenda','comentar_aprovacao'],
  comercial:  ['ver_obras_proprias','emitir_fatura_cli','aprovar_fatura_cli_req','criar_tarefa_outros'],
  projeto_el: ['ver_obras_proprias','validar_fatura_forn','criar_encomenda','satisfazer_encomenda'],
  projeto:    ['ver_obras_proprias','validar_fatura_forn','criar_encomenda'],
  tecnico:    ['ver_obras_proprias','validar_fatura_forn'],
  rh:         ['ver_obras_proprias'],
  outro:      [],
};
