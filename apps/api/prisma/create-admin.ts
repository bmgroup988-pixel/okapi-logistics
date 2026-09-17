/**
 * Crée (ou met à jour) un compte super-administrateur en production.
 * Interactif — le mot de passe n'est jamais visible à l'écran ni journalisé.
 *
 *   npm run admin:create --workspace @okapi/api
 */
import * as readline from 'node:readline';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    const onData = (char: Buffer) => {
      const c = char.toString('utf8');
      if (c === '\n' || c === '\r' || c === '') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (c === '') process.exit(1); // Ctrl+C
      if (c === '') {
        input = input.slice(0, -1);
        return;
      }
      input += c;
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function main() {
  const email = (await ask('Email du super-administrateur : ')).toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Email invalide.');

  const fullName = await ask('Nom complet : ');
  if (!fullName) throw new Error('Nom requis.');

  const password = await askHidden('Mot de passe (min. 12 caractères) : ');
  if (password.length < 12) throw new Error('Mot de passe trop court (12 caractères minimum).');
  const confirm = await askHidden('Confirmez le mot de passe : ');
  if (password !== confirm) throw new Error('Les deux mots de passe ne correspondent pas.');

  const superRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  if (!superRole) {
    throw new Error(
      "Rôle SUPER_ADMIN introuvable — lancez d'abord la commande de seed de référence " +
        '(npm run db:seed:prod).',
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName, passwordHash, isActive: true },
    create: { email, fullName, passwordHash, defaultLocale: 'fr' },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: superRole.id, scopeCountryId: null, scopeAgencyId: null },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: superRole.id, scopeCountryId: null, scopeAgencyId: null },
    });
  }

  console.log(`\nCompte super-administrateur prêt : ${email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
