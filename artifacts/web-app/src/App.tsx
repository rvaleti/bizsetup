import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import type { ComponentType } from "react";

// Pages
import Login from "@/pages/login";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerCompanyDetail from "@/pages/customer/company-detail";
import CustomerPipelineView from "@/pages/customer/pipeline-view";
import FacilitatorDashboard from "@/pages/facilitator/dashboard";
import FacilitatorPipelineDetail from "@/pages/facilitator/pipeline-detail";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCompanies from "@/pages/admin/companies";
import AdminUsers from "@/pages/admin/users";
import AdminPipelineDetail from "@/pages/admin/pipeline-detail";
import NotFound from "@/pages/not-found";

// Layout
import { AppLayout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ProtectedRouteProps {
  component: ComponentType<Record<string, unknown>>;
  allowedRoles?: string[];
  [key: string]: unknown;
}

function ProtectedRoute({ component: Component, allowedRoles, ...rest }: ProtectedRouteProps) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen w-full bg-slate-50 flex items-center justify-center animate-pulse"><div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) {
    window.location.href = "/";
    return null;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="h-screen flex items-center justify-center flex-col text-center p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-slate-600 mb-6">You do not have permission to view this page.</p>
        <button onClick={() => window.location.href="/"} className="px-4 py-2 bg-primary text-white rounded-lg">Go Home</button>
      </div>
    );
  }

  return <Component {...rest} />;
}

function Router() {
  const { data: user } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Login} />
      
      {/* Wrapped in AppLayout */}
      <Route path="/:rest*">
        {user ? (
          <AppLayout>
            <Switch>
              <Route path="/dashboard" component={() => <ProtectedRoute component={CustomerDashboard} allowedRoles={["CUSTOMER"]} />} />
              <Route path="/dashboard/company/:id" component={() => <ProtectedRoute component={CustomerCompanyDetail} allowedRoles={["CUSTOMER", "ADMIN", "FACILITATOR"]} />} />
              <Route path="/pipeline/:id" component={() => <ProtectedRoute component={CustomerPipelineView} allowedRoles={["CUSTOMER", "ADMIN", "FACILITATOR"]} />} />
              
              <Route path="/facilitator" component={() => <ProtectedRoute component={FacilitatorDashboard} allowedRoles={["FACILITATOR"]} />} />
              <Route path="/facilitator/pipeline/:id" component={() => {
                console.log("[ROUTE] /facilitator/pipeline/:id matched");
                return <ProtectedRoute component={FacilitatorPipelineDetail} allowedRoles={["FACILITATOR", "ADMIN"]} />;
              }} />
              
              <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} allowedRoles={["ADMIN"]} />} />
              <Route path="/admin/companies" component={() => <ProtectedRoute component={AdminCompanies} allowedRoles={["ADMIN"]} />} />
              <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} allowedRoles={["ADMIN"]} />} />
              <Route path="/admin/pipeline/:id" component={() => <ProtectedRoute component={AdminPipelineDetail} allowedRoles={["ADMIN"]} />} />
              
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        ) : (
          <Login />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
