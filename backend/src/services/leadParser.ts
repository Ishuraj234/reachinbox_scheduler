import { parse } from "csv-parse/sync";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Accepts raw text of an uploaded .csv or .txt file and returns a
 * de-duplicated list of valid email addresses. Works whether emails are
 * one-per-line, comma separated, or inside a CSV column (any column).
 */
export function parseLeadsFromText(raw: string): string[] {
  const found = new Set<string>();

  let rows: string[][] = [];
  try {
    rows = parse(raw, { skip_empty_lines: true, relax_column_count: true });
  } catch {
    // Not valid CSV - fall back to naive line/comma splitting below.
    rows = raw.split(/\r?\n/).map((line) => line.split(","));
  }

  for (const row of rows) {
    for (const cell of row) {
      const trimmed = cell.trim();
      if (EMAIL_REGEX.test(trimmed)) found.add(trimmed.toLowerCase());
    }
  }

  return Array.from(found);
}
