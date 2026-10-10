import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Users
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('avatar', 'text')
    .addColumn('role', 'text', (col) => col.notNull().defaultTo('student'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint('users_role_check', sql`role in ('student', 'admin')`)
    .execute();

  // Courses
  await db.schema
    .createTable('courses')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('image', 'text')
    .addColumn('price_uzs', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Lessons
  await db.schema
    .createTable('lessons')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title_uz', 'text', (col) => col.notNull())
    .addColumn('title_ru', 'text', (col) => col.notNull())
    .addColumn('title_en', 'text', (col) => col.notNull())
    .addColumn('video', 'text')
    .addColumn('course_id', 'uuid', (col) =>
      col.references('courses.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Dictionary Categories
  await db.schema
    .createTable('dictionary_categories')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name_uz', 'text', (col) => col.notNull())
    .addColumn('name_ru', 'text', (col) => col.notNull())
    .addColumn('name_en', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Dictionaries
  await db.schema
    .createTable('dictionaries')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('word_uz', 'text', (col) => col.notNull())
    .addColumn('word_ru', 'text', (col) => col.notNull())
    .addColumn('word_en', 'text', (col) => col.notNull())
    .addColumn('word_zh', 'text', (col) => col.notNull())
    .addColumn('example_uz', 'text', (col) => col.notNull())
    .addColumn('example_ru', 'text', (col) => col.notNull())
    .addColumn('example_en', 'text', (col) => col.notNull())
    .addColumn('example_zh', 'text', (col) => col.notNull())
    .addColumn('pronunciation', 'text', (col) => col.notNull())
    .addColumn('example_pronunciation', 'text', (col) => col.notNull())
    .addColumn('category_id', 'uuid', (col) =>
      col.references('dictionary_categories.id').onDelete('cascade').notNull(),
    )
    .addColumn('lesson_id', 'uuid', (col) =>
      col.references('lessons.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Reviews
  await db.schema
    .createTable('reviews')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('comment', 'text', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('course_id', 'uuid', (col) =>
      col.references('courses.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    // one review per user per course
    .addUniqueConstraint('reviews_user_course_unique', ['user_id', 'course_id'])
    .execute();

  // Grammars
  await db.schema
    .createTable('grammars')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('example', 'text', (col) => col.notNull())
    .addColumn('example_uz', 'text', (col) => col.notNull())
    .addColumn('example_ru', 'text', (col) => col.notNull())
    .addColumn('example_en', 'text', (col) => col.notNull())
    .addColumn('lesson_id', 'uuid', (col) =>
      col.references('lessons.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Stories
  await db.schema
    .createTable('stories')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('title_uz', 'text', (col) => col.notNull())
    .addColumn('title_ru', 'text', (col) => col.notNull())
    .addColumn('title_en', 'text', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('content_uz', 'text', (col) => col.notNull())
    .addColumn('content_ru', 'text', (col) => col.notNull())
    .addColumn('content_en', 'text', (col) => col.notNull())
    .addColumn('level', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'stories_level_check',
      sql`level in ('hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6')`,
    )
    .execute();

  // Enrollments
  await db.schema
    .createTable('enrollments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('course_id', 'uuid', (col) =>
      col.references('courses.id').onDelete('restrict').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('enrollments_user_course_unique', [
      'user_id',
      'course_id',
    ])
    .execute();

  // Sessions
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull().unique(),
    )
    .addColumn('refresh_token_hash', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Indexes
  await db.schema
    .createIndex('lessons_course_id_idx')
    .on('lessons')
    .column('course_id')
    .execute();
  await db.schema
    .createIndex('dictionaries_category_id_idx')
    .on('dictionaries')
    .column('category_id')
    .execute();
  await db.schema
    .createIndex('dictionaries_lesson_id_idx')
    .on('dictionaries')
    .column('lesson_id')
    .execute();
  await db.schema
    .createIndex('grammars_lesson_id_idx')
    .on('grammars')
    .column('lesson_id')
    .execute();
  await db.schema
    .createIndex('reviews_user_id_idx')
    .on('reviews')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('enrollments').execute();
  await db.schema.dropTable('stories').execute();
  await db.schema.dropTable('grammars').execute();
  await db.schema.dropTable('reviews').execute();
  await db.schema.dropTable('dictionaries').execute();
  await db.schema.dropTable('dictionary_categories').execute();
  await db.schema.dropTable('lessons').execute();
  await db.schema.dropTable('courses').execute();
  await db.schema.dropTable('users').execute();
}
