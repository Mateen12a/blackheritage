import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/motion";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Calendar,
  Users,
  ArrowUpRight,
  Store,
  Upload,
  CheckCircle2,
  Clock,
  Flame,
  Award,
  Music,
  Palette,
  Mic,
  Video,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Challenge {
  id: string;
  title: string;
  category: string;
  icon: "music" | "palette" | "mic" | "video";
  prize: string;
  secondaryPrize: string;
  deadline: string;
  daysRemaining: number;
  description: string;
  requirements: string[];
  eligibility: string;
  entriesCount: number;
}

const CHALLENGES: Challenge[] = [
  {
    id: "dj-soundclash-2026",
    title: "Afrobeats & Amapiano Transition Soundclash",
    category: "DJ & Music Production",
    icon: "music",
    prize: "₦500,000 Cash Grant",
    secondaryPrize: "Headline opening slot at Lagos Mainland Block Party",
    deadline: "Oct 28, 2026",
    daysRemaining: 18,
    description: "Build a seamless 15-minute live or studio mix that bridges classic Lagos highlife with modern Amapiano rhythms and heavy 808 percussion.",
    requirements: [
      "12 to 15-minute audio or video set",
      "Include at least two vintage Nigerian samples",
      "Live transition audio with tracklist",
    ],
    eligibility: "Open to all DJs, producers, and musical curators on Black Heritage.",
    entriesCount: 34,
  },
  {
    id: "flyer-visual-art-2026",
    title: "Lagos Nightlife Heritage Visual Art Contest",
    category: "Graphic & Motion Design",
    icon: "palette",
    prize: "₦300,000 + 100% Fee Waiver",
    secondaryPrize: "Featured showcase on Black Heritage home banner for 30 days",
    deadline: "Nov 10, 2026",
    daysRemaining: 31,
    description: "Design an iconic vertical 9:16 or square 1:1 concert poster celebrating the raw kinetic energy of Lagos after dark.",
    requirements: [
      "High-resolution PNG or MP4 motion flyer",
      "Original typography and visual layout",
      "No copyrighted watermarked assets",
    ],
    eligibility: "Open to event designers, organizers, and visual artists across Africa.",
    entriesCount: 52,
  },
  {
    id: "mc-host-spotlight-2026",
    title: "Next-Gen Event Host & MC Spotlight",
    category: "Event Hosting & MC",
    icon: "mic",
    prize: "₦250,000 Booking Retainer",
    secondaryPrize: "Verified Resident Host badge + priority client dispatch",
    deadline: "Nov 02, 2026",
    daysRemaining: 23,
    description: "Submit a 2-minute live crowd-work or hype reel demonstrating stage presence, audience chemistry, and clean pacing.",
    requirements: [
      "60 to 120-second video reel from a live show",
      "Clear vocal delivery and crowd reaction",
      "Brief intro with your hosting philosophy",
    ],
    eligibility: "Open to all energetic MCs, hypemen, and hosts.",
    entriesCount: 27,
  },
  {
    id: "stage-lighting-2026",
    title: "Concert Lighting & Stage Atmosphere Challenge",
    category: "Production & Stagecraft",
    icon: "video",
    prize: "₦400,000 Production Sponsor",
    secondaryPrize: "Equipment subsidy grant from Black Heritage Partners",
    deadline: "Nov 15, 2026",
    daysRemaining: 36,
    description: "Submit your best lighting cue sheet, DMX programming reel, or stage illumination concept from a recent festival or arena show.",
    requirements: [
      "Visual reel or 3D stage plot",
      "Color theory and tempo sync explanation",
      "Equipment breakdown note",
    ],
    eligibility: "Open to lighting technicians, stage builders, and technical event directors.",
    entriesCount: 19,
  },
];

