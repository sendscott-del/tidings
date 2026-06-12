import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase's PostgREST caps a single request at 1000 rows by default.
// fetchAll pages through all rows by re-invoking the factory with .range().
// Range pagination needs a stable sort or pages can overlap/skip across the
// 1000-row boundary, so we always apply an ORDER BY. `orderColumn` defaults to
// 'id'; callers whose table lacks an `id` column can pass a different column.
export async function fetchAll<T>(
  queryFactory: () => any,
  pageSize = 1000,
  orderColumn = 'id'
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await queryFactory()
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
