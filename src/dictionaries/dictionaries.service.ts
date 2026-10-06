import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto.js';
import { CreateDictionaryDto } from './dto/create-dicionary.dto.js';
import { Updateable } from 'kysely';
import { Dictionaries } from '../database/db.types.js';

@Injectable()
export class DictionariesService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .orderBy('created_at')
      .execute();
  }

  async findOne(id: string) {
    const dictionary = await this.db
      .selectFrom('dictionaries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!dictionary)
      throw new NotFoundException(
        `The dictionary with this id ${id} not found`,
      );

    return dictionary;
  }

  async create(dto: CreateDictionaryDto) {
    const dictionary = await this.db
      .insertInto('dictionaries')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return dictionary;
  }

  async update(id: string, dto: UpdateDictionaryDto) {
    const data: Updateable<Dictionaries> = { updated_at: new Date() };
    if (dto.word_uz) data.word_uz = dto.word_uz;
    if (dto.word_ru) data.word_ru = dto.word_ru;
    if (dto.word_en) data.word_en = dto.word_en;
    if (dto.word_zh) data.word_zh = dto.word_zh;
    if (dto.example_uz) data.example_uz = dto.example_uz;
    if (dto.example_ru) data.example_ru = dto.example_ru;
    if (dto.example_en) data.example_en = dto.example_en;
    if (dto.example_zh) data.example_zh = dto.example_zh;
    if (dto.pronunciation) data.pronunciation = dto.pronunciation;
    if (dto.example_pronunciation)
      data.example_pronunciation = dto.example_pronunciation;
    if (dto.lesson_id) data.lesson_id = dto.lesson_id;
    if (dto.category_id) data.category_id = dto.category_id;

    const dictionary = await this.db
      .updateTable('dictionaries')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return dictionary;
  }

  async remove(id: string) {
    const dictionary = await this.db
      .deleteFrom('dictionaries')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return dictionary;
  }
}
