import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateStoryDto } from './dto/create-story.dto.js';
import { UpdateStoryDto } from './dto/update-story.dto.js';
import { Updateable } from 'kysely';
import { Stories } from '../database/db.types.js';

@Injectable()
export class StoriesService {
  constructor(private readonly db: Database) {}

  async findAll() {
    return await this.db
      .selectFrom('stories')
      .selectAll()
      .orderBy('created_at')
      .execute();
  }

  async findOne(id: string) {
    const story = await this.db
      .selectFrom('stories')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!story)
      throw new NotFoundException(`Story with this id ${id} not found`);

    return story;
  }

  async create(dto: CreateStoryDto) {
    const story = await this.db
      .insertInto('stories')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return story;
  }

  async update(id: string, dto: UpdateStoryDto) {
    const data: Updateable<Stories> = { updated_at: new Date() };

    if (dto.title) data.title = dto.title;
    if (dto.title_uz) data.title_uz = dto.title_uz;
    if (dto.title_ru) data.title_ru = dto.title_ru;
    if (dto.title_en) data.title_en = dto.title_en;
    if (dto.content) data.content = dto.content;
    if (dto.content_uz) data.content_uz = dto.content_uz;
    if (dto.content_ru) data.content_ru = dto.content_ru;
    if (dto.content_en) data.content_en = dto.content_en;
    if (dto.level) data.level = dto.level;

    const story = await this.db
      .updateTable('stories')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return story;
  }

  async remove(id: string) {
    const story = await this.db
      .deleteFrom('stories')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return story;
  }
}
