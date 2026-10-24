import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BookOpenCheck, CalendarDays, Cloud, Layers, LayoutDashboard, LogOut,
  Menu, MessageCircle, X
} from "lucide-react";
import { Button } from "./ui/button";

interface AppNavigationProps {
  signedIn: boolean;
  userName: string;
  onLogout: () => void;
  onQuizNavigate: () => void;
}

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/quiz", label: "Quiz / Practice", icon: BookOpenCheck },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/planner", label: "Study Planner", icon: CalendarDays },
  { to: "/chat", label: "Study Buddy", icon: MessageCircle }
];

export default function AppNavigation({ signedIn, userName, onLogout, onQuizNavigate }: AppNavigationProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
  }

  const navigation = (
    <nav aria-label="Main" className="main-navigation">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
          onClick={() => {
            if (to === "/quiz") onQuizNavigate();
            close();
          }}
        >
          <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  if (!signedIn) {
    return <header className="demo-app-bar">
      <a className="brand" href="/" aria-label="Cloudwise home">
        <span className="brand-icon"><Cloud size={20} strokeWidth={2.5} /></span>
        <span>cloudwise<span className="brand-period">.</span></span>
      </a>
      {navigation}
    </header>;
  }

  return <>
    <header className="mobile-app-bar">
      <a className="brand" href="/dashboard" aria-label="Cloudwise dashboard">
        <span className="brand-icon"><Cloud size={20} strokeWidth={2.5} /></span>
        <span>cloudwise<span className="brand-period">.</span></span>
      </a>
      <Button
        type="button"
        variant="secondary"
        className="sidebar-menu-button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </Button>
    </header>
    {open && <button className="sidebar-overlay" type="button" aria-label="Close navigation menu" onClick={close} />}
    <aside id="app-sidebar" className={`app-sidebar${open ? " sidebar-open" : ""}`}>
      <a className="brand sidebar-brand" href="/dashboard" aria-label="Cloudwise dashboard" onClick={close}>
        <span className="brand-icon"><Cloud size={21} strokeWidth={2.5} /></span>
        <span>cloudwise<span className="brand-period">.</span></span>
      </a>
      {navigation}
      <div className="sidebar-account">
        <div className="sidebar-user">
          <span className="sidebar-user-mark" aria-hidden="true">{(userName.trim()[0] ?? "L").toUpperCase()}</span>
          <span className="sidebar-user-name" title={userName}>{userName}</span>
        </div>
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          <LogOut size={17} aria-hidden="true" /><span>{"Log out"}</span>
        </button>
      </div>
    </aside>
  </>;
}
