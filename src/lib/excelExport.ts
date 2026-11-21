/**
 * Zero-dependency Native Microsoft Excel (.xlsx - ECMA-376 OpenXML) Exporter.
 *
 * Why .xlsx instead of .csv:
 * - Turkish Windows / Turkish Excel uses ';' as list separator and ',' as decimal separator,
 *   causing standard comma-separated CSV files to dump all columns into Column A.
 * - CSV strips leading zeros on Turkish phone numbers (0533... -> 533...) and turns 11-digit
 *   T.C. Kimlik numbers into scientific notation (3,32E+10).
 * - Genuine PKZIP + OpenXML (.xlsx) opens cleanly in Microsoft Excel (TR/EN, Win/Mac/Mobile),
 *   Google Sheets, LibreOffice, and Apple Numbers with styled headers, auto-sized columns,
 *   frozen top row, Excel AutoFilter dropdowns, and exact text preservation.
 */

export type ExcelColumnAlign = 'left' | 'center' | 'right';
export type ExcelCellType = 'text' | 'number';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ExcelColumnAlign;
  type?: ExcelCellType;
  bold?: boolean;
}

export interface ExportExcelOptions {
  fileName: string;
  sheetName: string;
  columns: ExcelColumnDef[];
  rows: Record<string, unknown>[];
}

// Precompute standard IEEE 802.3 CRC-32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipFileEntry {
  path: string;
  data: Uint8Array;
}

/**
 * Builds a valid uncompressed (STORE, method = 0) PKZIP archive in memory.
 */
