import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import EditEvent from "@/pages/EditEvent";

/** Reads the :id off the admin edit route for the shared edit page. */
function EditEventRoute() {
  const [location] = useLocation();
  const id = location.match(/^\/admin\/events\/([^/?#]+)\/edit/)?.[1] || "";
  return <EditEvent id={id} />;
}
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import Vendors from "@/pages/Vendors";
import VendorDetails from "@/pages/VendorDetails";
import VendorAccount from "@/pages/VendorAccount";
import CalendarPage from "@/pages/Calendar";
import MyTickets from "@/pages/MyTickets";
import AuthPage from "@/pages/Auth";
import AdminDashboard from "@/pages/AdminDashboard";
import AttendeeDashboard from "@/pages/AttendeeDashboard";
import VendorDashboard from "@/pages/VendorDashboard";
import Messages from "@/pages/Messages";
import Verify from "@/pages/Verify";
import ManageEvent from "@/pages/ManageEvent";
import NewEvent from "@/pages/NewEvent";
import OrganizerDetails from "@/pages/OrganizerDetails";
import OrganizersLanding from "@/pages/OrganizersLanding";
import Challenges from "@/pages/Challenges";
import Settings from "@/pages/Settings";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import MotionReel from "@/pages/MotionReel";
import { PublicLayout } from "@/components/PublicLayout";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MotionProvider } from "@/components/motion";

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [path] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return (
      <Redirect to={"/auth?returnTo=" + encodeURIComponent(path)} />
    );
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function ActivateOrganizerScreen() {
  const { becomeOrganizer, isBecomingOrganizer } = useAuth();
  const [, setLocation] = useLocation();

  const handleActivate = async () => {
    try {
      await becomeOrganizer();
    } catch {
      // If error, stays on screen
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg border border-hairline rounded-2xl bg-surface p-8 sm:p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center mx-auto mb-6 text-gold">
          <Sparkles className="w-6 h-6 text-gold" />
        </div>
        <p className="eyebrow">Organizer Access</p>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          List Events on Black Heritage
        </h2>
        <p className="mt-3 text-sm text-muted-ink leading-relaxed">
          You are currently signed in as an attendee. Turn on organizer capabilities to publish events, scan tickets at the door, and receive direct payouts to your Nigerian bank account.
        </p>

        {/* Founder Hundred Perk Box */}
        <div className="mt-6 p-4 rounded-xl border border-gold/30 bg-gold/5 text-left flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-gold/20 flex items-center justify-center shrink-0 mt-0.5 text-gold">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gold tracking-wider uppercase">Founder Hundred Perk</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold">Ready</span>
            </div>
            <p className="text-xs text-ink/80 mt-1 leading-relaxed">
              0% platform fee on your first 100 paid tickets. Code <span className="font-mono text-gold font-bold">FOUNDER100</span> applied automatically.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            disabled={isBecomingOrganizer}
            onClick={handleActivate}
            className="press w-full sm:w-auto h-12 px-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-soft transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isBecomingOrganizer ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Activating…</span>
              </>
            ) : (
              <>
                <span>Activate &amp; Create Event</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setLocation("/events")}
            className="press w-full sm:w-auto h-12 px-6 rounded-full border border-hairline bg-surface-2/60 text-muted-ink hover:text-ink text-sm font-medium transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [path] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return (
      <Redirect to={"/auth?returnTo=" + encodeURIComponent(path)} />
    );
  }

  if (user.role !== "admin" && user.role !== "organizer" && !user.isAdmin) {
    if (path.startsWith("/admin/events/new")) {
      return (
        <PublicLayout>
          <ActivateOrganizerScreen />
        </PublicLayout>
      );
    }
    return <Redirect to="/dashboard" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

/**
 * StaffRoute: admins, organizers, and organizer team staff (manager,
 * finance, entry) all pass. Entry staff land here for the gate portal.
 */
function StaffRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [path] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return (
      <Redirect to={"/auth?returnTo=" + encodeURIComponent(path)} />
    );
  }

  const isStaff =
    user.role === "admin" || user.role === "organizer" || !!user.teamOwnerId;
  if (!isStaff) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

/** Logged-in users get the app Explore; guests get the marketing Home. */
function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }
  return user ? (
    <DashboardLayout>
      <Explore />
    </DashboardLayout>
  ) : (
    <PublicLayout>
      <Home />
    </PublicLayout>
  );
}

/**
 * wouter keeps the window's scroll position across route changes, so opening
 * a new page landed you halfway down it. Send every navigation to the top.
 *
 * Keyed on the path only: switching tabs on the auth page changes the query
 * string and should leave the form where the reader is looking.
 */
