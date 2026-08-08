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
    accountName: 'StudySync (Pty) Ltd',
    bank: 'FNB',
    accountNumber: '0000000000',
    branchCode: '250655',
    reference: 'Your email address',
  },
  ecocash: {
    name: 'StudySync',
    number: '+263 00 000 0000',
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
