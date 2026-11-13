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
  ArrowUpRight,
  CalendarDays,
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
  open: "Entries open until Sun 22 Nov, 11:59 PM",
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

const SIGNUP_HREF = `/auth?tab=register&returnTo=${encodeURIComponent("/challenges")}`;
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
        <Reveal>
          <header className="mb-8 max-w-3xl">
            <p className="eyebrow">Open call · Music, Dance, Comedy</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl md:text-5xl">
              {TALENT_HUNT.title}
            </h1>
            <div className="rule-gold mt-3" />
            <p className="mt-3 text-sm text-muted-ink sm:text-base leading-relaxed">
              {naira(TALENT_HUNT.prizeNaira)} for the best in Music, Dance and Comedy, and a slot on stage at the{" "}
              <Link href={TALENT_HUNT.stage.path} className="text-ink underline decoration-hairline underline-offset-4 hover:text-gold">
                {TALENT_HUNT.stage.title}
              </Link>
              , {TALENT_HUNT.stage.venue}, {TALENT_HUNT.stage.date}. Free to enter.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink">
                <CalendarDays className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                {PHASE_LINE[phase]}
              </span>
              {data && data.total >= 25 && (
                <span className="text-xs text-muted-ink">{data.total} entries so far</span>
              )}
            </div>
          </header>
        </Reveal>

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
                <p className="mt-3 font-display text-2xl font-bold text-ink">{naira(TALENT_HUNT.prizeNaira)}</p>
                <p className="mt-1 text-xs text-muted-ink">+ perform at {TALENT_HUNT.stage.title}</p>
                <p className="mt-3 text-sm text-muted-ink">{line}</p>
              </div>
            );
          })}
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* How to enter + dates + rules */}
          <div className="space-y-6 min-w-0">
            <section className="rounded-md border border-hairline bg-surface p-6">
              <h2 className="font-display text-xl font-bold text-ink">How to enter</h2>
              <ol className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted-ink">1</span>
                  <p className="text-sm text-ink leading-relaxed">
                    Record your performance, 1 minute or less. Your phone camera is fine.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted-ink">2</span>
                  <div className="text-sm text-ink leading-relaxed">
                    <p>Follow @blackhevents on Instagram and TikTok.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={TALENT_HUNT.instagram} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" className="h-9 border-hairline px-3 text-xs text-ink hover:text-gold">
                          <Instagram className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Follow on Instagram
                        </Button>
                      </a>
                      <a href={TALENT_HUNT.tiktok} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" className="h-9 border-hairline px-3 text-xs text-ink hover:text-gold">
                          <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Follow on TikTok
                        </Button>
                      </a>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted-ink">3</span>
                  <div className="text-sm text-ink leading-relaxed">
                    <p>
                      Create your free Black Heritage account and upload your video here. Your entry also gives you a talent profile, so organizers can find and book you.
                    </p>
                    <p className="mt-2 text-muted-ink">
                      Posting it too? Add <span className="font-semibold text-ink">{TALENT_HUNT.hashtag}</span> and tag{" "}
                      <span className="font-semibold text-ink">@blackhevents</span> so more people see you. You can enter with the link to that post instead of uploading.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section className="rounded-md border border-hairline bg-surface p-6">
              <h2 className="font-display text-xl font-bold text-ink">Dates</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Entries open", "Mon 16 Nov"],
                  ["Entries close", "Sun 22 Nov, 11:59 PM"],
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

            <section className="rounded-md border border-hairline bg-surface p-6">
              <h2 className="font-display text-xl font-bold text-ink">Rules</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-ink leading-relaxed marker:text-hairline">
                <li>Open to anyone 16 or older living in Nigeria. One entry per category.</li>
                <li>Your own original performance, 1 minute or less. Uploads are MP4 or MOV, up to {TALENT_HUNT.maxUploadMB} MB.</li>
                <li>If you enter with an Instagram or TikTok link, keep the post public until {TALENT_HUNT.winnersOn}.</li>
                <li>Judged by a panel of three: talent and skill 50%, originality 30%, stage presence and engagement 20%.</li>
                <li>Bought likes or views, copied content, or hateful or explicit content means disqualification.</li>
                <li>Black Heritage may repost your entry, with credit, to promote the contest.</li>
                <li>
                  Winners verify their ID and sign the Black Heritage talent agreement before the prize is paid by bank transfer.{" "}
                  <a
                    href={whatsappLink("Hi Black Heritage, can I see a copy of the BH Talent Hunt winner's agreement?")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline decoration-hairline underline-offset-4 hover:text-gold"
                  >
                    Ask us for a copy on WhatsApp
                  </a>
                  .
                </li>
              </ul>
            </section>
          </div>

          {/* Entry */}
          <div className="space-y-6 min-w-0">
            {mine.length > 0 && <MyEntries entries={mine} />}
            <EntryPanel phase={phase} signedIn={!!user} isAdmin={isAdmin} mine={mine} />
          </div>
        </div>

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
  followsConfirmed: false,
  acceptsRules: false,
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

  if (!signedIn) {
    return (
      <section className="rounded-md border border-hairline bg-surface p-6">
        <h2 className="font-display text-xl font-bold text-ink">Enter the Talent Hunt</h2>
        <p className="mt-2 text-sm text-muted-ink leading-relaxed">
          {phase === "upcoming"
            ? "Entries open on Monday 16 November. Create your free account now and record your video (1 minute or less), so you're ready."
            : phase === "open"
            ? "Create your free account, then come back here to upload your video. It takes about two minutes."
            : "Entries are closed. Create a free account to hear about the next open call."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={SIGNUP_HREF}>
            <Button className="press h-10 bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-gold-soft">
              Create free account
            </Button>
          </Link>
          <Link href={SIGNIN_HREF} className="text-sm text-ink underline decoration-hairline underline-offset-4 hover:text-gold">
            I have an account
          </Link>
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
    if (!form.category) return setError("Pick Music, Dance or Comedy");
    if (mode === "upload" && !clip && !keepsUpload) return setError("Choose your video to upload");
    if (mode === "link" && !form.videoUrl.trim() && !updating) return setError("Paste the link to your Instagram or TikTok post");
    if (!form.followsConfirmed) return setError("Follow @blackhevents on Instagram and TikTok, then tick the box");
    if (!form.acceptsRules) return setError("Tick the box to accept the rules and the winner's agreement");
    setSaving(true);
    try {
      // An empty videoUrl with no file keeps the video already on the entry.
      const fields = { ...form, videoUrl: mode === "link" ? form.videoUrl.trim() : "" };
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
      toast({
        title: body.updated ? "Entry updated" : "You're in",
        description: body.updated
          ? `Your ${CHALLENGE_CATEGORY_LABEL[form.category as ChallengeCategory]} entry is updated.`
          : "Your entry is in and your talent profile is live. Share your video to get noticed.",
      });
      setClip(null);
      setForm((f) => ({ ...EMPTY_FORM, stageName: f.stageName, whatsapp: f.whatsapp, instagram: f.instagram, tiktok: f.tiktok, city: f.city }));
    } catch (err: any) {
      setError(errorText(err) || "Your entry didn't save. Try again in a moment.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const field = "border-hairline bg-background text-ink h-11";

  return (
    <section className="rounded-md border border-hairline bg-surface p-6">
      <h2 className="font-display text-xl font-bold text-ink">Submit your entry</h2>
      {isAdmin && phase !== "open" && (
        <p className="mt-2 text-xs text-muted-ink">Admin: you can submit outside the entry window to test.</p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <fieldset>
          <legend className="text-sm text-ink">Category</legend>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
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
                    // Editing an entry starts from how that entry's video was sent.
                    const previous = mine.find((m) => m.category === c);
                    if (previous) setMode(previous.videoSource);
                  }}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm transition-colors",
                    on ? "border-gold/60 bg-gold/10 text-gold" : "border-hairline text-muted-ink hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {CHALLENGE_CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>
          {updating && (
            <p className="mt-2 text-xs text-muted-ink">You've already entered {CHALLENGE_CATEGORY_LABEL[updating.category]}. Submitting again updates that entry.</p>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="th-name" className="text-sm text-ink">Stage name</Label>
          <Input id="th-name" value={form.stageName} maxLength={60} autoComplete="nickname" onChange={(e) => set({ stageName: e.target.value })} className={field} />
        </div>

        <fieldset>
          <legend className="text-sm text-ink">Your video</legend>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you're sending your video">
            {([["upload", "Upload video"], ["link", "Paste a link"]] as const).map(([value, label]) => {
              const on = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMode(value);
                    setError("");
                  }}
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-md border text-sm transition-colors",
                    on ? "border-gold/60 bg-gold/10 text-gold" : "border-hairline text-muted-ink hover:text-ink",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {mode === "upload" ? (
            <div className="mt-3 space-y-2">
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPick} />
              {clip ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{clip.file.name}</p>
                    <p className="text-xs text-muted-ink">
                      {clip.seconds !== null ? `${formatClipLength(clip.seconds)} · ` : ""}
                      {sizeLabel(clip.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="shrink-0 text-xs text-ink underline decoration-hairline underline-offset-4 hover:text-gold"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={checking}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-background px-4 py-5 text-sm text-ink transition-colors hover:border-gold/60"
                >
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gold" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4 text-gold" aria-hidden="true" />
                  )}
                  <span>{checking ? "Checking your video…" : keepsUpload ? "Choose a new video" : "Choose your video"}</span>
                  <span className="text-xs text-muted-ink">
                    MP4 or MOV · {MAX_LENGTH} or less · up to {TALENT_HUNT.maxUploadMB} MB
                  </span>
                </button>
              )}
              {keepsUpload && !clip && (
                <p className="text-xs text-muted-ink">Your uploaded video stays unless you choose a new one.</p>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="th-video" className="sr-only">Link to your Instagram or TikTok post</Label>
              <Input
                id="th-video"
                type="url"
                inputMode="url"
                value={form.videoUrl}
                placeholder="https://www.tiktok.com/@you/video/..."
                onChange={(e) => set({ videoUrl: e.target.value })}
                className={field}
              />
              <p className="text-xs text-muted-ink">
                {updating ? "Leave it empty to keep your current video." : "Your Instagram or TikTok post, set to public."}
              </p>
            </div>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="th-about" className="text-sm text-ink">A line or two about you</Label>
          <Textarea
            id="th-about"
            value={form.about}
            maxLength={300}
            rows={3}
            placeholder="e.g. Afro-soul singer from Ile-Ife. I write my own songs."
            onChange={(e) => set({ about: e.target.value })}
            className="border-hairline bg-background text-ink"
          />
          <p className="text-xs text-muted-ink">This also goes on your talent profile.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="th-wa" className="text-sm text-ink">WhatsApp number</Label>
            <Input id="th-wa" inputMode="tel" autoComplete="tel" value={form.whatsapp} placeholder="0803 123 4567" onChange={(e) => set({ whatsapp: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-city" className="text-sm text-ink">City or school (optional)</Label>
            <Input id="th-city" value={form.city} maxLength={60} placeholder="e.g. OAU, Ile-Ife" onChange={(e) => set({ city: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-ig" className="text-sm text-ink">Instagram handle</Label>
            <Input id="th-ig" value={form.instagram} placeholder="@yourname" onChange={(e) => set({ instagram: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-tt" className="text-sm text-ink">TikTok handle</Label>
            <Input id="th-tt" value={form.tiktok} placeholder="@yourname" onChange={(e) => set({ tiktok: e.target.value })} className={field} />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
          <Checkbox checked={form.followsConfirmed} onCheckedChange={(v) => set({ followsConfirmed: v === true })} className="mt-0.5" />
          <span>I follow @blackhevents on Instagram and TikTok.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
          <Checkbox checked={form.acceptsRules} onCheckedChange={(v) => set({ acceptsRules: v === true })} className="mt-0.5" />
          <span>I accept the rules, and if I win, I'll sign the Black Heritage talent agreement before the prize is paid.</span>
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <Button type="submit" disabled={saving || checking} className="press h-11 w-full bg-primary text-sm font-medium text-primary-foreground hover:bg-gold-soft">
          {saving && progress !== null ? (
            progress < 100 ? `Uploading ${progress}%` : "Saving your entry…"
          ) : saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
          ) : updating ? (
            "Update my entry"
          ) : (
            "Submit my entry"
          )}
        </Button>
        {progress !== null && (
          <div className="space-y-1.5">
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-hairline"
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
