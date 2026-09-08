/**
 * Shared WhatsApp deep-links for the public site.
 * Keeping the number + message in one place so we can update them later.
 */
export const WHATSAPP_ADMIN_NUMBER = "27686523995";

export const WHATSAPP_ADMIN_URL =
  `https://wa.me/${WHATSAPP_ADMIN_NUMBER}?text=` +
  encodeURIComponent(
    "Hi StudySync, I'd like help building my child's study plan."
  );

/** Invite link for the public StudySync student study community. */
export const WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/E6vmLWM13LoCrMpc757QLF?s=cl&p=i&mlu=4";

/** In-app page that collects a signup before revealing the invite link. */
export const COMMUNITY_PAGE_PATH = "/community";

export function openWhatsAppAdmin() {
  if (typeof window === "undefined") return;
  window.open(WHATSAPP_ADMIN_URL, "_blank", "noopener,noreferrer");
}
