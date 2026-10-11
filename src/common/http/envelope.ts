export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Returned by list endpoints; the envelope puts `items` in `data` and adds `meta` */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  map<U>(fn: (item: T) => U): Paginated<U> {
    return new Paginated(this.items.map(fn), this.meta);
  }
}

export interface SuccessEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  error: string;
  data: null;
}
