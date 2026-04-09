import jsPDF from 'jspdf';

function bytesToLatin1(bytes) {
  let result = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    result += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return result;
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function collectPdfStrings(raw) {
  const matches = [];
  const regex = /\(([^()]*)\)/g;
  let match;
  while ((match = regex.exec(raw))) {
    const value = match[1]
      .replace(/\\\)/g, ')')
      .replace(/\\\(/g, '(')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
    if (/[A-Za-z0-9]/.test(value)) matches.push(value);
  }
  return matches;
}

function parseAmount(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/);
  if (!match) return '';
  const [, d, m, yRaw] = match;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  return `${y}-${m}-${d}`;
}

function extractBest(regex, text) {
  const match = text.match(regex);
  return match?.[1]?.trim() || '';
}

export async function parseFornecedorInvoiceFile(file) {
  if (!file) return { ok: false, fields: {}, rawText: '', reason: 'Sem ficheiro' };
  if (!/pdf$/i.test(file.name || '')) {
    return { ok: false, fields: {}, rawText: '', reason: 'Só é suportada leitura automática de PDFs nesta fase.' };
  }

  try {
    const buffer = await file.arrayBuffer();
    const raw = bytesToLatin1(new Uint8Array(buffer));
    const strings = collectPdfStrings(raw);
    const text = normalizeWhitespace(strings.join('\n'));

    if (!text || text.length < 20) {
      return { ok: false, fields: {}, rawText: '', reason: 'PDF sem texto legível. Pode ser um scan/imagem.' };
    }

    const allAmounts = [...text.matchAll(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g)]
      .map(match => parseAmount(match[1]))
      .filter(Boolean)
      .sort((a, b) => b - a);

    const fields = {
      nFatura: extractBest(/(?:fatura|factura|invoice|ft)[^\w]{0,12}(?:n[.ºo°]*\s*)?([A-Z0-9\/.-]{3,})/i, text),
      obra: extractBest(/\b(O\d{3,5})\b/i, text).toUpperCase(),
      data: toIsoDate(extractBest(/(?:data(?:\s+da\s+fatura)?|date)[^\d]{0,12}(\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/i, text)),
      venc: toIsoDate(extractBest(/(?:vencimento|data\s+vencimento|due\s+date)[^\d]{0,12}(\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/i, text)),
      descricao: extractBest(/(?:descri[cç][aã]o|designa[cç][aã]o|refer[eê]ncia)[^A-Za-z0-9]{0,10}(.{8,120})/i, text),
      nifFornecedor: extractBest(/(?:nif|vat)[^\d]{0,12}(\d{9})/i, text),
      valor: allAmounts[0] || null,
    };

    const filled = Object.values(fields).filter(Boolean).length;
    return {
      ok: filled >= 2,
      fields,
      rawText: text.slice(0, 4000),
      reason: filled >= 2 ? '' : 'Poucos campos foram detetados automaticamente.',
    };
  } catch (error) {
    return { ok: false, fields: {}, rawText: '', reason: error?.message || 'Falha ao ler PDF.' };
  }
}

function addStampBox(doc, x, y, width, lines, color = [22, 101, 52]) {
  doc.setDrawColor(...color);
  doc.setFillColor(242, 250, 244);
  doc.roundedRect(x, y, width, 26, 2, 2, 'FD');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(lines[0], x + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  lines.slice(1).forEach((line, idx) => {
    doc.text(line, x + 4, y + 13 + (idx * 5));
  });
}

export async function generateFornecedorValidationStampedPdf({ fatura, fornecedorNome, validatedBy }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  const dataTexto = now.toLocaleDateString('pt-PT');
  const horaTexto = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Fatura validada internamente', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Fornecedor: ${fornecedorNome || '—'}`, 14, 30);
  doc.text(`Fatura: ${fatura.nFatura || fatura.id || '—'}`, 14, 36);
  doc.text(`Obra: ${fatura.obra || '—'}`, 14, 42);
  doc.text(`Valor: € ${Number(fatura.valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, 14, 48);
  doc.text(`Data do documento: ${fatura.data || '—'}`, 14, 54);
  doc.text(`Original anexado: ${fatura.pdf?.name || 'documento original'}`, 14, 60);

  addStampBox(doc, 14, 72, 105, [
    'CARIMBO DIGITAL DP',
    `Validado por: ${validatedBy || 'Produção'}`,
    `Data: ${dataTexto} ${horaTexto}`,
    `Estado interno: Validada`,
  ]);

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(10);
  const notes = doc.splitTextToSize(
    'Esta é a versão interna carimbada gerada automaticamente pelo SIS. O PDF original mantém-se arquivado sem alterações. Nesta primeira versão, o carimbo é guardado como documento complementar de validação.',
    180
  );
  doc.text(notes, 14, 110);

  if (fatura.pdf?.base64?.startsWith('data:image/')) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Anexo visual do documento original', 14, 18);
    doc.addImage(fatura.pdf.base64, 'JPEG', 14, 26, 180, 240, undefined, 'FAST');
    addStampBox(doc, 118, 12, 78, [
      'VALIDADA DP',
      fornecedorNome || 'Fornecedor',
      `${dataTexto} ${horaTexto}`,
    ]);
  }

  return {
    name: `fatura_validada_dp_${fatura.nFatura || fatura.id || 'documento'}.pdf`,
    size: 0,
    base64: doc.output('datauristring'),
  };
}

