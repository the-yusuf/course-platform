import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto.js';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto.js';
import { Updateable } from 'kysely';
import { DictionaryCategories } from '../database/db.types.js';

@Injectable()
export class DictionaryCategoriesService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return await this.db
      .selectFrom('dictionary_categories')
      .selectAll()
      .select((eb) => [
        eb
          .selectFrom('dictionaries')
          .select((eb) =>
            eb.cast<number>(eb.fn.countAll(), 'integer').as('count'),
          )
          .whereRef('dictionaries.category_id', '=', 'dictionary_categories.id')
          .$asScalar()
          .$notNull()
          .as('dictionaries_count'),
      ])
      .orderBy('created_at')
      .execute();
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

    const dictionaries = await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .where('category_id', '=', dictionaryCategory.id)
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
    const data: Updateable<DictionaryCategories> = { updated_at: new Date() };
    if (dto.name_uz) data.name_uz = dto.name_uz;
    if (dto.name_ru) data.name_ru = dto.name_ru;
    if (dto.name_en) data.name_en = dto.name_en;

    const dictionaryCategory = await this.db
      .updateTable('dictionary_categories')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return dictionaryCategory;
  }

  async remove(id: string) {
    const dictionaryCategory = await this.db
      .deleteFrom('dictionary_categories')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return dictionaryCategory;
  }
}
