/**
 * Jeu de données de référence — docs/03-modele-de-donnees.md §14, décisions D1–D15.
 * Idempotent : peut être relancé sans créer de doublons.
 *
 *   npm run seed --workspace @okapi/api
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_CODES,
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  LOCALES,
  type RoleCode,
} from '@okapi/shared';

const prisma = new PrismaClient();
const D = (v: string) => new Prisma.Decimal(v);

async function seedCurrencies() {
  const rows: Array<[string, string, string, number, boolean, boolean]> = [
    // code, nameKey, symbol, decimals, active, reference
    ['USD', 'currency.usd', '$', 2, true, true],
    ['EUR', 'currency.eur', '€', 2, true, false],
    ['XOF', 'currency.xof', 'FCFA', 0, true, false],
    ['CDF', 'currency.cdf', 'FC', 2, true, false],
    ['XAF', 'currency.xaf', 'FCFA', 0, true, false],
    ['ZAR', 'currency.zar', 'R', 2, true, false],
    ['RWF', 'currency.rwf', 'FRw', 0, true, false],
    ['BIF', 'currency.bif', 'FBu', 0, true, false],
    ['TZS', 'currency.tzs', 'TSh', 2, true, false],
    ['GBP', 'currency.gbp', '£', 2, false, false],
    ['CNY', 'currency.cny', '¥', 2, false, false],
    ['NGN', 'currency.ngn', '₦', 2, false, false],
  ];
  for (const [code, nameKey, symbol, decimalDigits, isActive, isReference] of rows) {
    await prisma.currency.upsert({
      where: { code },
      update: { symbol, decimalDigits, isActive, isReference, nameKey },
      create: { code, nameKey, symbol, decimalDigits, isActive, isReference },
    });
  }
}

async function seedCountries() {
  const rows = [
    { iso2: 'BJ', nameKey: 'country.bj', cur: 'XOF', loc: 'fr', pfx: '+229', pol: 'derogation' },
    { iso2: 'CD', nameKey: 'country.cd', cur: 'CDF', loc: 'fr', pfx: '+243', pol: 'derogation' },
    { iso2: 'CG', nameKey: 'country.cg', cur: 'XAF', loc: 'fr', pfx: '+242', pol: 'derogation' },
    { iso2: 'ZA', nameKey: 'country.za', cur: 'ZAR', loc: 'en', pfx: '+27', pol: 'derogation' },
    { iso2: 'RW', nameKey: 'country.rw', cur: 'RWF', loc: 'en', pfx: '+250', pol: 'derogation' },
    { iso2: 'BI', nameKey: 'country.bi', cur: 'BIF', loc: 'fr', pfx: '+257', pol: 'derogation' },
    { iso2: 'TZ', nameKey: 'country.tz', cur: 'TZS', loc: 'en', pfx: '+255', pol: 'derogation' },
    { iso2: 'FR', nameKey: 'country.fr', cur: 'EUR', loc: 'fr', pfx: '+33', pol: 'strict' },
    { iso2: 'CN', nameKey: 'country.cn', cur: 'CNY', loc: 'zh', pfx: '+86', pol: 'strict' },
    { iso2: 'NG', nameKey: 'country.ng', cur: 'NGN', loc: 'en', pfx: '+234', pol: 'derogation' },
  ];
  for (const c of rows) {
    await prisma.country.upsert({
      where: { iso2: c.iso2 },
      update: { defaultCurrency: c.cur, defaultLocale: c.loc, phonePrefix: c.pfx, unpaidDeliveryPolicy: c.pol },
      create: {
        iso2: c.iso2,
        nameKey: c.nameKey,
        defaultCurrency: c.cur,
        defaultLocale: c.loc,
        phonePrefix: c.pfx,
        unpaidDeliveryPolicy: c.pol,
        dataResidencyRegion: c.iso2 === 'FR' ? 'eu-west' : null,
      },
    });
  }
}

/**
 * Réseau international (statut HUB par défaut — dessertes directes/aériennes,
 * hors modèle partenaire) + les 26 chefs-lieux de province de la RDC de
 * l'addendum 08, §1.3 (statut HUB pour les 3 déjà en agence propre, PARTNER
 * pour les 23 autres — à faire évoluer depuis /admin/cities au fil de
 * l'ouverture de partenaires). Idempotent comme le reste du seed.
 */
