import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { Courses } from '../database/db.types.js';
import { Updateable } from 'kysely';

@Injectable()
export class CoursesService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return this.db
      .selectFrom('courses')
      .selectAll('courses')
      .select((eb) => [
        eb
          .selectFrom('lessons')
          .select((eb) =>
            eb.cast<number>(eb.fn.countAll(), 'integer').as('count'),
          )
          .whereRef('lessons.course_id', '=', 'courses.id')
          .$asScalar()
          .$notNull()
          .as('lessons_count'),
        eb
          .selectFrom('reviews')
          .select((eb) =>
            eb.cast<number>(eb.fn.countAll(), 'integer').as('count'),
          )
          .whereRef('reviews.course_id', '=', 'courses.id')
          .$asScalar()
          .$notNull()
          .as('reviews_count'),
      ])
      .orderBy('courses.created_at')
      .execute();
  }

  async findOne(id: string) {
    const course = await this.db
      .selectFrom('courses')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!course) throw new NotFoundException(`Course with id ${id} not found`);

    const lessons = await this.db
      .selectFrom('lessons')
      .selectAll()
      .where('course_id', '=', id)
      .execute();

    const reviews = await this.db
      .selectFrom('reviews')
      .selectAll()
      .where('course_id', '=', id)
      .execute();

    return { ...course, lessons, reviews };
  }

  async create(dto: CreateCourseDto) {
    const course = await this.db
      .insertInto('courses')
      .values(dto)
      .returningAll()
      .executeTakeFirst();
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const data: Updateable<Courses> = { updated_at: new Date() };
    if (dto.title) data.title = dto.title.trim();
    if (dto.price_uzs) data.price_uzs = dto.price_uzs;

    const course = await this.db
      .updateTable('courses')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return course;
  }

  async delete(id: string) {
    const course = await this.db
      .deleteFrom('courses')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return course;
  }
}
