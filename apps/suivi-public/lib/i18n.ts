export const LOCALES = ['fr', 'en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function resolveLocale(v: string | undefined): Locale {
  return isLocale(v) ? v : 'fr';
}

type Dict = {
  htmlLang: string;
  brand: string;
  title: string;
  subtitle: string;
  placeholder: string;
  example: string;
  submit: string;
  noAccount: string;
  parcel: string;
  status: string;
  paymentPaid: string;
  paymentPartial: string;
  paymentPending: string;
  destination: string;
  registeredOn: string;
  history: string;
  notFoundTitle: string;
  notFoundBody: string;
  retry: string;
  help: string;
  legal: string;
  privacy: string;
  steps: Record<string, string>;
};

export const DICT: Record<Locale, Dict> = {
  fr: {
    htmlLang: 'fr',
    brand: 'Okapi Logistics',
    title: 'Suivez votre colis Okapi en temps réel',
    subtitle: 'Saisissez votre numéro de suivi. Aucun compte nécessaire.',
    placeholder: 'Numéro de suivi',
    example: 'Exemple : OKP26090043FIH',
    submit: 'Suivre',
    noAccount: 'Aucun compte nécessaire.',
    parcel: 'Colis',
    status: 'Statut',
    paymentPaid: 'Payé',
    paymentPartial: 'Paiement partiel',
    paymentPending: 'En attente de paiement',
    destination: 'Destination',
    registeredOn: 'Enregistré le',
    history: 'Historique',
    notFoundTitle: 'Nous n’avons trouvé aucun colis avec ce numéro.',
    notFoundBody:
      'Vérifiez la saisie (format : OKP + 8 chiffres + 3 lettres). Le colis vient peut-être d’être enregistré ; réessayez dans quelques minutes.',
    retry: 'Réessayer',
    help: 'Besoin d’aide ?',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    steps: {
      ENREGISTRE: 'Enregistré',
      EN_TRANSIT: 'En transit',
      ARRIVE: 'Arrivé',
      LIVRE: 'Livré',
      ANNULE: 'Annulé',
      RETOURNE: 'Retourné',
    },
  },
  en: {
    htmlLang: 'en',
    brand: 'Okapi Logistics',
    title: 'Track your Okapi parcel in real time',
    subtitle: 'Enter your tracking number. No account required.',
    placeholder: 'Tracking number',
    example: 'Example: OKP26090043FIH',
    submit: 'Track',
    noAccount: 'No account required.',
    parcel: 'Parcel',
    status: 'Status',
    paymentPaid: 'Paid',
    paymentPartial: 'Partial payment',
    paymentPending: 'Awaiting payment',
    destination: 'Destination',
    registeredOn: 'Registered on',
    history: 'History',
    notFoundTitle: 'We could not find a parcel with this number.',
    notFoundBody:
      'Check the number (format: OKP + 8 digits + 3 letters). The parcel may have just been registered; try again in a few minutes.',
    retry: 'Try again',
    help: 'Need help?',
    legal: 'Legal notice',
    privacy: 'Privacy',
    steps: {
      ENREGISTRE: 'Registered',
      EN_TRANSIT: 'In transit',
      ARRIVE: 'Arrived',
      LIVRE: 'Delivered',
      ANNULE: 'Cancelled',
      RETOURNE: 'Returned',
    },
  },
  zh: {
    htmlLang: 'zh',
    brand: 'Okapi Logistics',
    title: '实时跟踪您的 Okapi 包裹',
    subtitle: '输入您的运单号。无需账户。',
    placeholder: '运单号',
    example: '示例：OKP26090043FIH',
    submit: '查询',
    noAccount: '无需账户。',
    parcel: '包裹',
    status: '状态',
    paymentPaid: '已付款',
    paymentPartial: '部分付款',
    paymentPending: '待付款',
    destination: '目的地',
    registeredOn: '登记日期',
    history: '历史记录',
    notFoundTitle: '未找到该运单号对应的包裹。',
    notFoundBody: '请检查运单号（格式：OKP + 8 位数字 + 3 位字母）。包裹可能刚刚登记，请稍后重试。',
    retry: '重试',
    help: '需要帮助？',
    legal: '法律声明',
    privacy: '隐私',
    steps: {
      ENREGISTRE: '已登记',
      EN_TRANSIT: '运输中',
      ARRIVE: '已到达',
      LIVRE: '已送达',
      ANNULE: '已取消',
      RETOURNE: '已退回',
    },
  },
};
