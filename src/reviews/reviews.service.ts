import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { Updateable } from 'kysely';
import { Reviews } from '../database/db.types.js';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: Database) {}

  findAll() {
    return this.selectReviews().orderBy('reviews.created_at', 'desc').execute();
  }

  async findOne(id: string) {
    const review = await this.selectReviews()
      .where('reviews.id', '=', id)
      .executeTakeFirst();
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async create(dto: CreateReviewDto) {
    const review = await this.db
      .insertInto('reviews')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return review;
  }

  async update(id: string, dto: UpdateReviewDto) {
    const data: Updateable<Reviews> = { updated_at: new Date() };

    if (dto.comment) data.comment = dto.comment;
    if (dto.user_id) data.user_id = dto.user_id;
    if (dto.course_id) data.course_id = dto.course_id;

    const review = await this.db
      .updateTable('reviews')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return review;
  }

  async remove(id: string) {
    const review = await this.db
      .deleteFrom('reviews')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return review;
  }

  private selectReviews() {
    return this.db.selectFrom('reviews').select((eb) => [
      'reviews.id',
      'reviews.comment',
      'reviews.created_at',
      jsonObjectFrom(
        eb
          .selectFrom('users')
          .select(['users.id', 'users.username', 'users.avatar'])
          .whereRef('users.id', '=', 'reviews.user_id'),
      )
        .$notNull()
        .as('user'),
      jsonObjectFrom(
        eb
          .selectFrom('courses')
          .select(['courses.id', 'courses.title'])
          .whereRef('courses.id', '=', 'reviews.course_id'),
      )
        .$notNull()
        .as('course'),
    ]);
  }
}
