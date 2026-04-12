import Papa from 'papaparse'

export interface ParsedContact {
  first_name: string
  last_name: string
  phone: string
  email: string
  household_id: string
  unit_name: string
  sex: string
  age_group: string
  has_children: boolean
  melchizedek: boolean
  relief_society: boolean
  elders_quorum: boolean
  young_women: boolean
  aaronic: boolean
  primary_member: boolean
}

export interface ParseResult {
  contacts: ParsedContact[]
  skipped: { row: number; reason: string; data: Record<string, string> }[]
  totalRows: number
}

// Normalize phone to E.164: strip non-digits, prepend +1 if 10 digits
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 10) return `+${digits}`
  return null
}

// Find a column by matching possible names (case-insensitive)
function findColumn(headers: string[], candidates: string[]): string | null {
  const lower = candidates.map((c) => c.toLowerCase().trim())
  return headers.find((h) => lower.includes(h.toLowerCase().trim())) || null
}

// Find a column that contains a substring
function findColumnContaining(headers: string[], substring: string): string | null {
  return headers.find((h) => h.toLowerCase().includes(substring.toLowerCase())) || null
}

function parseAge(ageStr: string): string {
  const age = parseInt(ageStr, 10)
  if (isNaN(age)) return 'Adult'
  if (age < 12) return 'Child'
  if (age <= 17) return 'Youth'
  return 'Adult'
}

function parseName(fullName: string): { first: string; last: string } {
  // LCR format is typically "Last, First" or "First Last"
  if (fullName.includes(',')) {
    const [last, ...rest] = fullName.split(',')
    return { first: rest.join(',').trim(), last: last.trim() }
  }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  const last = parts.pop()!
  return { first: parts.join(' '), last }
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]

        // Map columns
        const nameCol = findColumn(headers, ['Preferred Name', 'Name', 'Full Name', 'Member Name'])
        const firstNameCol = findColumn(headers, ['First Name', 'Given Name', 'Preferred First Name'])
        const lastNameCol = findColumn(headers, ['Last Name', 'Surname', 'Family Name'])
        const phoneCol = findColumn(headers, ['Phone', 'Individual Phone', 'Mobile', 'Cell Phone', 'Phone Number'])
        const emailCol = findColumn(headers, ['Email', 'Individual Email', 'Email Address', 'E-mail'])
        const householdCol = findColumn(headers, ['Household ID', 'HouseholdID', 'Household'])
        const unitCol = findColumn(headers, ['Unit Name', 'Unit', 'Ward', 'Ward Name'])
        const sexCol = findColumn(headers, ['Sex', 'Gender'])
        const ageCol = findColumn(headers, ['Age', 'Individual Age'])
        const childrenCol = findColumnContaining(headers, 'children')
        const priesthoodCol = findColumn(headers, ['Priesthood Office', 'Priesthood'])
        const orgCol = findColumn(headers, ['Organization', 'Organization Name', 'Class/Quorum'])

        const contacts: ParsedContact[] = []
        const skipped: ParseResult['skipped'] = []

        rows.forEach((row, i) => {
          const rowNum = i + 2 // header is row 1

          // Get phone
          const rawPhone = (phoneCol ? row[phoneCol] : '').trim()
          if (!rawPhone) {
            skipped.push({ row: rowNum, reason: 'No phone number', data: row })
            return
          }
          const phone = normalizePhone(rawPhone)
          if (!phone) {
            skipped.push({ row: rowNum, reason: `Invalid phone: ${rawPhone}`, data: row })
            return
          }

          // Get name
          let firstName = ''
          let lastName = ''
          if (firstNameCol && lastNameCol) {
            firstName = (row[firstNameCol] || '').trim()
            lastName = (row[lastNameCol] || '').trim()
          } else if (nameCol) {
            const parsed = parseName((row[nameCol] || '').trim())
            firstName = parsed.first
            lastName = parsed.last
          }

          if (!firstName && !lastName) {
            skipped.push({ row: rowNum, reason: 'No name', data: row })
            return
          }

          const email = (emailCol ? row[emailCol] : '').trim()
          const householdId = (householdCol ? row[householdCol] : '').trim()
          const unitName = (unitCol ? row[unitCol] : '').trim()
          const sex = (sexCol ? row[sexCol] : '').trim()
          const ageGroup = ageCol ? parseAge((row[ageCol] || '').trim()) : 'Adult'
          const hasChildren = childrenCol ? (row[childrenCol] || '').trim().toLowerCase() === 'yes' || (row[childrenCol] || '').trim() === 'true' : false

          // Priesthood / organization detection
          const priesthood = (priesthoodCol ? row[priesthoodCol] : '').trim().toLowerCase()
          const org = (orgCol ? row[orgCol] : '').trim().toLowerCase()

          const melchizedek = ['elder', 'high priest', 'patriarch', 'seventy', 'apostle'].some(
            (p) => priesthood.includes(p)
          )
          const aaronic = ['deacon', 'teacher', 'priest'].some((p) => priesthood.includes(p))
          const reliefSociety = org.includes('relief society')
          const eldersQuorum = org.includes('elders quorum') || org.includes("elders'")
          const youngWomen = org.includes('young women')
          const primaryMember = org.includes('primary') || ageGroup === 'Child'

          contacts.push({
            first_name: firstName,
            last_name: lastName,
            phone,
            email,
            household_id: householdId,
            unit_name: unitName,
            sex,
            age_group: ageGroup,
            has_children: hasChildren,
            melchizedek,
            relief_society: reliefSociety,
            elders_quorum: eldersQuorum,
            young_women: youngWomen,
            aaronic,
            primary_member: primaryMember,
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
