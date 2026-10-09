import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { Database } from '../database/database.js';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly db: Database) {}

  findAll() {
    return this.selectEnrollments()
      .orderBy('enrollments.created_at', 'desc')
      .execute();
  }

  async findOne(id: string) {
    const enrollment = await this.selectEnrollments()
      .where('enrollments.id', '=', id)
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  async create(dto: CreateEnrollmentDto) {
    const enrollment = await this.db
      .insertInto('enrollments')
      .values(dto)
      .returningAll()
      .executeTakeFirst();
    return enrollment;
  }

  async remove(id: string) {
    const enrollment = await this.db
      .deleteFrom('enrollments')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
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
          .select(['courses.id', 'courses.title', 'courses.price_uzs'])
          .whereRef('courses.id', '=', 'enrollments.course_id'),
      )
        .$notNull()
        .as('course'),
    ]);
  }
}
