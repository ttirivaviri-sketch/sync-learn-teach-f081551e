/**
 * Manual payment (deposit / EFT / EcoCash) configuration.
 *
 * Edit these values with your real banking details — they are shown to
 * learners on the Study Mode paywall. Nothing here is a secret.
 */

import { PRICING } from '@/sail/types';

/** Official StudySync fee structure (single source of truth: PRICING). */
export const STUDY_PLANS = [
  {
    id: 'ai_moderate',
    label: 'AI Moderate',
    blurb: 'Daily tasks, quizzes, flashcards, Photo Solve, AI tutor',
    priceZar: PRICING.ai_moderate.monthly,
    accessDays: 30,
  },
  {
    id: 'ai_premium',
    label: 'AI Premium',
    blurb: 'Everything in Moderate + adaptive plans, past-paper analysis, unlimited AI',
    priceZar: PRICING.ai_premium.monthly,
    accessDays: 30,
  },
] as const;

export type StudyPlanId = (typeof STUDY_PLANS)[number]['id'];

export const SUPPORTED_CURRENCIES = ['ZAR', 'USD'] as const;
export type PaymentCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MANUAL_PAYMENT = {
  priceZar: PRICING.ai_moderate.monthly,
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

