import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parse } from 'csv-parse/sync'

const DATA_DIR = resolve(__dirname, 'data')

/**
 * Read a CSV file and return typed rows.
 * Handles UTF-8 BOM, quoted fields, and newlines within quotes.
 *
 * @param filename - CSV filename relative to the data directory
 * @param subDir  - optional subdirectory (e.g. 'init' or 'packages/study-abroad')
 */
export function readCsv<T extends Record<string, string>>(
  filename: string,
  subDir?: string,
): T[] {
  const baseDir = subDir ? resolve(DATA_DIR, subDir) : DATA_DIR
  const filePath = resolve(baseDir, filename)
  if (!existsSync(filePath)) {
    return []
  }
  const raw = readFileSync(filePath, 'utf-8')
  // Strip BOM
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  // Normalize line endings: CRLF -> LF, also strip standalone CR
  const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const records: T[] = parse(normalized, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: false,
    relax_column_count: true,
    relax_quotes: true,
  })
  return records
}

/**
 * Parse a JSON string column, returning undefined for empty strings
 */
export function parseJson<T = any>(value: string | undefined | null): T | undefined {
  if (!value || value.trim() === '') return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

/**
 * Split a comma/pipe-separated string into an array, filtering empties
 */
export function splitList(value: string | undefined | null, sep = ','): string[] {
  if (!value || value.trim() === '') return []
  return value.split(sep).map((s) => s.trim()).filter(Boolean)
}
