import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';

const pageMeta: SchemaObject = {
  type: 'object',
  required: ['total', 'page', 'limit', 'totalPages'],
  properties: {
    total: { type: 'integer', example: 42 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    totalPages: { type: 'integer', example: 3 },
  },
};

function envelope(
  status: number,
  data: SchemaObject | ReferenceObject,
  extra: Record<string, SchemaObject> = {},
): SchemaObject {
  return {
    type: 'object',
    required: ['statusCode', 'message', 'data', ...Object.keys(extra)],
    properties: {
      statusCode: { type: 'integer', example: status },
      message: { type: 'string', example: 'Success' },
      data,
      ...extra,
    },
  };
}

/** Documents `{ statusCode, message, data: Model }` (or `data: Model[]`) */
export const ApiEnvelope = (
  model: Type<unknown>,
  {
    status = 200,
    isArray = false,
  }: { status?: number; isArray?: boolean } = {},
) => {
  const ref = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      schema: envelope(status, isArray ? { type: 'array', items: ref } : ref),
    }),
  );
};

/** Documents `{ statusCode, message, data: Model[], meta }` */
export const ApiPaginated = (model: Type<unknown>) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      schema: envelope(
        200,
        { type: 'array', items: { $ref: getSchemaPath(model) } },
        { meta: pageMeta },
      ),
    }),
  );
