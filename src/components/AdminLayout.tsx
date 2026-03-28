import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Building2, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

export function AdminLayout() {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
      isActive
        ? "bg-white/10 text-white font-medium"
        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
    }`;

  const sidebar = (
    <>
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500">
            <Building2 className="size-4 text-[#0b1120]" />
          </div>
          <div>
            <span className="text-xl text-white font-semibold tracking-tight" style={serif}>
              Consorcia
            </span>
            <p className="text-[11px] text-amber-400/80 font-medium">Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        <NavLink to="/admin/dashboard" end className={navLinkClass}>
          <LayoutDashboard className="size-4 shrink-0" />
          Dashboard
        </NavLink>
        <NavLink to="/admin/supervisors" className={navLinkClass}>
          <Users className="size-4 shrink-0" />
          Supervisores
        </NavLink>
        <NavLink to="/admin/buildings" className={navLinkClass}>
          <Building2 className="size-4 shrink-0" />
          Edificios
        </NavLink>
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-white/5 hover:text-slate-200"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0b1120] lg:flex">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0b1120] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-amber-500">
              <Building2 className="size-3.5 text-[#0b1120]" />
            </div>
            <span className="text-base font-semibold tracking-tight" style={serif}>
              Consorcia
            </span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
              Admin
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
