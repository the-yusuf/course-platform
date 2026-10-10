import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { Database } from '../database/database.js';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    const enrollments = await this.selectEnrollments()
      .orderBy('enrollments.created_at', 'desc')
      .execute();
    return enrollments.map((enrollment) => this.present(enrollment));
  }

  async findForUser(userId: string) {
    const enrollments = await this.selectEnrollments()
      .where('enrollments.user_id', '=', userId)
      .orderBy('enrollments.created_at', 'desc')
      .execute();
    return enrollments.map((enrollment) => this.present(enrollment));
  }

  async findOne(id: string) {
    const enrollment = await this.selectEnrollments()
      .where('enrollments.id', '=', id)
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return this.present(enrollment);
  }

  async isEnrolled(userId: string, courseId: string) {
    const enrollment = await this.db
      .selectFrom('enrollments')
      .select('id')
      .where('user_id', '=', userId)
      .where('course_id', '=', courseId)
      .executeTakeFirst();
    return !!enrollment;
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

  // DB stores storage keys; clients get URLs
  private present<
    T extends {
      user: { avatar: string | null };
      course: { image: string | null };
    },
  >(enrollment: T): T {
    return {
      ...enrollment,
      user: {
        ...enrollment.user,
        avatar: this.storage.url(enrollment.user.avatar),
      },
      course: {
        ...enrollment.course,
        image: this.storage.url(enrollment.course.image),
      },
    };
  }
}
