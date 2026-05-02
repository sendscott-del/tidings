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

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 10) return `+${digits}`
  return null
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const lower = candidates.map((c) => c.toLowerCase().trim())
  return headers.find((h) => lower.includes(h.toLowerCase().trim())) || null
}

export function parseCommunityCSV(file: File): Promise<CommunityParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]

        const firstCol = findColumn(headers, ['First Name', 'First', 'Given Name'])
        const lastCol = findColumn(headers, ['Last Name', 'Last', 'Surname', 'Family Name'])
        const nameCol = findColumn(headers, ['Name', 'Full Name'])
        const phoneCol = findColumn(headers, ['Phone', 'Mobile', 'Cell Phone', 'Phone Number'])
        const notesCol = findColumn(headers, ['Notes', 'Note', 'Comments'])

        const contacts: ParsedCommunityContact[] = []
        const skipped: CommunityParseResult['skipped'] = []

        rows.forEach((row, i) => {
          const rowNum = i + 2

          const rawPhone = (phoneCol ? row[phoneCol] : '').trim()
          if (!rawPhone) {
            skipped.push({ row: rowNum, reason: 'No phone number' })
            return
          }
          const phone = normalizePhone(rawPhone)
          if (!phone) {
            skipped.push({ row: rowNum, reason: `Invalid phone: ${rawPhone}` })
            return
          }

          let firstName = ''
          let lastName = ''
          if (firstCol) firstName = (row[firstCol] || '').trim()
          if (lastCol) lastName = (row[lastCol] || '').trim()
          if (!firstName && !lastName && nameCol) {
            const full = (row[nameCol] || '').trim()
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
            notes: (notesCol ? (row[notesCol] || '') : '').trim(),
          })
        })

        resolve({ contacts, skipped, totalRows: rows.length })
      },
      error(err) {
        reject(err)
      },
    })
  })
}
