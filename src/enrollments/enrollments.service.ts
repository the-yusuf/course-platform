import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { Database } from '../database/database.js';
import type { Kysely } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { AuthUser } from '../auth/auth.types.js';
import type { DB } from '../database/db.types.js';
import { StorageService } from '../storage/storage.service.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = await paginate(
      this.selectEnrollments()
        .orderBy('enrollments.created_at', 'desc')
        .orderBy('enrollments.id'),
      query,
    );
    return page.map((enrollment) => this.present(enrollment));
  }

  async findForUser(userId: string, query: PaginationQueryDto) {
    const page = await paginate(
      this.selectEnrollments()
        .where('enrollments.user_id', '=', userId)
        .orderBy('enrollments.created_at', 'desc')
        .orderBy('enrollments.id'),
      query,
    );
    return page.map((enrollment) => this.present(enrollment));
  }

  async findOne(id: string) {
    const enrollment = await this.selectEnrollments()
      .where('enrollments.id', '=', id)
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return this.present(enrollment);
  }

  /**
   * Pass a transaction to also lock the enrollment (FOR SHARE) until it
   * commits, so it can't be deleted while something depends on it.
   */
  async isEnrolled(userId: string, courseId: string, trx?: Kysely<DB>) {
    const enrollment = await (trx ?? this.db)
      .selectFrom('enrollments')
      .select('id')
      .where('user_id', '=', userId)
      .where('course_id', '=', courseId)
      .$if(!!trx, (qb) => qb.forShare())
      .executeTakeFirst();
    return !!enrollment;
  }

  /** Ids of the lessons a user may open: those of courses they're enrolled in */
  enrolledLessonIds(userId: string) {
    return this.db
      .selectFrom('lessons')
      .innerJoin('enrollments', 'enrollments.course_id', 'lessons.course_id')
      .select('lessons.id')
      .where('enrollments.user_id', '=', userId);
  }

  /** Content outside any lesson is free; admins can open everything */
  async canAccessLesson(user: AuthUser, lessonId: string | null) {
    if (lessonId === null || user.role === 'admin') return true;
    const lesson = await this.enrolledLessonIds(user.id)
      .where('lessons.id', '=', lessonId)
      .executeTakeFirst();
    return !!lesson;
  }

  async create(dto: CreateEnrollmentDto) {
    try {
      return await this.db
        .insertInto('enrollments')
        .values(dto)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (
        err instanceof DatabaseError &&
        err.constraint === 'enrollments_user_course_unique'
      ) {
        throw new ConflictException('User is already enrolled in this course');
      }
      throw err; // unknown user_id / course_id → 404 via PgExceptionFilter
    }
  }

  async remove(id: string) {
    const enrollment = await this.db
      .deleteFrom('enrollments')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  private selectEnrollments() {
    return this.db.selectFrom('enrollments').select((eb) => [
      'enrollments.id',
      'enrollments.created_at',
      jsonObjectFrom(
        eb
          .selectFrom('users')
          .select(['users.id', 'users.username', 'users.email', 'users.avatar'])
          .whereRef('users.id', '=', 'enrollments.user_id'),
      )
        .$notNull()
        .as('user'),
      jsonObjectFrom(
        eb
          .selectFrom('courses')
          .select([
            'courses.id',
            'courses.title',
            'courses.image',
            'courses.price_uzs',
          ])
          .whereRef('courses.id', '=', 'enrollments.course_id'),
      )
        .$notNull()
        .as('course'),
    ]);
  }

  private present<
    T extends {
      user: { avatar: string | null };
      course: { image: string | null };
    },
  >(enrollment: T): T {
    return {
      ...enrollment,
      user: this.storage.withUrl(enrollment.user, 'avatar'),
      course: this.storage.withUrl(enrollment.course, 'image'),
    };
  }
}
