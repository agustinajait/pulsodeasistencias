import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Sala from "@/pages/sala";
import Admin from "@/pages/admin";
import Servicios from "@/pages/servicios";
import Reportes from "@/pages/reportes";
import Casos from "@/pages/casos";
import Informes from "@/pages/informes";
import Configuracion from "@/pages/configuracion";
import Oportunai from "@/pages/oportunai";
import Talentos from "@/pages/talentos";
import Calendario from "@/pages/calendario";
import Planificaciones from "@/pages/planificaciones";
import Diagnostico from "@/pages/diagnostico";

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
  allowedRoles: ("admin" | "sala" | "superadmin" | "equipotecnico")[];
  withLayout?: boolean;
}) {
  const { role } = useAuth();

  if (!role) {
    return <Redirect to="/login" />;
  }

  const roleType = role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : role === "equipotecnico" ? "equipotecnico" : "sala";

  if (!allowedRoles.includes(roleType)) {
    if (role === "equipotecnico") return <Redirect to="/casos" />;
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
      <Route path="/casos">
        {() => <ProtectedRoute component={Casos} allowedRoles={["admin", "superadmin", "equipotecnico"]} />}
      </Route>
      <Route path="/informes">
        {() => <ProtectedRoute component={Informes} allowedRoles={["admin", "superadmin", "sala"]} />}
      </Route>
      <Route path="/configuracion">
        {() => <ProtectedRoute component={Configuracion} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/oportunai">
        {() => <ProtectedRoute component={Oportunai} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/talentos">
        {() => <ProtectedRoute component={Talentos} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/calendario">
        {() => <ProtectedRoute component={Calendario} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/planificaciones">
        {() => <ProtectedRoute component={Planificaciones} allowedRoles={["admin", "superadmin"]} />}
      </Route>
      <Route path="/diagnostico">
        {() => <ProtectedRoute component={Diagnostico} allowedRoles={["admin", "superadmin"]} />}
      </Route>

      {/* Root redirect */}
      <Route path="/">
        {() => {
          const { role } = useAuth();
          if (!role) return <Redirect to="/login" />;
          if (role === "equipotecnico") return <Redirect to="/casos" />;
          return <Redirect to={role === "admin" || role === "superadmin" ? "/reportes" : "/sala"} />;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function TokenSync() {
  const { token } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);
  }, [token]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TokenSync />
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
