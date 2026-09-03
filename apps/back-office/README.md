# @okapi/back-office — back-office agents & administration

React 19 + Vite 6 + TanStack Query + React Router. Multilingue fr / en / zh.

```bash
npm run dev --workspace @okapi/back-office   # http://localhost:5173  (proxy /api -> :3000)
```

Variables : `VITE_API_BASE` (défaut `/api/v1`), `VITE_API_TARGET` (cible du proxy dev).

## Écrans (référence wireframes livrable 4)

| Route | Écran | Permission |
|-------|-------|-----------|
| `/` | Tableau de bord agence (W-AGT-01) — KPIs, derniers colis | — |
| `/parcels` | Liste filtrée (W-AGT-06) | `parcel:read` |
| `/parcels/new` | Enregistrement en 3 étapes (W-AGT-02/03/04/05) : parties & trajet + aperçu prix live, **photo obligatoire** (presign S3 + SHA-256), confirmation | `parcel:create` |
| `/parcels/:id` | Fiche colis (W-AGT-07/08/10/11) : onglets Suivi / Paiements / Photos / Documents, **modale encaissement** (W-AGT-09), **modale changement de statut** (W-AGT-12) | `parcel:read` |
| `/reports` | Impayés & retards (W-ADM-03) | `report:read` |
| `/tariffs` | Prix par kg par destination (W-ADM-04) | `tariff:read` / `tariff:write` |
| `/exchange-rates` | Taux de change + saisie manuelle + sync (W-ADM-05) | `fx:read` / `fx:write` |
| `/users` | Utilisateurs & rôles (W-SAD-01) | `user:manage` |
| `/branding` | Identité visuelle & pied de page (W-SAD-03) | `config:write` |

- Authentification : `POST /auth/login` (+ MFA), jeton d'accès en mémoire, refresh
  rotatif en `localStorage`, rafraîchissement automatique sur 401.
- Navigation et routes filtrées par **permissions** (`useAuth().can`).
- Idempotency-Key généré côté client sur la création de colis et de paiement.