function createZipArchive(files: ZipFileEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = files.map((file) => {
    const nameBytes = encoder.encode(file.path);
    const crc = crc32(file.data);
    return {
      nameBytes,
      data: file.data,
      crc,
      offset: 0
    };
  });

  let localTotalSize = 0;
  let centralDirSize = 0;
  for (const item of prepared) {
    item.offset = localTotalSize;
    localTotalSize += 30 + item.nameBytes.length + item.data.length;
    centralDirSize += 46 + item.nameBytes.length;
  }

  const totalSize = localTotalSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Valid MS-DOS date/time (2025-01-01 00:00:00) so Windows Explorer & Excel never complain
  const dosTime = 0x0000;
  const dosDate = 0x5a21;

  let cursor = 0;

  // 1. Local File Headers + File Payloads
  for (const item of prepared) {
    view.setUint32(cursor, 0x04034b50, true); // Local file header signature
    view.setUint16(cursor + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(cursor + 6, 0x0800, true); // General purpose bit flag (UTF-8 filenames)
    view.setUint16(cursor + 8, 0, true); // Compression method: 0 = STORE
    view.setUint16(cursor + 10, dosTime, true);
    view.setUint16(cursor + 12, dosDate, true);
    view.setUint32(cursor + 14, item.crc, true);
    view.setUint32(cursor + 18, item.data.length, true); // Compressed size
    view.setUint32(cursor + 22, item.data.length, true); // Uncompressed size
    view.setUint16(cursor + 26, item.nameBytes.length, true);
    view.setUint16(cursor + 28, 0, true); // Extra field length
    cursor += 30;

    out.set(item.nameBytes, cursor);
    cursor += item.nameBytes.length;

    out.set(item.data, cursor);
    cursor += item.data.length;
  }

  const centralDirOffset = cursor;

  // 2. Central Directory Headers
  for (const item of prepared) {
    view.setUint32(cursor, 0x02014b50, true); // Central directory file header signature
    view.setUint16(cursor + 4, 20, true); // Version made by
    view.setUint16(cursor + 6, 20, true); // Version needed to extract
    view.setUint16(cursor + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(cursor + 10, 0, true); // Compression method: STORE
    view.setUint16(cursor + 12, dosTime, true);
    view.setUint16(cursor + 14, dosDate, true);
    view.setUint32(cursor + 16, item.crc, true);
    view.setUint32(cursor + 20, item.data.length, true);
    view.setUint32(cursor + 24, item.data.length, true);
    view.setUint16(cursor + 28, item.nameBytes.length, true);
    view.setUint16(cursor + 30, 0, true); // Extra field length
    view.setUint16(cursor + 32, 0, true); // File comment length
    view.setUint16(cursor + 34, 0, true); // Disk number start
    view.setUint16(cursor + 36, 0, true); // Internal file attributes
    view.setUint32(cursor + 38, 0, true); // External file attributes
    view.setUint32(cursor + 42, item.offset, true); // Relative offset of local header
    cursor += 46;

    out.set(item.nameBytes, cursor);
    cursor += item.nameBytes.length;
  }

  // 3. End of Central Directory Record (EOCD)
  view.setUint32(cursor, 0x06054b50, true);
  view.setUint16(cursor + 4, 0, true); // Number of this disk
  view.setUint16(cursor + 6, 0, true); // Disk where central directory starts
  view.setUint16(cursor + 8, prepared.length, true);
  view.setUint16(cursor + 10, prepared.length, true);
  view.setUint32(cursor + 12, centralDirSize, true);
  view.setUint32(cursor + 16, centralDirOffset, true);
  view.setUint16(cursor + 20, 0, true); // Comment length

  return out;
}

/**
 * Strips illegal XML 1.0 control characters and escapes special entities.
 */
function escapeXml(raw: string): string {
  // Remove control chars disallowed in XML 1.0 (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  const sanitized = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts 0-based column index to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
function getExcelColumnLetter(colIndex: number): string {
  let n = colIndex + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Sanitizes Excel worksheet tab name (max 31 chars, no \ / ? * [ ] :).
 */
function sanitizeSheetName(name: string): string {
  const cleaned = String(name || 'Rapor')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Rapor').slice(0, 31);
}

/**
 * Cleans whitespace and accidental line breaks in single-line text fields.
 */
export function cleanExcelText(raw: unknown, fallback = '-'): string {
  if (raw === null || raw === undefined) return fallback;
  const cleaned = String(raw).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

/**
 * Formats Turkish phone numbers uniformly (e.g. "5337678143" -> "0533 767 81 43")
 * while keeping leading zero intact as a text string in Excel.
 */
export function formatPhoneForExcel(raw: unknown): string {
  if (raw === null || raw === undefined) return '-';
  const text = String(raw).trim();
  if (!text) return '-';

  const digits = text.replace(/\D/g, '');
  let tenDigits = '';
  if (digits.length === 10 && digits.startsWith('5')) {
    tenDigits = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('90')) {
    tenDigits = digits.slice(2);
  }

  if (tenDigits.length === 10) {
    return `0${tenDigits.slice(0, 3)} ${tenDigits.slice(3, 6)} ${tenDigits.slice(6, 8)} ${tenDigits.slice(8, 10)}`;
  }

  return cleanExcelText(text, '-');
}

function buildStylesXml(): string {
  // Strict OpenXML order: numFmts (optional) -> fonts -> fills -> borders -> cellStyleXfs -> cellXfs -> cellStyles
  // Note: Fill 0 MUST be 'none' and Fill 1 MUST be 'gray125' per ECMA-376 spec!
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font>
      <sz val="10"/>
      <color rgb="FF0F172A"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="10"/>
      <color rgb="FF002147"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <sz val="10"/>
      <color rgb="FF0F172A"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF002147"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF8FAFC"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFFFFFFF"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF1E3A5F"/></left>
      <right style="thin"><color rgb="FF1E3A5F"/></right>
      <top style="thin"><color rgb="FF002147"/></top>
      <bottom style="medium"><color rgb="FF38C1D2"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function resolveHeaderStyleIndex(align: ExcelColumnAlign = 'left'): number {
  if (align === 'center') return 2;
  if (align === 'right') return 3;
  return 1;
}

function resolveDataStyleIndex(
  isEvenRow: boolean,
  align: ExcelColumnAlign = 'left',
  isNumeric = false,
  isBold = false
): number {
  if (isNumeric) {
    return isEvenRow ? 11 : 10;
  }
  if (isBold && align === 'left') {
    return isEvenRow ? 13 : 12;
  }
  if (align === 'center') {
    return isEvenRow ? 7 : 6;
  }
  if (align === 'right') {
    return isEvenRow ? 9 : 8;
  }
  return isEvenRow ? 5 : 4;
}

/**
 * Generates the binary Uint8Array of a complete .xlsx file.
 */
export function buildExcelXlsxBytes(options: ExportExcelOptions): Uint8Array {
  const columns = options.columns;
  const rows = options.rows || [];
  const safeSheetName = sanitizeSheetName(options.sheetName);

  const colCount = Math.max(1, columns.length);
  const totalSheetRows = rows.length + 1; // Row 1 = Header
  const lastColLetter = getExcelColumnLetter(colCount - 1);
  const dimensionRef = `A1:${lastColLetter}${totalSheetRows}`;

  // Calculate optimal width for each column based on header + cell values
  const computedWidths = columns.map((col) => {
    if (typeof col.width === 'number' && col.width > 0) {
      return col.width;
    }
    let maxChars = String(col.header || '').length + 3; // Extra room for AutoFilter dropdown arrow
    for (let r = 0; r < rows.length; r++) {
      const rawVal = rows[r]?.[col.key];
      const strLen = rawVal === null || rawVal === undefined ? 1 : String(rawVal).length;
      if (strLen > maxChars) maxChars = strLen;
    }
    const minW = col.minWidth ?? 11;
    const maxW = col.maxWidth ?? 46;
    return Math.min(maxW, Math.max(minW, Math.ceil(maxChars * 1.15) + 3));
  });

  const colsXml = columns
    .map((_, idx) => {
      const colNum = idx + 1;
      return `<col min="${colNum}" max="${colNum}" width="${computedWidths[idx]}" customWidth="1"/>`;
    })
    .join('');

  // Build Row 1 (Header)
  const headerCellsXml = columns
    .map((col, colIdx) => {
      const cellRef = `${getExcelColumnLetter(colIdx)}1`;
      const styleIdx = resolveHeaderStyleIndex(col.align || (col.type === 'number' ? 'right' : 'left'));
      const escapedHeader = escapeXml(String(col.header || ''));
      return `<c r="${cellRef}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapedHeader}</t></is></c>`;
    })
    .join('');

  const sheetRowsXml: string[] = [
    `<row r="1" ht="28" customHeight="1">${headerCellsXml}</row>`
  ];

  // Build Data Rows (Row 2..N)
  for (let r = 0; r < rows.length; r++) {
    const excelRowNum = r + 2;
    const isEven = r % 2 === 1;
    const rowObj = rows[r] || {};

    const rowCells = columns
      .map((col, colIdx) => {
        const cellRef = `${getExcelColumnLetter(colIdx)}${excelRowNum}`;
        const rawVal = rowObj[col.key];

        if (col.type === 'number') {
          const parsed =
            typeof rawVal === 'number'
              ? rawVal
              : typeof rawVal === 'string' && rawVal.trim() !== '' && rawVal.trim() !== '-'
              ? Number(rawVal.replace(',', '.'))
              : NaN;

          if (Number.isFinite(parsed)) {
            const styleIdx = resolveDataStyleIndex(isEven, col.align || 'right', true, false);
            return `<c r="${cellRef}" s="${styleIdx}" t="n"><v>${parsed}</v></c>`;
          }
        }

        const textVal =
          rawVal === null || rawVal === undefined || String(rawVal).trim() === ''
            ? '-'
            : String(rawVal);
        const align = col.align || 'left';
        const styleIdx = resolveDataStyleIndex(isEven, align, false, Boolean(col.bold));
        return `<c r="${cellRef}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(textVal)}</t></is></c>`;
      })
      .join('');

    sheetRowsXml.push(`<row r="${excelRowNum}" ht="22" customHeight="1">${rowCells}</row>`);
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = buildStylesXml();

  // Strict OpenXML worksheet child element sequence:
  // dimension -> sheetViews -> sheetFormatPr -> cols -> sheetData -> autoFilter -> pageMargins
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="22" customHeight="1"/>
  <cols>${colsXml}</cols>
  <sheetData>${sheetRowsXml.join('')}</sheetData>
  <autoFilter ref="${dimensionRef}"/>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;

  const encoder = new TextEncoder();
  return createZipArchive([
    { path: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { path: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { path: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { path: 'xl/styles.xml', data: encoder.encode(stylesXml) },
    { path: 'xl/worksheets/sheet1.xml', data: encoder.encode(worksheetXml) }
  ]);
}

/**
 * Builds and immediately downloads a styled native .xlsx Excel workbook in the browser.
 */
export function exportToExcelXlsx(options: ExportExcelOptions): void {
  const bytes = buildExcelXlsxBytes(options);
  const cleanFileName = options.fileName.replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = cleanFileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}
