// Client-side parser for the LCR 12-column landscape "Tidings Export" PDF.
// Uses pdfjs-dist with coordinate-based text extraction to reconstruct rows
// and assign each text item to a column based on x-position.
//
// Output shape matches CSV parser's ParseResult so StakeImport can branch by
// file extension and feed the same downstream pipeline.

import {
  type ParseResult,
  type ParsedContact,
  normalizePhone,
  parseName,
  parseBirthDate,
  parseClassAssignment,
  parseYesNo,
  parseGender,
  parsePriesthoodOffice,
} from './csv-parser'

// pdfjs-dist v5 ships ESM modules; the worker is loaded as a URL via Vite's
// `?url` query so the bundler emits it as a separate asset.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

// Expected header tokens from the landscape report. Used to derive column
// x-positions from page 1 dynamically — survives small layout shifts.
const HEADER_TOKENS = [
  'PreferredName',
  'Unit',
  'BirthDate',
  'Callings',
  'ClassAssignment',
  'HasChildren',
  'IndividualPhone',
  'IsEndowed',
  'Is ReturnedMissionary',
  'IsSingle',
  'Gender',
  'Priesthood',
] as const

type ColKey =
  | 'name'
  | 'unit'
  | 'birth'
  | 'callings'
  | 'class'
  | 'haschildren'
  | 'phone'
  | 'endowed'
  | 'rm'
  | 'single'
  | 'gender'
  | 'priesthood'

const COL_KEYS: ColKey[] = [
  'name', 'unit', 'birth', 'callings', 'class', 'haschildren',
  'phone', 'endowed', 'rm', 'single', 'gender', 'priesthood',
]

interface TextItem {
  str: string
  x: number
  y: number
}

interface ColumnBounds {
  key: ColKey
  xStart: number   // left edge (inclusive)
  xEnd: number     // right edge (exclusive)
}

interface RawRow {
  cells: Record<ColKey, string>
  hasDate: boolean // birth-date present → marks the start of a new contact
  yMin: number     // top of the row group (for ordering)
}

const BIRTH_DATE_RE = /^\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}$/

// Group text items into visual rows by y-coordinate (within tolerance).
function groupByRow(items: TextItem[], yTolerance = 3): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextItem[][] = []
  let current: TextItem[] = []
  let lastY = Number.NaN

  for (const item of sorted) {
    if (Number.isNaN(lastY) || Math.abs(item.y - lastY) <= yTolerance) {
      current.push(item)
      lastY = Number.isNaN(lastY) ? item.y : lastY
    } else {
      if (current.length > 0) rows.push(current)
      current = [item]
      lastY = item.y
    }
  }
  if (current.length > 0) rows.push(current)
  return rows
}

// Derive column x-bounds from a row that contains the header tokens.
function deriveColumnBounds(headerRow: TextItem[]): ColumnBounds[] | null {
  // Find x-position of each expected header token. Tokens may be split across
  // items; we accept the leftmost item whose string starts with the token's
  // first word.
  const xStarts: number[] = []
  const headerFirstWords = HEADER_TOKENS.map((t) => t.split(/\s+/)[0].toLowerCase())

  for (const firstWord of headerFirstWords) {
    const match = headerRow.find((it) => it.str.toLowerCase().startsWith(firstWord))
    if (!match) return null
    xStarts.push(match.x)
  }

  // Sort to be safe (header tokens should be in left-to-right order already)
  const sortedStarts = [...xStarts].sort((a, b) => a - b)
  const bounds: ColumnBounds[] = sortedStarts.map((x, i) => ({
    key: COL_KEYS[i],
    xStart: x - 2, // small left margin
    xEnd: i < sortedStarts.length - 1 ? sortedStarts[i + 1] - 2 : Number.POSITIVE_INFINITY,
  }))
  return bounds
}

// Static fallback bounds, derived from sample inspection of the landscape
// "Tidings Export.pdf". Used only if dynamic detection on page 1 fails.
// These x-values are page coordinates in PDF points (1/72 in).
// Tuned to the 12-column landscape layout — order matches COL_KEYS.
const FALLBACK_BOUNDS: ColumnBounds[] = (() => {
  const xs = [10, 130, 235, 290, 380, 485, 545, 625, 670, 730, 765, 800]
  return xs.map((x, i) => ({
    key: COL_KEYS[i],
    xStart: x,
    xEnd: i < xs.length - 1 ? xs[i + 1] : Number.POSITIVE_INFINITY,
  }))
})()

// Bucket text items into columns by x-position.
function bucketRow(items: TextItem[], bounds: ColumnBounds[]): Record<ColKey, string> {
  const cells: Record<ColKey, string> = {
    name: '', unit: '', birth: '', callings: '', class: '', haschildren: '',
    phone: '', endowed: '', rm: '', single: '', gender: '', priesthood: '',
  }
  // Order items left-to-right within the row for stable string concat.
  const ordered = [...items].sort((a, b) => a.x - b.x)
  for (const item of ordered) {
    const col = bounds.find((b) => item.x >= b.xStart && item.x < b.xEnd)
    if (!col) continue
    if (cells[col.key]) cells[col.key] += ' '
    cells[col.key] += item.str
  }
  // Collapse internal whitespace
  for (const k of COL_KEYS) cells[k] = cells[k].replace(/\s+/g, ' ').trim()
  return cells
}

