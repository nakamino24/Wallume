import { Platform, NativeModules } from 'react-native';
import { storage } from '@/src/utils/storage';

type Locale = 'en' | 'id';
const KEY = 'mf.locale';

let _forcedLocale: Locale | null = null;

const EN: Record<string, string> = {
  'app.name': 'Wallume',
  'app.tagline': 'Organize your money with clarity.',
  'welcome.back': 'Welcome back.',
  'sign.in': 'Sign in',
  'sign.in.to': 'Sign in to Wallume',
  'create.account': 'Create account',
  'start.journey': 'Create your account.',
  'start.subtitle': 'Start tracking your finances in seconds.',
  'already.account': 'Already have an account?',
  'new.here': 'New here?',
  'email': 'Email',
  'password': 'Password',
  'name': 'Name',
  'or': 'or',
  'continue.google': 'Continue with Google',
  'sign.out': 'Sign out',
  'delete.account': 'Delete account & all data',
  'delete.confirm': 'Delete account?',
  'delete.warning': 'All your wallets, transactions, budgets, and goals will be permanently deleted. This cannot be undone.',
  'delete.everything': 'Delete everything',
  'cancel': 'Cancel',
  'home': 'Home',
  'wallets': 'Wallets',
  'plan': 'Plan',
  'coach': 'Coach',
  'profile': 'Profile',
  'settings': 'Settings',
  'net.worth': 'Net worth',
  'total.balance': 'Total Balance',
  'income': 'Income',
  'expense': 'Expense',
  'cash.flow': 'Cash flow',
  'saving.rate': 'Saving rate',
  'debt.ratio': 'Debt ratio',
  'health.score': 'Financial Health Score',
  'transactions': 'Transactions',
  'add.transaction': 'Add transaction',
  'no.transactions': 'No transactions yet',
  'no.transactions.sub': 'Track your first income or expense to see it here.',
  'budgets': 'Budgets',
  'goals': 'Goals',
  'debts': 'Debts',
  'assets': 'Assets',
  'investments': 'Investments',
  'plans': 'Plans',
  'bills': 'Bills',
  'hub.title': 'Your money',
  'hub.subtitle': 'Manage every part of your finances.',
  'hub.current': 'Current',
  'hub.current.section': 'Current section',
  'hub.budgets.detail': 'Monthly limits',
  'hub.goals.detail': 'Saving goals',
  'hub.plans.detail': 'Life plans',
  'hub.debts.detail': 'Payoff plans',
  'hub.assets.detail': 'What you own',
  'hub.investments.detail': 'Your portfolio',
  'hub.bills.detail': 'Recurring payments',
  'plans.title': 'Life plans',
  'plans.subtitle': 'Build toward what matters.',
  'plans.active': 'Active plans',
  'plans.empty': 'No active plans yet',
  'plans.empty.subtitle': 'Choose a template below to start.',
  'plans.start': 'Start a new plan',
  'plans.of': 'of',
  'plans.target': 'Target',
  'plans.template.wedding': 'Wedding',
  'plans.template.house': 'House',
  'plans.template.car': 'Car',
  'plans.template.vacation': 'Vacation',
  'plans.template.start': 'Start plan →',
  'reports': 'Reports',
  'export.pdf': 'Generate & Share PDF',
  'ai.coach': 'AI Coach',
  'coach.subtitle': 'Personal finance guidance',
  'coach.placeholder': 'Ask about your money\u2026',
  'payday': 'Payday',
  'payday.today': 'Payday today!',
  'payday.days': '{days} days until payday',
  'payday.next': 'Next: {date}',
  'set.payday': 'Set your payday date',
  'every.nth': 'Every {day}th',
  'dark.mode': 'Dark mode',
  'light.mode': 'Light mode',
  'appearance': 'Appearance',
  'language': 'Language',
  'security': 'Security',
  'biometric.lock': 'Face ID / Fingerprint lock',
  'biometric.desc': 'Require biometrics to open Wallume',
  'notifications': 'Notifications',
  'notif.billing': 'Billing reminders',
  'notif.budget': 'Budget alerts',
  'notif.payday': 'Payday reminders',
  'privacy.balance': 'Balance privacy',
  'privacy.showAmounts': 'Show financial amounts',
  'privacy': 'Privacy Policy',
  'privacy.desc': 'How your data is handled',
  'onboarding.tour': 'Onboarding tour',
  'onboarding.desc': 'Replay the intro walkthrough',
  'sign.out.confirm': 'You can sign back in anytime.',
  'debt.planner': 'Debt Payoff Planner',
  'debt.planner.sub': 'See your payoff plan',
  'portfolio': 'Portfolio',
  'ai.quick.summary': 'Quick financial summary',
};

