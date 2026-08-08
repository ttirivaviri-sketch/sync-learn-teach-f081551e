/**
 * useGoogleOAuthProfileSync — normalise Google OAuth sign-ups.
 *
 * Problem: Supabase's `signInWithOAuth` cannot pass custom metadata (e.g.
 * user_type) through the Google round-trip. The `handle_new_user` trigger
 * therefore defaults every Google sign-up to `learner`, even when the user
 * clicked "Continue with Google" on the tutor auth page.
 *
 * Solution: AuthForm writes the intended user_type to localStorage right
 * before the OAuth redirect. After Google returns the user to the app, this
 * hook reads that value and, only for brand-new accounts, updates the
 * profiles row to the correct type. The localStorage key is cleared immediately.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

const GOOGLE_OAUTH_USER_TYPE_KEY = "ss-google-oauth-user-type";
const NEW_USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export function useGoogleOAuthProfileSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const pendingUserType = localStorage.getItem(GOOGLE_OAUTH_USER_TYPE_KEY);
    if (!pendingUserType) return;

    const sync = async () => {
      try {
        // Re-validate the current user; we need `created_at` to decide if this
        // is a brand-new account (only new sign-ups should be re-typed).
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          logger.warn("[GoogleOAuthProfileSync] Could not get current user", userError);
          return;
        }

        const createdAt = new Date(userData.user.created_at);
        const isNewUser = createdAt.getTime() > Date.now() - NEW_USER_WINDOW_MS;
        if (!isNewUser) {
          logger.info("[GoogleOAuthProfileSync] Existing user; skipping user_type sync");
          return;
        }

        // Only overwrite the default 'learner' value; never change an existing
        // tutor/admin account when someone signs in on a different page.
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            user_type: pendingUserType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .eq("user_type", "learner");

        if (updateError) {
          logger.error("[GoogleOAuthProfileSync] Failed to update profile user_type", updateError);
          return;
        }

        // Mirror the same value into auth.users metadata so future triggers
        // and edge functions see the canonical role.
        await supabase.auth.updateUser({ data: { user_type: pendingUserType } });

        logger.info("[GoogleOAuthProfileSync] Synced user_type", {
          userId,
          userType: pendingUserType,
        });
      } catch (err) {
        logger.error("[GoogleOAuthProfileSync] Unexpected error", err as Error);
      } finally {
        localStorage.removeItem(GOOGLE_OAUTH_USER_TYPE_KEY);
      }
    };

    sync();
  }, [userId]);
}
