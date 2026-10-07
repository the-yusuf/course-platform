import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateGrammarDto } from './dto/create-grammar.dto.js';
import { UpdateGrammarDto } from './dto/update-grammar.dto.js';
import { Updateable } from 'kysely';
import { Grammars } from '../database/db.types.js';

@Injectable()
export class GrammarsService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return await this.db
      .selectFrom('grammars')
      .selectAll()
      .orderBy('created_at')
      .execute();
  }

  async findOne(id: string) {
    const grammar = await this.db
      .selectFrom('grammars')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!grammar)
      throw new NotFoundException(`Grammar with this id ${id} not found`);

    return grammar;
  }

  async create(dto: CreateGrammarDto) {
    const grammar = await this.db
      .insertInto('grammars')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return grammar;
  }

  async update(id: string, dto: UpdateGrammarDto) {
    const data: Updateable<Grammars> = { updated_at: new Date() };
    if (dto.title) data.title = dto.title;
    if (dto.description) data.description = dto.description;
    if (dto.example) data.example = dto.example;
    if (dto.example_uz) data.example_uz = dto.example_uz;
    if (dto.example_ru) data.example_ru = dto.example_ru;
    if (dto.example_en) data.example_en = dto.example_en;
    if (dto.lesson_id) data.lesson_id = dto.lesson_id;

    const grammar = await this.db
      .updateTable('grammars')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return grammar;
  }

  async remove(id: string) {
    const grammar = await this.db
      .deleteFrom('grammars')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return grammar;
  }
}
