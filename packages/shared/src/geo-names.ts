/**
 * Résolution d'un libellé humain à partir d'une clé de nom stockée en base
 * (`City.nameKey` / `Country.nameKey`, ex. `"city.dar-es-salaam"`), sans
 * dictionnaire figé à maintenir : une nouvelle ville ajoutée via
 * `/admin/cities` (EF-EVOL-01 — aucun développement requis pour ouvrir un
 * pays) obtient automatiquement un libellé correct.
 */
const SMALL_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'es', 'en', "d'"]);

export function humanizeNameKey(nameKey: string | null | undefined): string {
  if (!nameKey) return '';
  const raw = nameKey.replace(/^(city|country)\./, '');
  // Découpe en gardant les séparateurs (espace ou tiret) pour les
  // restituer tels quels — le champ "Nom" de /admin/cities accepte du
  // texte libre (espaces), tandis que les données de départ (seed) sont
  // en slugs tiretés ; les deux doivent s'humaniser correctement.
  let wordIndex = 0;
  return raw.replace(/[^-\s]+/g, (word) => {
    const isFirst = wordIndex++ === 0;
    if (!isFirst && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/**
 * Noms de pays (FR) — jeu borné (ISO 3166-1), pas de création de pays via
 * l'UI aujourd'hui (contrairement aux villes) : une table statique est donc
 * cohérente avec l'architecture actuelle. Repli sur `humanizeNameKey` si un
 * code n'y figure pas encore.
 */
const COUNTRY_NAMES_FR: Record<string, string> = {
  BJ: 'Bénin',
  CD: 'RD Congo',
  CG: 'Congo',
  ZA: 'Afrique du Sud',
  RW: 'Rwanda',
  BI: 'Burundi',
  TZ: 'Tanzanie',
  FR: 'France',
  CN: 'Chine',
  NG: 'Nigeria',
};

export function countryDisplayName(iso2: string, nameKey?: string | null): string {
  return COUNTRY_NAMES_FR[iso2.toUpperCase()] || humanizeNameKey(nameKey) || iso2;
}
