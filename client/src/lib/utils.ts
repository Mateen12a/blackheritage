import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The public link for an event: the pretty /e/<slug> when it has one. */
export function eventPath(event: { id?: string | number | null; slug?: string | null } | null | undefined): string {
  return event?.slug ? `/e/${event.slug}` : `/events/${event?.id ?? ""}`;
}
