import type { Paginated, PageMeta } from '@okapi/shared';

export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  const meta: PageMeta = {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
  return { data, page: meta };
}
