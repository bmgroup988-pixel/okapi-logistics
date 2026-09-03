import { z } from 'zod';
import { ROLE_CODES } from '@okapi/shared';

export const userCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(160),
  phone: z.string().max(32).optional().nullable(),
  locale: z.enum(['fr', 'en', 'zh']).default('fr'),
  password: z.string().min(10).max(200),
});

export const userUpdateSchema = z
  .object({
    fullName: z.string().min(1).max(160).optional(),
    phone: z.string().max(32).optional().nullable(),
    locale: z.enum(['fr', 'en', 'zh']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'aucun champ à modifier' });

export const roleAssignSchema = z
  .object({
    roleCode: z.enum(ROLE_CODES),
    scopeCountryId: z.string().uuid().optional().nullable(),
    scopeAgencyId: z.string().uuid().optional().nullable(),
  })
  .refine((d) => d.roleCode !== 'AGENT_FRET' || !!d.scopeAgencyId, {
    message: 'un agent doit être rattaché à une agence',
    path: ['scopeAgencyId'],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type RoleAssignInput = z.infer<typeof roleAssignSchema>;
