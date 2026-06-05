/**
 * Token layout email — struktur mengikuti `email-layout-for-cisc` (Downloads),
 * warna diselaraskan theme light + primary biru `globals.css` (bukan emerald/slate gelap).
 */
export const EMAIL_DESIGN_TOKENS = {
  /** Latar luar (setara area di luar kolom 600px) */
  pageBg: '#f4f4f5',
  /** Kolom utama 600px */
  shellBg: '#ffffff',
  shellText: '#18181b',

  /** Header gradient (setara from-slate-900 → to-slate-800, diganti primary) */
  headerGradientStart: '#1e3a8a',
  headerGradientEnd: '#172554',
  headerText: '#ffffff',
  headerSubtext: '#bfdbfe',
  headerBorder: '#1e40af',

  /** Isi (setara EmailBody px-6 py-8) */
  bodyPaddingX: '24px',
  bodyPaddingY: '32px',
  bodyText: '#334155',
  bodyTextMuted: '#64748b',

  /** Aksen (setara border-emerald-500 / text-emerald-500) */
  accent: '#1e3a8a',
  accentLight: '#3b82f6',

  /** Kartu ringkasan transaksi */
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  cardRadius: '12px',
  cardDetailBg: '#f8fafc',
  cardDetailBorder: '#e2e8f0',
  cardTotalBg: '#eff6ff',
  cardTotalBorder: '#bfdbfe',
  cardTotalText: '#1e3a8a',

  /** Ringkasan sukses (tetap hijau semantik) */
  surfaceSuccessBg: '#ecfdf5',
  surfaceSuccessBorder: '#a7f3d0',
  surfaceSuccessText: '#14532d',

  /** CTA (setara bg-emerald-500 → primary) */
  primary: '#1e3a8a',
  primaryForeground: '#ffffff',
  ctaRadius: '8px',

  /** Footer (setara bg-slate-900; diganti primary gelap) */
  footerBg: '#172554',
  footerBorder: '#1e3a8a',
  footerLabel: '#93c5fd',
  footerText: '#e2e8f0',
  footerMuted: '#94a3b8',
  footerLink: '#bfdbfe',

  disclaimerText: '#94a3b8',
  disclaimerBorder: '#e2e8f0',
} as const
