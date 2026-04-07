// ─────────────────────────────────────────────────────────────────────────────
// exportTesouraria.js — Gerador de Excel/PDF para o Mapa de Tesouraria NOVANOR
//
// Para editar o Excel: modifica ESTE ficheiro. O Tesouraria.jsx apenas importa
// as funções. Não é necessário tocar no ficheiro principal para ajustar o Excel.
//
// Estrutura do workbook:
//   📋 Capa           — resumo executivo, data, índice
//   📊 Resumo Anual   — tabela 12 meses + dados para gráficos
//   ⬇ Fornecedores   — todas as faturas a pagar
//   ⬆ Clientes        — todas as faturas a receber
//   👥 Colaboradores  — dados manuais
//   📋 Impostos        — dados manuais
//   🏦 Financiamentos — dados manuais
//   📈 Investimentos   — dados manuais
//   📦 Diversos        — dados manuais
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Cores NOVANOR ────────────────────────────────────────────────────────────
const C = {
  navy:    'FF1C3A5E',
  teal:    'FF00897B',
  white:   'FFFFFFFF',
  light:   'FFF0F4F8',
  success: 'FFE8F5E9',
  danger:  'FFFDF3F3',
  warn:    'FFFFF8E1',
  muted:   'FF718096',
  red:     'FFB83232',
  green:   'FF2E7D52',
};

