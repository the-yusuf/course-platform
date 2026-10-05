import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';
import type { Updateable } from 'kysely';
import { DatabaseError } from 'pg';
import { Database } from '../database/database.js';
import type { Users } from '../database/db.types.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const publicColumns = [
  'id',
  'username',
  'email',
  'avatar_path',
  'role',
  'created_at',
  'updated_at',
] as const;

@Injectable()
export class UsersService {
  constructor(private readonly db: Database) {}

  findAll() {
    return this.db
      .selectFrom('users')
      .select(publicColumns)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async findOne(id: string) {
    const user = await this.db
      .selectFrom('users')
      .select(publicColumns)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
    if (!user)
      throw new NotFoundException(`User with username ${username} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const password_hash = await hash(dto.password);
    try {
      return await this.db
        .insertInto('users')
        .values({
          username: dto.username.trim(),
          email: dto.email.trim().toLowerCase(),
          password_hash,
        })
        .returning(publicColumns)
        .executeTakeFirstOrThrow();
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Updateable<Users> = { updated_at: new Date() };
    if (dto.username) data.username = dto.username.trim();
    if (dto.email) data.email = dto.email.trim().toLowerCase();
    if (dto.password) data.password_hash = await hash(dto.password);

    let user;
    try {
      user = await this.db
        .updateTable('users')
        .set(data)
        .where('id', '=', id)
        .returning(publicColumns)
        .executeTakeFirst();
    } catch (err) {
      throw this.toConflict(err);
    }
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  async remove(id: string) {
    const user = await this.db
      .deleteFrom('users')
      .where('id', '=', id)
      .returning(['id'])
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  private toConflict(err: unknown) {
    if (err instanceof DatabaseError && err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'Email' : 'Username';
      return new ConflictException(`${field} is already taken`);
    }
    return err;
  }
}
