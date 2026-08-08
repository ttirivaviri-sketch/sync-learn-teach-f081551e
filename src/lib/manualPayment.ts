/**
 * Manual payment (deposit / EFT / EcoCash) configuration.
 *
 * Edit these values with your real banking details — they are shown to
 * learners on the Study Mode paywall. Nothing here is a secret.
 */

export const MANUAL_PAYMENT = {
  priceZar: 250,
  accessDays: 30,
  bank: {
    accountName: 'MISS. MISHELL DANDA',
    bank: 'Standard Bank',
    accountNumber: '10 20 487 9092',
    branch: 'MELVILLE',
    branchCode: '006105',
    swiftCode: 'SBZAZAJJ',
    reference: 'Your email address',
  },
  ecocash: {
    name: 'Israel Tapiwa Potera',
    number: '+263 78 204 1111',
    reference: 'Your email address',
  },
  whatsapp: '27686523995',
} as const;

export type ManualPaymentMethod = 'deposit' | 'eft' | 'ecocash';

export const METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  deposit: 'Cash deposit',
  eft: 'Bank transfer (EFT)',
  ecocash: 'EcoCash',
};

