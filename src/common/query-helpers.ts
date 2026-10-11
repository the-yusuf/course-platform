import { sql, type RawBuilder } from 'kysely';

/** The fields a PATCH body actually sent (`undefined` = not sent; `null` is kept) */
export function definedFields<T extends object>(dto: T) {
  return Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

/**
 * Correlated count for list endpoints, e.g. a course's lessons:
 * countOf('lessons', 'course_id', 'courses.id').as('lessons_count')
 */
export function countOf(
  table: string,
  column: string,
  parentRef: string,
  extraCondition?: RawBuilder<unknown>,
) {
  const extra = extraCondition ? sql` and ${extraCondition}` : sql``;
  return sql<number>`(select count(*)::int from ${sql.table(table)} where ${sql.ref(`${table}.${column}`)} = ${sql.ref(parentRef)}${extra})`;
}
