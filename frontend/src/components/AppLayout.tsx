import { CalendarDays, BookOpen, LayoutDashboard, LogOut, MessagesSquare, ShieldCheck, UserRound } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../lib/roles";

const baseNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/community", label: "Community", icon: MessagesSquare },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/profile", label: "Profile", icon: UserRound }
];

const adminNavItem = { to: "/admin", label: "Admin", icon: ShieldCheck };

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = isAdminRole(user?.roleLabel) ? [...baseNavItems, adminNavItem] : baseNavItems;

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand">
          <span className="brand-badge">+</span>
          <span>Rtu</span>
        </div>
        <nav className="rail-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "rail-link active" : "rail-link")}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <button
          type="button"
          className="logout-link"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <main className="app-content">
        <header className="topbar">
          <div className="topbar-user">
            <span>{user?.displayName ?? "User"}</span>
            <img
              src={
                user?.avatarUrl ??
                "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=80&q=80"
              }
              alt="avatar"
            />
          </div>
        </header>
        <section className="page-body">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
