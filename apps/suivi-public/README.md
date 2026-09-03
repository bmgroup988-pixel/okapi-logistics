# @okapi/suivi-public — page publique de suivi

Next.js 15 (App Router), multilingue **fr / en / zh**, sans compte (EF-SUI-01).

```bash
npm run dev --workspace @okapi/suivi-public   # http://localhost:3001
```

Variable : `NEXT_PUBLIC_API_BASE` (défaut `http://localhost:3000/api/v1`).

## Routes

| Route | Écran | Contenu |
|-------|-------|---------|
| `/` | — | redirige vers `/<locale>` (langue détectée via `Accept-Language`) |
| `/<lang>` | W-PUB-01 | saisie du numéro de suivi |
| `/<lang>/suivi/<numero>` | W-PUB-02 / W-PUB-03 | statut, frise, statut de paiement **synthétique** (sans montant — EF-SUI-04), photo (URL signée temporaire — EF-SUI-03), historique daté ; message générique si numéro inconnu ou mal formé (anti-énumération — EF-SUI-05) |

- Rendu serveur, aucune donnée personnelle exposée.
- Débit limité côté API (`/public/parcels` : 30 req/min/IP).
- Identité visuelle et slogans chargés depuis `/api/v1/public/branding`.
