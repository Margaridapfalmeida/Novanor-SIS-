export const DELIVERY_CLEAN_KEY = 'sis_delivery_clean_mode';

const CLEAR_KEYS = [
  'sis_access_matrix',
  'sis_obras_extra',
  'sis_obras_data',
  'sis_clientes_extra',
  'sis_fornecedores_extra',
  'sis_faturas_cli',
  'sis_faturas_forn',
  'sis_pasta_fatura_forn',
  'sis_documentos_extra',
  'sis_notificacoes',
  'sis_notif_email_log',
  'sis_dashboard_prefs',
  'sis_tarefas',
  'sis_bookmarks',
  'sis_logistica_frota',
  'sis_logistica_imoveis',
  'sis_logistica_contratos',
  'sis_rh_colab',
  'sis_rh_ferias',
  'sis_rh_horarios',
  'sis_rh_passagens',
  'sis_rh_despesas',
  'sis_despesas_internas',
  'sis_tesouraria_manual',
  'sis_tesouraria_resumo',
];

const CLEAR_PREFIXES = [
  'sis_encomendas_',
  'sis_rh_desp_file_',
];

export function isDeliveryCleanMode() {
  try {
    return localStorage.getItem(DELIVERY_CLEAN_KEY) === '1';
  } catch {
    return false;
  }
}

export function withDemoSeed(data) {
  return isDeliveryCleanMode() ? [] : data;
}

export function prepareSystemForDelivery() {
  try {
    CLEAR_KEYS.forEach((key) => localStorage.removeItem(key));
    Object.keys(localStorage).forEach((key) => {
      if (CLEAR_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem(DELIVERY_CLEAN_KEY, '1');
  } catch {}
}

export function disableDeliveryCleanMode() {
  try {
    localStorage.removeItem(DELIVERY_CLEAN_KEY);
  } catch {}
}
