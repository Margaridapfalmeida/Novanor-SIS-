export const TIPO_COR = {
  draft_emitido:     { bg: 'var(--bg-warning)', text: 'var(--color-warning)', dot: '#C47A1A' },
  draft_aprovado:    { bg: 'var(--bg-success)', text: 'var(--color-success)', dot: '#2E7D52' },
  fatura_emitida:    { bg: 'var(--bg-info)', text: 'var(--color-info)', dot: '#1C5F9A' },
  confirmar_emissao: { bg: 'var(--bg-info)', text: 'var(--color-info)', dot: '#1C5F9A' },
  alerta:            { bg: '#fff5f5', text: 'var(--color-danger)', dot: '#B83232' },
  danger:            { bg: 'var(--bg-danger)', text: 'var(--color-danger)', dot: '#B83232' },
  warning:           { bg: 'var(--bg-warning)', text: 'var(--color-warning)', dot: '#C47A1A' },
  info:              { bg: 'var(--bg-info)', text: 'var(--color-info)', dot: '#1C5F9A' },
  success:           { bg: 'var(--bg-success)', text: 'var(--color-success)', dot: '#2E7D52' },
  acao_req:          { bg: 'var(--bg-warning)', text: 'var(--color-warning)', dot: '#C47A1A' },
  acao_lg:           { bg: 'var(--bg-info)', text: 'var(--color-info)', dot: '#1C5F9A' },
  acao_ms:           { bg: 'var(--bg-warning)', text: 'var(--color-warning)', dot: '#C47A1A' },
  acao_ca:           { bg: 'var(--bg-info)', text: 'var(--color-info)', dot: '#1C5F9A' },
  acao_dp:           { bg: 'var(--bg-warning)', text: 'var(--color-warning)', dot: '#8B4A12' },
};

export function buildNotifNavState(n) {
  const fornecedorId = n?.meta?.fornecedorId || n?.meta?.fornId || null;
  const clienteId = n?.meta?.clienteId || null;
  const faturaId = n?.meta?.faturaId || n?.meta?.entityId || null;

  if (n.path === '/clientes') {
    return faturaId ? { abrirFatura: { ...n.meta, faturaId, clienteId, clienteNome: n.meta?.clienteNome } } : {};
  }
  if (n.path === '/fornecedores') {
    return faturaId ? { abrirFaturaForn: { ...n.meta, faturaId, fornecedorId } } : {};
  }
  if (n.path === '/tesouraria') {
    return n.meta?.tab ? { tab: n.meta.tab } : {};
  }
  return n.meta ? { abrirFatura: n.meta } : {};
}
