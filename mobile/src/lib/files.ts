import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BRAND } from '../config';
import { fmtDate } from './format';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type Cell = string | number;

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function safeName(name: string) {
  return name
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

async function writeAndShare(
  filename: string,
  format: ExportFormat,
  base64OrText: string,
  encoding: 'base64' | 'utf8'
) {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}.${format}`;
  await ReactNativeBlobUtil.fs.writeFile(path, base64OrText, encoding);
  await Share.open({
    url: Platform.OS === 'android' ? `file://${path}` : path,
    type: MIME[format],
    filename: `${filename}.${format}`,
    failOnCancel: false,
    title: filename,
  });
}

/** Same exports the web admin offers (CSV / Excel / PDF), handed to the system share sheet. */
/**
 * Opens a local PDF in the system viewer — iOS Quick Look / Android's PDF app —
 * where the Print button lives (this is how the app prints, like the web's
 * "Print" buttons).
 */
export async function openPdfForPrint(path: string) {
  if (Platform.OS === 'ios') {
    ReactNativeBlobUtil.ios.previewDocument(path);
  } else {
    await ReactNativeBlobUtil.android.actionViewIntent(path, 'application/pdf', 'Print or save PDF');
  }
}

/** Downloads a server PDF (invoice / sale / customisation bill) and opens it for printing. */
export async function printRemotePdf(url: string, name: string) {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName(name)}.pdf`;
  await ReactNativeBlobUtil.config({ path }).fetch('GET', url);
  await openPdfForPrint(path);
}

export async function exportTable(opts: {
  format: ExportFormat | 'print';
  filename: string;
  title: string;
  headers: string[];
  rows: Cell[][];
  totals?: Cell[];
}) {
  const filename = `${safeName(opts.filename)}-${new Date().toISOString().slice(0, 10)}`;
  const data = opts.totals ? [...opts.rows, opts.totals] : opts.rows;

  if (opts.format === 'csv') {
    const csv = Papa.unparse({ fields: opts.headers, data });
    await writeAndShare(filename, 'csv', `﻿${csv}`, 'utf8');
    return;
  }

  if (opts.format === 'xlsx') {
    const sheet = XLSX.utils.aoa_to_sheet([opts.headers, ...data]);
    sheet['!cols'] = opts.headers.map((h, i) => ({
      wch: Math.min(40, Math.max(h.length, ...data.map((r) => String(r[i] ?? '').length)) + 2),
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, opts.title.slice(0, 31));
    const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
    await writeAndShare(filename, 'xlsx', base64, 'base64');
    return;
  }

  // PDF — jsPDF is pure JS; loaded lazily so a problem here never affects app start.
  const { jsPDF } = require('jspdf') as typeof import('jspdf');
  const autoTable = (require('jspdf-autotable') as { default: (doc: unknown, opts: unknown) => void })
    .default;
  const doc = new jsPDF({
    orientation: opts.headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  doc.setFontSize(16);
  doc.text(BRAND.fullName, 40, 40);
  doc.setFontSize(11);
  doc.text(`${opts.title} · ${fmtDate(new Date())}`, 40, 58);
  autoTable(doc, {
    head: [opts.headers],
    body: opts.rows.map((r) => r.map((c) => String(c ?? ''))),
    foot: opts.totals ? [opts.totals.map((c) => String(c ?? ''))] : undefined,
    startY: 72,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [142, 111, 54], textColor: 255 },
    footStyles: { fillColor: [240, 232, 216], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 247, 241] },
  });
  const base64 = doc.output('datauristring').split(',')[1];
  if (opts.format === 'print') {
    const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}.pdf`;
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
    await openPdfForPrint(path);
    return;
  }
  await writeAndShare(filename, 'pdf', base64, 'base64');
}

/** Pick a .csv / .xlsx file and return its rows as objects keyed by the header row. */
export async function pickSpreadsheet<T = Record<string, string>>(): Promise<{
  name: string;
  rows: T[];
} | null> {
  let picked;
  try {
    [picked] = await pick({ type: [types.csv, types.xlsx, types.xls, types.plainText] });
  } catch (error) {
    if ((error as { code?: string })?.code === 'OPERATION_CANCELED') return null;
    throw error;
  }
  if (!picked) return null;
  const name = picked.name ?? 'file';
  const [copy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: name }],
    destination: 'cachesDirectory',
  });
  if (copy.status !== 'success') throw new Error(copy.copyError ?? 'Could not read the file');
  const path = decodeURIComponent(copy.localUri.replace('file://', ''));

  if (/\.csv$|\.txt$/i.test(name)) {
    const text: string = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
    const parsed = Papa.parse<T>(text.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    return { name, rows: parsed.data };
  }
  const base64: string = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
  const book = XLSX.read(base64, { type: 'base64' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return {
    name,
    rows: rows.map(
      (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '').trim()])) as T
    ),
  };
}