function ScrollToTop() {
  const [location] = useLocation();
  const path = location.split(/[?#]/)[0];

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [path]);

  return null;
}

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      {/* Logged-in users get the app Explore; guests get the marketing Home */}
      <Route path="/">
        <RootRoute />
      </Route>
      <Route path="/events">
        {() => (
          <PublicLayout>
            <Events />
          </PublicLayout>
        )}
      </Route>
      <Route path="/events/:id">
        {() => (
          <PublicLayout noNavbar>
            <EventDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/e/:slug">
        {() => (
          <PublicLayout noNavbar>
            <EventDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/vendors">
        {() => (
          <PublicLayout>
            <Vendors />
          </PublicLayout>
        )}
      </Route>
      <Route path="/talent">
        {() => (
          <PublicLayout>
            <Vendors />
          </PublicLayout>
        )}
      </Route>
      <Route path="/vendors/:id">
        {() => (
          <PublicLayout noNavbar>
            <VendorDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/talent/:id">
        {() => (
          <PublicLayout noNavbar>
            <VendorDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/v/:slug">
        {() => (
          <PublicLayout noNavbar>
            <VendorDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/t/:slug">
        {() => (
          <PublicLayout noNavbar>
            <VendorDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/calendar">
        {() => (
          <PublicLayout>
            <CalendarPage />
          </PublicLayout>
        )}
      </Route>
      <Route path="/challenges">
        {() => (
          <PublicLayout>
            <Challenges />
          </PublicLayout>
        )}
      </Route>
      <Route path="/organizers">
        {() => {
          if (user) {
            const isOrg =
              user.role === "admin" ||
              user.role === "organizer" ||
              user.isAdmin;
            return <Redirect to={isOrg ? "/admin" : user.role === "vendor" ? "/vendor-dashboard" : "/dashboard"} />;
          }
          return (
            <PublicLayout>
              <OrganizersLanding />
            </PublicLayout>
          );
        }}
      </Route>
      <Route path="/host">
        {() => {
          if (user) {
            const isOrg =
              user.role === "admin" ||
              user.role === "organizer" ||
              user.isAdmin;
            return <Redirect to={isOrg ? "/admin" : user.role === "vendor" ? "/vendor-dashboard" : "/dashboard"} />;
          }
          return (
            <PublicLayout>
              <OrganizersLanding />
            </PublicLayout>
          );
        }}
      </Route>
      <Route path="/organizers/:slug">
        {() => (
          <PublicLayout noNavbar>
            <OrganizerDetails />
          </PublicLayout>
        )}
      </Route>
      <Route path="/o/:slug">
        {() => (
          <PublicLayout noNavbar>
            <OrganizerDetails />
          </PublicLayout>
        )}
      </Route>

      {/* Instagram 9:16 Motion Reel Studio - Dev only (never ships to production) */}
      {import.meta.env.DEV && (
        <>
          <Route path="/reel">
            {() => <MotionReel />}
          </Route>
          <Route path="/motion">
            {() => <MotionReel />}
          </Route>
        </>
      )}

      {/* Auth Page */}
      <Route path="/auth">
        {() => {
          if (user) {
            const isOrg =
              user.role === "admin" ||
              user.role === "organizer" ||
              user.isAdmin;
            return (
              <Redirect to={isOrg ? "/admin" : "/dashboard"} />
            );
          }
          return <AuthPage />;
        }}
      </Route>

      <Route path="/admin/login">
        {() => {
          if (user) {
            const isOrg =
              user.role === "admin" ||
              user.role === "organizer" ||
              user.isAdmin;
            return (
              <Redirect to={isOrg ? "/admin" : "/dashboard"} />
            );
          }
          return <Redirect to="/auth" />;
        }}
      </Route>

      {/* Attendee Dashboard */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={AttendeeDashboard} />}
      </Route>
      <Route path="/my-tickets">
        {() => <ProtectedRoute component={MyTickets} />}
      </Route>

      {/* Account Settings */}
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>

      {/* Legal */}
      <Route path="/terms">
        {() => <Terms />}
      </Route>
      <Route path="/privacy">
        {() => <Privacy />}
      </Route>

      {/* Vendor / Talent Dashboard */}
      <Route path="/vendor-dashboard">
        {() => <ProtectedRoute component={VendorDashboard} />}
      </Route>
      <Route path="/talent-dashboard">
        {() => <ProtectedRoute component={VendorDashboard} />}
      </Route>
      <Route path="/vendor-signup">
        {() => <ProtectedRoute component={VendorAccount} />}
      </Route>
      <Route path="/talent-signup">
        {() => <ProtectedRoute component={VendorAccount} />}
      </Route>

      {/* Messaging */}
      <Route path="/messages/:id?">
        {() => <ProtectedRoute component={Messages} />}
      </Route>

      {/* Gate verification portal (entry staff + organizers) */}
      <Route path="/verify">
        {() => <StaffRoute component={Verify} />}
      </Route>

      {/* Organizer / Admin Routes */}
      <Route path="/admin">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/events">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/bookings">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/sponsors">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/vendors">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/talent">
        {() => <AdminRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/events/new">
        {() => <AdminRoute component={NewEvent} />}
      </Route>
      <Route path="/admin/events/:id/edit">
        {() => <AdminRoute component={EditEventRoute} />}
      </Route>
      <Route path="/admin/events/:id">
        {() => <AdminRoute component={ManageEvent} />}
      </Route>
      <Route path="/admin/events/:id/bookings">
        {() => <AdminRoute component={ManageEvent} />}
      </Route>

      {/* Catch-all */}
      <Route>
        {() => (
          <PublicLayout>
            <NotFound />
          </PublicLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <TooltipProvider>
          <Toaster />
          <ScrollToTop />
          <Router />
        </TooltipProvider>
      </MotionProvider>
    </QueryClientProvider>
  );
}

export default App;
