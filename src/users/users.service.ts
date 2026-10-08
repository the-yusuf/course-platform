import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import type { Updateable } from 'kysely';
import { DatabaseError } from 'pg';
import { Database } from '../database/database.js';
import type { Users } from '../database/db.types.js';
import { IMAGE_PRESETS } from '../storage/storage.constants.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto.js';

const publicColumns = [
  'id',
  'username',
  'email',
  'avatar',
  'role',
  'created_at',
  'updated_at',
] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    const users = await this.db
      .selectFrom('users')
      .select(publicColumns)
      .orderBy('created_at', 'desc')
      .execute();
    return users.map((user) => this.present(user));
  }

  async findOne(id: string) {
    const user = await this.db
      .selectFrom('users')
      .select(publicColumns)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return this.present(user);
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
      const user = await this.db
        .insertInto('users')
        .values({
          username: dto.username.trim(),
          email: dto.email.trim().toLowerCase(),
          password_hash,
        })
        .returning(publicColumns)
        .executeTakeFirstOrThrow();
      return this.present(user);
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async updateUserInfo(id: string, dto: UpdateUserDto) {
    const data: Updateable<Users> = { updated_at: new Date() };
    if (dto.username) data.username = dto.username.trim();
    if (dto.email) data.email = dto.email.trim().toLowerCase();

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
    return this.present(user);
  }

  async updateUserPhoto(id: string, file: Express.Multer.File) {
    const current = await this.db
      .selectFrom('users')
      .select('avatar')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new NotFoundException(`User with id ${id} not found`);

    const user = await this.storage.replaceImage(
      file,
      'users',
      IMAGE_PRESETS.avatar,
      current.avatar,
      (avatar) =>
        this.db
          .updateTable('users')
          .set({ avatar, updated_at: new Date() })
          .where('id', '=', id)
          .returning(publicColumns)
          .executeTakeFirst(),
    );
    // Also covers the user being deleted between the select and the update
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return this.present(user);
  }

  async updateUserPassword(id: string, dto: UpdateUserPasswordDto) {
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'password_hash'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    const isPasswordValid = await verify(
      user.password_hash,
      dto.current_password,
    );
    if (!isPasswordValid)
      throw new ConflictException('Current password is incorrect');

    const newPasswordHash = await hash(dto.new_password);
    const updatedUser = await this.db
      .updateTable('users')
      .set({ password_hash: newPasswordHash, updated_at: new Date() })
      .where('id', '=', id)
      .returning(publicColumns)
      .executeTakeFirst();
    return updatedUser && this.present(updatedUser);
  }

  async remove(id: string) {
    const user = await this.db
      .deleteFrom('users')
      .where('id', '=', id)
      .returning(['id', 'avatar'])
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    await this.storage.delete(user.avatar);
    return { id: user.id };
  }

  // DB stores the storage key; clients get a URL
  present<T extends { avatar: string | null }>(user: T): T {
    return { ...user, avatar: this.storage.url(user.avatar) };
  }

  private toConflict(err: unknown) {
    if (err instanceof DatabaseError && err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'Email' : 'Username';
      return new ConflictException(`${field} is already taken`);
    }
    return err;
  }
}
