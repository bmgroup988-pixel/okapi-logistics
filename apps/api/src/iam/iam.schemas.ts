import { z } from 'zod';
import { ROLE_CODES, localeSchema } from '@okapi/shared';

export const userCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(160),
  phone: z.string().max(32).optional().nullable(),
  locale: localeSchema.default('fr'),
  password: z.string().min(10).max(200),
});

export const userUpdateSchema = z
  .object({
    fullName: z.string().min(1).max(160).optional(),
    phone: z.string().max(32).optional().nullable(),
    locale: localeSchema.optional(),
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
  })
  .refine((d) => d.roleCode !== 'FOURNISSEUR', {
    // Un compte FOURNISSEUR doit toujours être scopé à un fournisseur
    // (scopeSupplierId) — passer par POST /admin/suppliers/:id/activate-portal,
    // pas par cette attribution de rôle générique (docs/11 §5).
    message: 'Le rôle FOURNISSEUR se crée via l’activation du portail fournisseur',
    path: ['roleCode'],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type RoleAssignInput = z.infer<typeof roleAssignSchema>;
