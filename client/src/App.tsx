import { Switch, Route, Redirect } from "wouter";
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
import CalendarPage from "@/pages/Calendar";
import MyTickets from "@/pages/MyTickets";
import AuthPage from "@/pages/Auth";
import AdminDashboard from "@/pages/AdminDashboard";
import ManageEvent from "@/pages/ManageEvent";
import NewEvent from "@/pages/NewEvent";
import { PublicLayout } from "@/components/PublicLayout";
import { AdminLayout } from "@/components/AdminLayout";

function ProtectedRoute({ 
  component: Component, 
  requireAdmin = false 
}: { 
  component: React.ComponentType, 
  requireAdmin?: boolean 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (requireAdmin && user.role !== 'admin' && user.role !== 'organizer' && !user.isAdmin) {
    return <Redirect to="/" />;
  }

  const Layout = (user.role === 'admin' || user.role === 'organizer' || user.isAdmin) ? AdminLayout : PublicLayout;

  return (
    <Layout>
      <Component />
    </Layout>
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
      <Route path="/calendar">
        {() => (
          <PublicLayout>
            <CalendarPage />
          </PublicLayout>
        )}
      </Route>
      
      {/* Auth Page - No Shared Layout or Custom */}
      <Route path="/auth">
        {() => {
          if (user) {
            return <Redirect to={user.role === 'admin' || user.role === 'organizer' || user.isAdmin ? "/admin" : "/"} />;
          }
          return <AuthPage />;
        }}
      </Route>

      {/* Admin Auth Page - For Organizers */}
      <Route path="/admin/login">
        {() => {
          if (user) {
            return <Redirect to={user.role === 'admin' || user.role === 'organizer' || user.isAdmin ? "/admin" : "/"} />;
          }
          return <AuthPage />;
        }}
      </Route>

      {/* Protected User Routes */}
      <Route path="/my-tickets">
        {() => <ProtectedRoute component={MyTickets} />}
      </Route>
      
      {/* Admin/Organizer Routes */}
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} requireAdmin />}
      </Route>
      <Route path="/admin/events">
        {() => <ProtectedRoute component={AdminDashboard} requireAdmin />}
      </Route>
      <Route path="/admin/bookings">
        {() => <ProtectedRoute component={AdminDashboard} requireAdmin />}
      </Route>
      <Route path="/admin/sponsors">
        {() => <ProtectedRoute component={AdminDashboard} requireAdmin />}
      </Route>
      <Route path="/admin/vendors">
        {() => <ProtectedRoute component={AdminDashboard} requireAdmin />}
      </Route>
      <Route path="/admin/events/new">
        {() => <ProtectedRoute component={NewEvent} requireAdmin />}
      </Route>
      <Route path="/admin/events/:id">
        {() => <ProtectedRoute component={ManageEvent} requireAdmin />}
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