// ─── Utilidades ───────────────────────────────────────────────────────────────
function colLetter(n) {
  let s = '';
  while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function addr(col, row) { return colLetter(col) + row; }

function ensureCell(ws, a, value = '') {
  if (!ws[a]) ws[a] = { t: typeof value === 'number' ? 'n' : 's', v: value };
}

function styleCell(ws, a, opts = {}) {
  ensureCell(ws, a);
  const {
    bold = false, italic = false, size = 10, color = 'FF000000', bg = null,
    align = 'left', wrap = false, numFmt = null, border = true,
  } = opts;
  ws[a].s = {
    font: { name: 'Arial', sz: size, bold, italic, color: { argb: color } },
    alignment: { horizontal: align, vertical: 'center', wrapText: wrap },
    ...(bg ? { fill: { patternType: 'solid', fgColor: { argb: bg } } } : {}),
    ...(border ? { border: {
      top:    { style: 'thin', color: { argb: 'FFCBD5E0' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E0' } },
      left:   { style: 'thin', color: { argb: 'FFCBD5E0' } },
      right:  { style: 'thin', color: { argb: 'FFCBD5E0' } },
    }} : {}),
    ...(numFmt ? { numFmt } : {}),
  };
}

function hdrCell(ws, a, bg = C.navy) {
  styleCell(ws, a, { bold: true, color: C.white, bg, align: 'center', size: 10 });
}

function applyRow(ws, row, numCols, opts) {
  for (let c = 1; c <= numCols; c++) styleCell(ws, addr(c, row), opts);
}

// ─── Calcular totais mensais ───────────────────────────────────────────────────
function calcMensais(pagamentos, recebimentos) {
  const recMes = Array(12).fill(0);
  const pagMes = Array(12).fill(0);
  recebimentos.forEach(r => {
    const d = r.dataEmissao || r.dataRecebimento || '';
    MESES.forEach((m, i) => { if (d.includes(m)) recMes[i] += r.valor || 0; });
  });
  pagamentos.forEach(p => {
    const d = p.dataFatura || p.prevPagamento || '';
    MESES.forEach((m, i) => { if (d.includes(m)) pagMes[i] += p.valor || 0; });
  });
  const cfMes = MESES.map((_, i) => recMes[i] - pagMes[i]);
  let acc = 0;
  const cfAcc = cfMes.map(v => (acc += v, acc));
  return { recMes, pagMes, cfMes, cfAcc };
}

// ─── ABA: CAPA ────────────────────────────────────────────────────────────────
function makeCapa(wb, pagamentos, recebimentos, now) {
  const pendForn = pagamentos.filter(p => p.estadoPag !== 'pago').reduce((s, p) => s + (p.valor || 0), 0);
  const pendCli  = recebimentos.filter(r => r.estadoRec !== 'recebido').reduce((s, r) => s + (r.valor || 0), 0);
  const pagoForn = pagamentos.filter(p => p.estadoPag === 'pago').reduce((s, p) => s + (p.valor || 0), 0);
  const recebCli = recebimentos.filter(r => r.estadoRec === 'recebido').reduce((s, r) => s + (r.valor || 0), 0);
  const fmt = v => `€ ${Math.round(v).toLocaleString('pt-PT')}`;

  const rows = [
    ['NOVANOR', 'Mapa de Tesouraria', ''],
    [`Exportado em ${now.toLocaleDateString('pt-PT')} às ${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`, '', ''],
    ['', '', ''],
    ['RESUMO EXECUTIVO', '', ''],
    ['Forn. — Pagamentos pendentes',  '', fmt(pendForn)],
    ['Forn. — Total já pago',         '', fmt(pagoForn)],
    ['Clientes — Por receber',        '', fmt(pendCli)],
    ['Clientes — Total recebido',     '', fmt(recebCli)],
    ['Saldo estimado (Rec.−Pag.)',    '', fmt(recebCli - pagoForn)],
    ['', '', ''],
    ['ABAS INCLUÍDAS', '', ''],
    ['📊 Resumo Anual',    '⬇ Fornecedores',   '⬆ Clientes'],
    ['👥 Colaboradores',   '📋 Impostos',       '🏦 Financiamentos'],
    ['📈 Investimentos',   '📦 Diversos',       ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 22 }];

  styleCell(ws, 'A1', { bold: true, size: 18, color: C.navy, border: false });
  styleCell(ws, 'B1', { bold: true, size: 14, color: C.teal, border: false });
  styleCell(ws, 'A2', { italic: true, size: 9, color: C.muted, border: false });
  styleCell(ws, 'A4', { bold: true, size: 11, color: C.white, bg: C.navy });
  styleCell(ws, 'A11', { bold: true, size: 11, color: C.white, bg: C.teal });

  [[5, C.danger, false], [6, C.success, false], [7, C.warn, false], [8, C.success, false], [9, C.light, true]].forEach(([r, bg, bold]) => {
    styleCell(ws, `A${r}`, { size: 10, bold });
    styleCell(ws, `C${r}`, { bold: true, size: 10, align: 'right', bg });
  });

  XLSX.utils.book_append_sheet(wb, ws, '📋 Capa');
}

// ─── ABA: RESUMO ANUAL ────────────────────────────────────────────────────────
function makeResumo(wb, pagamentos, recebimentos) {
  const { recMes, pagMes, cfMes, cfAcc } = calcMensais(pagamentos, recebimentos);
  const totalRec = recMes.reduce((a, b) => a + b, 0);
  const totalPag = pagMes.reduce((a, b) => a + b, 0);
  const totalCf  = cfMes.reduce((a, b) => a + b, 0);

  // ── Dados principais (linhas 1-10) + dados gráfico (linhas 12-17) ──────────
  const rows = [
    // 1: título
    ['RESUMO ANUAL DE TESOURARIA — NOVANOR', ...Array(13).fill('')],
    // 2: cabeçalho meses
    ['', ...MESES, 'TOTAL'],
    // 3: secção entradas
    ['▲ ENTRADAS', ...Array(12).fill(''), ''],
    // 4: recebimentos
    ['Recebimentos (Clientes)', ...recMes, totalRec],
    // 5: secção saídas
    ['▼ SAÍDAS', ...Array(12).fill(''), ''],
    // 6: pagamentos
    ['Pagamentos (Fornecedores)', ...pagMes, totalPag],
    // 7: separador
    ['', ...Array(13).fill('')],
    // 8: cashflow líquido
    ['CASHFLOW LÍQUIDO', ...cfMes, totalCf],
    // 9: cashflow acumulado
    ['CASHFLOW ACUMULADO', ...cfAcc, ''],
    // 10: separador
    ['', ...Array(13).fill('')],
    // 11: nota gráficos
    ['— Dados para gráficos —', ...Array(13).fill('')],
    // 12: labels meses (referência dos gráficos)
    ['Mês', ...MESES, ''],
    // 13: série recebimentos
    ['Recebimentos', ...recMes, ''],
    // 14: série pagamentos
    ['Pagamentos', ...pagMes, ''],
    // 15: série cashflow
    ['Cashflow', ...cfMes, ''],
    // 16: série acumulado
    ['Acumulado', ...cfAcc, ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, ...Array(12).fill({ wch: 11 }), { wch: 13 }];

  // Título
  styleCell(ws, 'A1', { bold: true, size: 13, color: C.white, bg: C.navy, align: 'left' });

  // Header meses
  for (let c = 1; c <= 14; c++) hdrCell(ws, addr(c, 2), C.navy);

  // Entradas header
  applyRow(ws, 3, 14, { bold: true, color: C.white, bg: C.teal });
  // Recebimentos dados
  styleCell(ws, 'A4', { bold: true, bg: 'FFEDF7F2' });
  for (let c = 2; c <= 14; c++)
    styleCell(ws, addr(c, 4), { align: 'right', numFmt: '#,##0', bg: 'FFEDF7F2' });

  // Saídas header
  applyRow(ws, 5, 14, { bold: true, color: C.white, bg: C.red });
  // Pagamentos dados
  styleCell(ws, 'A6', { bold: true, bg: C.danger });
  for (let c = 2; c <= 14; c++)
    styleCell(ws, addr(c, 6), { align: 'right', numFmt: '#,##0', bg: C.danger });

  // Cashflow líquido
  for (let c = 1; c <= 14; c++)
    styleCell(ws, addr(c, 8), { bold: true, color: C.white, bg: C.navy, align: c === 1 ? 'left' : 'right', numFmt: c === 1 ? null : '#,##0' });

  // Cashflow acumulado
  styleCell(ws, 'A9', { bold: true, bg: C.light });
  for (let c = 2; c <= 13; c++)
    styleCell(ws, addr(c, 9), { bold: true, bg: C.light, align: 'right', numFmt: '#,##0', color: C.navy });

  // Nota dados gráfico
  applyRow(ws, 11, 14, { italic: true, color: C.muted, bg: C.light, size: 9 });
  applyRow(ws, 12, 14, { bold: true, color: C.muted, bg: C.light, size: 9 });

  // ── GRÁFICOS via SheetJS (!charts) ────────────────────────────────────────
  // Nota: SheetJS suporta gráficos básicos via !charts nas versões Pro.
  // Na versão free (CDN), os gráficos são definidos aqui mas podem não renderizar.
  // Alternativa: os dados estão nas linhas 12-16 para o utilizador criar gráficos
  // manualmente no Excel com Insert > Chart.
  //
  // Para ter gráficos automáticos, usar o script Python (gerar_tesouraria.py)
  // com openpyxl que suporta gráficos nativamente.

  // Adicionar nota explicativa na célula A18
  ws['A18'] = { t: 's', v: '💡 Para criar gráficos: selecciona as linhas 12-16, vai a Inserir > Gráfico' };
  styleCell(ws, 'A18', { italic: true, color: C.muted, size: 9, bg: C.warn, border: false });

  ws['!freeze'] = { xSplit: 1, ySplit: 2 };
  XLSX.utils.book_append_sheet(wb, ws, '📊 Resumo Anual');
}

// ─── ABA: FORNECEDORES ────────────────────────────────────────────────────────
function makeFornecedores(wb, pagamentos) {
  const PAG_LABELS = {
    'pago': 'Pago', 'autorizado': 'Autorizado',
    'pending-ms': 'Aguarda MS', 'pending-dp': 'Aguarda DP', 'pending-lg': 'Aguarda LG',
  };
  const headers = ['Fornecedor','Obra','Categoria','Nº Fatura','Descrição',
    'Valor (€)','Data Fatura','Vencimento','Cond. Pag.','Prev. Pag.','Estado','Banco','Data Pag. Efectivo'];
  const dataRows = pagamentos.map(p => [
    p.fornecedor || '', p.obra || '', p.categoria || '', p.nFatura || '', p.descricao || '',
    p.valor || 0, p.dataFatura || '', p.dataVenc || '', p.condPag || '',
    p.prevPagamento || '', PAG_LABELS[p.estadoPag] || p.estadoPag || '',
    p.banco || '', p.dataConfirmacao || '',
  ]);
  const total = pagamentos.reduce((s, p) => s + (p.valor || 0), 0);

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ...dataRows,
    ['TOTAL', '', '', '', '', total, '', '', '', '', '', '', ''],
  ]);
  ws['!cols'] = [{wch:26},{wch:8},{wch:20},{wch:13},{wch:30},{wch:12},{wch:11},{wch:11},{wch:12},{wch:12},{wch:13},{wch:10},{wch:13}];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  headers.forEach((_, i) => hdrCell(ws, addr(i + 1, 1), C.navy));
  dataRows.forEach((row, ri) => {
    const rowNum = ri + 2;
    const estado = pagamentos[ri]?.estadoPag;
    const bg = estado === 'pago' ? C.success : estado === 'autorizado' ? 'FFE3F2FD' : ri % 2 === 0 ? C.light : 'FFFFFFFF';
    row.forEach((_, ci) => {
      styleCell(ws, addr(ci + 1, rowNum), { bg, size: 9, align: ci === 5 ? 'right' : 'left', numFmt: ci === 5 ? '#,##0.00' : null });
    });
  });
  const tr = dataRows.length + 2;
  headers.forEach((_, i) => {
    styleCell(ws, addr(i + 1, tr), { bold: true, color: C.white, bg: C.navy, align: i === 5 ? 'right' : 'left', numFmt: i === 5 ? '#,##0.00' : null });
  });

  XLSX.utils.book_append_sheet(wb, ws, '⬇ Fornecedores');
}

// ─── ABA: CLIENTES ────────────────────────────────────────────────────────────
function makeClientes(wb, recebimentos) {
  const REC_LABELS = { 'recebido': 'Recebido', 'parcial': 'Parcial', 'pendente': 'Pendente', 'vencida': 'Vencida' };
  const headers = ['Cliente','Obra','Nº Fatura','Descrição','Valor (€)',
    'Data Emissão','Cond. Pag.','Prev. Recebimento','Estado','Data Recebimento'];
  const dataRows = recebimentos.map(r => [
    r.cliente || '', r.obra || '', r.nFatura || '', r.descricao || '',
    r.valor || 0, r.dataEmissao || '', r.condPag || '',
    r.prevRecebimento || '', REC_LABELS[r.estadoRec] || r.estadoRec || '',
    r.dataRecebimento || '',
  ]);
  const total = recebimentos.reduce((s, r) => s + (r.valor || 0), 0);

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ...dataRows,
    ['TOTAL', '', '', '', total, '', '', '', '', ''],
  ]);
  ws['!cols'] = [{wch:28},{wch:8},{wch:13},{wch:30},{wch:12},{wch:12},{wch:12},{wch:16},{wch:12},{wch:14}];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  headers.forEach((_, i) => hdrCell(ws, addr(i + 1, 1), C.teal));
  dataRows.forEach((row, ri) => {
    const rowNum = ri + 2;
    const estado = recebimentos[ri]?.estadoRec;
    const bg = estado === 'recebido' ? C.success : estado === 'vencida' ? C.danger : ri % 2 === 0 ? C.light : 'FFFFFFFF';
    row.forEach((_, ci) => {
      styleCell(ws, addr(ci + 1, rowNum), { bg, size: 9, align: ci === 4 ? 'right' : 'left', numFmt: ci === 4 ? '#,##0.00' : null });
    });
  });
  const tr = dataRows.length + 2;
  headers.forEach((_, i) => {
    styleCell(ws, addr(i + 1, tr), { bold: true, color: C.white, bg: C.teal, align: i === 4 ? 'right' : 'left', numFmt: i === 4 ? '#,##0.00' : null });
  });

  XLSX.utils.book_append_sheet(wb, ws, '⬆ Clientes');
}

