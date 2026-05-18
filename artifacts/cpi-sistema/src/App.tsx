import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Sala from "@/pages/sala";
import Admin from "@/pages/admin";

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
}: {
  component: () => React.ReactElement;
  allowedRoles: ("admin" | "sala")[];
}) {
  const { role } = useAuth();

  if (!role) {
    return <Redirect to="/login" />;
  }

  const roleType = role === "admin" ? "admin" : "sala";

  if (!allowedRoles.includes(roleType)) {
    return <Redirect to={role === "admin" ? "/admin" : "/sala"} />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/sala">
        {() => <ProtectedRoute component={Sala} allowedRoles={["sala"]} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/">
        {() => {
          const { role } = useAuth();
          if (!role) return <Redirect to="/login" />;
          return <Redirect to={role === "admin" ? "/admin" : "/sala"} />;
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
