import { hash } from 'argon2';
import type { Kysely } from 'kysely';
import type { DB } from '../db.types.js';

/**
 * Creates the first admin from ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD.
 * Safe to run again: an existing user with that username is promoted to admin
 * and keeps their current password.
 */
export async function seed(db: Kysely<DB>): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    throw new Error(
      'Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env to seed the admin user',
    );
  }
  if (!/^[a-z0-9_.]{3,32}$/.test(username)) {
    throw new Error(
      'ADMIN_USERNAME must be 3-32 characters of a-z, 0-9, _ or .',
    );
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be 8-128 characters');
  }

  await db
    .insertInto('users')
    .values({
      username,
      email,
      password_hash: await hash(password),
      role: 'admin',
    })
    .onConflict((oc) =>
      oc
        .column('username')
        .doUpdateSet({ role: 'admin', updated_at: new Date() }),
    )
    .execute();
}
