import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { Database } from '../database/database.js';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly db: Database) {}
  async findAll() {
    return await this.db.selectFrom('enrollments').selectAll().execute();
  }

  async findOne(id: string) {
    const enrollment = await this.db
      .selectFrom('enrollments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!enrollment)
      throw new NotFoundException(`Enrollment with this id ${id} not found`);

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
}
