import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto.js';
import { ImageUpload } from '../storage/image-upload.decorator.js';
import { parseImagePipe } from '../storage/parse-image.pipe.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import { UserEntity } from './entities/user.entity.js';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiPaginated(UserEntity)
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiEnvelope(UserEntity)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiEnvelope(UserEntity, { status: 201 })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/update-info')
  @ApiEnvelope(UserEntity)
  updateUserInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUserInfo(id, dto);
  }

  /** Admin reset: no current password needed. Logs the user out. */
  @Put(':id/update-password')
  @ApiEnvelope(UserEntity)
  updateUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    return this.usersService.updateUserPassword(id, dto);
  }

  @Put(':id/update-photo')
  @ImageUpload('avatar')
  @ApiEnvelope(UserEntity)
  updateUserPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(parseImagePipe) file: Express.Multer.File,
  ) {
    return this.usersService.updateUserPhoto(id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
