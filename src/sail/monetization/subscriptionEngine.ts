/**
 * SAIL Monetization Engine
 *
 * Manages:
 *  1. Subscriptions table with plan, status, dates
 *  2. 7-day free trial for all new users
 *  3. Premium access to Study Mode features
 *  4. Access control: if (trial_active || plan === "premium") { allow Study Mode }
 *  5. Trial expiration monitoring
 *  6. Revenue tracking and metrics
 *
 * Supabase Table: subscriptions
 * Schema:
 *   id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id               uuid NOT NULL REFERENCES auth.users(id)
 *   plan                  text NOT NULL DEFAULT 'trial'
 *   status                text NOT NULL DEFAULT 'trial'
 *   trial_start           timestamptz
 *   trial_end             timestamptz
 *   current_period_start  timestamptz DEFAULT now()
 *   current_period_end    timestamptz
 *   price_monthly         numeric DEFAULT 0
 *   currency              text DEFAULT 'ZAR'
 *   features              jsonb DEFAULT '[]'
 *   payment_method        text
 *   cancelled_at          timestamptz
 *   created_at            timestamptz DEFAULT now()
 *   updated_at            timestamptz DEFAULT now()
 */

import { supabase } from '../../integrations/supabase/client';
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionFeatures,
} from '../types';
import { PLAN_FEATURES, PLAN_PRICING, TRIAL_DURATION_DAYS } from '../types';

// ─── Subscription Engine ────────────────────────────────────────────────────────

export class SubscriptionEngine {
  private static instance: SubscriptionEngine;
  private cache: Map<string, { sub: Subscription; fetchedAt: number }> = new Map();
  private CACHE_TTL = 60_000; // 1 minute

  static getInstance(): SubscriptionEngine {
    if (!SubscriptionEngine.instance) {
      SubscriptionEngine.instance = new SubscriptionEngine();
    }
    return SubscriptionEngine.instance;
  }

  // ── Get user's current subscription ───────────────────────────────────────
  async getSubscription(userId: string): Promise<Subscription | null> {
    // Check cache
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return cached.sub;
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[SAIL Monetization] Error fetching subscription:', error.message);
        return null;
      }

      if (data) {
        const sub = data as unknown as Subscription;
        this.cache.set(userId, { sub, fetchedAt: Date.now() });
        return sub;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ── Create a trial subscription for a new user ────────────────────────────
  async startTrial(userId: string): Promise<Subscription | null> {
    // Check if user already has a subscription
    const existing = await this.getSubscription(userId);
    if (existing) return existing;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 86_400_000);

    const subData = {
      user_id: userId,
      plan: 'trial' as SubscriptionPlan,
      status: 'trial' as SubscriptionStatus,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      price_monthly: 0,
      currency: 'ZAR',
      features: Object.keys(PLAN_FEATURES.trial).filter(
        k => (PLAN_FEATURES.trial as any)[k] === true
      ),
      payment_method: null,
    };

    try {
      const { data, error } = await supabase
        .from('subscriptions' as any)
        .insert(subData as any)
        .select()
        .single();

      if (error) {
        console.warn('[SAIL Monetization] Error creating trial:', error.message);
        // Return in-memory subscription
        return {
          id: `sub-trial-${userId}`,
          ...subData,
          cancelled_at: null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        } as unknown as Subscription;
      }

      const sub = data as unknown as Subscription;
      this.cache.set(userId, { sub, fetchedAt: Date.now() });
      return sub;
    } catch {
      return null;
    }
  }

  // ── Upgrade to a paid plan ────────────────────────────────────────────────
  async upgradePlan(userId: string, plan: SubscriptionPlan, paymentMethod?: string): Promise<boolean> {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000); // 30 days

    const pricing = PLAN_PRICING[plan];

