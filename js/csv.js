// Export CSV (séparateur « ; » et BOM UTF-8 pour ouvrir proprement dans Excel FR).
const cell = (v) => {
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.round(v * 10) / 10).replace('.', ',');
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
