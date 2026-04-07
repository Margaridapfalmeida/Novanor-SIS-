// ─── PDF DOWNLOAD UTILITY ─────────────────────────────────────────────────────
// Converte HTML string para PDF e descarrega directamente.
// Usa jsPDF + html2canvas para fidelidade de layout.

import logoNovanor from '../img/logonovanor.png';

let logoPromise;

function loadLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = logoNovanor;
    });
  }
  return logoPromise;
}

export async function downloadPdf(html, filename = 'documento') {
  const { default: jsPDF }      = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  const logoImg = await loadLogo();

  // Cria elemento temporário fora do viewport
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'width:794px',   // A4 @ 96dpi
    'background:#fff',
    'font-family:Arial,sans-serif',
    'font-size:11px',
    'color:#111',
    'padding:30px',
    'box-sizing:border-box',
  ].join(';');
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,            // alta resolução
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = pdf.internal.pageSize.getHeight();
    const marginX = 8;
    const marginTop = 22;
    const marginBottom = 8;
    const imgW    = pdfW - marginX * 2;
    const imgH    = (canvas.height * imgW) / canvas.width;
    const pageContentH = pdfH - marginTop - marginBottom;
    const logoW = 34;
    const logoH = (logoImg.height * logoW) / logoImg.width;
    const logoX = marginX;
    const logoY = 5;

    let y = marginTop;
    let remaining = imgH;

    // Paginar se o conteúdo ultrapassar uma página
    while (remaining > 0) {
      const pageH = Math.min(remaining, pageContentH);
      const srcY  = ((imgH - remaining) / imgH) * canvas.height;
      const srcH  = (pageH / imgH) * canvas.height;

      // Cria canvas parcial para esta página
      const pageCanvas  = document.createElement('canvas');
      pageCanvas.width  = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
      if (y > marginTop) pdf.addPage();
      pdf.addImage(pageData, 'JPEG', marginX, marginTop, imgW, pageH);
      pdf.addImage(logoImg, 'PNG', logoX, logoY, logoW, logoH);

      remaining -= pageH;
      y += pageH;
    }

    pdf.save(filename.endsWith('.pdf') ? filename : filename + '.pdf');
  } finally {
    document.body.removeChild(container);
  }
}