async function extractAllItems(pdf: PDFDocumentProxy): Promise<TextItem[][]> {
  const perPage: TextItem[][] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: TextItem[] = content.items
      .map((it: any) => {
        if (!it.str || !it.transform) return null
        const x = it.transform[4]
        const y = it.transform[5]
        return { str: it.str as string, x, y }
      })
      .filter((x): x is TextItem => x !== null && x.str.trim().length > 0)
    perPage.push(items)
  }
  return perPage
}

// Reassemble multi-line cells: a row begins when its birth-date cell matches
// the date pattern. Subsequent rows without a date merge into the previous
// contact's wrapping cells (name, unit, callings).
function mergeContinuations(rows: RawRow[]): RawRow[] {
  const merged: RawRow[] = []
  for (const row of rows) {
    if (row.hasDate) {
      merged.push(row)
    } else if (merged.length > 0) {
      const prev = merged[merged.length - 1]
      const append = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b)
      prev.cells.name = append(prev.cells.name, row.cells.name)
      prev.cells.unit = append(prev.cells.unit, row.cells.unit)
      prev.cells.callings = append(prev.cells.callings, row.cells.callings)
      prev.cells.class = append(prev.cells.class, row.cells.class)
    }
    // If no prior row, drop continuation lines (header artifacts).
  }
  return merged
}

function rowToContact(cells: Record<ColKey, string>): ParsedContact | { skip: string } {
  const rawPhone = cells.phone
  if (!rawPhone) return { skip: 'No phone number' }
  const phone = normalizePhone(rawPhone)
  if (!phone) return { skip: `Invalid phone: ${rawPhone}` }

  const { first, last } = parseName(cells.name)
  if (!first && !last) return { skip: 'No name' }

  const { birth_month, birth_day } = parseBirthDate(cells.birth)
  const classAssignment = parseClassAssignment(cells.class)
  const hasChildren = parseYesNo(cells.haschildren)
  const isEndowed = parseYesNo(cells.endowed)
  const isReturnedMissionary = parseYesNo(cells.rm)
  const isSingle = parseYesNo(cells.single)
  const gender = parseGender(cells.gender)
  const priesthood = parsePriesthoodOffice(cells.priesthood)
  const callings = cells.callings && cells.callings !== '-' ? [cells.callings] : []

  // Legacy booleans for backward compat with rebuildAutoLists' existing reads
  const ph = (cells.priesthood || '').toLowerCase()
  const cls = (cells.class || '').toLowerCase()
  const melchizedek = priesthood === 'Melchizedek' || ['elder', 'high priest', 'patriarch'].some((p) => ph.includes(p))
  const aaronic = priesthood === 'Aaronic' || ['deacon', 'teacher', 'priest'].some((p) => ph.includes(p))
  const reliefSociety = cls.includes('relief society')
  const eldersQuorum = cls.includes('elders quorum')
  const youngWomen = cls.includes('young women')
  const primaryMember = cls.includes('primary') || cls.includes('nursery') || /course\s*\d/.test(cls)

  return {
    first_name: first,
    last_name: last,
    phone,
    email: '',
    household_id: '',
    unit_name: cells.unit,
    sex: gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : '',
    age_group: birth_month != null && birth_day != null ? 'Adult' : 'Adult',
    has_children: hasChildren,
    melchizedek,
    relief_society: reliefSociety,
    elders_quorum: eldersQuorum,
    young_women: youngWomen,
    aaronic,
    primary_member: primaryMember,
    birth_month,
    birth_day,
    class_assignment: classAssignment,
    is_endowed: isEndowed,
    is_returned_missionary: isReturnedMissionary,
    is_single: isSingle,
    priesthood,
    gender,
    callings,
  }
}

export async function parsePDF(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const perPage = await extractAllItems(pdf)

  // Detect column bounds from page 1's header row, fall back to static layout.
  let bounds: ColumnBounds[] | null = null
  if (perPage.length > 0) {
    const page1Rows = groupByRow(perPage[0])
    // Look for a row containing "PreferredName" — that's the header line.
    const headerRow = page1Rows.find((r) =>
      r.some((it) => it.str.toLowerCase().includes('preferredname'))
    )
    if (headerRow) bounds = deriveColumnBounds(headerRow)
  }
  if (!bounds) bounds = FALLBACK_BOUNDS

  const rawRows: RawRow[] = []
  for (const items of perPage) {
    const visualRows = groupByRow(items)
    for (const visualRow of visualRows) {
      const cells = bucketRow(visualRow, bounds)
      // Skip header / footer / "Count: N" / page-number rows
      const allText = Object.values(cells).join(' ').toLowerCase()
      if (!cells.name && !cells.unit && !cells.birth) continue
      if (allText.includes('preferredname') || allText.startsWith('count:')) continue
      if (allText.includes('group by unit') || allText.includes('edit report')) continue
      rawRows.push({
        cells,
        hasDate: BIRTH_DATE_RE.test(cells.birth),
        yMin: visualRow[0].y,
      })
    }
  }

  const merged = mergeContinuations(rawRows)

  const contacts: ParsedContact[] = []
  const skipped: ParseResult['skipped'] = []
  merged.forEach((row, i) => {
    const result = rowToContact(row.cells)
    if ('skip' in result) {
      skipped.push({ row: i + 1, reason: result.skip, data: row.cells as unknown as Record<string, string> })
    } else {
      contacts.push(result)
    }
  })

  return { contacts, skipped, totalRows: merged.length }
}
