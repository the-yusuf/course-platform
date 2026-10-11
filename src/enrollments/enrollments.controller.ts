import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import {
  EnrollmentEntity,
  EnrollmentViewEntity,
} from './entities/enrollment.entity.js';

@Controller('enrollments')
@Roles('admin')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @ApiPaginated(EnrollmentViewEntity)
  findAll(@Query() query: PaginationQueryDto) {
    return this.enrollmentsService.findAll(query);
  }

  /** The caller's own enrollments ("my courses"). Declared before ':id'. */
  @Roles('student')
  @Get('me')
  @ApiPaginated(EnrollmentViewEntity)
  findMine(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.enrollmentsService.findForUser(user.id, query);
  }

  @Get(':id')
  @ApiEnvelope(EnrollmentViewEntity)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Post()
  @ApiEnvelope(EnrollmentEntity, { status: 201 })
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  @Delete(':id')
  @ApiEnvelope(EnrollmentEntity)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentsService.remove(id);
  }
}
