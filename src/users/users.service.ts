import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { DatabaseError } from 'pg';
import { Database } from '../database/database.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { definedFields } from '../common/query-helpers.js';
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

  async findAll(query: PaginationQueryDto) {
    const page = await paginate(
      this.db
        .selectFrom('users')
        .select(publicColumns)
        .orderBy('created_at', 'desc')
        .orderBy('id'),
      query,
    );
    return page.map((user) => this.present(user));
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

  // No 404 here: login must not reveal which usernames exist
  findByUsername(username: string) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
  }

  async create(dto: CreateUserDto) {
    const password_hash = await hash(dto.password);
    try {
      const user = await this.db
        .insertInto('users')
        // the DTO already trimmed + lowercased both (and the DB checks it)
        .values({ username: dto.username, email: dto.email, password_hash })
        .returning(publicColumns)
        .executeTakeFirstOrThrow();
      return this.present(user);
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async updateUserInfo(id: string, dto: UpdateUserDto) {
    let user;
    try {
      user = await this.db
        .updateTable('users')
        .set({ ...definedFields(dto), updated_at: new Date() })
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

  /** Admin reset: no current password needed */
  updateUserPassword(id: string, dto: UpdateUserPasswordDto) {
    return this.setPassword(id, dto.new_password);
  }

  /** Changes the password and ends the user's session, atomically */
  async setPassword(id: string, newPassword: string) {
    const password_hash = await hash(newPassword);
    const user = await this.db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('users')
        .set({ password_hash, updated_at: new Date() })
        .where('id', '=', id)
        .returning(publicColumns)
        .executeTakeFirst();
      if (updated) {
        await trx.deleteFrom('sessions').where('user_id', '=', id).execute();
      }
      return updated;
    });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return this.present(user);
  }

  async verifyPassword(id: string, password: string) {
    const user = await this.db
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', id)
      .executeTakeFirst();
    return !!user && (await verify(user.password_hash, password));
  }

  async remove(id: string) {
    const user = await this.db
      .deleteFrom('users')
      .where('id', '=', id)
      .returning(['id', 'avatar'])
      .executeTakeFirst();
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    await this.storage.delete(user.avatar);
  }

  present<T extends { avatar: string | null }>(user: T): T {
    return this.storage.withUrl(user, 'avatar');
  }

  private toConflict(err: unknown) {
    if (err instanceof DatabaseError && err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'Email' : 'Username';
      return new ConflictException(`${field} is already taken`);
    }
    return err;
  }
}