const ID: Record<string, string> = {
  'app.name': 'Wallume',
  'app.tagline': 'Atur keuanganmu dengan jelas.',
  'welcome.back': 'Selamat datang.',
  'sign.in': 'Masuk',
  'sign.in.to': 'Masuk ke Wallume',
  'create.account': 'Buat akun',
  'start.journey': 'Buat akun baru.',
  'start.subtitle': 'Mulai catat keuangan dalam hitungan detik.',
  'already.account': 'Sudah punya akun?',
  'new.here': 'Baru di sini?',
  'email': 'Email',
  'password': 'Kata Sandi',
  'name': 'Nama',
  'or': 'atau',
  'continue.google': 'Lanjut dengan Google',
  'sign.out': 'Keluar',
  'delete.account': 'Hapus akun & semua data',
  'delete.confirm': 'Hapus akun?',
  'delete.warning': 'Semua dompet, transaksi, anggaran, dan tujuan akan dihapus permanen. Tidak bisa dibatalkan.',
  'delete.everything': 'Hapus semuanya',
  'cancel': 'Batal',
  'home': 'Beranda',
  'wallets': 'Dompet',
  'plan': 'Rencana',
  'coach': 'Asisten AI',
  'profile': 'Profil',
  'settings': 'Pengaturan',
  'net.worth': 'Total Kekayaan',
  'total.balance': 'Total Saldo',
  'income': 'Pemasukan',
  'expense': 'Pengeluaran',
  'cash.flow': 'Arus Kas',
  'saving.rate': 'Rasio Tabungan',
  'debt.ratio': 'Rasio Utang',
  'health.score': 'Skor Keuangan',
  'transactions': 'Transaksi',
  'add.transaction': 'Tambah transaksi',
  'no.transactions': 'Belum ada transaksi',
  'no.transactions.sub': 'Catat pemasukan atau pengeluaran pertama kamu.',
  'budgets': 'Anggaran',
  'goals': 'Tujuan',
  'debts': 'Utang',
  'assets': 'Aset',
  'investments': 'Investasi',
  'plans': 'Rencana',
  'bills': 'Tagihan',
  'hub.title': 'Keuangan kamu',
  'hub.subtitle': 'Kelola semua bagian keuanganmu.',
  'hub.current': 'Aktif',
  'hub.current.section': 'Bagian saat ini',
  'hub.budgets.detail': 'Batas bulanan',
  'hub.goals.detail': 'Target tabungan',
  'hub.plans.detail': 'Rencana hidup',
  'hub.debts.detail': 'Rencana pelunasan',
  'hub.assets.detail': 'Yang kamu miliki',
  'hub.investments.detail': 'Portofoliomu',
  'hub.bills.detail': 'Pembayaran rutin',
  'plans.title': 'Rencana hidup',
  'plans.subtitle': 'Wujudkan hal yang penting buatmu.',
  'plans.active': 'Rencana aktif',
  'plans.empty': 'Belum ada rencana aktif',
  'plans.empty.subtitle': 'Pilih template di bawah untuk memulai.',
  'plans.start': 'Buat rencana baru',
  'plans.of': 'dari',
  'plans.target': 'Target',
  'plans.template.wedding': 'Pernikahan',
  'plans.template.house': 'Rumah',
  'plans.template.car': 'Mobil',
  'plans.template.vacation': 'Liburan',
  'plans.template.start': 'Mulai rencana →',
  'reports': 'Laporan',
  'export.pdf': 'Buat & Bagikan PDF',
  'ai.coach': 'Asisten AI',
  'coach.subtitle': 'Panduan keuangan pribadi',
  'coach.placeholder': 'Tanya soal keuangan\u2026',
  'payday': 'Hari Gajian',
  'payday.today': 'Hari ini gajian!',
  'payday.days': '{days} hari lagi gajian',
  'payday.next': 'Berikutnya: {date}',
  'set.payday': 'Atur tanggal gajian',
  'every.nth': 'Tiap tgl {day}',
  'dark.mode': 'Mode gelap',
  'light.mode': 'Mode terang',
  'appearance': 'Tampilan',
  'language': 'Bahasa',
  'security': 'Keamanan',
  'biometric.lock': 'Kunci Face ID / Sidik jari',
  'biometric.desc': 'Aktifkan biometrik untuk buka Wallume',
  'notifications': 'Notifikasi',
  'notif.billing': 'Pengingat tagihan',
  'notif.budget': 'Peringatan anggaran',
  'notif.payday': 'Pengingat gajian',
  'privacy.balance': 'Privasi saldo',
  'privacy.showAmounts': 'Tampilkan nominal keuangan',
  'privacy': 'Kebijakan Privasi',
  'privacy.desc': 'Bagaimana data kamu dikelola',
  'onboarding.tour': 'Tur pengenalan',
  'onboarding.desc': 'Putar ulang panduan awal',
  'sign.out.confirm': 'Kamu bisa masuk kapan saja.',
  'debt.planner': 'Perencana Pelunasan Utang',
  'debt.planner.sub': 'Lihat rencana pelunasan',
  'portfolio': 'Portofolio',
  'ai.quick.summary': 'Ringkasan keuangan cepat',
};

const TRANSLATIONS: Record<Locale, Record<string, string>> = { en: EN, id: ID };

function getDeviceLocale(): Locale {
  if (_forcedLocale) return _forcedLocale;
  try {
    const locale = Platform.OS === 'ios' || Platform.OS === 'android'
      ? (NativeModules.I18nManager?.localeIdentifier || 'en-US')
      : (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    if (locale.startsWith('id')) return 'id';
  } catch {}
  return 'en';
}

export function getLocale(): Locale {
  return _forcedLocale || getDeviceLocale();
}

export async function initLocale(): Promise<Locale> {
  const saved = await storage.getItem<Locale | null>(KEY, null);
  if (saved === 'en' || saved === 'id') {
    _forcedLocale = saved;
    return saved;
  }
  return getDeviceLocale();
}

export async function setLocale(locale: Locale) {
  _forcedLocale = locale;
  await storage.setItem(KEY, locale);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = _forcedLocale || getDeviceLocale();
  const dict = TRANSLATIONS[locale] || EN;
  let text = dict[key] || EN[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
