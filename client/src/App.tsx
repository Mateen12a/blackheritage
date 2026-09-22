import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
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
import Settings from "@/pages/Settings";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
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
      <Route path="/vendors/:id">
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
      <Route path="/calendar">
        {() => (
          <PublicLayout>
            <CalendarPage />
          </PublicLayout>
        )}
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

      {/* Vendor Dashboard */}
      <Route path="/vendor-dashboard">
        {() => <ProtectedRoute component={VendorDashboard} />}
      </Route>
      <Route path="/vendor-signup">
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
      <Route path="/admin/events/new">
        {() => <AdminRoute component={NewEvent} />}
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
          <Router />
        </TooltipProvider>
      </MotionProvider>
    </QueryClientProvider>
  );
}

export default App;