async function seedCities() {
  type Row = { code: string; nameKey: string; iso2: string; tz: string; status: 'HUB' | 'PARTNER' | 'PLANNED' };
  const rows: Row[] = [
    // -- Réseau international / actuel --
    { code: 'COO', nameKey: 'city.cotonou', iso2: 'BJ', tz: 'Africa/Porto-Novo', status: 'HUB' },
    { code: 'FIH', nameKey: 'city.kinshasa', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'HUB' },
    { code: 'FBM', nameKey: 'city.lubumbashi', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'HUB' },
    { code: 'BZV', nameKey: 'city.brazzaville', iso2: 'CG', tz: 'Africa/Brazzaville', status: 'HUB' },
    { code: 'PNR', nameKey: 'city.pointe-noire', iso2: 'CG', tz: 'Africa/Brazzaville', status: 'HUB' },
    { code: 'JNB', nameKey: 'city.johannesburg', iso2: 'ZA', tz: 'Africa/Johannesburg', status: 'HUB' },
    { code: 'KGL', nameKey: 'city.kigali', iso2: 'RW', tz: 'Africa/Kigali', status: 'HUB' },
    { code: 'BJM', nameKey: 'city.bujumbura', iso2: 'BI', tz: 'Africa/Bujumbura', status: 'HUB' },
    { code: 'DAR', nameKey: 'city.dar-es-salaam', iso2: 'TZ', tz: 'Africa/Dar_es_Salaam', status: 'HUB' },
    { code: 'PAR', nameKey: 'city.paris', iso2: 'FR', tz: 'Europe/Paris', status: 'HUB' },
    { code: 'SHA', nameKey: 'city.shanghai', iso2: 'CN', tz: 'Asia/Shanghai', status: 'HUB' },
    { code: 'CAN', nameKey: 'city.guangzhou', iso2: 'CN', tz: 'Asia/Shanghai', status: 'HUB' },
    { code: 'LOS', nameKey: 'city.lagos', iso2: 'NG', tz: 'Africa/Lagos', status: 'HUB' },
    // -- 26 chefs-lieux de province RDC — addendum 08, §1.3 --
    { code: 'BZU', nameKey: 'city.buta', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Bas-Uele
    { code: 'MDK', nameKey: 'city.mbandaka', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Équateur
    // FBM (Haut-Katanga / Lubumbashi) déjà listé ci-dessus, en HUB.
    { code: 'KMN', nameKey: 'city.kamina', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Haut-Lomami
    { code: 'IRP', nameKey: 'city.isiro', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Haut-Uele
    { code: 'BUX', nameKey: 'city.bunia', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Ituri
    { code: 'TSH', nameKey: 'city.tshikapa', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Kasaï
    { code: 'KGA', nameKey: 'city.kananga', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Kasaï-Central
    { code: 'MJM', nameKey: 'city.mbuji-mayi', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Kasaï-Oriental
    // FIH (Kinshasa) déjà listé ci-dessus, en HUB.
    { code: 'MAT', nameKey: 'city.matadi', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Kongo-Central
    { code: 'KEN', nameKey: 'city.kenge', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Kwango
    { code: 'FDU', nameKey: 'city.bandundu', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Kwilu
    { code: 'KBN', nameKey: 'city.kabinda', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Lomami
    { code: 'KWZ', nameKey: 'city.kolwezi', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'HUB' }, // Lualaba
    { code: 'INO', nameKey: 'city.inongo', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Mai-Ndombe
    { code: 'KND', nameKey: 'city.kindu', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Maniema
    { code: 'LIQ', nameKey: 'city.lisala', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Mongala
    { code: 'GOM', nameKey: 'city.goma', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Nord-Kivu
    { code: 'BDT', nameKey: 'city.gbadolite', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Nord-Ubangi
    { code: 'LUS', nameKey: 'city.lusambo', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Sankuru
    { code: 'BKY', nameKey: 'city.bukavu', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Sud-Kivu
    { code: 'GMA', nameKey: 'city.gemena', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Sud-Ubangi
    { code: 'FMI', nameKey: 'city.kalemie', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Tanganyika
    { code: 'FKI', nameKey: 'city.kisangani', iso2: 'CD', tz: 'Africa/Lubumbashi', status: 'PARTNER' }, // Tshopo
    { code: 'BNB', nameKey: 'city.boende', iso2: 'CD', tz: 'Africa/Kinshasa', status: 'PARTNER' }, // Tshuapa
  ];
  for (const c of rows) {
    const country = await prisma.country.findUniqueOrThrow({ where: { iso2: c.iso2 } });
    await prisma.city.upsert({
      where: { code: c.code },
      update: { countryId: country.id, timezone: c.tz, nameKey: c.nameKey, status: c.status },
      create: { code: c.code, nameKey: c.nameKey, timezone: c.tz, countryId: country.id, status: c.status },
    });
  }
}

async function seedAgencies() {
  // Agences propres existantes — cf. flyer des adresses d'agences (Kinshasa,
  // Lubumbashi, Kolwezi, Cotonou, Johannesburg).
  const rows = [
    { code: 'COO-01', name: 'Agence Cotonou', city: 'COO', cur: 'XOF' },
    { code: 'FIH-01', name: 'Agence Kinshasa', city: 'FIH', cur: 'CDF' },
    { code: 'FBM-01', name: 'Agence Lubumbashi', city: 'FBM', cur: 'CDF' },
    { code: 'KWZ-01', name: 'Agence Kolwezi', city: 'KWZ', cur: 'CDF' },
    { code: 'JNB-01', name: 'Agence Johannesburg', city: 'JNB', cur: 'ZAR' },
  ];
  for (const a of rows) {
    const city = await prisma.city.findUniqueOrThrow({ where: { code: a.city } });
    await prisma.agency.upsert({
      where: { code: a.code },
      update: { name: a.name, cityId: city.id, countryId: city.countryId, billingCurrency: a.cur },
      create: {
        code: a.code,
        name: a.name,
        cityId: city.id,
        countryId: city.countryId,
        billingCurrency: a.cur,
        timezone: city.timezone,
        email: 'contact.gokapi@gmail.com',
      },
    });
  }
}

/**
 * Partenaires de livraison de démonstration pour deux villes PARTNER —
 * addendum 08, §1.4/§1.5. Valeurs à ajuster une fois les partenaires réels
 * identifiés (même logique que `seedTariffs`, valeurs indicatives).
 */
async function seedDeliveryPartners() {
  const rows = [
    {
      city: 'GOM',
      name: 'Kivu Express Courrier',
      coverageZone: 'Goma centre-ville',
      contactPhone: '+243 990 000 001',
      isPreferred: true,
      pricePerKg: '0.60',
      currency: 'USD',
    },
    {
      city: 'BKY',
      name: 'Bukavu Livraison Rapide',
      coverageZone: 'Bukavu centre-ville',
      contactPhone: '+243 990 000 002',
      isPreferred: true,
      pricePerKg: '0.60',
      currency: 'USD',
    },
  ];
  for (const r of rows) {
    const city = await prisma.city.findUniqueOrThrow({ where: { code: r.city } });
    const existing = await prisma.deliveryPartner.findFirst({ where: { cityId: city.id, name: r.name } });
    const partner = existing
      ? await prisma.deliveryPartner.update({
          where: { id: existing.id },
          data: { coverageZone: r.coverageZone, contactPhone: r.contactPhone, isPreferred: r.isPreferred },
        })
      : await prisma.deliveryPartner.create({
          data: {
            cityId: city.id,
            name: r.name,
            coverageZone: r.coverageZone,
            contactPhone: r.contactPhone,
            isPreferred: r.isPreferred,
            settlementMode: 'PER_KG',
          },
        });
    const activeTariff = await prisma.partnerTariff.findFirst({
      where: { deliveryPartnerId: partner.id, isActive: true, effectiveTo: null },
    });
    const data = { deliveryPartnerId: partner.id, pricePerKg: D(r.pricePerKg), currencyCode: r.currency };
    if (activeTariff) await prisma.partnerTariff.update({ where: { id: activeTariff.id }, data });
    else await prisma.partnerTariff.create({ data });
  }
}

async function seedCorridors() {
  const pairs: Array<[string, string]> = [
    ['BJ', 'CD'],
    ['BJ', 'CG'],
    ['CD', 'BJ'],
    ['CD', 'ZA'],
    ['CD', 'RW'],
    ['CD', 'BI'],
    ['CD', 'TZ'],
  ];
  for (const [o, d] of pairs) {
    const origin = await prisma.country.findUniqueOrThrow({ where: { iso2: o } });
    const dest = await prisma.country.findUniqueOrThrow({ where: { iso2: d } });
    await prisma.corridor.upsert({
      where: {
        originCountryId_destinationCountryId: {
          originCountryId: origin.id,
          destinationCountryId: dest.id,
        },
      },
      update: { isActive: true },
      create: {
        originCountryId: origin.id,
        destinationCountryId: dest.id,
        labelKey: `corridor.${o.toLowerCase()}-${d.toLowerCase()}`,
      },
    });
  }
}

async function seedTariffs() {
  // Prix par kg par destination (D6) — valeurs de démonstration à ajuster (O-3).
  const rows = [
    { city: 'FIH', mode: 'AIR' as const, price: '1.10', fixed: '0', min: '0' },
    { city: 'FIH', mode: 'SEA' as const, price: '0.45', fixed: '0', min: '5.00' },
    { city: 'BZV', mode: 'AIR' as const, price: '1.05', fixed: '0', min: '0' },
    { city: 'JNB', mode: 'AIR' as const, price: '1.60', fixed: '10.00', min: '0' },
    { city: 'KGL', mode: 'AIR' as const, price: '1.35', fixed: '0', min: '0' },
    { city: 'DAR', mode: 'AIR' as const, price: '1.45', fixed: '0', min: '0' },
  ];
  for (const t of rows) {
    const city = await prisma.city.findUniqueOrThrow({ where: { code: t.city } });
    const existing = await prisma.tariff.findFirst({
      where: { destinationCityId: city.id, mode: t.mode, validTo: null },
    });
    const data = {
      destinationCityId: city.id,
      mode: t.mode,
      currency: 'USD',
      pricePerKg: D(t.price),
      fixedFee: D(t.fixed),
      minCharge: D(t.min),
      overrideMin: D('-0.15'),
      overrideMax: D('0.15'),
    };
    if (existing) await prisma.tariff.update({ where: { id: existing.id }, data });
    else await prisma.tariff.create({ data });
  }
}

async function seedExchangeRates() {
  // 1 unité de <base> = <rate> USD. USD est la devise pivot -> pas de ligne.
  const rates: Array<[string, string]> = [
    ['EUR', '1.08500000'],
    ['XOF', '0.00164000'],
    ['CDF', '0.00035500'],
    ['XAF', '0.00164000'],
    ['ZAR', '0.05400000'],
    ['RWF', '0.00075000'],
    ['BIF', '0.00034000'],
    ['TZS', '0.00040000'],
  ];
  const effectiveFrom = new Date('2026-01-01T00:00:00Z');
  for (const [base, rate] of rates) {
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_effectiveFrom: {
          baseCurrency: base,
          quoteCurrency: 'USD',
          effectiveFrom,
        },
      },
      update: { rate: D(rate), source: 'MANUAL', provider: 'seed' },
      create: {
        baseCurrency: base,
        quoteCurrency: 'USD',
        rate: D(rate),
        source: 'MANUAL',
        provider: 'seed',
        effectiveFrom,
      },
    });
  }
}

async function seedRolesAndPermissions() {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }
  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, nameKey: `role.${code.toLowerCase()}`, isSystem: true },
    });
    const perms = ROLE_PERMISSIONS[code as RoleCode] ?? [];
    for (const permissionCode of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
        update: {},
        create: { roleId: role.id, permissionCode },
      });
    }
  }
}

async function seedSettings() {
  const entries: Array<[string, Prisma.InputJsonValue]> = [
    ['fx.reference_currency', 'USD'],
    ['fx.provider', 'exchangerate.host'],
    ['fx.stale_hours', 36],
    ['fx.sync_cron', '0 */6 * * *'],
    ['tracking.sequence_scope', 'DESTINATION_CITY'],
    ['dunning.schedule_days', [0, 2, 5]],
    ['i18n.locales', ['fr', 'en', 'zh']],
    ['i18n.default_locale', 'fr'],
    ['brand.navy', '#170655'],
    ['brand.orange', '#E47911'],
    ['brand.turquoise', '#1CA9C9'],
    ['brand.anthracite', '#2E3138'],
    ['contact.email', 'contact.gokapi@gmail.com'],
    ['footer.slogan.fr', 'Le futur du commerce africain'],
    ['footer.slogan.en', 'The future of African trade'],
    ['footer.slogan.zh', '非洲贸易的未来'],
    ['pricing.override_max_pct', '0.15'],
  ];
  for (const [key, value] of entries) {
    const existing = await prisma.setting.findFirst({
      where: { scope: 'GLOBAL', scopeId: null, key },
    });
    if (existing) await prisma.setting.update({ where: { id: existing.id }, data: { value } });
    else await prisma.setting.create({ data: { scope: 'GLOBAL', scopeId: null, key, value } });
  }
}

async function seedContent() {
  const blocks: Array<{ key: string; fr: string; en: string; zh: string }> = [
    {
      key: 'public.home.title',
      fr: 'Suivez votre colis Okapi en temps réel',
      en: 'Track your Okapi parcel in real time',
      zh: '实时跟踪您的 Okapi 包裹',
    },
    {
      key: 'public.home.subtitle',
      fr: 'Saisissez votre numéro de suivi. Aucun compte nécessaire.',
      en: 'Enter your tracking number. No account required.',
      zh: '输入您的运单号。无需账户。',
    },
    {
      key: 'public.footer.slogan',
      fr: 'Le futur du commerce africain',
      en: 'The future of African trade',
      zh: '非洲贸易的未来',
    },
  ];
  for (const b of blocks) {
    const block = await prisma.contentBlock.upsert({
      where: { key: b.key },
      update: {},
      create: { key: b.key, description: b.key },
    });
    for (const locale of LOCALES) {
      await prisma.contentTranslation.upsert({
        where: { contentBlockId_locale: { contentBlockId: block.id, locale } },
        update: { value: b[locale] },
        create: { contentBlockId: block.id, locale, value: b[locale] },
      });
    }
  }
}

async function seedNotificationTemplates() {
  for (const trigger of NOTIFICATION_TRIGGERS) {
    for (const channel of NOTIFICATION_CHANNELS) {
      for (const locale of LOCALES) {
        const tpl = DEFAULT_NOTIFICATION_TEMPLATES[trigger][locale];
        await prisma.notificationTemplate.upsert({
          where: { trigger_channel_locale: { trigger, channel, locale } },
          update: {
            body: tpl.body,
            subject: channel === 'EMAIL' ? (tpl.subject ?? null) : null,
          },
          create: {
            trigger,
            channel,
            locale,
            body: tpl.body,
            subject: channel === 'EMAIL' ? (tpl.subject ?? null) : null,
          },
        });
      }
    }
  }
}

async function seedRetentionPolicies() {
  const rows: Array<[string, number, string]> = [
    ['parcel_dossier', 60, 'ANONYMIZE'],
    ['accounting_document', 120, 'DELETE'],
    ['audit_log', 60, 'DELETE'],
    ['notification', 13, 'DELETE'],
  ];
  for (const [category, months, action] of rows) {
    const existing = await prisma.retentionPolicy.findFirst({
      where: { category, countryId: null },
    });
    if (existing) {
      await prisma.retentionPolicy.update({
        where: { id: existing.id },
        data: { retentionMonths: months, action },
      });
    } else {
      await prisma.retentionPolicy.create({
        data: { category, retentionMonths: months, action },
      });
    }
  }
}

async function seedUsers() {
  const password = process.env.SEED_PASSWORD ?? 'OkapiDev!2026';
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@okapi.example' },
    update: { fullName: 'Super Admin', isActive: true },
    create: {
      email: 'admin@okapi.example',
      fullName: 'Super Admin',
      passwordHash: hash,
      defaultLocale: 'fr',
    },
  });
  const agent = await prisma.user.upsert({
    where: { email: 'a.boni@okapi.example' },
    update: { fullName: 'A. Boni', isActive: true },
    create: {
      email: 'a.boni@okapi.example',
      fullName: 'A. Boni',
      passwordHash: hash,
      defaultLocale: 'fr',
    },
  });

  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const agentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'AGENT_FRET' } });
  const cotonou = await prisma.agency.findUniqueOrThrow({ where: { code: 'COO-01' } });

  await ensureUserRole(superAdmin.id, superRole.id, null, null);
  await ensureUserRole(agent.id, agentRole.id, null, cotonou.id);
}

async function ensureUserRole(
  userId: string,
  roleId: string,
  scopeCountryId: string | null,
  scopeAgencyId: string | null,
) {
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, scopeCountryId, scopeAgencyId },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId, scopeCountryId, scopeAgencyId } });
  }
}

async function main() {
  console.log('Seed Okapi Logistics…');
  await seedCurrencies();
  await seedCountries();
  await seedCities();
  await seedAgencies();
  await seedDeliveryPartners();
  await seedCorridors();
  await seedTariffs();
  await seedExchangeRates();
  await seedRolesAndPermissions();
  await seedSettings();
  await seedContent();
  await seedNotificationTemplates();
  await seedRetentionPolicies();
  await seedUsers();
  console.log('Seed terminé.');
  console.log('  Super-admin : admin@okapi.example');
  console.log('  Agent       : a.boni@okapi.example (Agence Cotonou)');
  console.log(`  Mot de passe : ${process.env.SEED_PASSWORD ?? 'OkapiDev!2026'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
