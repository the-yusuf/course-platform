import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import type { SelectQueryBuilder } from 'kysely';
import type { DB } from '../database/db.types.js';
import { Paginated } from './http/envelope.js';

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 20;
}

/**
 * Runs one page of `query` and its total count in parallel. `query` must be
 * fully ordered (end with a unique column such as id) for stable pages.
 */
export async function paginate<TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  { page, limit }: PaginationQueryDto,
): Promise<Paginated<O>> {
  const [items, count] = await Promise.all([
    query
      .limit(limit)
      .offset((page - 1) * limit)
      .execute(),
    query
      .clearSelect()
      .clearOrderBy()
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow(),
  ]);
  const total = Number(count.total);
  return new Paginated(items, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
