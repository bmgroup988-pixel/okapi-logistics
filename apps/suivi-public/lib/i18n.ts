export const LOCALES = ['fr', 'en', 'zh', 'sw', 'ln'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function resolveLocale(v: string | undefined): Locale {
  return isLocale(v) ? v : 'fr';
}

export const NETWORK_CITIES = ['Cotonou', 'Kinshasa', 'Lubumbashi', 'Kolwezi', 'Johannesburg'];

type Dict = {
  htmlLang: string;
  brand: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  placeholder: string;
  example: string;
  submit: string;
  noAccount: string;
  howItWorksTitle: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
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
  invalidFormatTitle: string;
  invalidFormatBody: string;
  errorTitle: string;
  errorBody: string;
  cancelledNote: string;
  returnedNote: string;
  trackAnother: string;
  retry: string;
  help: string;
  legal: string;
  privacy: string;
  rightsReserved: string;
  steps: Record<string, string>;
};

export const DICT: Record<Locale, Dict> = {
  fr: {
    htmlLang: 'fr',
    brand: 'Okapi Logistics',
    eyebrow: 'Suivi d’expédition',
    title: 'Votre colis,',
    titleAccent: 'à la trace.',
    subtitle:
      'Saisissez le numéro figurant sur votre reçu d’expédition. Il commence par OKP et vous a été remis à l’enregistrement du colis.',
    placeholder: 'Numéro de suivi',
    example: 'Exemple : OKP26090043FIH',
    submit: 'Suivre',
    noAccount: 'Aucun compte nécessaire.',
    howItWorksTitle: 'Suivez votre colis en 3 gestes',
    step1Title: 'Ouvrez cette page',
    step1Body: 'Depuis votre téléphone, tablette ou ordinateur — aucune application à installer.',
    step2Title: 'Saisissez le numéro',
    step2Body: 'Celui de votre reçu d’expédition, il commence toujours par OKP.',
    step3Title: 'Suivez chaque étape',
    step3Body: 'Enregistrement, transit, arrivée, livraison — mis à jour en temps réel.',
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
    invalidFormatTitle: 'Ce numéro ne semble pas valide.',
    invalidFormatBody: 'Le format attendu est OKP suivi de 8 chiffres puis de 3 lettres, par exemple OKP26090043FIH.',
    errorTitle: 'Une erreur est survenue.',
    errorBody: 'Le service de suivi est momentanément indisponible. Merci de réessayer dans quelques instants.',
    cancelledNote: 'Ce colis a été annulé. Contactez l’agence d’enregistrement pour plus d’informations.',
    returnedNote: 'Ce colis a été retourné vers son agence d’origine.',
    trackAnother: 'Suivre un autre colis',
    retry: 'Réessayer',
    help: 'Besoin d’aide ?',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    rightsReserved: 'Tous droits réservés.',
    steps: {
      ENREGISTRE: 'Enregistré',
      EN_TRANSIT: 'En transit',
      ARRIVE: 'Arrivé',
      HANDED_TO_PARTNER: 'En cours de livraison',
      LIVRE: 'Livré',
      ANNULE: 'Annulé',
      RETOURNE: 'Retourné',
    },
  },
  en: {
    htmlLang: 'en',
    brand: 'Okapi Logistics',
    eyebrow: 'Shipment tracking',
    title: 'Your parcel,',
    titleAccent: 'tracked live.',
    subtitle:
      'Enter the number shown on your shipping receipt. It starts with OKP and was given to you when the parcel was registered.',
    placeholder: 'Tracking number',
    example: 'Example: OKP26090043FIH',
    submit: 'Track',
    noAccount: 'No account required.',
    howItWorksTitle: 'Track your parcel in 3 steps',
    step1Title: 'Open this page',
    step1Body: 'From your phone, tablet or computer — no app to install.',
    step2Title: 'Enter the number',
    step2Body: 'The one on your shipping receipt, always starting with OKP.',
    step3Title: 'Follow each step',
    step3Body: 'Registered, in transit, arrived, delivered — updated in real time.',
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
    invalidFormatTitle: 'This number does not look valid.',
    invalidFormatBody: 'The expected format is OKP followed by 8 digits then 3 letters, e.g. OKP26090043FIH.',
    errorTitle: 'Something went wrong.',
    errorBody: 'The tracking service is temporarily unavailable. Please try again in a moment.',
    cancelledNote: 'This parcel was cancelled. Contact the registering agency for more information.',
    returnedNote: 'This parcel was returned to its origin agency.',
    trackAnother: 'Track another parcel',
    retry: 'Try again',
    help: 'Need help?',
    legal: 'Legal notice',
    privacy: 'Privacy',
    rightsReserved: 'All rights reserved.',
    steps: {
      ENREGISTRE: 'Registered',
      EN_TRANSIT: 'In transit',
      ARRIVE: 'Arrived',
      HANDED_TO_PARTNER: 'Out for delivery',
      LIVRE: 'Delivered',
      ANNULE: 'Cancelled',
      RETOURNE: 'Returned',
    },
  },
  zh: {
    htmlLang: 'zh',
    brand: 'Okapi Logistics',
    eyebrow: '运单追踪',
    title: '您的包裹，',
    titleAccent: '实时可查。',
    subtitle: '请输入运单号，印在您的寄件收据上，以 OKP 开头，登记包裹时提供给您。',
    placeholder: '运单号',
    example: '示例：OKP26090043FIH',
    submit: '查询',
    noAccount: '无需账户。',
    howItWorksTitle: '三步查询您的包裹',
    step1Title: '打开本页面',
    step1Body: '手机、平板或电脑均可，无需安装应用。',
    step2Title: '输入运单号',
    step2Body: '收据上的运单号，始终以 OKP 开头。',
    step3Title: '查看每个阶段',
    step3Body: '登记、运输中、到达、送达——实时更新。',
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
    invalidFormatTitle: '该运单号格式不正确。',
    invalidFormatBody: '正确格式为 OKP 加 8 位数字再加 3 位字母，例如 OKP26090043FIH。',
    errorTitle: '出现错误。',
    errorBody: '追踪服务暂时不可用，请稍后重试。',
    cancelledNote: '该包裹已取消。请联系登记代理点了解详情。',
    returnedNote: '该包裹已退回原发货代理点。',
    trackAnother: '查询另一个包裹',
    retry: '重试',
    help: '需要帮助？',
    legal: '法律声明',
    privacy: '隐私',
    rightsReserved: '版权所有。',
    steps: {
      ENREGISTRE: '已登记',
      EN_TRANSIT: '运输中',
      ARRIVE: '已到达',
      HANDED_TO_PARTNER: '派送中',
      LIVRE: '已送达',
      ANNULE: '已取消',
      RETOURNE: '已退回',
    },
  },
  sw: {
    htmlLang: 'sw',
    brand: 'Okapi Logistics',
    eyebrow: 'Ufuatiliaji wa mzigo',
    title: 'Mzigo wako,',
    titleAccent: 'unafuatiliwa.',
    subtitle:
      'Ingiza nambari iliyoandikwa kwenye risiti yako ya usafirishaji. Huanza na OKP na ulipewa wakati wa kusajili mzigo.',
    placeholder: 'Nambari ya ufuatiliaji',
    example: 'Mfano: OKP26090043FIH',
    submit: 'Fuatilia',
    noAccount: 'Hakuna akaunti inayohitajika.',
    howItWorksTitle: 'Fuatilia mzigo wako kwa hatua 3',
    step1Title: 'Fungua ukurasa huu',
    step1Body: 'Kutoka simu yako, kompyuta kibao au kompyuta — hakuna programu ya kusakinisha.',
    step2Title: 'Ingiza nambari',
    step2Body: 'Ile iliyo kwenye risiti yako ya usafirishaji, huanza kila mara na OKP.',
    step3Title: 'Fuata kila hatua',
    step3Body: 'Usajili, safarini, kufika, kutolewa — inasasishwa wakati halisi.',
    parcel: 'Mzigo',
    status: 'Hali',
    paymentPaid: 'Imelipwa',
    paymentPartial: 'Malipo ya sehemu',
    paymentPending: 'Inasubiri malipo',
    destination: 'Mwisho wa safari',
    registeredOn: 'Imesajiliwa tarehe',
    history: 'Historia',
    notFoundTitle: 'Hatukupata mzigo wenye nambari hii.',
    notFoundBody:
      'Angalia nambari uliyoingiza (mfumo: OKP + tarakimu 8 + herufi 3). Huenda mzigo umesajiliwa hivi karibuni; jaribu tena baada ya dakika chache.',
    invalidFormatTitle: 'Nambari hii haionekani sahihi.',
    invalidFormatBody: 'Mfumo unaotarajiwa ni OKP ikifuatiwa na tarakimu 8 kisha herufi 3, mfano OKP26090043FIH.',
    errorTitle: 'Hitilafu imetokea.',
    errorBody: 'Huduma ya ufuatiliaji haipatikani kwa muda. Tafadhali jaribu tena baadaye kidogo.',
    cancelledNote: 'Mzigo huu umefutwa. Wasiliana na wakala aliyesajili kwa maelezo zaidi.',
    returnedNote: 'Mzigo huu umerudishwa kwa wakala wa asili.',
    trackAnother: 'Fuatilia mzigo mwingine',
    retry: 'Jaribu tena',
    help: 'Unahitaji msaada?',
    legal: 'Taarifa za kisheria',
    privacy: 'Faragha',
    rightsReserved: 'Haki zote zimehifadhiwa.',
    steps: {
      ENREGISTRE: 'Imesajiliwa',
      EN_TRANSIT: 'Njiani',
      ARRIVE: 'Imefika',
      HANDED_TO_PARTNER: 'Inasafirishwa kwa mshirika',
      LIVRE: 'Imetolewa',
      ANNULE: 'Imefutwa',
      RETOURNE: 'Imerudishwa',
    },
  },
  ln: {
    htmlLang: 'ln',
    brand: 'Okapi Logistics',
    eyebrow: 'Bolandi ya kolo',
    title: 'Kolo na yo,',
    titleAccent: 'elandami na ntango ya solo.',
    subtitle:
      'Kotisa motango oyo ezali na resi ya kotinda na yo. Ebandaka na OKP mpe bapesaki yo yango na ntango ya kokoma kolo.',
    placeholder: 'Motango ya bolandi',
    example: 'Ndakisa: OKP26090043FIH',
    submit: 'Landá',
    noAccount: 'Compte esengami te.',
    howItWorksTitle: 'Landá kolo na yo na matambe 3',
    step1Title: 'Fungola lokasa oyo',
    step1Body: 'Longwa na telefone, tablette to ordinateur na yo — application ya kokotisa ezali te.',
    step2Title: 'Kotisa motango',
    step2Body: 'Oyo ezali na resi ya kotinda na yo, ebandaka ntango nyonso na OKP.',
    step3Title: 'Landá litambe na litambe',
    step3Body: 'Kokomama, na nzela, kokoma, kopesama — ekobongisama na ntango ya solo.',
    parcel: 'Kolo',
    status: 'Etat',
    paymentPaid: 'Efutami',
    paymentPartial: 'Nde ya ndambo',
    paymentPending: 'Ezali kozela nde',
    destination: 'Esika ekokende',
    registeredOn: 'Ekomami mokolo ya',
    history: 'Istware',
    notFoundTitle: 'Tomoni te kolo oyo ezali na motango oyo.',
    notFoundBody:
      'Talá motango oyo okotisi (fɔrma: OKP + mituya 8 + minkanda 3). Ntango mosusu kolo ekomami kaka sika; meká lisusu na miniti mike.',
    invalidFormatTitle: 'Motango oyo ezali malamu te.',
    invalidFormatBody: 'Fɔrma esengami ezali OKP elandami na mituya 8 mpe na minkanda 3, ndakisa OKP26090043FIH.',
    errorTitle: 'Mbeba moko esalemi.',
    errorBody: 'Mosala ya bolandi ezali te mpo na mwa ntango. Meká lisusu na sima ya mwa ntango.',
    cancelledNote: 'Kolo oyo elongolami. Bengá agence oyo ekomaki yango mpo na koyeba mingi.',
    returnedNote: 'Kolo oyo ezongisami epai ya agence oyo ebandaki.',
    trackAnother: 'Landá kolo mosusu',
    retry: 'Meká lisusu',
    help: 'Osengeli na lisungi?',
    legal: 'Makambo ya mibeko',
    privacy: 'Bobombami',
    rightsReserved: 'Makoki nyonso ebombami.',
    steps: {
      ENREGISTRE: 'Ekomami',
      EN_TRANSIT: 'Na nzela',
      ARRIVE: 'Ekomi',
      HANDED_TO_PARTNER: 'Ezali na nzela ya kopesama',
      LIVRE: 'Epesami',
      ANNULE: 'Elongolami',
      RETOURNE: 'Ezongisami',
    },
  },
};
