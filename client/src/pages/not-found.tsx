import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md border border-hairline rounded-md bg-surface p-10 text-center">
        <p className="eyebrow">404 · off the guest list</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink leading-tight">
          This page isn't on the list
        </h1>
        <div className="mt-4 h-0.5 w-16 bg-gold mx-auto" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-ink leading-relaxed">
          The link may be broken, or the page has moved. The good stuff is
          still one tap away.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
              Return Home
            </Button>
          </Link>
          <Link href="/events">
            <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
              Browse events →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
