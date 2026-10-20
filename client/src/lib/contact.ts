/**
 * The platform's public WhatsApp contact.
 *
 * wa.me needs the number in international format with no "+" and no spaces.
 * Every "chat with us" link should be built here so the number lives in one
 * place instead of being pasted around the site.
 */
export const WHATSAPP_NUMBER = "2349168324043";

/** Shown in the footer and the organizers page, so people can read it. */
export const WHATSAPP_DISPLAY = "+234 916 832 4043";

const DEFAULT_GREETING =
  "Hi Black Heritage, I want to talk about selling tickets for my event.";

/** Open a chat with the team, pre-filled so the first reply has context. */
export function whatsappLink(message: string = DEFAULT_GREETING): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Official Black Heritage WhatsApp Community link.
 * Used on post-purchase screens and ticket views so attendees can connect.
 */
export const BLACK_HERITAGE_WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/KuirUdtxvBN5Ev9rKdNDlg";

/**
 * The "Join the community" buttons open the community invite itself. They
 * used to open a 1:1 chat with the team number asking to be added, which
 * left every request waiting on a person. Invite links take no message.
 */
export function blackHeritageCommunityWhatsAppLink(_eventTitle?: string): string {
  return BLACK_HERITAGE_WHATSAPP_COMMUNITY_URL;
}
