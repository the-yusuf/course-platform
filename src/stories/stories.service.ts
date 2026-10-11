import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateStoryDto } from './dto/create-story.dto.js';
import { UpdateStoryDto } from './dto/update-story.dto.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { definedFields } from '../common/query-helpers.js';

@Injectable()
export class StoriesService {
  constructor(private readonly db: Database) {}

  findAll(query: PaginationQueryDto) {
    return paginate(
      this.db
        .selectFrom('stories')
        .selectAll()
        .orderBy('created_at')
        .orderBy('id'),
      query,
    );
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
    const story = await this.db
      .updateTable('stories')
      .set({ ...definedFields(dto), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!story)
      throw new NotFoundException(`Story with this id ${id} not found`);

    return story;
  }

  async remove(id: string) {
    const story = await this.db
      .deleteFrom('stories')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!story)
      throw new NotFoundException(`Story with this id ${id} not found`);

    return story;
  }
}
