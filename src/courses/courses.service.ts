import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { Database } from '../database/database.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { Courses } from '../database/db.types.js';
import { Insertable, Updateable } from 'kysely';
import { IMAGE_PRESETS } from '../storage/storage.constants.js';
import { StorageService } from '../storage/storage.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
    private readonly reviews: ReviewsService,
  ) {}

  async findAll() {
    const courses = await this.db
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
    return courses.map((course) => this.present(course));
  }

  async findOne(id: string) {
    const course = await this.db
      .selectFrom('courses')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!course) throw new NotFoundException(`Course with id ${id} not found`);

    // Public outline: no video links, those are behind enrollment (GET /lessons/:id)
    const lessons = await this.db
      .selectFrom('lessons')
      .select(['id', 'title_uz', 'title_ru', 'title_en', 'created_at'])
      .where('course_id', '=', id)
      .orderBy('created_at')
      .execute();

    const reviews = await this.reviews.findByCourse(id);

    return { ...this.present(course), lessons, reviews };
  }

  async create(dto: CreateCourseDto, file?: Express.Multer.File) {
    const values: Insertable<Courses> = {
      title: dto.title.trim(),
      description: dto.description.trim(),
      price_uzs: dto.price_uzs,
    };
    const insert = (image: string | null) =>
      this.db
        .insertInto('courses')
        .values({ ...values, image })
        .returningAll()
        .executeTakeFirstOrThrow();

    const course = file
      ? await this.storage.replaceImage(
          file,
          'courses',
          IMAGE_PRESETS.course,
          null,
          insert,
        )
      : await insert(null);
    return this.present(course!); // insert() throws instead of returning nothing
  }

  async update(id: string, dto: UpdateCourseDto, file?: Express.Multer.File) {
    const data: Updateable<Courses> = { updated_at: new Date() };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined)
      data.description = dto.description.trim();
    if (dto.price_uzs !== undefined) data.price_uzs = dto.price_uzs;

    const updateWith = (extra: Updateable<Courses>) =>
      this.db
        .updateTable('courses')
        .set({ ...data, ...extra })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

    let course;
    if (file) {
      // 404 before writing anything to disk
      const current = await this.db
        .selectFrom('courses')
        .select('image')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current)
        throw new NotFoundException(`Course with id ${id} not found`);

      course = await this.storage.replaceImage(
        file,
        'courses',
        IMAGE_PRESETS.course,
        current.image,
        (image) => updateWith({ image }),
      );
    } else {
      course = await updateWith({});
    }

    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    return this.present(course);
  }

  async delete(id: string) {
    let course;
    try {
      course = await this.db
        .deleteFrom('courses')
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    } catch (err) {
      // 23001: ON DELETE RESTRICT, 23503: default NO ACTION foreign key
      if (
        err instanceof DatabaseError &&
        (err.code === '23001' || err.code === '23503')
      ) {
        throw new ConflictException(
          'Course has enrollments and cannot be deleted',
        );
      }
      throw err;
    }
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);

    await this.storage.delete(course.image);
    return { ...course, image: null }; // the file is gone, don't hand out its URL
  }

  // DB stores the storage key; clients get a URL
  private present<T extends { image: string | null }>(course: T): T {
    return { ...course, image: this.storage.url(course.image) };
  }
}
