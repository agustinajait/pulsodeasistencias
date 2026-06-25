import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Briefcase,
  FolderOpen,
  LogOut,
  Sparkles,
  Network,
  CalendarDays,
  BarChart3,
} from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: ("admin" | "superadmin" | "sala" | "equipotecnico")[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Inicio",
    path: "/reportes",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Asistencias",
    path: "/sala",
    icon: <ClipboardCheck className="w-5 h-5" />,
    roles: ["admin", "superadmin", "sala"],
  },
  {
    label: "Coordinación",
    path: "/admin",
    icon: <Users className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Casos",
    path: "/casos",
    icon: <FolderOpen className="w-5 h-5" />,
    roles: ["admin", "superadmin", "equipotecnico"],
  },
  {
    label: "Servicios",
    path: "/servicios",
    icon: <Briefcase className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Oportunai",
    path: "/oportunai",
    icon: <Sparkles className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Red de talentos",
    path: "/talentos",
    icon: <Network className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Calendario",
    path: "/calendario",
    icon: <CalendarDays className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
  {
    label: "Planificaciones",
    path: "/planificaciones",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["admin", "superadmin"],
  },
];

function roleType(role: string | null): "admin" | "superadmin" | "sala" | "equipotecnico" {
  if (role === "superadmin") return "superadmin";
  if (role === "admin") return "admin";
  if (role === "equipotecnico") return "equipotecnico";
  return "sala";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { role, logout } = useAuth();
  const rt = roleType(role);

  const visible = NAV_ITEMS.filter((i) => i.roles.includes(rt));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function isActive(path: string) {
    if (path === "/reportes") return location === "/reportes" || location === "/";
    return location.startsWith(path);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar (desktop lg+) ── */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1e1147] text-white shrink-0">
        {/* Logo */}
        <div className="px-5 pt-7 pb-6">
          <div className="text-white font-bold text-lg leading-none">Koratic</div>
          <div className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-0.5">
            {rt === "superadmin" ? "Super Admin" : rt === "admin" ? "Coordinación" : rt === "equipotecnico" ? "Equipo Técnico" : "Sala"}
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-0.5 py-2">
          {visible.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                }`}
              >
                <span className={active ? "text-white" : "text-white/50"}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          {/* Logout — always visible below nav items */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/8 transition-all mt-2"
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 pt-10 pb-3 bg-[#1e1147] shrink-0">
          <div>
            <div className="text-white font-bold text-base">Koratic</div>
            <div className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
              {rt === "superadmin" ? "Super Admin" : rt === "admin" ? "Coordinación" : rt === "equipotecnico" ? "Equipo Técnico" : "Sala"}
            </div>
          </div>
          <button onClick={handleLogout} className="text-white/60 hover:text-white p-1.5">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>

        {/* ── Bottom nav (mobile) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
          {visible.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-semibold transition-colors ${
                  active ? "text-violet-600" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span className={active ? "text-violet-600" : "text-gray-400"}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-semibold text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </nav>
      </div>
    </div>
  );
}
