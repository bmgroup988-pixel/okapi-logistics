import { useSyncExternalStore } from 'react';

export const LOCALES = ['fr', 'en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

const STRINGS: Record<string, Record<Locale, string>> = {
  'app.title': { fr: 'Okapi Logistics', en: 'Okapi Logistics', zh: 'Okapi Logistics' },
  'nav.dashboard': { fr: 'Tableau de bord', en: 'Dashboard', zh: '仪表板' },
  'nav.new': { fr: '＋ Nouveau colis', en: '＋ New parcel', zh: '＋ 新包裹' },
  'nav.parcels': { fr: 'Colis', en: 'Parcels', zh: '包裹' },
  'nav.admin': { fr: 'Administration', en: 'Administration', zh: '管理' },
  'nav.reports': { fr: 'Rapports', en: 'Reports', zh: '报表' },
  'nav.tariffs': { fr: 'Tarifs (prix/kg)', en: 'Tariffs (price/kg)', zh: '价格/公斤' },
  'nav.fx': { fr: 'Taux de change', en: 'Exchange rates', zh: '汇率' },
  'nav.config': { fr: 'Configuration', en: 'Configuration', zh: '配置' },
  'nav.users': { fr: 'Utilisateurs', en: 'Users', zh: '用户' },
  'nav.branding': { fr: 'Identité visuelle', en: 'Branding', zh: '品牌' },
  'nav.cities': { fr: 'Villes', en: 'Cities', zh: '城市' },
  'nav.deliveryPartners': { fr: 'Partenaires de livraison', en: 'Delivery partners', zh: '配送合作伙伴' },
  'nav.settlements': { fr: 'Réconciliation partenaires', en: 'Partner settlements', zh: '合作伙伴结算' },
  'auth.login': { fr: 'Se connecter', en: 'Sign in', zh: '登录' },
  'auth.email': { fr: 'E-mail', en: 'Email', zh: '邮箱' },
  'auth.password': { fr: 'Mot de passe', en: 'Password', zh: '密码' },
  'auth.otp': { fr: 'Code de vérification (6 chiffres)', en: 'Verification code (6 digits)', zh: '验证码（6位）' },
  'auth.logout': { fr: 'Déconnexion', en: 'Sign out', zh: '退出' },
  'common.save': { fr: 'Enregistrer', en: 'Save', zh: '保存' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel', zh: '取消' },
  'common.next': { fr: 'Suivant', en: 'Next', zh: '下一步' },
  'common.back': { fr: 'Précédent', en: 'Back', zh: '上一步' },
  'common.loading': { fr: 'Chargement…', en: 'Loading…', zh: '加载中…' },
  'common.search': { fr: 'Rechercher', en: 'Search', zh: '搜索' },
  'parcel.status': { fr: 'Statut', en: 'Status', zh: '状态' },
  'parcel.payment': { fr: 'Paiement', en: 'Payment', zh: '付款' },
  'parcel.balance': { fr: 'Solde restant', en: 'Balance due', zh: '待付余额' },
  'parcel.amountDue': { fr: 'Montant dû', en: 'Amount due', zh: '应付金额' },
  'parcel.encash': { fr: 'Encaisser un paiement', en: 'Record a payment', zh: '登记付款' },
  'parcel.changeStatus': { fr: 'Changer le statut', en: 'Change status', zh: '更改状态' },
  'wizard.step1': { fr: 'Parties & trajet', en: 'Parties & route', zh: '双方与路线' },
  'wizard.step2': { fr: 'Photo du colis', en: 'Parcel photo', zh: '包裹照片' },
  'wizard.step3': { fr: 'Tarif & récapitulatif', en: 'Price & summary', zh: '价格与摘要' },
};

let current: Locale = readStored();
const listeners = new Set<() => void>();

function readStored(): Locale {
  try {
    const v = localStorage.getItem('okapi.locale');
    return (LOCALES as readonly string[]).includes(v ?? '') ? (v as Locale) : 'fr';
  } catch {
    return 'fr';
  }
}

export function setLocale(l: Locale) {
  current = l;
  try {
    localStorage.setItem('okapi.locale', l);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
}

export function useT() {
  const locale = useLocale();
  const t = (key: string) => STRINGS[key]?.[locale] ?? key;
  return { t, locale };
}
