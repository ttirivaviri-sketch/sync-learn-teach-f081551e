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

export function openWhatsAppAdmin() {
  if (typeof window === "undefined") return;
  window.open(WHATSAPP_ADMIN_URL, "_blank", "noopener,noreferrer");
}
