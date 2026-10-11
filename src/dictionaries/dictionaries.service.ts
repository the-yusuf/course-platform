import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto.js';
import { CreateDictionaryDto } from './dto/create-dicionary.dto.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { definedFields } from '../common/query-helpers.js';
import type { AuthUser } from '../auth/auth.types.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';

@Injectable()
export class DictionariesService {
  constructor(
    private readonly db: Database,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /** Students see free words plus those of lessons they're enrolled in */
  findAll(user: AuthUser, query: PaginationQueryDto) {
    const list = this.db
      .selectFrom('dictionaries')
      .selectAll()
      .$if(user.role !== 'admin', (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('lesson_id', 'is', null),
            eb('lesson_id', 'in', this.enrollments.enrolledLessonIds(user.id)),
          ]),
        ),
      )
      .orderBy('created_at')
      .orderBy('id');
    return paginate(list, query);
  }

  async findOne(id: string, user: AuthUser) {
    const dictionary = await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!dictionary)
      throw new NotFoundException(
        `The dictionary with this id ${id} not found`,
      );
    if (!(await this.enrollments.canAccessLesson(user, dictionary.lesson_id)))
      throw new ForbiddenException('You must be enrolled in this course');

    return dictionary;
  }

  async create(dto: CreateDictionaryDto) {
    const dictionary = await this.db
      .insertInto('dictionaries')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return dictionary;
  }

  async update(id: string, dto: UpdateDictionaryDto) {
    const dictionary = await this.db
      .updateTable('dictionaries')
      .set({ ...definedFields(dto), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!dictionary)
      throw new NotFoundException(
        `The dictionary with this id ${id} not found`,
      );

    return dictionary;
  }

  async remove(id: string) {
    const dictionary = await this.db
      .deleteFrom('dictionaries')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!dictionary)
      throw new NotFoundException(
        `The dictionary with this id ${id} not found`,
      );

    return dictionary;
  }
}
