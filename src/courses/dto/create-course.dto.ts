import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmpty,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  // Multipart fields arrive as strings. Empty strings are left as-is so they
  // fail @IsInt instead of silently becoming 0.
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  )
  @IsInt()
  @Min(0)
  @Max(2_147_483_647) // Postgres `integer`
  price_uzs: number;

  // Documents the multipart file for Swagger. Multer puts the file in
  // @UploadedFile(), never in the body, so a body value here was sent as text.
  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'JPEG, PNG or WebP, max 5 MB',
  })
  @IsOptional()
  @IsEmpty({ message: 'image must be uploaded as a file' })
  image?: unknown;
}
