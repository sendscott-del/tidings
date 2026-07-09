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
const NAME_ALIASES = ['Name', 'Full Name', 'Nombre Completo']
const PHONE_ALIASES = ['Phone', 'Mobile', 'Cell Phone', 'Phone Number', 'Cell', 'Phone #', 'Telefono', 'Celular', 'Numero', 'Numero de Telefono', 'Tel', 'Cel', 'Movil']
const NOTES_ALIASES = ['Notes', 'Note', 'Comments', 'Notas', 'Nota', 'Comentarios', 'Observaciones']

// Shared logic for CSV and Excel: both arrive as a header list + row objects
// keyed by those headers. Data row i is spreadsheet row i+2 (row 1 = header).
function processRows(headers: string[], rows: Record<string, string>[]): CommunityParseResult {
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
      const full = String(row[nameCol] ?? '').trim()
      if (full.includes(',')) {
        const [last, ...rest] = full.split(',')
        lastName = last.trim()
        firstName = rest.join(',').trim()
      } else {
        const parts = full.split(/\s+/)
        firstName = parts[0] || ''
        lastName = parts.slice(1).join(' ') || ''
      }
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
  const headerRow = (aoa[0] || []).map((h) => String(h ?? '').trim())
  const rows = aoa.slice(1).map((arr) => {
    const obj: Record<string, string> = {}
    headerRow.forEach((h, idx) => { obj[h] = arr[idx] != null ? String(arr[idx]) : '' })
    return obj
  })
  return processRows(headerRow, rows)
}

// Accepts .csv, .xlsx, .xls, .xlsm. Column headers may be English or Spanish.
export function parseCommunityCSV(file: File): Promise<CommunityParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
    return parseXlsx(file)
  }
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]
        resolve(processRows(headers, rows))
      },
      error(err) {
        reject(err)
      },
    })
  })
}
