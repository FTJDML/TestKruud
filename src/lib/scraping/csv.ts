/**
 * Minimale, correcte CSV-parser: ondersteunt quotes, escaped quotes en
 * regeleindes binnen velden. Geen dependency nodig voor merchantfeeds.
 */
export type CsvRow = Record<string, string>

export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = -1
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

export function parseCsv(input: string, delimiter?: string): CsvRow[] {
  const text = input.replace(/^﻿/, '')
  const sep = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === sep) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows.filter((entry) => entry.some((value) => value.trim().length > 0))
  if (!header) return []
  const keys = header.map((key) => key.trim())
  return body.map((values) => {
    const record: CsvRow = {}
    keys.forEach((key, position) => {
      record[key] = (values[position] ?? '').trim()
    })
    return record
  })
}
