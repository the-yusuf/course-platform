import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { CreateStoryDto } from './dto/create-story.dto.js';
import { UpdateStoryDto } from './dto/update-story.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import { StoryEntity } from './entities/story.entity.js';

@Controller('stories')
@Roles('admin')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Roles('student')
  @Get()
  @ApiPaginated(StoryEntity)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.storiesService.findAll(query);
  }

  @Roles('student')
  @Get(':id')
  @ApiEnvelope(StoryEntity)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.findOne(id);
  }

  @Post()
  @ApiEnvelope(StoryEntity, { status: 201 })
  async create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  @Patch(':id')
  @ApiEnvelope(StoryEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoryDto,
  ) {
    return this.storiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiEnvelope(StoryEntity)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.storiesService.remove(id);
  }
}