// ─── ABA: DADOS MANUAIS (colaboradores, impostos, etc.) ───────────────────────
function makeManual(wb, label, dados, bg) {
  const grupos = dados?.grupos || [];
  const nome = label.replace(/^[^\w]+ */u, '').toUpperCase();
  const rows = [
    [nome, '', '', ''],
    ['Rubrica', 'Descrição', 'Valor (€)', 'Mês'],
  ];
  let totalGeral = 0;

  grupos.forEach(g => {
    rows.push([g.label || '', '', '', '']);
    (g.itens || []).forEach(item => {
      rows.push(['  ' + (item.label || ''), item.descricao || '', item.valor || 0, item.mes || '']);
      totalGeral += item.valor || 0;
    });
    rows.push(['', '', '', '']);
  });
  if (!grupos.length) rows.push(['Sem dados registados', '', '', '']);
  rows.push(['TOTAL', '', totalGeral, '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 10 }];

  styleCell(ws, 'A1', { bold: true, size: 12, color: C.white, bg });
  hdrCell(ws, 'A2', bg); hdrCell(ws, 'B2', bg); hdrCell(ws, 'C2', bg); hdrCell(ws, 'D2', bg);

  const totalRow = rows.length;
  styleCell(ws, `A${totalRow}`, { bold: true, color: C.white, bg });
  styleCell(ws, `C${totalRow}`, { bold: true, color: C.white, bg, align: 'right', numFmt: '#,##0.00' });

  XLSX.utils.book_append_sheet(wb, ws, label);
}

// ─── EXPORT PRINCIPAL — chama todas as abas ───────────────────────────────────
export function exportTesourariaCompleto(pagamentos, recebimentos, manualData, anoAtivo) {
  try {
    const wb   = XLSX.utils.book_new();
    const now  = new Date();

    makeCapa(wb, pagamentos, recebimentos, now);
    makeResumo(wb, pagamentos, recebimentos);
    makeFornecedores(wb, pagamentos);
    makeClientes(wb, recebimentos);

    [
      { key: 'colaboradores',  label: '👥 Colaboradores', bg: 'FF1C5F9A' },
      { key: 'impostos',       label: '📋 Impostos',       bg: 'FF6A1B9A' },
      { key: 'financiamentos', label: '🏦 Financiamentos', bg: 'FF00695C' },
      { key: 'investimentos',  label: '📈 Investimentos',  bg: 'FF4E342E' },
      { key: 'diversos',       label: '📦 Diversos',       bg: 'FF37474F' },
    ].forEach(({ key, label, bg }) => {
      const cat = manualData?.[anoAtivo]?.[key] || manualData?.[key] || {};
      makeManual(wb, label, cat, bg);
    });

    const fname = `Tesouraria_NOVANOR_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fname);
  } catch (e) {
    console.error('Export error:', e);
    alert('Erro ao exportar: ' + e.message);
  }
}

// ─── EXPORT DE TABELA INDIVIDUAL ──────────────────────────────────────────────
export function exportTableToExcel(tableId, filename) {
  try {
    const table = document.getElementById(tableId);
    if (!table) { console.warn('Table not found:', tableId); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, filename + '.xlsx');
  } catch {
    // fallback CSV
    const table = document.getElementById(tableId);
    if (!table) return;
    const csv = Array.from(table.querySelectorAll('tr'))
      .map(r => Array.from(r.querySelectorAll('th,td'))
        .map(c => `"${(c.innerText || '').replace(/"/g, '""')}"`)
        .join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.csv';
    a.click();
  }
}

// ─── IMPRIMIR TABELA ──────────────────────────────────────────────────────────
export function printTable(tableId, title) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const now = new Date();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
    h2 { color: #1C3A5E; font-size: 14px; margin: 0 0 2px; }
    .sub { color: #718096; font-size: 9px; margin: 0 0 14px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1C3A5E; color: #fff; padding: 5px 7px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 4px 7px; border-bottom: 0.5px solid #CBD5E0; font-size: 9px; }
    tr:nth-child(even) { background: #F0F4F8; }
  </style></head><body>
    <h2>NOVANOR — ${title}</h2>
    <p class="sub">Exportado em ${now.toLocaleDateString('pt-PT')} às ${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
    ${table.outerHTML}
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `NOVANOR_${title.replace(/[^a-zA-Z0-9_\-]/g,'_')}_${now.toLocaleDateString('pt-PT').replace(/\//g,'-')}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}