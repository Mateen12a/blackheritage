import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
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
import ManageEvent from "@/pages/ManageEvent";
import NewEvent from "@/pages/NewEvent";
import { PublicLayout } from "@/components/PublicLayout";
import { AdminLayout } from "@/components/AdminLayout";
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
    <PublicLayout>
      <Component />
    </PublicLayout>
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
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      {/* Public Routes with Navbar */}
      <Route path="/">
        {() => (
          <PublicLayout>
            <Home />
          </PublicLayout>
        )}
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
          <PublicLayout>
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
          <PublicLayout>
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

      {/* Vendor Dashboard */}
      <Route path="/vendor-dashboard">
        {() => <ProtectedRoute component={VendorDashboard} />}
      </Route>
      <Route path="/vendor-signup">
        {() => <ProtectedRoute component={VendorAccount} />}
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
