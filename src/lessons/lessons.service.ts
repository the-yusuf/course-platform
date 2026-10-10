import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { Updateable } from 'kysely';
import { Lessons } from '../database/db.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';

@Injectable()
export class LessonsService {
  constructor(
    private readonly db: Database,
    private readonly enrollments: EnrollmentsService,
  ) {}

  async findAll() {
    return this.db
      .selectFrom('lessons')
      .selectAll('lessons')
      .select((eb) => [
        eb
          .selectFrom('dictionaries')
          .select((eb) =>
            eb.cast<number>(eb.fn.countAll(), 'integer').as('count'),
          )
          .whereRef('dictionaries.lesson_id', '=', 'lessons.id')
          .$asScalar()
          .$notNull()
          .as('dictionaries_count'),
        eb
          .selectFrom('grammars')
          .select((eb) =>
            eb.cast<number>(eb.fn.countAll(), 'integer').as('count'),
          )
          .whereRef('grammars.lesson_id', '=', 'lessons.id')
          .$asScalar()
          .$notNull()
          .as('grammars_count'),
      ])
      .orderBy('lessons.created_at')
      .execute();
  }

  async findOne(id: string, user: AuthUser) {
    const lesson = await this.db
      .selectFrom('lessons')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    if (
      user.role !== 'admin' &&
      !(await this.enrollments.isEnrolled(user.id, lesson.course_id))
    ) {
      throw new ForbiddenException('You must be enrolled in this course');
    }

    const dictionaries = await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .where('lesson_id', '=', id)
      .execute();

    const grammars = await this.db
      .selectFrom('grammars')
      .selectAll()
      .where('lesson_id', '=', id)
      .execute();

    return { ...lesson, dictionaries, grammars };
  }

  async create(dto: CreateLessonDto) {
    const lesson = await this.db
      .insertInto('lessons')
      .values(dto)
      .returningAll()
      .executeTakeFirst();
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto) {
    const data: Updateable<Lessons> = { updated_at: new Date() };
    if (dto.title_uz !== undefined) data.title_uz = dto.title_uz;
    if (dto.title_ru !== undefined) data.title_ru = dto.title_ru;
    if (dto.title_en !== undefined) data.title_en = dto.title_en;
    if (dto.video !== undefined) data.video = dto.video || null; // "" or null clears it
    if (dto.course_id !== undefined) data.course_id = dto.course_id;

    const lesson = await this.db
      .updateTable('lessons')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    return lesson;
  }

  async delete(id: string) {
    const lesson = await this.db
      .deleteFrom('lessons')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    return lesson;
  }
}
