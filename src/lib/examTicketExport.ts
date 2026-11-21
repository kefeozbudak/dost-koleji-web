export interface ExamTicketRenderData {
  docNo: string;
  docDate: string;
  studentName: string;
  studentTc: string;
  grade: string;
  examDate: string;
  examTime: string;
  campusName: string;
  campusAddress: string;
  documentTitle?: string;
  logoUrl?: string;
  rules: string[];
  requiredDocs: string[];
}

/**
 * Resmi 11 Haneli T.C. Kimlik Numarası Algoritmik Doğrulaması
 */
export function isValidTcKimlik(rawTc: string): boolean {
  const tc = String(rawTc || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(tc)) return false;
  if (tc[0] === '0') return false;

  const digits = tc.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const check10 = (((oddSum * 7) - evenSum) % 10 + 10) % 10;
  if (check10 !== digits[9]) return false;

  const sumFirst10 = digits.slice(0, 10).reduce((acc, n) => acc + n, 0);
  const check11 = sumFirst10 % 10;
  return check11 === digits[10];
}

/**
 * KVKK uyumlu maskelenmiş T.C. Kimlik gösterimi (Örn: 123*****901)
 */
export function maskTcKimlik(rawTc: string): string {
  const clean = String(rawTc || '').replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}*****${clean.slice(8)}`;
  }
  if (clean.length >= 5) {
    return `${clean.slice(0, 2)}*****${clean.slice(-2)}`;
  }
  return '***********';
}

/**
 * Sınav seansı metninden gerçek saat bilgisini (1. Seans -> "11:00", 2. Seans -> "15:00") çıkarır
 */
export function parseExamSessionTime(rawSession: any): string {
  const str = String(rawSession || '').trim();
  if (!str) return '11:00';

  const lower = str.toLocaleLowerCase('tr-TR');
  if (
    lower.includes('15:00') ||
    lower.includes('16:00') ||
    lower.includes('session_2') ||
    lower.includes('seans 2') ||
    lower.includes('2. seans')
  ) {
    return '15:00';
  }
  if (
    lower.includes('11:00') ||
    lower.includes('10:00') ||
    lower.includes('session_1') ||
    lower.includes('seans 1') ||
    lower.includes('1. seans')
  ) {
    return '11:00';
  }

  const explicitTime = str.match(/(\d{1,2}:\d{2})/);
  if (explicitTime && explicitTime[1]) {
    return explicitTime[1];
  }

  return '11:00';
}

/**
 * Instagram / Facebook / TikTok uygulama içi tarayıcı (WebView) tespiti
 */
export function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|BytedanceWebview|musical_ly|Line\//i.test(ua);
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 3500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

function drawVerificationMatrix(
  ctx: CanvasRenderingContext2D,
  seedStr: string,
  x: number,
  y: number,
  size: number
) {
  const cells = 11;
  const cellSize = size / cells;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
  ctx.fillStyle = '#002147';

  const isFinder = (r: number, c: number) =>
    (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinder(r, c)) {
        const localR = r >= cells - 3 ? r - (cells - 3) : r;
        const localC = c >= cells - 3 ? c - (cells - 3) : c;
        if (localR === 0 || localR === 2 || localC === 0 || localC === 2 || (localR === 1 && localC === 1)) {
          ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize - 0.5, cellSize - 0.5);
        }
      } else {
        hash ^= (r * 31 + c * 17) & 0xff;
        hash = Math.imul(hash, 16777619);
        if ((hash >>> 0) % 2 === 0) {
          ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize - 0.5, cellSize - 0.5);
        }
      }
    }
  }
}

/**
 * Türkçe karakter tam uyumlu, yüksek çözünürlüklü (1240x1754 A4) Sınav Giriş Belgesi Canvas üretici
 */
export async function renderExamTicketCanvas(
  ticket: ExamTicketRenderData
): Promise<HTMLCanvasElement> {
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D başlatılamadı.');
  }

  const fontFamily = '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

  // Ensure web fonts are ready before measuring text widths
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    try {
      await Promise.race([
        (document as any).fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 800))
      ]);
    } catch (_) {}
  }

  // Page Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Top Decorative Brand Strip
  ctx.fillStyle = '#002147';
  ctx.fillRect(0, 0, width, 22);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 22, width, 6);

  // Outer Border Card
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 56, 64, width - 112, height - 128, 24);
  ctx.stroke();

  // Header Section - Right Side First (QR Matrix + Belge No + Düzenlenme Tarihi) so we know exact right boundary
  const qrSize = 86;
  const qrX = width - 104 - qrSize;
  const qrY = 108;
  drawVerificationMatrix(ctx, `${ticket.docNo}-${ticket.studentName}`, qrX, qrY, qrSize);

  const rightTextX = qrX - 20;
  const belgeNoLabel = `BELGE NO: ${ticket.docNo}`;
  const docDateLabel = `Düzenlenme Tarihi: ${ticket.docDate}`;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#002147';
  ctx.font = `800 18px ${fontFamily}`;
  const belgeNoWidth = ctx.measureText(belgeNoLabel).width;
  ctx.fillText(belgeNoLabel, rightTextX, 144);

  ctx.fillStyle = '#64748b';
  ctx.font = `600 15px ${fontFamily}`;
  const docDateWidth = ctx.measureText(docDateLabel).width;
  ctx.fillText(docDateLabel, rightTextX, 172);
  ctx.textAlign = 'left';

  const rightBlockLeftX = rightTextX - Math.max(belgeNoWidth, docDateWidth);

  // Header Section - Left Side (Logo + Fitted Title & Subtitle)
  const logoSrc = ticket.logoUrl && !ticket.logoUrl.includes('aida-public') && !ticket.logoUrl.includes('unsplash.com')
    ? ticket.logoUrl
    : '/dost-logo-png.png';
  const logoImg = await loadImageSafe(logoSrc);

  let titleStartX = 104;
  if (logoImg && logoImg.naturalWidth > 0) {
    const targetH = 76;
    const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
    const targetW = Math.min(185, targetH * ratio);
    ctx.drawImage(logoImg, 104, 113, targetW, targetH);
    titleStartX = 104 + targetW + 24;
  } else {
    ctx.fillStyle = '#002147';
    drawRoundedRect(ctx, 104, 112, 76, 76, 16);
    ctx.fill();
    ctx.fillStyle = '#D4AF37';
    ctx.font = `800 32px ${fontFamily}`;
    ctx.fillText('DK', 118, 161);
    titleStartX = 204;
  }

  const maxTitleWidth = Math.max(240, rightBlockLeftX - titleStartX - 28);
  const upperTitle = (ticket.documentTitle || 'BURSLULUK SINAVI GİRİŞ BELGESİ').toLocaleUpperCase('tr-TR');

  let titleFontSize = 25;
  ctx.font = `800 ${titleFontSize}px ${fontFamily}`;
  while (titleFontSize > 17 && ctx.measureText(upperTitle).width > maxTitleWidth) {
    titleFontSize -= 0.5;
    ctx.font = `800 ${titleFontSize}px ${fontFamily}`;
  }

  ctx.fillStyle = '#002147';
  const titleLines = wrapCanvasText(ctx, upperTitle, maxTitleWidth).slice(0, 2);
  let subTitleY = 176;
  if (titleLines.length === 1) {
    ctx.fillText(titleLines[0], titleStartX, 145, maxTitleWidth);
  } else {
    ctx.fillText(titleLines[0], titleStartX, 132, maxTitleWidth);
    ctx.fillText(titleLines[1], titleStartX, 156, maxTitleWidth);
    subTitleY = 184;
  }

  const subTitleText = 'DOST KOLEJİ EĞİTİM KURUMLARI • RESMİ ADAY BELGESİ';
  let subFontSize = 14.5;
  ctx.font = `700 ${subFontSize}px ${fontFamily}`;
  while (subFontSize > 11 && ctx.measureText(subTitleText).width > maxTitleWidth) {
    subFontSize -= 0.5;
    ctx.font = `700 ${subFontSize}px ${fontFamily}`;
  }
  ctx.fillStyle = '#64748b';
  ctx.fillText(subTitleText, titleStartX, subTitleY, maxTitleWidth);

  // Header Divider
  ctx.fillStyle = '#002147';
  ctx.fillRect(104, 230, width - 208, 3);

  // Banner Callout
  const calloutBoxW = width - 208;
  ctx.fillStyle = '#f0f5ff';
  drawRoundedRect(ctx, 104, 262, calloutBoxW, 74, 14);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const calloutText =
    'Lütfen sınav günü bu belgeyi çıktı olarak kimlik kartınızla birlikte yanınızda bulundurunuz.';
  const calloutMaxW = calloutBoxW - 52;
  let calloutFontSize = 18;
  ctx.font = `700 ${calloutFontSize}px ${fontFamily}`;
  while (calloutFontSize > 14 && ctx.measureText(calloutText).width > calloutMaxW) {
    calloutFontSize -= 0.5;
    ctx.font = `700 ${calloutFontSize}px ${fontFamily}`;
  }

  ctx.fillStyle = '#1e3a8a';
  const calloutLines = wrapCanvasText(ctx, calloutText, calloutMaxW).slice(0, 2);
  if (calloutLines.length === 1) {
    ctx.fillText(calloutLines[0], 130, 305, calloutMaxW);
  } else {
    ctx.fillText(calloutLines[0], 130, 293, calloutMaxW);
    ctx.fillText(calloutLines[1], 130, 317, calloutMaxW);
  }

  // Student & Exam Info Box
  const infoTop = 368;
  const infoHeight = 470;
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, 104, infoTop, width - 208, infoHeight, 20);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  const fields = [
    { label: 'ÖĞRENCİ ADI SOYADI', value: String(ticket.studentName || '-').toLocaleUpperCase('tr-TR') },
    { label: 'T.C. KİMLİK NUMARASI', value: String(ticket.studentTc || '-') },
    { label: 'SINIF SEVİYESİ', value: String(ticket.grade || '-') },
    { label: 'SINAV TARİHİ', value: String(ticket.examDate || '9 OCAK 2027 CUMARTESİ') },
    { label: 'SINAV SAATİ / SEANS', value: String(ticket.examTime || '11:00') },
    { label: 'SINAV MERKEZİ (KAMPÜS)', value: String(ticket.campusName || '-') },
  ];

  const colW = (width - 208 - 96) / 2;
  fields.forEach((field, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const fx = 152 + col * (colW + 32);
    const fy = infoTop + 62 + row * 142;

    ctx.fillStyle = '#64748b';
    ctx.font = `700 15px ${fontFamily}`;
    ctx.fillText(field.label, fx, fy);

    ctx.fillStyle = '#002147';
    const valFontSize = field.value.length > 18 ? 22 : 26;
    ctx.font = `800 ${valFontSize}px ${fontFamily}`;
    const wrappedVal = wrapCanvasText(ctx, field.value, colW - 16);
    wrappedVal.slice(0, 2).forEach((line, lIdx) => {
      ctx.fillText(line, fx, fy + 38 + lIdx * 30);
    });

    if (row < 2) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(fx, fy + 86, colW - 20, 1.5);
    }
  });

  // Campus Address Full-Width Box
  const addrTop = 876;
  ctx.fillStyle = '#fffbeb';
  drawRoundedRect(ctx, 104, addrTop, width - 208, 138, 16);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = `800 17px ${fontFamily}`;
  ctx.fillText('SINAV MERKEZİ AÇIK ADRESİ', 136, addrTop + 42);

  ctx.fillStyle = '#1e293b';
  ctx.font = `600 20px ${fontFamily}`;
  const addrLines = wrapCanvasText(ctx, ticket.campusAddress || '-', width - 272);
  addrLines.slice(0, 2).forEach((line, idx) => {
    ctx.fillText(line, 136, addrTop + 78 + idx * 28);
  });

  // Rules & Required Documents Two-Column Section
  const rulesTop = 1056;
  const boxW = (width - 208 - 36) / 2;
  const boxH = 460;

  // Left: Exam Rules
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, 104, rulesTop, boxW, boxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#002147';
  ctx.font = `800 20px ${fontFamily}`;
  ctx.fillText('SINAV KURALLARI', 136, rulesTop + 48);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(136, rulesTop + 62, 64, 4);

  ctx.fillStyle = '#334155';
  ctx.font = `500 18px ${fontFamily}`;
  let ruleY = rulesTop + 104;
  (ticket.rules || []).forEach((rule) => {
    if (!rule) return;
    const lines = wrapCanvasText(ctx, rule, boxW - 84);
    ctx.fillStyle = '#1d4eca';
    ctx.beginPath();
    ctx.arc(144, ruleY - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    lines.forEach((l, i) => {
      if (ruleY < rulesTop + boxH - 24) {
        ctx.fillText(l, 162, ruleY + i * 26);
      }
    });
    ruleY += lines.length * 26 + 18;
  });

  // Right: Required Documents
  const rightX = 104 + boxW + 36;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, rightX, rulesTop, boxW, boxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#002147';
  ctx.font = `800 20px ${fontFamily}`;
  ctx.fillText('GEREKLİ BELGELER VE HATIRLATMA', rightX + 32, rulesTop + 48);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(rightX + 32, rulesTop + 62, 64, 4);

  let docY = rulesTop + 104;
  ctx.font = `600 18px ${fontFamily}`;
  (ticket.requiredDocs || []).forEach((docItem) => {
    if (!docItem) return;
    const lines = wrapCanvasText(ctx, docItem, boxW - 84);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(rightX + 40, docY - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    lines.forEach((l, i) => {
      if (docY < rulesTop + boxH - 24) {
        ctx.fillText(l, rightX + 58, docY + i * 26);
      }
    });
    docY += lines.length * 26 + 20;
  });

  // Additional helpful note in right box
  docY += 16;
  if (docY < rulesTop + boxH - 70) {
    ctx.fillStyle = '#64748b';
    ctx.font = `500 16px ${fontFamily}`;
    const noteLines = wrapCanvasText(
      ctx,
      'Sınav sonuçları açıklandığında kayıtlı veli telefon numarasına SMS ile bilgilendirme yapılacaktır.',
      boxW - 64
    );
    noteLines.forEach((nl, idx) => {
      ctx.fillText(nl, rightX + 32, docY + idx * 24);
    });
  }

  // Official Footer Strip
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(104, height - 150, width - 208, 1.5);

  ctx.fillStyle = '#64748b';
  ctx.font = `600 15px ${fontFamily}`;
  ctx.fillText('Dost Koleji Sınav Hizmetleri • Resmi Sınav Giriş Belgesi', 104, height - 114);

  ctx.textAlign = 'right';
  ctx.font = `700 15px monospace`;
  ctx.fillStyle = '#002147';
  ctx.fillText(`VERIFIED ENTRY TICKET • ${ticket.docNo}`, width - 104, height - 114);
  ctx.textAlign = 'left';

  return canvas;
}

/**
 * Harici kütüphane gerektirmeyen, %100 standartlara uygun PDF 1.4 (A4 DCTDecode) ikili dosya üretici
 */
function jpegDataUrlToPdfBlob(jpegDataUrl: string, imgWidth: number, imgHeight: number): Blob {
  const base64 = jpegDataUrl.split(',')[1] || '';
  const binaryStr = atob(base64);
  const jpegBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    jpegBytes[i] = binaryStr.charCodeAt(i);
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // index 0 unused, 1..5 are PDF objects
  let byteOffset = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    byteOffset += bytes.length;
  };

  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteOffset += b.length;
  };

  const pageW = 595.28;
  const pageH = 841.89;

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog
  offsets[1] = byteOffset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets[2] = byteOffset;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page
  offsets[3] = byteOffset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: Image XObject (JPEG stream)
  offsets[4] = byteOffset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // Object 5: Page Content Stream
  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  offsets[5] = byteOffset;
  pushStr(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('\nendstream\nendobj\n');

  // Cross-Reference Table
  const xrefStart = byteOffset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let objId = 1; objId <= 5; objId++) {
    const padded = String(offsets[objId]).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

function sanitizeFilename(raw: string): string {
  return String(raw || 'Aday')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 40) || 'Aday';
}

export async function generateExamTicketFiles(ticket: ExamTicketRenderData) {
  const canvas = await renderExamTicketCanvas(ticket);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const pngDataUrl = canvas.toDataURL('image/png');
  const pdfBlob = jpegDataUrlToPdfBlob(jpegDataUrl, canvas.width, canvas.height);
  const baseName = `Dost_Koleji_Sinav_Giris_Belgesi_${sanitizeFilename(ticket.studentName)}_${ticket.docNo}`;

  return {
    pdfBlob,
    pngDataUrl,
    pdfFileName: `${baseName}.pdf`,
    pngFileName: `${baseName}.png`,
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function shareExamTicketFile(blob: Blob, fileName: string, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const file = new File([blob], fileName, { type: blob.type });
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return false;
    }
    await navigator.share({
      title,
      text: `${title} - Dost Koleji Sınav Giriş Belgesi`,
      files: [file],
    });
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return true;
    return false;
  }
}
