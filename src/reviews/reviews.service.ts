import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { Updateable } from 'kysely';
import { Reviews } from '../database/db.types.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return await this.db
      .selectFrom('reviews')
      .selectAll()
      .orderBy('created_at')
      .execute();
  }

  async findOne(id: string) {
    const review = await this.db
      .selectFrom('reviews')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!review)
      throw new NotFoundException(`Review with that id ${id} not found`);

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
}
