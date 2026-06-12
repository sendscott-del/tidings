import Papa from 'papaparse'

export interface ParsedContact {
  first_name: string
  last_name: string
  phone: string
  email: string
  household_id: string
  unit_name: string
  age_group: string
  has_children: boolean
  melchizedek: boolean
  relief_society: boolean
  elders_quorum: boolean
  young_women: boolean
  aaronic: boolean
  primary_member: boolean
  // v0.26.0 — added for the 12-column LCR landscape report
  birth_month: number | null
  birth_day: number | null
  class_assignment: string[]
  is_endowed: boolean
  is_returned_missionary: boolean
  is_single: boolean
  priesthood: 'Aaronic' | 'Melchizedek' | 'Unordained' | null
  gender: 'M' | 'F' | null
  callings: string[]
  is_adult: boolean
}

export interface ParseResult {
  contacts: ParsedContact[]
  skipped: { row: number; reason: string; data: Record<string, string> }[]
  totalRows: number
}

// Normalize a US phone to E.164. Accept exactly 10 digits (prepend +1) or 11
// digits starting with 1 (prepend +). Anything else is invalid → null, so
// over-long typos are rejected rather than imported as sendable numbers.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
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

export function parseName(fullName: string): { first: string; last: string } {
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

const MONTH_TO_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// "29 Jan 1992" → { birth_month: 1, birth_day: 29, is_adult: true }.
// Year is parsed only to derive is_adult (18+), then discarded — never stored.
export function parseBirthDate(raw: string): { birth_month: number | null; birth_day: number | null; is_adult: boolean } {
  const trimmed = (raw || '').trim()
  if (!trimmed || trimmed === '-') return { birth_month: null, birth_day: null, is_adult: false }
  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return { birth_month: null, birth_day: null, is_adult: false }
  const day = parseInt(match[1], 10)
  const month = MONTH_TO_NUM[match[2].toLowerCase()]
  const year = parseInt(match[3], 10)
  if (!month || !day || day < 1 || day > 31) return { birth_month: null, birth_day: null, is_adult: false }

  // Compute is_adult (18+) as of today, with birthday-not-yet adjustment.
  const now = new Date()
  const ty = now.getUTCFullYear()
  const tm = now.getUTCMonth() + 1
  const td = now.getUTCDate()
  let age = ty - year
  if (month > tm || (month === tm && day > td)) age -= 1
  const is_adult = age >= 18

  return { birth_month: month, birth_day: day, is_adult }
}

// "Relief Society, New Member Gospel Doctrine(F)" → ["Relief Society", "New Member Gospel Doctrine"]
// Strips trailing (L)/(F) language suffixes; splits on commas.
export function parseClassAssignment(raw: string): string[] {
  const trimmed = (raw || '').trim()
  if (!trimmed || trimmed === '-') return []
  return trimmed
    .split(',')
    .map((s) => s.trim().replace(/\s*\([LF]\)\s*$/i, '').trim())
    .filter(Boolean)
}

export function parseYesNo(raw: string): boolean {
  const v = (raw || '').trim().toLowerCase()
  return v === 'yes' || v === 'true'
}

export function parseGender(raw: string): 'M' | 'F' | null {
  const v = (raw || '').trim().toUpperCase()
  if (v === 'M' || v === 'MALE') return 'M'
  if (v === 'F' || v === 'FEMALE') return 'F'
  return null
}

export function parsePriesthoodOffice(raw: string): 'Aaronic' | 'Melchizedek' | 'Unordained' | null {
  const v = (raw || '').trim().toLowerCase()
  if (!v) return null
  if (v.includes('aaronic')) return 'Aaronic'
  if (v.includes('melchizedek')) return 'Melchizedek'
  if (v.includes('unordained')) return 'Unordained'
  // Specific offices from LCR
  if (['deacon', 'teacher', 'priest'].some((o) => v.includes(o))) return 'Aaronic'
  if (['elder', 'high priest', 'patriarch', 'seventy', 'apostle'].some((o) => v.includes(o))) return 'Melchizedek'
  return null
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
        const nameCol = findColumn(headers, ['Preferred Name', 'PreferredName', 'Name', 'Full Name', 'Member Name'])
        const firstNameCol = findColumn(headers, ['First Name', 'Given Name', 'Preferred First Name'])
        const lastNameCol = findColumn(headers, ['Last Name', 'Surname', 'Family Name'])
        const phoneCol = findColumn(headers, ['Phone', 'Individual Phone', 'IndividualPhone', 'Mobile', 'Cell Phone', 'Phone Number'])
        const emailCol = findColumn(headers, ['Email', 'Individual Email', 'Email Address', 'E-mail'])
        const householdCol = findColumn(headers, ['Household ID', 'HouseholdID', 'Household'])
        const unitCol = findColumn(headers, ['Unit Name', 'Unit', 'Ward', 'Ward Name'])
        const ageCol = findColumn(headers, ['Age', 'Individual Age'])
        const childrenCol = findColumnContaining(headers, 'children')
        const priesthoodCol = findColumn(headers, ['Priesthood Office', 'Priesthood', 'Priesthoodoffice'])
        const orgCol = findColumn(headers, ['Organization', 'Organization Name', 'Class/Quorum'])

        // v0.26.0 — 12-column LCR landscape report
        const birthDateCol = findColumn(headers, ['Birth Date', 'BirthDate', 'Birthday'])
        const callingsCol = findColumn(headers, ['Callings', 'Calling'])
        const classAssignCol = findColumn(headers, ['Class Assignment', 'ClassAssignment'])
        const endowedCol = findColumn(headers, ['Is Endowed', 'IsEndowed', 'Endowed'])
        const returnedMissCol = findColumn(headers, ['Is Returned Missionary', 'IsReturnedMissionary', 'Returned Missionary'])
        const singleCol = findColumn(headers, ['Is Single', 'IsSingle', 'Single'])
        const genderCol = findColumn(headers, ['Gender'])

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
          const ageGroup = ageCol ? parseAge((row[ageCol] || '').trim()) : 'Adult'
          const hasChildren = childrenCol ? parseYesNo(row[childrenCol] || '') : false

          // Legacy boolean cluster (existing rebuildAutoLists still reads these)
          const priesthoodRaw = (priesthoodCol ? row[priesthoodCol] : '').trim().toLowerCase()
          const org = (orgCol ? row[orgCol] : '').trim().toLowerCase()
          const melchizedek = ['elder', 'high priest', 'patriarch', 'seventy', 'apostle'].some((p) => priesthoodRaw.includes(p))
          const aaronic = ['deacon', 'teacher', 'priest'].some((p) => priesthoodRaw.includes(p))
          const reliefSociety = org.includes('relief society')
          const eldersQuorum = org.includes('elders quorum') || org.includes("elders'")
          const youngWomen = org.includes('young women')
          const primaryMember = org.includes('primary') || ageGroup === 'Child'

          // v0.26.0 — new columns
          const { birth_month, birth_day, is_adult } = birthDateCol
            ? parseBirthDate(row[birthDateCol] || '')
            : { birth_month: null, birth_day: null, is_adult: false }
          const classAssignment = classAssignCol ? parseClassAssignment(row[classAssignCol] || '') : []
          const isEndowed = endowedCol ? parseYesNo(row[endowedCol] || '') : false
          const isReturnedMissionary = returnedMissCol ? parseYesNo(row[returnedMissCol] || '') : false
          const isSingle = singleCol ? parseYesNo(row[singleCol] || '') : false
          const gender = genderCol ? parseGender(row[genderCol] || '') : null
          const priesthood = priesthoodCol ? parsePriesthoodOffice(row[priesthoodCol] || '') : null
          const callingsRaw = (callingsCol ? row[callingsCol] : '').trim()
          const callings = callingsRaw && callingsRaw !== '-' ? [callingsRaw] : []

          contacts.push({
            first_name: firstName,
            last_name: lastName,
            phone,
            email,
            household_id: householdId,
            unit_name: unitName,
            age_group: ageGroup,
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
            is_adult,
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
