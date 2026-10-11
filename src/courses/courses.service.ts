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
import { Updateable } from 'kysely';
import { IMAGE_PRESETS } from '../storage/storage.constants.js';
import { StorageService } from '../storage/storage.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { LessonsService } from '../lessons/lessons.service.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { countOf, definedFields } from '../common/query-helpers.js';

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageService,
    private readonly reviews: ReviewsService,
    private readonly lessons: LessonsService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = await paginate(
      this.db
        .selectFrom('courses')
        .selectAll('courses')
        .select([
          countOf('lessons', 'course_id', 'courses.id').as('lessons_count'),
          countOf('reviews', 'course_id', 'courses.id').as('reviews_count'),
        ])
        .orderBy('courses.created_at')
        .orderBy('courses.id'),
      query,
    );
    return page.map((course) => this.present(course));
  }

  /** Public outline: lesson titles only; videos are behind enrollment */
  async findOne(id: string) {
    const [course, lessons, reviews] = await Promise.all([
      this.db
        .selectFrom('courses')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
      this.lessons.outline(id),
      this.reviews.findByCourse(id),
    ]);
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    return { ...this.present(course), lessons, reviews };
  }

  async create(dto: CreateCourseDto, file?: Express.Multer.File) {
    const insert = (image: string | null) =>
      this.db
        .insertInto('courses')
        .values({
          title: dto.title,
          description: dto.description,
          price_uzs: dto.price_uzs,
          image,
        })
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
    // `image` only exists on the DTO to reject it as a text field
    const { image: _image, ...fields } = definedFields(dto);
    const updateWith = (extra: Updateable<Courses>) =>
      this.db
        .updateTable('courses')
        .set({ ...fields, ...extra, updated_at: new Date() })
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

  private present<T extends { image: string | null }>(course: T): T {
    return this.storage.withUrl(course, 'image');
  }
}
