import { Kysely } from 'kysely';
import type { DB } from './db.types.js';

export class Database extends Kysely<DB> {}
