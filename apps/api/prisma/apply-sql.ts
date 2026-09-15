/**
 * Applique les objets SQL non gérés par Prisma (colonne générée, contraintes
 * EXCLUDE, triggers, index trigram). À lancer après `prisma migrate`.
 *
 *   npm run db:constraints --workspace @okapi/api
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

// Contrairement à `seed.ts` (qui utilise PrismaClient, lequel charge .env
// automatiquement), ce script parle directement à `pg` et doit charger
// apps/api/.env lui-même avant de lire process.env.DATABASE_URL.
loadEnv({ path: join(__dirname, '..', '.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant');

  const sql = readFileSync(join(__dirname, 'sql', '00_constraints.sql'), 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Contraintes SQL appliquées (00_constraints.sql).');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
