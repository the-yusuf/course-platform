import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { Database } from '../database/database.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { Updateable } from 'kysely';
import { Reviews } from '../database/db.types.js';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import type { AuthUser } from '../auth/auth.types.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: Database,
    private readonly enrollments: EnrollmentsService,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    const reviews = await this.selectReviews()
      .orderBy('reviews.created_at', 'desc')
      .execute();
    return reviews.map((review) => this.present(review));
  }

  async findByCourse(courseId: string) {
    const reviews = await this.selectReviews()
      .where('reviews.course_id', '=', courseId)
      .orderBy('reviews.created_at', 'desc')
      .execute();
    return reviews.map((review) => this.present(review));
  }

  async findOne(id: string) {
    const review = await this.selectReviews()
      .where('reviews.id', '=', id)
      .executeTakeFirst();
    if (!review) throw new NotFoundException('Review not found');
    return this.present(review);
  }

  async create(user: AuthUser, dto: CreateReviewDto) {
    const course = await this.db
      .selectFrom('courses')
      .select('id')
      .where('id', '=', dto.course_id)
      .executeTakeFirst();
    if (!course)
      throw new NotFoundException(`Course with id ${dto.course_id} not found`);

    if (
      user.role !== 'admin' &&
      !(await this.enrollments.isEnrolled(user.id, dto.course_id))
    ) {
      throw new ForbiddenException(
        'You must be enrolled in this course to review it',
      );
    }

    try {
      return await this.db
        .insertInto('reviews')
        .values({
          comment: dto.comment,
          course_id: dto.course_id,
          user_id: user.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (
        err instanceof DatabaseError &&
        err.constraint === 'reviews_user_course_unique'
      ) {
        throw new ConflictException('You have already reviewed this course');
      }
      throw err;
    }
  }

  async update(id: string, user: AuthUser, dto: UpdateReviewDto) {
    const existing = await this.db
      .selectFrom('reviews')
      .select('user_id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!existing) throw new NotFoundException('Review not found');
    if (existing.user_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only edit your own review');
    }

    const data: Updateable<Reviews> = { updated_at: new Date() };
    if (dto.comment !== undefined) data.comment = dto.comment;

    const review = await this.db
      .updateTable('reviews')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  async remove(id: string) {
    const review = await this.db
      .deleteFrom('reviews')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!review) throw new NotFoundException('Review not found');
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

  // DB stores the storage key; clients get a URL
  private present<T extends { user: { avatar: string | null } }>(review: T): T {
    return {
      ...review,
      user: { ...review.user, avatar: this.storage.url(review.user.avatar) },
    };
  }
}