export default function ChallengesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("bh_user_challenges");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Submission Form State
  const [stageName, setStageName] = useState(user?.username || "");
  const [entryTitle, setEntryTitle] = useState("");
  const [workUrl, setWorkUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenSubmission = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setSubmissionModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/portfolio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setFileUrl(data.url);
          toast({ title: "Work sample uploaded" });
        }
      } else {
        toast({ title: "Upload failed", description: "Try pasting an external link instead.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload error", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim() || !entryTitle.trim() || (!workUrl.trim() && !fileUrl)) {
      toast({
        title: "Incomplete submission",
        description: "Please provide your creator name, title, and at least one work link or uploaded file.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newEntry = {
        id: "entry_" + Date.now(),
        challengeId: selectedChallenge?.id,
        challengeTitle: selectedChallenge?.title,
        stageName,
        entryTitle,
        workUrl: workUrl || fileUrl,
        description,
        submittedAt: new Date().toISOString(),
        status: "under_review",
      };

      const updated = [newEntry, ...mySubmissions];
      setMySubmissions(updated);
      try {
        localStorage.setItem("bh_user_challenges", JSON.stringify(updated));
      } catch {
        // storage fallback
      }

      setIsSubmitting(false);
      setSubmissionModalOpen(false);
      // Reset form
      setEntryTitle("");
      setWorkUrl("");
      setFileUrl("");
      setDescription("");

      toast({
        title: "Challenge entry submitted!",
        description: `Your entry for "${selectedChallenge?.title}" has been registered. Our review jury will evaluate it before the deadline.`,
      });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-6">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header Hero */}
        <Reveal y={16}>
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-8 border-b border-hairline">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                <p className="eyebrow">Creative Grants & Competitions</p>
              </div>
              <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-ink tracking-tight">
                Creator & Talent Challenges
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-ink leading-relaxed">
                Lagos and Abuja creative showcases for DJs, hosts, visual artists, and event producers. Win cash production grants, headline bookings, and platform fee waivers.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/vendor-dashboard">
                <Button
                  variant="outline"
                  className="press border-hairline text-ink hover:text-gold text-xs sm:text-sm h-10 px-4"
                >
                  <Store className="w-4 h-4 mr-2" />
                  Talent Studio
                </Button>
              </Link>
              {user ? (
                <Link href="/admin">
                  <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs sm:text-sm h-10 px-4">
                    Organizer Hub
                  </Button>
                </Link>
              ) : (
                <Link href="/auth?returnTo=/challenges">
                  <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs sm:text-sm h-10 px-4">
                    Sign in to Enter
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Reveal>

        {/* Organizer Cross-Over Banner: Work as Talent */}
        <Reveal y={12} delay={0.15}>
          <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0 mt-0.5">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-ink text-base sm:text-lg">
                  Event Organizers: Put Your Talent to Work
                </h3>
                <p className="text-xs sm:text-sm text-muted-ink mt-1 max-w-2xl">
                  Do you also DJ, MC, shoot photos, or design stages? Build your Talent Profile with one click from the same account and get booked by other event producers across Nigeria.
                </p>
              </div>
            </div>
            <Link href="/vendor-dashboard">
              <Button className="press shrink-0 bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-xs sm:text-sm h-10 px-5 rounded-md">
                Launch Talent Profile
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Reveal>

        {/* User Submissions Preview (if any) */}
        {mySubmissions.length > 0 && (
          <Reveal y={12} delay={0.2}>
            <div className="mt-8 rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <h3 className="font-display font-bold text-ink text-base">Your Active Submissions</h3>
                </div>
                <span className="text-xs text-muted-ink font-mono">{mySubmissions.length} submitted</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mySubmissions.map((sub) => (
                  <div key={sub.id} className="p-3.5 rounded-xl border border-hairline bg-surface-2/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gold uppercase tracking-wider">{sub.challengeTitle}</p>
                      <p className="text-sm font-bold text-ink mt-0.5">{sub.entryTitle}</p>
                      <p className="text-[11px] text-muted-ink mt-1">Creator: {sub.stageName} · Status: Under Review</p>
                    </div>
                    {sub.workUrl && (
                      <a href={sub.workUrl} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-ink hover:text-gold">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Challenges Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {CHALLENGES.map((challenge, idx) => (
            <Reveal key={challenge.id} y={16} delay={0.1 * (idx + 1)}>
              <div className="rounded-2xl border border-hairline bg-surface hover:border-gold/40 transition-all duration-300 p-6 flex flex-col justify-between h-full group">
                <div>
                  {/* Category & Status */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-ink/80">
                      {challenge.icon === "music" && <Music className="w-3.5 h-3.5 text-gold" />}
                      {challenge.icon === "palette" && <Palette className="w-3.5 h-3.5 text-gold" />}
                      {challenge.icon === "mic" && <Mic className="w-3.5 h-3.5 text-gold" />}
                      {challenge.icon === "video" && <Video className="w-3.5 h-3.5 text-gold" />}
                      {challenge.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gold font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {challenge.daysRemaining} days left
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-xl sm:text-2xl text-ink group-hover:text-gold transition-colors leading-snug">
                    {challenge.title}
                  </h3>

                  <p className="mt-3 text-xs sm:text-sm text-muted-ink leading-relaxed">
                    {challenge.description}
                  </p>

                  {/* Prize Callout Card */}
                  <div className="mt-5 p-4 rounded-xl border border-gold/30 bg-gold/5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Grand Prize</span>
                      <p className="font-display font-bold text-lg text-gold leading-tight mt-0.5">{challenge.prize}</p>
                      <p className="text-xs text-ink/80 mt-1">{challenge.secondaryPrize}</p>
                    </div>
                    <Trophy className="w-8 h-8 text-gold shrink-0 opacity-80" />
                  </div>

                  {/* Rules Checklist */}
                  <div className="mt-5 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-ink">Submission Rules</span>
                    <ul className="space-y-1.5 pt-1">
                      {challenge.requirements.map((req, rIdx) => (
                        <li key={rIdx} className="flex items-center gap-2 text-xs text-ink/90">
                          <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-hairline flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-ink">
                    <strong className="text-ink">{challenge.entriesCount}</strong> creators entered
                  </span>
                  <Button
                    onClick={() => handleOpenSubmission(challenge)}
                    className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs h-9 px-4 rounded-md"
                  >
                    Enter Challenge
                    <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Submission Dialog */}
      <Dialog open={submissionModalOpen} onOpenChange={setSubmissionModalOpen}>
        <DialogContent className="sm:max-w-lg bg-surface border-hairline text-ink">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-ink">
              Enter {selectedChallenge?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-ink">
              Showcase your work for jury evaluation. Open to event organizers, creative producers, and independent talent.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEntry} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Stage or Creator Name</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. DJ Spinall, Studio 54 Lagos"
                className="h-10 text-xs bg-surface-2 border-hairline text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Submission Title</Label>
              <Input
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="e.g. Mainland Sundown Amapiano Mix v1"
                className="h-10 text-xs bg-surface-2 border-hairline text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Work Link (SoundCloud, YouTube, Drive, Behance)</Label>
              <Input
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://..."
                className="h-10 text-xs bg-surface-2 border-hairline text-ink font-mono"
              />
            </div>

            {/* Direct File Upload Option */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Or Upload File Sample (Image/Audio/PDF)</Label>
              <div className="flex items-center gap-2">
                <input
                  id="challenge-file-upload"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                  disabled={isUploading}
                  className="sr-only"
                />
                <label
                  htmlFor="challenge-file-upload"
                  className="flex-1 h-10 px-3 flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface-2 text-xs text-ink hover:text-gold cursor-pointer transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading file...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      {fileUrl ? "File attached (click to replace)" : "Choose local file"}
                    </>
                  )}
                </label>
                {fileUrl && (
                  <button
                    type="button"
                    onClick={() => setFileUrl("")}
                    className="p-2 text-muted-ink hover:text-destructive"
                    aria-label="Remove uploaded file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {fileUrl && (
                <p className="text-[11px] text-gold truncate">Attached: {fileUrl}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Concept Notes or Tracklist</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly explain the inspiration, tools, or live context of this piece..."
                className="text-xs bg-surface-2 border-hairline text-ink resize-none h-20"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSubmissionModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="press bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs h-9 px-5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Submitting...
                  </>
                ) : (
                  "Submit Entry"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
