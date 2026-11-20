import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { whatsappLink } from "@/lib/contact";
import {
  TALENT_HUNT,
  CHALLENGE_CATEGORY_LABEL,
  CHALLENGE_STATUS_LABEL,
  CLIP_LENGTH_GRACE_SECONDS,
  challengeCategories,
  challengeEntryStatuses,
  formatClipLength,
  type ChallengeCategory,
  type ChallengeEntryStatus,
  type ChallengePhase,
} from "@shared/challenge";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Footprints,
  Instagram,
  Laugh,
  Loader2,
  Megaphone,
  MessageCircle,
  Music,
  Trophy,
  Upload,
  Video,
} from "lucide-react";

const API = "/api/challenges/talent-hunt";
const ENTRIES_API = `${API}/entries`;
const ADMIN_API = "/api/admin/challenges/talent-hunt/entries";
const BASE_URL = import.meta.env.VITE_API_URL || "";
const MAX_UPLOAD_BYTES = TALENT_HUNT.maxUploadMB * 1024 * 1024;
const MAX_LENGTH = formatClipLength(TALENT_HUNT.maxVideoSeconds);
const WHATSAPP_SHRINK_TIP = "Send it to yourself on WhatsApp, save the copy WhatsApp makes (it's much smaller) and upload that.";

type VideoSource = "link" | "upload";

type MyEntry = {
  id: string;
  category: ChallengeCategory;
  stageName: string;
  videoUrl: string;
  videoSource: VideoSource;
  status: ChallengeEntryStatus;
  vendorId: string | null;
};

type ContestState = {
  phase: ChallengePhase;
  counts: Record<ChallengeCategory, number>;
  total: number;
  mine: MyEntry[];
  storage?: { usedBytes: number; budgetBytes: number };
};

/** Uploaded files are stored site-relative; links are absolute. */
const mediaHref = (url: string) => (url.startsWith("/") ? `${BASE_URL}${url}` : url);

const sizeLabel = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  return mb >= 1024 ? `${trim(mb / 1024)} GB` : `${mb < 10 ? trim(mb) : Math.round(mb)} MB`;
};

/** Length of a picked clip, read by the browser. Null when it can't tell (some iPhone files); the server checks again. */
function readClipSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(seconds);
    };
    const timer = window.setTimeout(() => done(null), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** fetch can't report upload progress; on mobile data a 30 MB clip needs a progress bar. */
function postWithProgress(url: string, body: FormData, onProgress: (pct: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}${url}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* an HTML error page from the proxy */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      reject(new Error(
        data.message ||
          (xhr.status === 413 ? `That video is over ${TALENT_HUNT.maxUploadMB} MB. ${WHATSAPP_SHRINK_TIP}` : "Your entry didn't save. Try again in a moment."),
      ));
    };
    xhr.onerror = () => reject(new Error("The upload stopped. Check your connection and try again."));
    xhr.send(body);
  });
}

const CATEGORY_COPY: Record<ChallengeCategory, { Icon: typeof Music; line: string }> = {
  music: { Icon: Music, line: "Sing, rap, or play an instrument." },
  dance: { Icon: Footprints, line: "Solo or crew, any style." },
  comedy: { Icon: Laugh, line: "Stand-up, a skit, crowd work." },
};

