"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

type NavLink = { href: string; label: string };

const VENDOR_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/loads", label: "My Batches" },
  { href: "/sops", label: "SOPs" },
  { href: "/vendor/scorecard", label: "Monthly Report" },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/customer", label: "RE Portal" },
  { href: "/sops", label: "SOPs" },
  { href: "/loads/new", label: "Upload Batch" },
  { href: "/settings", label: "Settings" },
];

const CUSTOMER_LINKS: NavLink[] = [
  { href: "/customer", label: "Batch Review" },
  { href: "/sops", label: "SOPs" },
  { href: "/admin", label: "Analytics" },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function shortTabLabel(label: string): string {
  if (label === "Admin Dashboard") return "Admin";
  if (label === "Monthly Report") return "Report";
  if (label === "My Batches") return "Batches";
  if (label === "Batch Review") return "Review";
  if (label === "Upload Batch") return "Upload";
  return label;
}

function MobileOverflowMenu({
  extraLinks,
  userEmail,
  userRole,
  installPrompt,
  onInstall,
}: {
  extraLinks: NavLink[];
  userEmail?: string | null;
  userRole?: string;
  installPrompt: (() => Promise<void>) | null;
  onInstall: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  return (
    <div className="header-overflow show-mobile" ref={menuRef}>
      <button
        type="button"
        className="header-overflow__toggle"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        More
      </button>
      {menuOpen && (
        <div className="header-overflow__menu" role="menu">
          {userEmail && (
            <div className="header-overflow__meta">
              {userEmail}
              {userRole ? ` · ${userRole}` : ""}
            </div>
          )}
          {extraLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {installPrompt && (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await installPrompt();
                onInstall();
                setMenuOpen(false);
              }}
            >
              Install app
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [installPrompt, setInstallPrompt] = useState<
    (() => Promise<void>) | null
  >(null);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      const deferred = event as Event & { prompt: () => Promise<void> };
      setInstallPrompt(() => () => deferred.prompt());
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const navLinks =
    role === "admin"
      ? ADMIN_LINKS
      : role === "customer"
        ? CUSTOMER_LINKS
        : VENDOR_LINKS;
  const bottomTabs = navLinks.slice(0, 4);
  const overflowLinks = navLinks.slice(4);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__brand">
          <div className="site-header__mark">RE</div>
          <div>
            <div className="site-header__title">Royal Enfield</div>
            <div className="site-header__subtitle">
              Vendor Quality Dashboard
            </div>
          </div>
        </div>
        <div className="site-header__tools">
          <ThemeToggle />
          {!isLoginPage && (
            <MobileOverflowMenu
              key={pathname}
              extraLinks={overflowLinks}
              userEmail={session?.user?.email}
              userRole={role}
              installPrompt={installPrompt}
              onInstall={() => setInstallPrompt(null)}
            />
          )}
        </div>
      </header>

      {!isLoginPage && (
        <nav className="top-nav hide-mobile" aria-label="Primary">
          {navLinks.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : undefined}
              >
                {label}
              </Link>
            );
          })}
          {session?.user && (
            <div className="top-nav__session">
              <div className="top-nav__user">
                <div className="top-nav__email">{session.user.email}</div>
                <div className="top-nav__role">
                  {(session.user as { role?: string }).role ?? "user"}
                </div>
              </div>
              <button
                type="button"
                className="top-nav__signout"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      )}

      <div className="app-shell__main">{children}</div>

      {!isLoginPage && (
        <nav className="bottom-nav show-mobile" aria-label="Primary mobile">
          {bottomTabs.map((tab) => {
            const active = isActivePath(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? "active" : undefined}
              >
                <span className="bottom-nav__dot" aria-hidden="true" />
                {shortTabLabel(tab.label)}
              </Link>
            );
          })}
        </nav>
      )}

      <footer className="site-footer">
        Royal Enfield Vendor Quality Dashboard &mdash; Powered by Leadership
        Fractal
      </footer>
    </div>
  );
}
