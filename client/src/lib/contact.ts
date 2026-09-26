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
