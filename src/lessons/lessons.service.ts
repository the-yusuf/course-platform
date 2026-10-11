import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { sql, type Kysely } from 'kysely';
import type { DB } from '../database/db.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { countOf, definedFields } from '../common/query-helpers.js';

const OUTLINE_COLUMNS = [
  'id',
  'title_uz',
  'title_ru',
  'title_en',
  'position',
  'created_at',
] as const;

@Injectable()
export class LessonsService {
  constructor(
    private readonly db: Database,
    private readonly enrollments: EnrollmentsService,
  ) {}

  findAll(query: PaginationQueryDto) {
    return paginate(
      this.db
        .selectFrom('lessons')
        .selectAll('lessons')
        .select([
          countOf('dictionaries', 'lesson_id', 'lessons.id').as(
            'dictionaries_count',
          ),
          countOf('grammars', 'lesson_id', 'lessons.id').as('grammars_count'),
        ])
        .orderBy('lessons.course_id')
        .orderBy('lessons.position')
        .orderBy('lessons.id'),
      query,
    );
  }

  /** A course's lessons in order, without video links (safe to show publicly) */
  outline(courseId: string, db: Kysely<DB> = this.db) {
    return db
      .selectFrom('lessons')
      .select(OUTLINE_COLUMNS)
      .where('course_id', '=', courseId)
      .orderBy('position')
      .orderBy('created_at')
      .execute();
  }

  async findOne(id: string, user: AuthUser) {
    const lesson = await this.db
      .selectFrom('lessons')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);

    const [allowed, dictionaries, grammars] = await Promise.all([
      this.enrollments.canAccessLesson(user, lesson.id),
      this.db
        .selectFrom('dictionaries')
        .selectAll()
        .where('lesson_id', '=', id)
        .orderBy('created_at')
        .execute(),
      this.db
        .selectFrom('grammars')
        .selectAll()
        .where('lesson_id', '=', id)
        .orderBy('created_at')
        .execute(),
    ]);
    if (!allowed)
      throw new ForbiddenException('You must be enrolled in this course');

    return { ...lesson, dictionaries, grammars };
  }

  async create(dto: CreateLessonDto) {
    const lesson = await this.db
      .insertInto('lessons')
      .values({
        title_uz: dto.title_uz,
        title_ru: dto.title_ru,
        title_en: dto.title_en,
        video: dto.video || null,
        course_id: dto.course_id,
        position: this.nextPosition(dto.course_id), // new lessons go last
      })
      .returningAll()
      .executeTakeFirst();
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto) {
    const { video, course_id: newCourseId, ...fields } = definedFields(dto);

    const lesson = await this.db
      .updateTable('lessons')
      .set({ ...fields, updated_at: new Date() })
      .$if(video !== undefined, (qb) => qb.set({ video: video || null })) // "" or null clears it
      // moved to another course: append it there; same course: keep its place
      .$if(newCourseId !== undefined, (qb) =>
        qb.set({
          course_id: newCourseId!,
          position: sql<number>`case when course_id = ${newCourseId} then position else ${this.nextPosition(newCourseId!)} end`,
        }),
      )
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    return lesson;
  }

  /** Sets the order of a course's lessons; `lessonIds` must list every one of them */
  async reorder(courseId: string, lessonIds: string[]) {
    return this.db.transaction().execute(async (trx) => {
      // lock the course so lessons can't be added/moved while reordering
      const course = await trx
        .selectFrom('courses')
        .select('id')
        .where('id', '=', courseId)
        .forUpdate()
        .executeTakeFirst();
      if (!course)
        throw new NotFoundException(`Course with id ${courseId} not found`);

      const current = await trx
        .selectFrom('lessons')
        .select('id')
        .where('course_id', '=', courseId)
        .execute();
      const currentIds = new Set(current.map((lesson) => lesson.id));
      if (
        lessonIds.length !== currentIds.size ||
        !lessonIds.every((lessonId) => currentIds.has(lessonId))
      ) {
        throw new BadRequestException(
          'lesson_ids must list every lesson of the course exactly once',
        );
      }

      if (lessonIds.length > 0) {
        await trx
          .updateTable('lessons')
          .set({
            position: sql<number>`array_position(${lessonIds}::uuid[], id)`,
            updated_at: new Date(),
          })
          .where('course_id', '=', courseId)
          .execute();
      }
      return this.outline(courseId, trx);
    });
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

  private nextPosition(courseId: string) {
    return sql<number>`(select coalesce(max(position), 0) + 1 from lessons where course_id = ${courseId})`;
  }
}
