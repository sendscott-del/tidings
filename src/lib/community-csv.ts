import Papa from 'papaparse'

export interface ParsedCommunityContact {
  first_name: string
  last_name: string
  phone: string
  notes: string
}

export interface CommunityParseResult {
  contacts: ParsedCommunityContact[]
  skipped: { row: number; reason: string }[]
  totalRows: number
}

// Accept exactly 10 digits (prepend +1) or 11 digits starting with 1 (prepend
// +). Anything else is invalid → null, so over-long typos are rejected.
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

// Strip accents + lowercase so 'Teléfono' and 'Telefono' both match.
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const wanted = candidates.map(norm)
  return headers.find((h) => wanted.includes(norm(h))) || null
}

// English + Spanish header aliases (matched accent-insensitively via norm()).
const FIRST_ALIASES = ['First Name', 'First', 'Given Name', 'Nombre', 'Nombres', 'Primer Nombre']
const LAST_ALIASES = ['Last Name', 'Last', 'Surname', 'Family Name', 'Apellido', 'Apellidos', 'Apellido Paterno']
const NAME_ALIASES = ['Name', 'Full Name', 'Nombre Completo', 'Contact', 'Contacto']
const PHONE_ALIASES = ['Phone', 'Mobile', 'Cell Phone', 'Phone Number', 'Cell', 'Phone #', 'Telefono', 'Celular', 'Numero', 'Numero de Telefono', 'Tel', 'Cel', 'Movil', 'Telefonos']
const NOTES_ALIASES = ['Notes', 'Note', 'Comments', 'Notas', 'Nota', 'Comentarios', 'Observaciones']

const ALL_HEADER_ALIASES = [
  ...FIRST_ALIASES, ...LAST_ALIASES, ...NAME_ALIASES, ...PHONE_ALIASES, ...NOTES_ALIASES,
].map(norm)

function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (trimmed.includes(',')) {
    const [last, ...rest] = trimmed.split(',')
    return { first: rest.join(',').trim(), last: last.trim() }
  }
  const parts = trimmed.split(/\s+/)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' }
}

// A row is a header only if it names a known column AND contains no phone
// number itself. Google-Form exports and hand-made lists often have NO header
// row (first row is already a contact) — those return false here so we fall
// back to positional/content detection instead of eating the first contact.
function looksLikeHeader(row: string[]): boolean {
  const hasAlias = row.some((c) => ALL_HEADER_ALIASES.includes(norm(String(c ?? ''))))
  if (!hasAlias) return false
  const hasPhone = row.some((c) => normalizePhone(String(c ?? '')) !== null)
  return !hasPhone
}

// Header path: rows are objects keyed by the detected header names.
// Data row i is spreadsheet row i+2 (row 1 = header).
function processHeaderedRows(headers: string[], rows: Record<string, string>[]): CommunityParseResult {
  const firstCol = findColumn(headers, FIRST_ALIASES)
  const lastCol = findColumn(headers, LAST_ALIASES)
  const nameCol = findColumn(headers, NAME_ALIASES)
  const phoneCol = findColumn(headers, PHONE_ALIASES)
  const notesCol = findColumn(headers, NOTES_ALIASES)

  const contacts: ParsedCommunityContact[] = []
  const skipped: CommunityParseResult['skipped'] = []

  rows.forEach((row, i) => {
    const rowNum = i + 2

    const rawPhone = (phoneCol ? String(row[phoneCol] ?? '') : '').trim()
    if (!rawPhone) {
      skipped.push({ row: rowNum, reason: phoneCol ? 'No phone number' : 'No phone column found' })
      return
    }
    const phone = normalizePhone(rawPhone)
    if (!phone) {
      skipped.push({ row: rowNum, reason: `Invalid phone: ${rawPhone}` })
      return
    }

    let firstName = ''
    let lastName = ''
    if (firstCol) firstName = String(row[firstCol] ?? '').trim()
    if (lastCol) lastName = String(row[lastCol] ?? '').trim()
    if (!firstName && !lastName && nameCol) {
      const n = splitName(String(row[nameCol] ?? ''))
      firstName = n.first
      lastName = n.last
    }

    contacts.push({
      first_name: firstName,
      last_name: lastName,
      phone,
      notes: (notesCol ? String(row[notesCol] ?? '') : '').trim(),
    })
  })

  return { contacts, skipped, totalRows: rows.length }
}

// Headerless path: no recognizable header, so figure out which column holds
// phone numbers by scanning content (the column with the most valid phones),
// and take the name from the first other non-empty column (usually col 0).
function processHeaderless(aoa: string[][]): CommunityParseResult {
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0)

  let phoneCol = -1
  let bestCount = 0
  for (let c = 0; c < width; c++) {
    let count = 0
    for (const r of aoa) if (normalizePhone(String(r[c] ?? '')) !== null) count++
    if (count > bestCount) {
      bestCount = count
      phoneCol = c
    }
  }

  const contacts: ParsedCommunityContact[] = []
  const skipped: CommunityParseResult['skipped'] = []
  let dataRows = 0

  aoa.forEach((row, i) => {
    const rowNum = i + 1
    const hasAny = row.some((c) => String(c ?? '').trim() !== '')
    if (!hasAny) return // silently skip fully blank rows
    dataRows++

    const phone = phoneCol >= 0 ? normalizePhone(String(row[phoneCol] ?? '')) : null
    if (!phone) {
      skipped.push({ row: rowNum, reason: 'No valid phone number in row' })
      return
    }

    let nameRaw = ''
    for (let c = 0; c < width; c++) {
      if (c === phoneCol) continue
      const t = String(row[c] ?? '').trim()
      if (t) {
        nameRaw = t
        break
      }
    }
    const { first, last } = splitName(nameRaw)

    contacts.push({ first_name: first, last_name: last, phone, notes: '' })
  })

  return { contacts, skipped, totalRows: dataRows }
}

// Central dispatch: decide header vs headerless from the first non-empty row.
function parseAoa(aoa: string[][]): CommunityParseResult {
  const rows = aoa.filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
  if (rows.length === 0) return { contacts: [], skipped: [], totalRows: 0 }

  if (looksLikeHeader(rows[0])) {
    const headers = rows[0].map((h) => String(h ?? '').trim())
    const objRows = rows.slice(1).map((arr) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => { obj[h] = arr[idx] != null ? String(arr[idx]) : '' })
      return obj
    })
    return processHeaderedRows(headers, objRows)
  }

  return processHeaderless(rows)
}

// Excel path — SheetJS is dynamically imported so it only loads when someone
// actually uploads a spreadsheet (keeps the main bundle small). raw:true keeps
// phone numbers as full digit strings instead of scientific notation.
async function parseXlsx(file: File): Promise<CommunityParseResult> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { contacts: [], skipped: [], totalRows: 0 }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false })
  const rows = aoa.map((arr) => (Array.isArray(arr) ? arr.map((c) => (c != null ? String(c) : '')) : []))
  return parseAoa(rows)
}

// Accepts .csv, .xlsx, .xls, .xlsm. Header row is optional; column headers may
// be English or Spanish.
export function parseCommunityCSV(file: File): Promise<CommunityParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
    return parseXlsx(file)
  }
  return new Promise((resolve, reject) => {
    // header:false → rows come back as arrays, so parseAoa can decide whether
    // the first row is a header or already a contact.
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete(results) {
        const rows = (results.data as unknown[][]).map((r) =>
          (Array.isArray(r) ? r.map((c) => (c != null ? String(c) : '')) : []),
        )
        resolve(parseAoa(rows))
      },
      error(err) {
        reject(err)
      },
    })
  })
}
