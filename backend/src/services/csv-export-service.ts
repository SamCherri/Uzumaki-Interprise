export type CsvColumn = { key: string; header: string };

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const normalized = value instanceof Date
    ? value.toISOString()
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  const escaped = normalized.replace(/"/g, '""');
  if (/[",\n\r]/u.test(normalized)) return `"${escaped}"`;
  return escaped;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: CsvColumn[]): string {
  const header = columns.map((col) => escapeCsvValue(col.header)).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvValue(row[col.key])).join(','));
  return `${[header, ...lines].join('\n')}\n`;
}
