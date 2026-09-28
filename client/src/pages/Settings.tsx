import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateAccountProfile, useChangePassword, useCloseAccount } from "@/hooks/use-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/motion";
import { Loader2, Upload } from "lucide-react";
import { ReferralCard } from "@/components/ReferralCard";

function SettingsForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const profile = useUpdateAccountProfile();
  const password = useChangePassword();
  const closeAccount = useCloseAccount();
  const [closeConfirm, setCloseConfirm] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [socials, setSocials] = useState({ instagram: "", twitter: "", whatsapp: "", website: "" });
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isOrganizer = user?.role === "organizer" || user?.role === "admin";
  // The server refuses to close an account that still has live events. Read
  // the same list it will check, so the card explains the block up front
  // instead of letting someone type DELETE and fail.
  const { data: manageEvents } = useQuery<any[]>({
    queryKey: ["/api/events", "manage", "close-account-check"],
    queryFn: async () => {
      const res = await fetch("/api/events?manage=true", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });
  const liveEvents = (manageEvents || []).filter(
    (e: any) =>
      e.organizerId === (user as any)?._id &&
      e.status === "published" &&
      new Date(e.date).getTime() >= Date.now() - 6 * 60 * 60 * 1000,
  );
  const closeAccountBlocked = liveEvents.length > 0;

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || "");
    setBio(user.bio || "");
    setAvatarUrl(user.avatarUrl || null);
    setSocials({
      instagram: user.socials?.instagram || "",
      twitter: user.socials?.twitter || "",
      whatsapp: user.socials?.whatsapp || "",
      website: user.socials?.website || "",
    });
  }, [user]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/portfolio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        setAvatarUrl(data.url);
      }
    } finally {
      setUploading(false);
    }
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    profile.mutate({
      displayName: displayName || undefined,
      bio: bio || undefined,
      avatarUrl,
      socials: isOrganizer ? socials : undefined,
    });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    password.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  }

  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-muted-ink">
          How you appear across events, chats, and reviews.
        </p>
      </header>

      <Reveal>
        <Card className="border-hairline bg-surface">
          <CardHeader>
            <CardTitle className="text-ink">Profile</CardTitle>
            <CardDescription>Your email ({user?.email}) is fixed. Everything else is yours.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 rounded-full bg-surface-2 border border-hairline flex items-center justify-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gold uppercase">
                      {(displayName || user?.username || "U").charAt(0)}
                    </span>
                  )}
                </span>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" className="border-hairline" asChild>
                    <span>
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {avatarUrl ? "Change photo" : "Upload photo"}
                    </span>
                  </Button>
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.username || "Your name"}
                  maxLength={80}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Short bio</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="What you do, what you play, what you curate."
                  className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-muted-ink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                />
              </div>

              {isOrganizer && (
                <fieldset className="space-y-3 rounded-md border border-hairline p-4">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-ink">
                    Where fans find you
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        value={socials.instagram}
                        onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                        placeholder="instagram.com/yourhandle"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="twitter">X / Twitter</Label>
                      <Input
                        id="twitter"
                        value={socials.twitter}
                        onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                        placeholder="x.com/yourhandle"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="whatsapp">WhatsApp number</Label>
                      <Input
                        id="whatsapp"
                        value={socials.whatsapp}
                        onChange={(e) => setSocials({ ...socials, whatsapp: e.target.value })}
                        placeholder="234..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={socials.website}
                        onChange={(e) => setSocials({ ...socials, website: e.target.value })}
                        placeholder="yourdomain.com"
                      />
                    </div>
                  </div>
                </fieldset>
              )}

              <Button type="submit" disabled={profile.isPending} className="bg-primary text-primary-foreground hover:bg-gold-soft">
                {profile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card className="border-hairline bg-surface">
          <CardHeader>
            <CardTitle className="text-ink">Password</CardTitle>
            <CardDescription>Use at least 8 characters. Something you have not used elsewhere.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  {passwordsMismatch && (
                    <p className="text-xs text-red-400">The two passwords do not match.</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={password.isPending || passwordsMismatch || newPassword.length < 8}
                className="border-hairline"
              >
                {password.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <ReferralCard />
      </Reveal>

      {/* Closing an account: say exactly what happens, then ask for the word.
          Vague danger zones get clicked by accident; concrete ones do not. */}
      <Reveal>
        <Card className="border-red-500/30 bg-surface">
          <CardHeader>
            <CardTitle className="text-ink">Close this account</CardTitle>
            <CardDescription>
              This signs you out for good. Tickets you already bought stay valid, and the
              organizer still has your name on their door list — but you will not be able to
              sign in and view them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-ink">
              <li>• Your name, photo, bio, phone and links are removed.</li>
              <li>• Your email and username are freed, so you can sign up again later.</li>
              {isOrganizer && (
                <li>• Your hub link stops working and your vendor listing leaves the directory.</li>
              )}
              {isOrganizer && (
                <li>
                  • Your events stay online as recaps for attendees, without your name on them.
                </li>
              )}
              <li>• Followers are removed from both sides — they stop hearing from you.</li>
              <li>• Past sales, tickets and payouts are kept. Money records do not get deleted.</li>
            </ul>

            {closeAccountBlocked && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                You have {liveEvents.length} upcoming published event
                {liveEvents.length === 1 ? "" : "s"} ({liveEvents.map((e: any) => e.title).slice(0, 2).join(", ")}
                {liveEvents.length > 2 ? "…" : ""}). Unpublish them first — closing the account
                now would leave people holding tickets for shows that disappear.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-close">
                Type <span className="font-mono text-ink">DELETE</span> to confirm
              </Label>
              <Input
                id="confirm-close"
                value={closeConfirm}
                onChange={(e) => setCloseConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>

            <Button
              variant="outline"
              disabled={closeConfirm.trim().toUpperCase() !== "DELETE" || closeAccount.isPending}
              onClick={() => closeAccount.mutate(closeConfirm.trim().toUpperCase(), {
                onSuccess: () => navigate("/"),
              })}
              className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              {closeAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Close my account
            </Button>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

// DashboardLayout is applied by ProtectedRoute at the route level; adding
// another one here stacked a second mobile header on the page.
export default function Settings() {
  return <SettingsForm />;
}
