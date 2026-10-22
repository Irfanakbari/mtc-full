import ExcelJS from 'exceljs';
import type { Prisma } from '../generated/prisma/client';
import { OpnameScope, OpnameStatus } from '../generated/prisma/enums';

export interface WorksheetSessionData {
  Id: string;
  RecordNumber: string;
  Scope: OpnameScope;
  Status: OpnameStatus;
  Notes: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  StartedAt: Date | null;
  StartedBy: string | null;
  CompletedAt: Date | null;
  CompletedBy: string | null;
  ApprovalNotes: string | null;
}

export interface WorksheetItemData {
  Name: string;
  Model: string | null;
  Specification: string | null;
  Classification: string | null;
  Unit: string;
  AddressLocation: string;
}

export interface WorksheetRowData {
  item: WorksheetItemData;
  systemQty: number | Prisma.Decimal;
  actualQty: number | Prisma.Decimal | null;
  differenceQty: number | Prisma.Decimal | null;
  notes: string | null;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export async function buildInventoryCountingWorksheet(
  session: WorksheetSessionData,
  rows: WorksheetRowData[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PT VUTEQ INDONESIA - MTC';
  workbook.lastModifiedBy = session.StartedBy ?? session.CreatedBy;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Stock Opname', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.45,
        header: 0.25,
        footer: 0.25,
      },
      printTitlesRow: '7:7',
      showGridLines: true,
    },
    views: [
      {
        state: 'frozen',
        ySplit: 7,
        showGridLines: true,
      },
    ],
    headerFooter: {
      oddHeader: '&L&BPT VUTEQ INDONESIA&R&BStock Opname Worksheet&B',
      oddFooter: `&LNo: ${session.RecordNumber} | Status: ${session.Status} | Printed: &D &T&RPage &P of &N`,
    },
  });

  // Setup Column Widths
  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'location', width: 15 },
    { key: 'name', width: 34 },
    { key: 'model', width: 18 },
    { key: 'spec', width: 26 },
    { key: 'classification', width: 16 },
    { key: 'unit', width: 9 },
    { key: 'systemQty', width: 14 },
    { key: 'actualQty', width: 16 },
    { key: 'diffQty', width: 14 },
    { key: 'check', width: 8 },
    { key: 'notes', width: 24 },
  ];

  // Palette constants
  const COLOR_NAVY = 'FF1E3A8A';
  const COLOR_DARK_TEXT = 'FF0F172A';
  const COLOR_MUTED_LABEL = 'FF475569';
  const COLOR_CARD_BG = 'FFF8FAFC';
  const COLOR_BORDER = 'FFCBD5E1';
  const COLOR_BOX_BORDER = 'FF94A3B8';
  const COLOR_ZEBRA_ODD = 'FFF8FAFC';
  const COLOR_TOTAL_BG = 'FFF1F5F9';

  // Common borders
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: COLOR_BORDER } },
    left: { style: 'thin', color: { argb: COLOR_BORDER } },
    bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
    right: { style: 'thin', color: { argb: COLOR_BORDER } },
  };

  const cardBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // 1. Company Banner (Row 1)
  sheet.mergeCells('A1:L1');
  const titleRow1 = sheet.getCell('A1');
  titleRow1.value = 'PT VUTEQ INDONESIA  •  MAINTENANCE & SPARE PARTS DEPARTMENT';
  titleRow1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_NAVY } };
  titleRow1.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 20;

  // 2. Title Row (Row 2)
  sheet.mergeCells('A2:L2');
  const titleRow2 = sheet.getCell('A2');
  titleRow2.value = 'LEMBAR KERJA STOCK OPNAME / PHYSICAL COUNT WORKSHEET';
  titleRow2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLOR_DARK_TEXT } };
  titleRow2.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 24;

  // 3. Subtitle / Instruction (Row 3)
  sheet.mergeCells('A3:L3');
  const titleRow3 = sheet.getCell('A3');
  titleRow3.value = 'Petunjuk: Cocokkan stok fisik barang di rak lokasi. Tulis hasil perhitungan aktual dan catatan verifikasi dengan jelas.';
  titleRow3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  titleRow3.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(3).height = 18;

  // 4. Metadata Info Box (Rows 4-5)
  sheet.getRow(4).height = 20;
  sheet.getRow(5).height = 20;

  const styleMetaCell = (cell: ExcelJS.Cell, bg = COLOR_CARD_BG) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.border = cardBorder;
  };

  // Row 4
  sheet.getCell('A4').value = 'No. Dokumen:';
  sheet.getCell('A4').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('A4').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('A4'));

  sheet.mergeCells('B4:D4');
  const docNumCell = sheet.getCell('B4');
  docNumCell.value = session.RecordNumber;
  docNumCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_NAVY } };
  docNumCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['B4', 'C4', 'D4'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('E4').value = 'Tgl Dibuat:';
  sheet.getCell('E4').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('E4').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('E4'));

  sheet.mergeCells('F4:G4');
  const createdDateCell = sheet.getCell('F4');
  createdDateCell.value = formatDate(session.CreatedAt);
  createdDateCell.font = { name: 'Calibri', size: 9, color: { argb: COLOR_DARK_TEXT } };
  createdDateCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['F4', 'G4'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('H4').value = 'Status:';
  sheet.getCell('H4').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('H4').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('H4'));

  sheet.mergeCells('I4:J4');
  const statusCell = sheet.getCell('I4');
  statusCell.value = session.Status;
  statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR_NAVY } };
  statusCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['I4', 'J4'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('K4').value = 'Total Item:';
  sheet.getCell('K4').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('K4').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('K4'));

  const countCell = sheet.getCell('L4');
  countCell.value = `${rows.length} Item`;
  countCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR_DARK_TEXT } };
  countCell.alignment = { vertical: 'middle', horizontal: 'center' };
  styleMetaCell(countCell);

  // Row 5
  sheet.getCell('A5').value = 'Cakupan:';
  sheet.getCell('A5').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('A5'));

  sheet.mergeCells('B5:D5');
  const scopeCell = sheet.getCell('B5');
  scopeCell.value = session.Scope === OpnameScope.ALL_ACTIVE_ITEMS ? 'All Active Items (Semua Item Aktif)' : 'Selected Items (Item Pilihan)';
  scopeCell.font = { name: 'Calibri', size: 9, color: { argb: COLOR_DARK_TEXT } };
  scopeCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['B5', 'C5', 'D5'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('E5').value = 'Dibuat Oleh:';
  sheet.getCell('E5').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('E5').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('E5'));

  sheet.mergeCells('F5:G5');
  const createdByCell = sheet.getCell('F5');
  createdByCell.value = session.CreatedBy;
  createdByCell.font = { name: 'Calibri', size: 9, color: { argb: COLOR_DARK_TEXT } };
  createdByCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['F5', 'G5'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('H5').value = 'Mulai Oleh:';
  sheet.getCell('H5').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('H5').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('H5'));

  sheet.mergeCells('I5:J5');
  const startedByCell = sheet.getCell('I5');
  startedByCell.value = session.StartedBy ? `${session.StartedBy} (${formatDate(session.StartedAt)})` : '-';
  startedByCell.font = { name: 'Calibri', size: 9, color: { argb: COLOR_DARK_TEXT } };
  startedByCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ['I5', 'J5'].forEach((c) => styleMetaCell(sheet.getCell(c)));

  sheet.getCell('K5').value = 'Catatan:';
  sheet.getCell('K5').font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_MUTED_LABEL } };
  sheet.getCell('K5').alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(sheet.getCell('K5'));

  const notesCell = sheet.getCell('L5');
  notesCell.value = session.Notes ?? '-';
  notesCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };
  notesCell.alignment = { vertical: 'middle', horizontal: 'left' };
  styleMetaCell(notesCell);

  // Row 6: Spacer
  sheet.getRow(6).height = 10;

  // Row 7: Table Header
  const headers = [
    { text: 'NO', align: 'center' },
    { text: 'LOKASI / RAK', align: 'center' },
    { text: 'NAMA BARANG / ITEM NAME', align: 'left' },
    { text: 'MODEL / TIPE', align: 'left' },
    { text: 'SPESIFIKASI', align: 'left' },
    { text: 'KLASIFIKASI', align: 'center' },
    { text: 'SATUAN', align: 'center' },
    { text: 'QTY SISTEM', align: 'right' },
    { text: 'HASIL FISIK', align: 'center' },
    { text: 'SELISIH', align: 'right' },
    { text: 'CEK', align: 'center' },
    { text: 'CATATAN / REMARKS', align: 'left' },
  ];

  const headerRow = sheet.getRow(7);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.text;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_NAVY },
    };
    cell.font = {
      name: 'Calibri',
      size: 9.5,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: h.align as ExcelJS.Alignment['horizontal'],
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F275A' } },
      left: { style: 'thin', color: { argb: 'FF0F275A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F275A' } },
      right: { style: 'thin', color: { argb: 'FF0F275A' } },
    };
  });

  // Data Rows (Row 8+)
  let currentRowNum = 8;
  const startDataRow = 8;

  if (rows.length === 0) {
    const emptyRow = sheet.getRow(currentRowNum);
    emptyRow.height = 28;
    sheet.mergeCells(`A${currentRowNum}:L${currentRowNum}`);
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = 'Tidak ada item dalam sesi stock opname ini.';
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    for (let c = 1; c <= 12; c++) {
      emptyRow.getCell(c).border = thinBorder;
    }
    currentRowNum += 1;
  } else {
    rows.forEach((row, idx) => {
      const dataRow = sheet.getRow(currentRowNum);
      dataRow.height = 24;

      const isOdd = idx % 2 === 1;
      const rowBg = isOdd ? COLOR_ZEBRA_ODD : 'FFFFFFFF';

      const sysQtyNum = Number(row.systemQty);
      const actQtyNum = row.actualQty !== null ? Number(row.actualQty) : null;
      const hasActual = actQtyNum !== null;
      const diffQtyNum = hasActual ? actQtyNum - sysQtyNum : null;

      // Col A: No
      const cNo = dataRow.getCell(1);
      cNo.value = idx + 1;
      cNo.alignment = { vertical: 'middle', horizontal: 'center' };
      cNo.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };

      // Col B: Location (Bold)
      const cLoc = dataRow.getCell(2);
      cLoc.value = row.item.AddressLocation;
      cLoc.alignment = { vertical: 'middle', horizontal: 'center' };
      cLoc.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR_DARK_TEXT } };

      // Col C: Name (Bold)
      const cName = dataRow.getCell(3);
      cName.value = row.item.Name;
      cName.alignment = { vertical: 'middle', horizontal: 'left' };
      cName.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR_DARK_TEXT } };

      // Col D: Model
      const cModel = dataRow.getCell(4);
      cModel.value = row.item.Model ?? '-';
      cModel.alignment = { vertical: 'middle', horizontal: 'left' };
      cModel.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };

      // Col E: Spec
      const cSpec = dataRow.getCell(5);
      cSpec.value = row.item.Specification ?? '-';
      cSpec.alignment = { vertical: 'middle', horizontal: 'left' };
      cSpec.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };

      // Col F: Classification
      const cClass = dataRow.getCell(6);
      cClass.value = row.item.Classification ?? '-';
      cClass.alignment = { vertical: 'middle', horizontal: 'center' };
      cClass.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };

      // Col G: Unit
      const cUnit = dataRow.getCell(7);
      cUnit.value = row.item.Unit;
      cUnit.alignment = { vertical: 'middle', horizontal: 'center' };
      cUnit.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };

      // Col H: System Qty
      const cSys = dataRow.getCell(8);
      cSys.value = sysQtyNum;
      cSys.alignment = { vertical: 'middle', horizontal: 'right' };
      cSys.font = { name: 'Calibri', size: 9.5, color: { argb: COLOR_DARK_TEXT } };
      cSys.numFmt = '#,##0.00';

      // Col I: Actual Qty (Handwriting box / data entry)
      const cAct = dataRow.getCell(9);
      cAct.value = actQtyNum;
      cAct.alignment = { vertical: 'middle', horizontal: 'right' };
      cAct.font = { name: 'Calibri', size: 10, bold: hasActual, color: { argb: COLOR_DARK_TEXT } };
      cAct.numFmt = '#,##0.00';

      // Col J: Difference (Formula)
      const cDiff = dataRow.getCell(10);
      cDiff.value = {
        formula: `IF(ISBLANK(I${currentRowNum}),"",I${currentRowNum}-H${currentRowNum})`,
        result: diffQtyNum !== null ? diffQtyNum : undefined,
      };
      cDiff.alignment = { vertical: 'middle', horizontal: 'right' };
      cDiff.font = {
        name: 'Calibri',
        size: 9.5,
        bold: Boolean(diffQtyNum && diffQtyNum !== 0),
        color: {
          argb: diffQtyNum && diffQtyNum < 0 ? 'FFDC2626' : diffQtyNum && diffQtyNum > 0 ? 'FF16A34A' : COLOR_DARK_TEXT,
        },
      };
      cDiff.numFmt = '+#,##0.00;-#,##0.00;0.00';

      // Col K: Check indicator
      const cCheck = dataRow.getCell(11);
      cCheck.value = hasActual ? '✓' : '[  ]';
      cCheck.alignment = { vertical: 'middle', horizontal: 'center' };
      cCheck.font = {
        name: 'Calibri',
        size: hasActual ? 11 : 9,
        bold: hasActual,
        color: { argb: hasActual ? 'FF16A34A' : 'FF94A3B8' },
      };

      // Col L: Notes
      const cNotes = dataRow.getCell(12);
      cNotes.value = row.notes ?? '';
      cNotes.alignment = { vertical: 'middle', horizontal: 'left' };
      cNotes.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };

      // Apply row styling and borders
      for (let c = 1; c <= 12; c++) {
        const cell = dataRow.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBg },
        };
        // Col 9 has a slightly more prominent border for clear field writing
        if (c === 9) {
          cell.border = {
            top: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
            left: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
            bottom: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
            right: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
          };
        } else {
          cell.border = thinBorder;
        }
      }

      currentRowNum += 1;
    });
  }

  const lastDataRow = currentRowNum - 1;

  // Summary / Total Row
  if (rows.length > 0) {
    const totalRow = sheet.getRow(currentRowNum);
    totalRow.height = 24;

    sheet.mergeCells(`A${currentRowNum}:G${currentRowNum}`);
    const lblTotal = totalRow.getCell(1);
    lblTotal.value = `TOTAL (${rows.length} ITEMS)`;
    lblTotal.alignment = { vertical: 'middle', horizontal: 'right' };
    lblTotal.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_DARK_TEXT } };

    // Total System Qty
    const totSys = totalRow.getCell(8);
    totSys.value = {
      formula: `SUM(H${startDataRow}:H${lastDataRow})`,
      result: undefined,
    };
    totSys.alignment = { vertical: 'middle', horizontal: 'right' };
    totSys.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_NAVY } };
    totSys.numFmt = '#,##0.00';

    // Total Actual Qty
    const totAct = totalRow.getCell(9);
    totAct.value = {
      formula: `IF(COUNT(I${startDataRow}:I${lastDataRow})>0,SUM(I${startDataRow}:I${lastDataRow}),"")`,
      result: undefined,
    };
    totAct.alignment = { vertical: 'middle', horizontal: 'right' };
    totAct.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_DARK_TEXT } };
    totAct.numFmt = '#,##0.00';

    // Total Diff Qty
    const totDiff = totalRow.getCell(10);
    totDiff.value = {
      formula: `IF(COUNT(I${startDataRow}:I${lastDataRow})>0,SUM(J${startDataRow}:J${lastDataRow}),"")`,
      result: undefined,
    };
    totDiff.alignment = { vertical: 'middle', horizontal: 'right' };
    totDiff.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_DARK_TEXT } };
    totDiff.numFmt = '+#,##0.00;-#,##0.00;0.00';

    // Apply Total styling & Accounting double underline
    const totalBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF64748B' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: COLOR_BORDER } },
      right: { style: 'thin', color: { argb: COLOR_BORDER } },
    };

    for (let c = 1; c <= 12; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_TOTAL_BG },
      };
      cell.border = totalBorder;
    }

    currentRowNum += 1;
  }

  // Spacer before Signature Block
  sheet.getRow(currentRowNum).height = 14;
  currentRowNum += 1;

  // Sign-off / Signature Matrix (Maker-Checker Verification)
  const sigHeaderRow = sheet.getRow(currentRowNum);
  sigHeaderRow.height = 22;

  // Box 1: Cols B-D (Counted by)
  sheet.mergeCells(`B${currentRowNum}:D${currentRowNum}`);
  const b1H = sigHeaderRow.getCell(2);
  b1H.value = 'PETUGAS PENGHITUNG / COUNTED BY';

  // Box 2: Cols F-H (Verified by)
  sheet.mergeCells(`F${currentRowNum}:H${currentRowNum}`);
  const b2H = sigHeaderRow.getCell(6);
  b2H.value = 'DIVERIFIKASI OLEH / VERIFIED BY';

  // Box 3: Cols J-L (Approved by)
  sheet.mergeCells(`J${currentRowNum}:L${currentRowNum}`);
  const b3H = sigHeaderRow.getCell(10);
  b3H.value = 'DISETUJUI OLEH / APPROVED BY';

  const sigHeaderStyle = (cell: ExcelJS.Cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_DARK_TEXT } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
      left: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
      right: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
      bottom: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
    };
  };

  [2, 3, 4, 6, 7, 8, 10, 11, 12].forEach((c) => sigHeaderStyle(sigHeaderRow.getCell(c)));
  currentRowNum += 1;

  // Signature Blank Space (Rows for signature stamp / pen)
  for (let i = 0; i < 3; i++) {
    const sRow = sheet.getRow(currentRowNum);
    sRow.height = 16;
    [2, 3, 4, 6, 7, 8, 10, 11, 12].forEach((colIdx) => {
      const cell = sRow.getCell(colIdx);
      cell.border = {
        left: colIdx === 2 || colIdx === 6 || colIdx === 10 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
        right: colIdx === 4 || colIdx === 8 || colIdx === 12 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
      };
    });
    currentRowNum += 1;
  }

  // Signature Name Row
  const sigNameRow = sheet.getRow(currentRowNum);
  sigNameRow.height = 20;

  sheet.mergeCells(`B${currentRowNum}:D${currentRowNum}`);
  const b1N = sigNameRow.getCell(2);
  b1N.value = `Nama: ${session.StartedBy ?? session.CreatedBy}`;

  sheet.mergeCells(`F${currentRowNum}:H${currentRowNum}`);
  const b2N = sigNameRow.getCell(6);
  b2N.value = 'Nama: ________________________';

  sheet.mergeCells(`J${currentRowNum}:L${currentRowNum}`);
  const b3N = sigNameRow.getCell(10);
  b3N.value = `Nama: ${session.CompletedBy ?? '________________________'}`;

  const sigNameStyle = (cell: ExcelJS.Cell) => {
    cell.font = { name: 'Calibri', size: 9, color: { argb: COLOR_DARK_TEXT } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  };

  [2, 6, 10].forEach((colIdx) => sigNameStyle(sigNameRow.getCell(colIdx)));
  [2, 3, 4, 6, 7, 8, 10, 11, 12].forEach((colIdx) => {
    const cell = sigNameRow.getCell(colIdx);
    cell.border = {
      ...cell.border,
      left: colIdx === 2 || colIdx === 6 || colIdx === 10 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
      right: colIdx === 4 || colIdx === 8 || colIdx === 12 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
    };
  });
  currentRowNum += 1;

  // Signature Date Row
  const sigDateRow = sheet.getRow(currentRowNum);
  sigDateRow.height = 20;

  sheet.mergeCells(`B${currentRowNum}:D${currentRowNum}`);
  const b1D = sigDateRow.getCell(2);
  b1D.value = 'Tanggal: _____________________';

  sheet.mergeCells(`F${currentRowNum}:H${currentRowNum}`);
  const b2D = sigDateRow.getCell(6);
  b2D.value = 'Tanggal: _____________________';

  sheet.mergeCells(`J${currentRowNum}:L${currentRowNum}`);
  const b3D = sigDateRow.getCell(10);
  b3D.value = 'Tanggal: _____________________';

  [2, 6, 10].forEach((colIdx) => sigNameStyle(sigDateRow.getCell(colIdx)));
  [2, 3, 4, 6, 7, 8, 10, 11, 12].forEach((colIdx) => {
    const cell = sigDateRow.getCell(colIdx);
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLOR_BOX_BORDER } },
      left: colIdx === 2 || colIdx === 6 || colIdx === 10 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
      right: colIdx === 4 || colIdx === 8 || colIdx === 12 ? { style: 'thin', color: { argb: COLOR_BOX_BORDER } } : undefined,
    };
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
