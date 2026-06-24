import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Sala from "@/pages/sala";
import Admin from "@/pages/admin";
import Servicios from "@/pages/servicios";
import Reportes from "@/pages/reportes";
import CheckIn from "@/pages/check-in";
import ChildDocs from "@/pages/child-docs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  component: Component,
  allowedRoles,
  withLayout = true,
}: {
  component: () => React.ReactElement;
  allowedRoles: ("admin" | "sala" | "superadmin")[];
  withLayout?: boolean;
}) {
  const { role } = useAuth();

  if (!role) {
    return <Redirect to="/login" />;
  }

  const roleType = role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : "sala";

  if (!allowedRoles.includes(roleType)) {
    return <Redirect to={role === "admin" || role === "superadmin" ? "/reportes" : "/sala"} />;
  }

  if (withLayout) {
    return (
      <Layout>
        <Component />
      </Layout>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no layout */}
      <Route path="/check-in/:token" component={CheckIn} />
      <Route path="/docs/:token" component={ChildDocs} />
      <Route path="/login" component={Login} />

      {/* Protected routes — wrapped in Layout */}
      <Route path="/reportes">
        {() => <ProtectedRoute component={Reportes} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/sala">
        {() => <ProtectedRoute component={Sala} allowedRoles={["sala", "admin", "superadmin"]} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/servicios">
        {() => <ProtectedRoute component={Servicios} allowedRoles={["admin", "superadmin"]} />}
      </Route>

      {/* Root redirect */}
      <Route path="/">
        {() => {
          const { role } = useAuth();
          if (!role) return <Redirect to="/login" />;
          return <Redirect to={role === "admin" || role === "superadmin" ? "/reportes" : "/sala"} />;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
