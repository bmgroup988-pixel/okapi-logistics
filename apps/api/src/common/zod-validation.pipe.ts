import { BadRequestException, PipeTransform } from '@nestjs/common';
import { API_ERROR_CODES } from '@okapi/shared';
import type { ZodSchema } from 'zod';

/**
 * Pipe de validation basé sur Zod (schémas partagés `@okapi/shared`).
 * Usage : `@Body(new ZodValidationPipe(parcelCreateSchema)) body: ParcelCreateInput`.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      error: {
        code: API_ERROR_CODES.VALIDATION,
        message: 'Requête invalide',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
    });
  }
}
