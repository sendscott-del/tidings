// Client-side parser for the LCR 12-column landscape "Tidings Export" PDF.
// Uses pdfjs-dist with coordinate-based text extraction. The report layout
// renders each contact across 3-5 visual lines (~5pt apart), with ~12-18pt
// gaps between contacts. We cluster items by vertical proximity into
// per-contact "records," then bucket each record's items by x into columns
// using empirically-measured column bounds.

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

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

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

type Cells = Record<ColKey, string>

const COL_KEYS: ColKey[] = [
  'name', 'unit', 'birth', 'callings', 'class', 'haschildren',
  'phone', 'endowed', 'rm', 'single', 'gender', 'priesthood',
]

// Measured from the actual LCR landscape export (page size 792 × 612 pt).
// Each entry is the x-coordinate where that column STARTS. The next entry
// (or +∞) is the implicit end.
const COLUMN_X_STARTS: Record<ColKey, number> = {
  name: 25,
  unit: 95,
  birth: 145,
  callings: 185,
  class: 285,
  haschildren: 355,
  phone: 405,
  endowed: 485,
  rm: 540,
  single: 605,
  gender: 650,
  priesthood: 695,
}

interface TextItem {
  str: string
  x: number
  y: number       // PDF y (origin at bottom) — we convert to top-down for grouping
  pageHeight: number
}

function toTop(it: TextItem): number {
  return it.pageHeight - it.y
}

function colKeyForX(x: number): ColKey | null {
  let chosen: ColKey | null = null
  for (const key of COL_KEYS) {
    if (x >= COLUMN_X_STARTS[key]) chosen = key
  }
  return chosen
}

const BIRTH_DATE_RE = /^\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}$/

// Words that show up only in page headers/footers/title — drop records that
// contain ONLY these tokens.
const STRUCTURAL_TOKENS = new Set([
  'tidings', 'description', 'search', 'group', 'by', 'unit', 'edit', 'report',
  'preferred', 'name', 'birth', 'date', '(1', '1990)', 'callings', 'class',
  'assignment', 'has', 'children', 'individual', 'phone', 'is', 'endowed',
  'returned', 'missionary', 'single', 'gender', 'priesthood', 'count:',
])

// Cluster sorted items into records by vertical gap. Within a record the
// line-to-line gap is ~5pt; between records ~12-18pt. A threshold of 9pt
// separates them cleanly.
function clusterIntoRecords(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => toTop(a) - toTop(b) || a.x - b.x)
  const records: TextItem[][] = []
  let current: TextItem[] = []
  let lastTop = Number.NEGATIVE_INFINITY

  for (const item of sorted) {
    const t = toTop(item)
    if (current.length === 0 || t - lastTop <= 9) {
      current.push(item)
    } else {
      records.push(current)
      current = [item]
    }
    lastTop = t
  }
  if (current.length > 0) records.push(current)
  return records
}

function bucketIntoColumns(record: TextItem[]): Cells {
  const cells: Cells = {
    name: '', unit: '', birth: '', callings: '', class: '', haschildren: '',
    phone: '', endowed: '', rm: '', single: '', gender: '', priesthood: '',
  }
  // Sort by (top asc, x asc) so within-column text concatenates in reading order.
  const ordered = [...record].sort((a, b) => toTop(a) - toTop(b) || a.x - b.x)
  for (const item of ordered) {
    const key = colKeyForX(item.x)
    if (!key) continue
    if (cells[key]) cells[key] += ' '
    cells[key] += item.str
  }
  for (const k of COL_KEYS) cells[k] = cells[k].replace(/\s+/g, ' ').trim()
  return cells
}

function isStructuralOnly(record: TextItem[]): boolean {
  return record.every((it) => STRUCTURAL_TOKENS.has(it.str.toLowerCase()))
}

function rowToContact(cells: Cells): ParsedContact | { skip: string } {
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
    age_group: 'Adult',
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

  // Extract items page by page; cluster within each page (records don't span pages).
  const allRecords: Cells[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height
    const content = await page.getTextContent()

    const items: TextItem[] = content.items
      .map((it: any) => {
        if (!it.str || !it.transform) return null
        const x = it.transform[4] as number
        const y = it.transform[5] as number
        const str = (it.str as string).trim()
        if (!str) return null
        return { str, x, y, pageHeight }
      })
      .filter((x): x is TextItem => x !== null)

    const recordGroups = clusterIntoRecords(items)
    for (const group of recordGroups) {
      if (isStructuralOnly(group)) continue
      const cells = bucketIntoColumns(group)
      // Drop records that don't contain a date — they're header/footer/orphans.
      if (!BIRTH_DATE_RE.test(cells.birth)) continue
      allRecords.push(cells)
    }
  }

  const contacts: ParsedContact[] = []
  const skipped: ParseResult['skipped'] = []
  allRecords.forEach((cells, i) => {
    const result = rowToContact(cells)
    if ('skip' in result) {
      skipped.push({ row: i + 1, reason: result.skip, data: cells as unknown as Record<string, string> })
    } else {
      contacts.push(result)
    }
  })

  return { contacts, skipped, totalRows: allRecords.length }
}
