import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto.js';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto.js';
import { sql } from 'kysely';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { countOf, definedFields } from '../common/query-helpers.js';

@Injectable()
export class DictionaryCategoriesService {
  constructor(private readonly db: Database) {}

  findAll(query: PaginationQueryDto) {
    return paginate(
      this.db
        .selectFrom('dictionary_categories')
        .selectAll()
        .select(
          // public: free words only
          countOf(
            'dictionaries',
            'category_id',
            'dictionary_categories.id',
            sql`dictionaries.lesson_id is null`,
          ).as('dictionaries_count'),
        )
        .orderBy('created_at')
        .orderBy('id'),
      query,
    );
  }

  async findOne(id: string) {
    const dictionaryCategory = await this.db
      .selectFrom('dictionary_categories')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!dictionaryCategory)
      throw new NotFoundException(
        `Dictionary category with this ${id} not found`,
      );

    // public endpoint: words that belong to a lesson are for enrolled students
    const dictionaries = await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .where('category_id', '=', dictionaryCategory.id)
      .where('lesson_id', 'is', null)
      .orderBy('created_at')
      .execute();

    return { ...dictionaryCategory, dictionaries };
  }

  async create(dto: CreateDictionaryCategoryDto) {
    const dictionaryCategory = await this.db
      .insertInto('dictionary_categories')
      .values(dto)
      .returningAll()
      .executeTakeFirst();
    return dictionaryCategory;
  }

  async update(id: string, dto: UpdateDictionaryCategoryDto) {
    const dictionaryCategory = await this.db
      .updateTable('dictionary_categories')
      .set({ ...definedFields(dto), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!dictionaryCategory)
      throw new NotFoundException(
        `Dictionary category with this ${id} not found`,
      );
    return dictionaryCategory;
  }

  async remove(id: string) {
    const dictionaryCategory = await this.db
      .deleteFrom('dictionary_categories')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!dictionaryCategory)
      throw new NotFoundException(
        `Dictionary category with this ${id} not found`,
      );
    return dictionaryCategory;
  }
}
