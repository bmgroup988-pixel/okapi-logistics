import { useSyncExternalStore } from 'react';

export const LOCALES = ['fr', 'en', 'zh', 'sw', 'ln'] as const;
export type Locale = (typeof LOCALES)[number];

const STRINGS: Record<string, Record<Locale, string>> = {
  'app.title': { fr: 'Okapi Logistics', en: 'Okapi Logistics', zh: 'Okapi Logistics', sw: 'Okapi Logistics', ln: 'Okapi Logistics' },
  'nav.dashboard': { fr: 'Tableau de bord', en: 'Dashboard', zh: '仪表板', sw: 'Dashibodi', ln: 'Tableau ya bokambi' },
  'nav.new': { fr: '＋ Nouveau colis', en: '＋ New parcel', zh: '＋ 新包裹', sw: '＋ Mzigo mpya', ln: '＋ Kolo ya sika' },
  'nav.parcels': { fr: 'Colis', en: 'Parcels', zh: '包裹', sw: 'Mizigo', ln: 'Bakolo' },
  'nav.admin': { fr: 'Administration', en: 'Administration', zh: '管理', sw: 'Utawala', ln: 'Boyangeli' },
  'nav.reports': { fr: 'Rapports', en: 'Reports', zh: '报表', sw: 'Ripoti', ln: 'Balapolo' },
  'nav.tariffs': { fr: 'Tarifs (prix/kg)', en: 'Tariffs (price/kg)', zh: '价格/公斤', sw: 'Bei (bei/kg)', ln: 'Ntalo (ntalo/kg)' },
  'nav.fx': { fr: 'Taux de change', en: 'Exchange rates', zh: '汇率', sw: 'Kiwango cha ubadilishaji', ln: 'Talo ya mbongo' },
  'nav.config': { fr: 'Configuration', en: 'Configuration', zh: '配置', sw: 'Mipangilio', ln: 'Boyokani' },
  'nav.users': { fr: 'Utilisateurs', en: 'Users', zh: '用户', sw: 'Watumiaji', ln: 'Basaleli' },
  'nav.branding': { fr: 'Identité visuelle', en: 'Branding', zh: '品牌', sw: 'Chapa ya kampuni', ln: 'Elembo ya kompani' },
  'nav.cities': { fr: 'Villes', en: 'Cities', zh: '城市', sw: 'Miji', ln: 'Bingumba' },
  'nav.deliveryPartners': { fr: 'Partenaires de livraison', en: 'Delivery partners', zh: '配送合作伙伴', sw: 'Washirika wa usafirishaji', ln: 'Bapatenere ya kopesa' },
  'nav.settlements': { fr: 'Réconciliation partenaires', en: 'Partner settlements', zh: '合作伙伴结算', sw: 'Usuluhishi wa washirika', ln: 'Bofuti ya bapatenere' },
  'nav.suppliers': { fr: 'Fournisseurs', en: 'Suppliers', zh: '供应商', sw: 'Wasambazaji', ln: 'Bapesi' },
  'nav.carriers': { fr: 'Compagnies de transport', en: 'Carriers', zh: '承运公司', sw: 'Makampuni ya usafiri', ln: 'Bakompani ya komema' },
  'nav.supplierPortal': { fr: 'Mes expéditions', en: 'My shipments', zh: '我的货运', sw: 'Mizigo yangu', ln: 'Bakolo na ngai' },
  'auth.login': { fr: 'Se connecter', en: 'Sign in', zh: '登录', sw: 'Ingia', ln: 'Kokɔta' },
  'auth.email': { fr: 'E-mail', en: 'Email', zh: '邮箱', sw: 'Barua pepe', ln: 'Imelo' },
  'auth.password': { fr: 'Mot de passe', en: 'Password', zh: '密码', sw: 'Nenosiri', ln: 'Password' },
  'auth.otp': { fr: 'Code de vérification (6 chiffres)', en: 'Verification code (6 digits)', zh: '验证码（6位）', sw: 'Msimbo wa uthibitisho (tarakimu 6)', ln: 'Code ya kolakisa (mituya 6)' },
  'auth.logout': { fr: 'Déconnexion', en: 'Sign out', zh: '退出', sw: 'Toka', ln: 'Kobima' },
  'common.save': { fr: 'Enregistrer', en: 'Save', zh: '保存', sw: 'Hifadhi', ln: 'Bomba' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel', zh: '取消', sw: 'Ghairi', ln: 'Longola' },
  'common.next': { fr: 'Suivant', en: 'Next', zh: '下一步', sw: 'Endelea', ln: 'Elandi' },
  'common.back': { fr: 'Précédent', en: 'Back', zh: '上一步', sw: 'Rudi', ln: 'Zonga' },
  'common.loading': { fr: 'Chargement…', en: 'Loading…', zh: '加载中…', sw: 'Inapakia…', ln: 'Ezali kotya…' },
  'common.search': { fr: 'Rechercher', en: 'Search', zh: '搜索', sw: 'Tafuta', ln: 'Luka' },
  'parcel.status': { fr: 'Statut', en: 'Status', zh: '状态', sw: 'Hali', ln: 'Etat' },
  'parcel.payment': { fr: 'Paiement', en: 'Payment', zh: '付款', sw: 'Malipo', ln: 'Nde' },
  'parcel.balance': { fr: 'Solde restant', en: 'Balance due', zh: '待付余额', sw: 'Salio linalobaki', ln: 'Mbongo etikali' },
  'parcel.amountDue': { fr: 'Montant dû', en: 'Amount due', zh: '应付金额', sw: 'Kiasi kinachodaiwa', ln: 'Motuya ya kofuta' },
  'parcel.encash': { fr: 'Encaisser un paiement', en: 'Record a payment', zh: '登记付款', sw: 'Sajili malipo', ln: 'Koma nde' },
  'parcel.changeStatus': { fr: 'Changer le statut', en: 'Change status', zh: '更改状态', sw: 'Badilisha hali', ln: 'Bongola etat' },
  'wizard.step1': { fr: 'Parties & trajet', en: 'Parties & route', zh: '双方与路线', sw: 'Wahusika na safari', ln: 'Bato mpe nzela' },
  'wizard.step2': { fr: 'Photo du colis', en: 'Parcel photo', zh: '包裹照片', sw: 'Picha ya mzigo', ln: 'Foto ya kolo' },
  'wizard.step3': { fr: 'Tarif & récapitulatif', en: 'Price & summary', zh: '价格与摘要', sw: 'Bei na muhtasari', ln: 'Ntalo na muhtasari' },
  'footer.slogan': {
    fr: '« Le futur du commerce africain »',
    en: '"The future of African trade"',
    zh: '"非洲贸易的未来"',
    sw: '« Mustakabali wa biashara ya Afrika »',
    ln: '« Avenir ya mombongo ya Afrika »',
  },
  'footer.rights': { fr: 'Tous droits réservés.', en: 'All rights reserved.', zh: '版权所有。', sw: 'Haki zote zimehifadhiwa.', ln: 'Makoki nyonso ebombami.' },
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