const PHASE_LINE: Record<ChallengePhase, string> = {
  upcoming: "Entries open Mon 16 Nov",
  open: `Entries open until ${TALENT_HUNT.closesOn}, 11:59 PM`,
  judging: `Entries closed. Top 10 on ${TALENT_HUNT.shortlistOn}, winners on ${TALENT_HUNT.winnersOn}`,
  winners: "Winners announced",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function errorText(err: any): string {
  const raw = String(err?.message || "").replace(/^\d+:\s*/, "");
  try {
    return JSON.parse(raw).message || raw;
  } catch {
    return raw;
  }
}

const SIGNIN_HREF = `/auth?returnTo=${encodeURIComponent("/challenges")}`;

export default function ChallengesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data } = useQuery<ContestState>({ queryKey: [API], staleTime: 30_000 });
  const phase: ChallengePhase = data?.phase ?? "upcoming";
  const mine = data?.mine ?? [];

  return (
    <div className="min-h-screen bg-background pb-20 pt-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Said simply: anyone should get it in five seconds, reading or not. */}
        <header className="mx-auto mb-6 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            {TALENT_HUNT.title} · Free
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Sing. Dance. Make us laugh.
          </h1>
          <p className="mt-3 text-lg text-ink">
            <span className="font-bold text-gold">{naira(TALENT_HUNT.prizeNaira * 3)}</span> in prizes up for grabs.
          </p>
          <p className="mt-1 text-sm text-muted-ink">
            Winners perform live at OAU on {TALENT_HUNT.stage.date}. {PHASE_LINE[phase]}.
          </p>
          {data && data.total >= 25 && (
            <p className="mt-2 text-xs text-muted-ink">{data.total} entries so far</p>
          )}
        </header>

        <ol className="mx-auto mb-6 grid max-w-2xl grid-cols-3 gap-2 text-center" aria-label="How it works">
          {[
            { Icon: Video, top: "Film 1 minute", sub: "on your phone" },
            { Icon: Upload, top: "Send it here", sub: "no payment" },
            { Icon: Trophy, top: "Win + perform", sub: `at OAU, ${TALENT_HUNT.stage.date}` },
          ].map(({ Icon, top, sub }, i) => (
            <li key={top} className="rounded-lg border border-hairline bg-surface px-2 py-3">
              <Icon className="mx-auto h-6 w-6 text-gold" aria-hidden="true" />
              <p className="mt-1.5 text-sm font-semibold text-ink"><span className="sr-only">Step {i + 1}: </span>{top}</p>
              <p className="text-xs text-muted-ink">{sub}</p>
            </li>
          ))}
        </ol>

        {/* The form comes first: it's why people are here. */}
        <div className="mx-auto max-w-2xl space-y-6">
          <EntryPanel phase={phase} signedIn={!!user} isAdmin={isAdmin} mine={mine} />
          {mine.length > 0 && <MyEntries entries={mine} />}
        </div>

        <h2 className="mt-12 mb-4 font-display text-2xl font-bold text-ink">The details</h2>

        {/* Prizes */}
        <section aria-labelledby="prizes" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <h2 id="prizes" className="sr-only">Prizes</h2>
          {challengeCategories.map((c) => {
            const { Icon, line } = CATEGORY_COPY[c];
            return (
              <div key={c} className="rounded-md border border-hairline bg-surface p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-gold" aria-hidden="true" />
                  {CHALLENGE_CATEGORY_LABEL[c]}
                </div>
                <p className="mt-3 font-display text-2xl font-bold text-ink">One winner</p>
                <p className="mt-1 text-xs text-muted-ink">A share of {naira(TALENT_HUNT.prizeNaira * 3)} + perform at {TALENT_HUNT.stage.title}</p>
                <p className="mt-3 text-sm text-muted-ink">{line}</p>
              </div>
            );
          })}
        </section>

        <div className="mt-6">
          {/* How to enter + dates + rules */}
          <div className="space-y-6 min-w-0">
            <section className="rounded-md border border-hairline bg-surface p-6">
              <h2 className="font-display text-xl font-bold text-ink">Dates</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Entries open", "Mon 16 Nov"],
                  ["Entries close", `${TALENT_HUNT.closesOn}, 11:59 PM`],
                  ["Top 10 per category", TALENT_HUNT.shortlistOn],
                  ["Winners announced", TALENT_HUNT.winnersOn],
                  ["Winners perform", `${TALENT_HUNT.stage.date}, OAU Ile-Ife`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-hairline pb-2.5 last:border-0 last:pb-0">
                    <dt className="text-muted-ink">{k}</dt>
                    <dd className="text-right text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

        </div>

        <RulesSection />

        {isAdmin && <JudgingPanel />}

        {/* Organizer path */}
        <Reveal>
          <section className="mt-10 rounded-md border border-hairline bg-surface-2 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Megaphone className="h-4 w-4 text-gold" aria-hidden="true" />
              Run a talent hunt for your event
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-ink leading-relaxed">
              Auditions, open calls and showcases: Black Heritage takes the entries, builds every entrant a talent profile, and gives your judges one list to score.
            </p>
            <a
              href={whatsappLink("Hi Black Heritage, I want to run a talent hunt or open call for my event.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block"
            >
              <Button className="press h-9 bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-gold-soft sm:text-sm">
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Message on WhatsApp
              </Button>
            </a>
          </section>
        </Reveal>
      </div>
    </div>
  );
}

/**
 * The rules, grouped by the question an entrant actually has. Every date and
 * amount comes from TALENT_HUNT so the page can't drift from the server.
 */
function RulesSection() {
  const pool = naira(TALENT_HUNT.prizeNaira * 3);
  const groups: { title: string; items: React.ReactNode[] }[] = [
    {
      title: "Who can enter",
      items: [
        "Anyone 16 or older living in Nigeria.",
        "One entry per category. You can enter Music, Dance and Comedy, once each.",
        "Groups and crews are welcome. One person enters for the group and receives the prize for everyone.",
      ],
    },
    {
      title: "Your video",
      items: [
        `${TALENT_HUNT.maxVideoSeconds / 60} minute or less. Any phone camera is fine.`,
        "It must be your own performance. Covers are fine; reposting someone else's video is not.",
        `Upload an MP4 or MOV up to ${TALENT_HUNT.maxUploadMB} MB, or paste the link to your public Instagram or TikTok post. Keep that post public until ${TALENT_HUNT.winnersOn}.`,
        "Keep it clean: no hate, no nudity, and no insults aimed at real people.",
      ],
    },
    {
      title: "Judging",
      items: [
        "A panel of three judges scores every entry: talent and skill 50%, originality 30%, stage presence and engagement 20%.",
        "Likes and shares only count inside the engagement score. Bought likes, views or followers mean disqualification.",
        `Top 10 per category on ${TALENT_HUNT.shortlistOn}, winners on ${TALENT_HUNT.winnersOn}. The judges' decision is final.`,
      ],
    },
    {
      title: "Prizes",
      items: [
        `${pool} in total: ${naira(TALENT_HUNT.prizeNaira)} to the winner of each category.`,
        `Each winner performs at the ${TALENT_HUNT.stage.title}, ${TALENT_HUNT.stage.venue}, ${TALENT_HUNT.stage.date}. You need to be able to get to OAU Ile-Ife that day; we confirm stage times with each winner.`,
        <>
          Winners verify their ID and sign the Black Heritage talent agreement. We pay the prize by bank transfer within 7 days of that, and announce each payment with the winner's permission.{" "}
          <a
            href={whatsappLink("Hi Black Heritage, can I see a copy of the BH Challenge winner's agreement?")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-hairline underline-offset-4 hover:text-gold"
          >
            Ask us for a copy on WhatsApp
          </a>
          .
        </>,
      ],
    },
    {
      title: "Your content",
      items: [
        `You keep the rights to your performance. By entering, you let Black Heritage repost it, with credit, to promote the ${TALENT_HUNT.title} and the ${TALENT_HUNT.stage.title}.`,
        "An entry that breaks these rules can be removed at any stage, including after winners are announced.",
        "If a date changes, we post it here and on @blackhevents first.",
      ],
    },
  ];

  return (
    <section id="rules" aria-labelledby="rules-title" className="mt-8 scroll-mt-24 rounded-md border border-hairline bg-surface p-6 sm:p-8">
      <h2 id="rules-title" className="font-display text-xl font-bold text-ink sm:text-2xl">
        Rules
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-ink">
        The short version: your own performance, {TALENT_HUNT.maxVideoSeconds / 60} minute or less, one entry per category, and no
        bought likes.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="min-w-0 border-t border-hairline pt-4">
            <h3 className="text-sm font-semibold text-ink">{g.title}</h3>
            <ul className="mt-2.5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-ink marker:text-hairline">
              {g.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function MyEntries({ entries }: { entries: MyEntry[] }) {
  return (
    <section className="rounded-md border border-hairline bg-surface p-6">
      <h2 className="font-display text-xl font-bold text-ink">Your entries</h2>
      <ul className="mt-4 space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {CHALLENGE_CATEGORY_LABEL[e.category]} · {e.stageName}
              </p>
              <a href={mediaHref(e.videoUrl)} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-muted-ink hover:text-gold">
                {e.videoSource === "upload" ? "Your uploaded video" : e.videoUrl}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  e.status === "winner" || e.status === "shortlisted" ? "border-gold/50 text-gold" : "border-hairline text-muted-ink",
                )}
              >
                {CHALLENGE_STATUS_LABEL[e.status]}
              </span>
              {e.vendorId && (
                <Link href={`/talent/${e.vendorId}`} className="text-xs text-ink underline decoration-hairline underline-offset-4 hover:text-gold">
                  Your profile
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const EMPTY_FORM = {
  category: "" as "" | ChallengeCategory,
  stageName: "",
  videoUrl: "",
  about: "",
  whatsapp: "",
  instagram: "",
  tiktok: "",
  city: "",
  email: "",
  followsConfirmed: false,
  acceptsRules: false,
};

/** Plain words for each category: what people actually do, not a label. */
const CATEGORY_WORDS: Record<ChallengeCategory, string> = {
  music: "I sing or rap",
  dance: "I dance",
  comedy: "I make people laugh",
};

function EntryPanel({ phase, signedIn, isAdmin, mine }: { phase: ChallengePhase; signedIn: boolean; isAdmin: boolean; mine: MyEntry[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, stageName: mine[0]?.stageName || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Upload is the default; a link to a public post is the fallback (and costs no disk).
  const [mode, setMode] = useState<VideoSource>("upload");
  const [clip, setClip] = useState<{ file: File; seconds: number | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [done, setDone] = useState<null | { category: ChallengeCategory; createdAccount: boolean; email: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm((f) => ({ ...f, ...patch }));
  const updating = form.category ? mine.find((m) => m.category === form.category) : undefined;
  const keepsUpload = updating?.videoSource === "upload";
  const canSubmit = phase === "open" || isAdmin;

  // Size and length are checked here first, so nobody spends data uploading a clip the server will refuse.
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again should re-run the checks
    if (!file) return;
    setError("");
    const isMp4OrMov = file.type === "video/mp4" || file.type === "video/quicktime" || /\.(mp4|mov)$/i.test(file.name);
    if (!isMp4OrMov) {
      setClip(null);
      return setError("Upload an MP4 or MOV video, the kind your phone camera records.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setClip(null);
      return setError(`This video is ${sizeLabel(file.size)}. The limit is ${TALENT_HUNT.maxUploadMB} MB. ${WHATSAPP_SHRINK_TIP}`);
    }
    setChecking(true);
    const seconds = await readClipSeconds(file);
    setChecking(false);
    if (seconds !== null && seconds > TALENT_HUNT.maxVideoSeconds + CLIP_LENGTH_GRACE_SECONDS) {
      setClip(null);
      return setError(`This video is ${formatClipLength(seconds)}. Trim it to ${MAX_LENGTH} or less, then choose it again.`);
    }
    setClip({ file, seconds });
  };

  if (done) {
    return (
      <section id="enter" className="scroll-mt-24 rounded-xl border-2 border-gold/60 bg-surface p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-gold" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">You're in! 🎉</h2>
        <p className="mt-2 text-base text-ink">
          Your {CHALLENGE_CATEGORY_LABEL[done.category]} video is with the judges.
        </p>
        <p className="mt-2 text-sm text-muted-ink">
          Top 10 comes out on {TALENT_HUNT.shortlistOn}. If you make it, we'll message you on WhatsApp.
        </p>
        {done.createdAccount && (
          <p className="mt-4 rounded-md bg-surface-2 p-3 text-xs text-muted-ink">
            We made your free Black Heritage account with <span className="text-ink">{done.email}</span>. To sign in later,
            tap "Forgot password" and set your own.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a href={`https://wa.me/?text=${encodeURIComponent(`I just entered the ${TALENT_HUNT.title}! ${naira(TALENT_HUNT.prizeNaira * 3)} in prizes up for grabs, free to enter: https://blackhevents.com/challenges`)}`} target="_blank" rel="noopener noreferrer">
            <Button className="press h-11 w-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-gold-soft">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Tell your friends
            </Button>
          </a>
          <Button variant="outline" className="h-11 border-hairline text-ink" onClick={() => setDone(null)}>
            Enter another category
          </Button>
        </div>
      </section>
    );
  }

  if (!canSubmit) {
    return (
      <section className="rounded-md border border-hairline bg-surface p-6">
        <h2 className="font-display text-xl font-bold text-ink">
          {phase === "upcoming" ? "Entries open Monday" : "Entries are closed"}
        </h2>
        <p className="mt-2 text-sm text-muted-ink leading-relaxed">
          {phase === "upcoming"
            ? "Record your video now, 1 minute or less. On Monday 16 November, come back here and upload it."
            : `Judging is on. The top 10 per category are announced on ${TALENT_HUNT.shortlistOn} and the winners on ${TALENT_HUNT.winnersOn}.`}
        </p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsSignIn(false);
    if (!form.category) return setError("Step 1: tap what you do");
    if (mode === "upload" && !clip && !keepsUpload) return setError("Step 2: choose your video");
    if (mode === "link" && !form.videoUrl.trim() && !updating) return setError("Step 2: paste your TikTok or Instagram link");
    if (form.stageName.trim().length < 2) return setError("Step 3: write your name");
    if (form.whatsapp.replace(/\D/g, "").length < 7) return setError("Step 3: add your WhatsApp number");
    if (!signedIn && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setError("Step 3: add your email");
    if (!form.acceptsRules) return setError("Tick the box at the bottom");
    setSaving(true);
    try {
      // An empty videoUrl with no file keeps the video already on the entry.
      // One tick covers following us and the rules; signed-in entrants send no email.
      const fields: Record<string, unknown> = {
        ...form,
        followsConfirmed: form.acceptsRules,
        videoUrl: mode === "link" ? form.videoUrl.trim() : "",
      };
      if (signedIn) delete fields.email;
      else fields.email = form.email.trim();
      let body: any;
      if (mode === "upload" && clip) {
        const data = new FormData();
        for (const [key, value] of Object.entries(fields)) data.append(key, String(value));
        data.append("video", clip.file);
        setProgress(0);
        body = await postWithProgress(ENTRIES_API, data, setProgress);
      } else {
        const res = await apiRequest("POST", ENTRIES_API, fields);
        body = await res.json();
      }
      await queryClient.invalidateQueries({ queryKey: [API] });
      // A first-time entrant is now signed in; refresh who the app thinks we are.
      if (body.createdAccount) await queryClient.invalidateQueries({ queryKey: [`${BASE_URL}/api/auth/user`] });
      if (body.updated) {
        toast({ title: "Entry updated", description: `Your ${CHALLENGE_CATEGORY_LABEL[form.category as ChallengeCategory]} entry is updated.` });
      } else {
        setDone({ category: form.category as ChallengeCategory, createdAccount: Boolean(body.createdAccount), email: form.email.trim() });
        requestAnimationFrame(() => document.getElementById("enter")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      setClip(null);
      setForm((f) => ({ ...EMPTY_FORM, stageName: f.stageName, whatsapp: f.whatsapp, instagram: f.instagram, tiktok: f.tiktok, city: f.city }));
    } catch (err: any) {
      const msg = errorText(err) || "Your entry didn't save. Try again in a moment.";
      if (/already has a Black Heritage account/i.test(msg)) setNeedsSignIn(true);
      setError(msg);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const field = "border-hairline bg-background text-ink h-11";

  return (
    <section id="enter" className="scroll-mt-24 rounded-xl border-2 border-gold/40 bg-surface p-5 sm:p-6">
      <h2 className="font-display text-2xl font-bold text-ink">Enter now. It's free.</h2>
      <p className="mt-1 text-sm text-muted-ink">3 quick steps. No payment.</p>
      {isAdmin && phase !== "open" && (
        <p className="mt-2 text-xs text-muted-ink">Admin: you can submit outside the entry window to test.</p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-6" noValidate>
        {/* Step 1 */}
        <fieldset>
          <legend className="flex items-center gap-2 text-base font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
            What do you do?
          </legend>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="What do you do?">
            {challengeCategories.map((c) => {
              const on = form.category === c;
              const { Icon } = CATEGORY_COPY[c];
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    set({ category: c });
                    setError("");
                    // Editing an entry starts from how that entry's video was sent.
                    const previous = mine.find((m) => m.category === c);
                    if (previous) setMode(previous.videoSource);
                  }}
                  className={cn(
                    "press flex h-16 items-center gap-3 rounded-lg border-2 px-4 text-left text-base font-semibold transition-colors sm:h-24 sm:flex-col sm:justify-center sm:gap-1.5 sm:text-center sm:text-sm",
                    on ? "border-gold bg-gold/15 text-gold" : "border-hairline text-ink hover:border-gold/50",
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  {CATEGORY_WORDS[c]}
                  {on && <CheckCircle2 className="ml-auto h-5 w-5 sm:hidden" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {updating && (
            <p className="mt-2 text-xs text-muted-ink">You've already entered {CHALLENGE_CATEGORY_LABEL[updating.category]}. Sending again updates that entry.</p>
          )}
        </fieldset>

        {/* Step 2 */}
        <fieldset>
          <legend className="flex items-center gap-2 text-base font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
            Add your video ({MAX_LENGTH} or less)
          </legend>
          {mode === "upload" ? (
            <div className="mt-3 space-y-2">
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPick} />
              {clip ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-gold/50 bg-gold/10 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">Video added</p>
                      <p className="text-xs text-muted-ink">
                        {clip.seconds !== null ? `${formatClipLength(clip.seconds)} · ` : ""}
                        {sizeLabel(clip.file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="shrink-0 text-sm text-ink underline decoration-hairline underline-offset-4 hover:text-gold"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={checking}
                  className="press flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gold/50 bg-background px-4 py-7 text-base font-semibold text-ink transition-colors hover:border-gold"
                >
                  {checking ? (
                    <Loader2 className="h-7 w-7 animate-spin text-gold" aria-hidden="true" />
                  ) : (
                    <Upload className="h-7 w-7 text-gold" aria-hidden="true" />
                  )}
                  <span>{checking ? "Checking your video…" : keepsUpload ? "Choose a new video" : "Tap to choose your video"}</span>
                  <span className="text-xs font-normal text-muted-ink">From your phone gallery</span>
                </button>
              )}
              {keepsUpload && !clip && (
                <p className="text-xs text-muted-ink">Your uploaded video stays unless you choose a new one.</p>
              )}
              <button type="button" onClick={() => { setMode("link"); setError(""); }} className="text-xs text-muted-ink underline decoration-hairline underline-offset-4 hover:text-gold">
                Already posted it on TikTok or Instagram? Paste the link instead
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Label htmlFor="th-video" className="sr-only">Link to your TikTok or Instagram post</Label>
              <Input
                id="th-video"
                type="url"
                inputMode="url"
                value={form.videoUrl}
                placeholder="Paste your TikTok or Instagram link"
                onChange={(e) => set({ videoUrl: e.target.value })}
                className={field}
              />
              <p className="text-xs text-muted-ink">
                {updating ? "Leave it empty to keep your current video." : "The post must be public."}
              </p>
              <button type="button" onClick={() => { setMode("upload"); setError(""); }} className="text-xs text-muted-ink underline decoration-hairline underline-offset-4 hover:text-gold">
                Upload the video from my phone instead
              </button>
            </div>
          )}
        </fieldset>

        {/* Step 3 */}
        <fieldset className="space-y-3">
          <legend className="flex items-center gap-2 text-base font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
            Your details
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="th-name" className="text-sm text-ink">Your name (or stage name)</Label>
            <Input id="th-name" value={form.stageName} maxLength={60} autoComplete="nickname" placeholder="e.g. Tobi Vibes" onChange={(e) => set({ stageName: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-wa" className="text-sm text-ink">WhatsApp number</Label>
            <Input id="th-wa" type="tel" inputMode="tel" autoComplete="tel" value={form.whatsapp} placeholder="0803 123 4567" onChange={(e) => set({ whatsapp: e.target.value })} className={field} />
            <p className="text-xs text-muted-ink">We message you here if you make the Top 10.</p>
          </div>
          {!signedIn && (
            <div className="space-y-1.5">
              <Label htmlFor="th-email" className="text-sm text-ink">Email</Label>
              <Input id="th-email" type="email" inputMode="email" autoComplete="email" value={form.email} placeholder="you@gmail.com" onChange={(e) => set({ email: e.target.value })} className={field} />
              <p className="text-xs text-muted-ink">
                Your confirmation comes here. Already have an account?{" "}
                <Link href={SIGNIN_HREF} className="text-ink underline decoration-hairline underline-offset-4 hover:text-gold">Sign in</Link>
              </p>
            </div>
          )}

          <details className="group rounded-lg border border-hairline bg-background/60 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm text-ink">
              <span className="underline decoration-hairline underline-offset-4 group-open:no-underline">Add more about you</span>{" "}
              <span className="text-muted-ink">(optional, helps the judges)</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="th-about" className="text-sm text-ink">A line about you</Label>
                <Textarea
                  id="th-about"
                  value={form.about}
                  maxLength={300}
                  rows={2}
                  placeholder="e.g. Afro-soul singer from Ile-Ife"
                  onChange={(e) => set({ about: e.target.value })}
                  className="border-hairline bg-background text-ink"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="th-city" className="text-sm text-ink">City or school</Label>
                  <Input id="th-city" value={form.city} maxLength={60} placeholder="e.g. OAU" onChange={(e) => set({ city: e.target.value })} className={field} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="th-ig" className="text-sm text-ink">Instagram</Label>
                  <Input id="th-ig" value={form.instagram} placeholder="@yourname" onChange={(e) => set({ instagram: e.target.value })} className={field} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="th-tt" className="text-sm text-ink">TikTok</Label>
                  <Input id="th-tt" value={form.tiktok} placeholder="@yourname" onChange={(e) => set({ tiktok: e.target.value })} className={field} />
                </div>
              </div>
            </div>
          </details>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm text-ink">
          <Checkbox checked={form.acceptsRules} onCheckedChange={(v) => set({ acceptsRules: v === true, followsConfirmed: v === true })} className="mt-0.5 h-5 w-5" />
          <span>
            I follow{" "}
            <a href={TALENT_HUNT.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-hairline underline-offset-4 hover:text-gold">@blackhevents</a>{" "}
            on Instagram and TikTok, and I agree to the{" "}
            <a href="#rules" className="underline decoration-hairline underline-offset-4 hover:text-gold">rules</a>.
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
            {needsSignIn && (
              <Link href={SIGNIN_HREF} className="ml-1 font-semibold underline underline-offset-4">Sign in now</Link>
            )}
          </div>
        )}

        <Button type="submit" disabled={saving || checking} className="press h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-gold-soft">
          {saving && progress !== null ? (
            progress < 100 ? `Sending your video… ${progress}%` : "Almost done…"
          ) : saving ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Saving" />
          ) : updating ? (
            "Update my entry"
          ) : (
            "Send my video"
          )}
        </Button>
        {progress !== null && (
          <div className="space-y-1.5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-hairline"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-ink">Keep this page open until it finishes.</p>
          </div>
        )}
      </form>
    </section>
  );
}

type AdminEntry = {
  id: string;
  category: ChallengeCategory;
  stageName: string;
  videoUrl: string;
  videoSource: VideoSource;
  about: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  city: string;
  email: string;
  status: ChallengeEntryStatus;
  score: number | null;
  vendorId: string | null;
};

function JudgingPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<"" | ChallengeCategory>("");
  const { data: entries = [], isLoading } = useQuery<AdminEntry[]>({ queryKey: [ADMIN_API], staleTime: 10_000 });
  const { data: contest } = useQuery<ContestState>({ queryKey: [API], staleTime: 30_000 });
  const storage = contest?.storage;
  const shown = useMemo(() => (category ? entries.filter((e) => e.category === category) : entries), [entries, category]);

  const judge = async (id: string, patch: { status?: ChallengeEntryStatus; score?: number | null }) => {
    try {
      await apiRequest("PATCH", `${ADMIN_API}/${id}`, patch);
      await queryClient.invalidateQueries({ queryKey: [ADMIN_API] });
      await queryClient.invalidateQueries({ queryKey: [API] });
    } catch (err: any) {
      toast({ title: "That didn't save", description: errorText(err), variant: "destructive" });
    }
  };

  return (
    <section className="mt-10 rounded-md border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-ink">Judging · {entries.length} entries</h2>
          {storage && (
            <span
              className={cn(
                "basis-full pl-6 text-xs sm:basis-auto sm:pl-0",
                storage.usedBytes / storage.budgetBytes >= 0.8 ? "text-destructive" : "text-muted-ink",
              )}
            >
              Uploads use {sizeLabel(storage.usedBytes)} of {sizeLabel(storage.budgetBytes)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            aria-label="Filter by category"
            className="h-9 rounded-md border border-hairline bg-background px-2 text-sm text-ink"
          >
            <option value="">All categories</option>
            {challengeCategories.map((c) => (
              <option key={c} value={c}>{CHALLENGE_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <a href={`${BASE_URL}${ADMIN_API}?format=csv`}>
            <Button type="button" variant="outline" className="h-9 border-hairline px-3 text-xs text-ink hover:text-gold">
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Download CSV
            </Button>
          </a>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-ink">Loading entries…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-ink">No entries yet. Share the contest link: blackhevents.com/challenges</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted-ink">
                <th className="py-2 pr-3 font-medium">Entrant</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Contact</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="border-b border-hairline align-top last:border-0">
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-ink">{e.stageName}</p>
                    <p className="mt-0.5 max-w-xs text-xs text-muted-ink">{e.about}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <a href={mediaHref(e.videoUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-gold">
                        <ExternalLink className="h-3 w-3" aria-hidden="true" /> Watch
                      </a>
                      <span className="text-muted-ink">{e.videoSource === "upload" ? "Uploaded" : "Link"}</span>
                      {e.vendorId && (
                        <Link href={`/talent/${e.vendorId}`} className="text-ink hover:text-gold">Profile</Link>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-ink">{CHALLENGE_CATEGORY_LABEL[e.category]}</td>
                  <td className="py-3 pr-3 text-xs text-muted-ink">
                    <p>{e.whatsapp}</p>
                    <p>{e.email}</p>
                    {e.instagram && <p>IG @{e.instagram}</p>}
                    {e.tiktok && <p>TT @{e.tiktok}</p>}
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={e.score ?? ""}
                      aria-label={`Score for ${e.stageName}`}
                      onBlur={(ev) => {
                        const raw = ev.target.value.trim();
                        const score = raw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
                        if (score !== e.score && (score === null || Number.isFinite(score))) judge(e.id, { score });
                      }}
                      className="h-9 w-20 border-hairline bg-background text-ink"
                    />
                  </td>
                  <td className="py-3">
                    <select
                      value={e.status}
                      onChange={(ev) => judge(e.id, { status: ev.target.value as ChallengeEntryStatus })}
                      aria-label={`Status for ${e.stageName}`}
                      className="h-9 rounded-md border border-hairline bg-background px-2 text-sm text-ink"
                    >
                      {challengeEntryStatuses.map((s) => (
                        <option key={s} value={s}>{CHALLENGE_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-ink">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Scores and statuses save as you change them. "Top 10" and "Winner" show on the entrant's own page.
      </p>
    </section>
  );
}