    try {
      const existing = await this.getSubscription(userId);

      if (existing) {
        const { error } = await supabase
          .from('subscriptions' as any)
          .update({
            plan,
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            price_monthly: pricing.monthly,
            currency: pricing.currency,
            payment_method: paymentMethod || existing.payment_method,
            features: Object.keys(PLAN_FEATURES[plan]).filter(
              k => (PLAN_FEATURES[plan] as any)[k] === true
            ),
            updated_at: now.toISOString(),
          } as any)
          .eq('id', existing.id);

        if (error) {
          console.warn('[SAIL Monetization] Error upgrading plan:', error.message);
          return false;
        }
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('subscriptions' as any)
          .insert({
            user_id: userId,
            plan,
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            price_monthly: pricing.monthly,
            currency: pricing.currency,
            payment_method: paymentMethod || null,
            features: Object.keys(PLAN_FEATURES[plan]).filter(
              k => (PLAN_FEATURES[plan] as any)[k] === true
            ),
          } as any);

        if (error) {
          console.warn('[SAIL Monetization] Error creating subscription:', error.message);
          return false;
        }
      }

      // Invalidate cache
      this.cache.delete(userId);
      return true;
    } catch {
      return false;
    }
  }

  // ── Cancel subscription ───────────────────────────────────────────────────
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const existing = await this.getSubscription(userId);
      if (!existing) return false;

      const { error } = await supabase
        .from('subscriptions' as any)
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existing.id);

      if (error) {
        console.warn('[SAIL Monetization] Error cancelling:', error.message);
        return false;
      }

      this.cache.delete(userId);
      return true;
    } catch {
      return false;
    }
  }

  // ── Check if user has active access (trial or paid) ────────────────────────
  async hasAccess(userId: string, feature?: keyof SubscriptionFeatures): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    if (!sub) return false;

    // Check trial
    if (sub.status === 'trial') {
      if (sub.trial_end && new Date(sub.trial_end) > new Date()) {
        if (feature) {
          return (PLAN_FEATURES.trial as any)[feature] === true;
        }
        return true; // Trial active
      }
      return false; // Trial expired
    }

    // Check active subscription
    if (sub.status === 'active') {
      if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
        if (feature) {
          const plan = sub.plan as SubscriptionPlan;
          return (PLAN_FEATURES[plan] as any)[feature] === true;
        }
        return true;
      }
      return false; // Subscription expired
    }

    return false;
  }

  // ── The core access control check ─────────────────────────────────────────
  // if (trial_active || plan === "premium") { allow Study Mode }
  async canAccessStudyMode(userId: string): Promise<{
    allowed: boolean;
    reason: string;
    plan: SubscriptionPlan | null;
    daysRemaining: number | null;
    trialActive: boolean;
  }> {
    const sub = await this.getSubscription(userId);

    if (!sub) {
      return {
        allowed: false,
        reason: 'No subscription found. Start your free trial!',
        plan: null,
        daysRemaining: null,
        trialActive: false,
      };
    }

    // Trial check
    if (sub.status === 'trial' && sub.trial_end) {
      const trialEnd = new Date(sub.trial_end);
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000));

      if (daysRemaining > 0) {
        return {
          allowed: true,
          reason: `Free trial: ${daysRemaining} days remaining`,
          plan: 'trial',
          daysRemaining,
          trialActive: true,
        };
      }

      return {
        allowed: false,
        reason: 'Your free trial has expired. Upgrade to continue!',
        plan: 'trial',
        daysRemaining: 0,
        trialActive: false,
      };
    }

    // Premium / Active check
    if (sub.status === 'active' && (sub.plan === 'premium' || sub.plan === 'basic' || sub.plan === 'enterprise')) {
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const daysRemaining = periodEnd
        ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000))
        : null;

      return {
        allowed: true,
        reason: `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan active`,
        plan: sub.plan,
        daysRemaining,
        trialActive: false,
      };
    }

    return {
      allowed: false,
      reason: 'Subscription inactive. Please renew.',
      plan: sub.plan,
      daysRemaining: null,
      trialActive: false,
    };
  }

  // ── Get features for user's plan ──────────────────────────────────────────
  async getUserFeatures(userId: string): Promise<SubscriptionFeatures> {
    const sub = await this.getSubscription(userId);
    if (!sub) return PLAN_FEATURES.free;

    if (sub.status === 'trial') {
      const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
      if (trialEnd && trialEnd > new Date()) {
        return PLAN_FEATURES.trial;
      }
      return PLAN_FEATURES.free;
    }

    if (sub.status === 'active') {
      return PLAN_FEATURES[sub.plan as SubscriptionPlan] || PLAN_FEATURES.free;
    }

    return PLAN_FEATURES.free;
  }

  // ── Get trial status ──────────────────────────────────────────────────────
  async getTrialStatus(userId: string): Promise<{
    hasTrialed: boolean;
    trialActive: boolean;
    daysRemaining: number;
    trialStart: string | null;
    trialEnd: string | null;
  }> {
    const sub = await this.getSubscription(userId);

    if (!sub || sub.plan !== 'trial') {
      return {
        hasTrialed: !!sub,
        trialActive: false,
        daysRemaining: 0,
        trialStart: null,
        trialEnd: null,
      };
    }

    const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
    const daysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
      : 0;

    return {
      hasTrialed: true,
      trialActive: daysRemaining > 0,
      daysRemaining,
      trialStart: sub.trial_start,
      trialEnd: sub.trial_end,
    };
  }

  // ── Get revenue metrics ───────────────────────────────────────────────────
  async getRevenueMetrics(): Promise<{
    totalSubscribers: number;
    activeTrials: number;
    monthlyRevenue: number;
    trialConversionRate: number;
    churnRate: number;
  }> {
    try {
      const { data: allSubs } = await supabase
        .from('subscriptions' as any)
        .select('plan, status, price_monthly, trial_end, cancelled_at');

      const subs = (allSubs || []) as unknown as Subscription[];
      const now = new Date();

      const activeTrials = subs.filter(
        s => s.status === 'trial' && s.trial_end && new Date(s.trial_end) > now
      ).length;

      const activePaid = subs.filter(s => s.status === 'active').length;
      const cancelled = subs.filter(s => s.status === 'cancelled').length;
      const converted = subs.filter(s => s.status === 'active' && s.trial_start).length;
      const totalTrials = subs.filter(s => s.trial_start).length;

      return {
        totalSubscribers: activePaid,
        activeTrials,
        monthlyRevenue: subs
          .filter(s => s.status === 'active')
          .reduce((sum, s) => sum + (s.price_monthly || 0), 0),
        trialConversionRate: totalTrials > 0 ? converted / totalTrials : 0,
        churnRate: (activePaid + cancelled) > 0 ? cancelled / (activePaid + cancelled) : 0,
      };
    } catch {
      return {
        totalSubscribers: 0,
        activeTrials: 0,
        monthlyRevenue: 0,
        trialConversionRate: 0,
        churnRate: 0,
      };
    }
  }

  // ── Clear cache ───────────────────────────────────────────────────────────
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────────

export const subscriptionEngine = SubscriptionEngine.getInstance();
