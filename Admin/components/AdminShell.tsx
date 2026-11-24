"use client";

import {
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

const UserContext = createContext<User | null>(null);
export const useAdmin = () => useContext(UserContext)!;

interface NavGroup {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: Array<{ href: string; label: string }>;
}

/** Sidebar, grouped like a typical store back office. */
const NAV: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { href: "/orders", label: "Orders" },
      { href: "/carts", label: "Carts (add to bag)" },
    ],
  },
  {
    label: "Catalog",
    icon: Package,
    items: [
      { href: "/products", label: "Products" },
      { href: "/categories", label: "Categories" },
      { href: "/brands", label: "Brands" },
      { href: "/inventory", label: "Inventory" },
    ],
  },
  {
    label: "Customers",
    icon: Users,
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/newsletter", label: "Newsletter" },
    ],
  },
  { label: "Marketing", icon: Megaphone, items: [{ href: "/coupons", label: "Coupons" }] },
  { label: "Reports", icon: BarChart3, items: [{ href: "/reports", label: "Sales report" }] },
  {
    label: "Support",
    icon: LifeBuoy,
    items: [
      { href: "/messages", label: "Messages" },
      { href: "/faqs", label: "FAQs" },
    ],
  },
  {
    label: "System",
    icon: Settings,
    items: [
      { href: "/settings", label: "Store settings" },
      { href: "/integrations", label: "Integrations" },
      { href: "/audit-log", label: "Audit log" },
    ],
  },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const activeGroup = NAV.find((g) => g.items?.some((i) => isActive(pathname, i.href)))?.label;
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  const [lastActive, setLastActive] = useState(activeGroup);
  // Expand the group of the page being viewed (e.g. after following a link).
  if (activeGroup !== lastActive) {
    setLastActive(activeGroup);
    if (activeGroup && !open.has(activeGroup)) setOpen(new Set([...open, activeGroup]));
  }
  const toggle = (label: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const row = "flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 font-medium transition-colors";
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-2">
      <ul className="space-y-0.5">
        {NAV.map((g) => {
          const Icon = g.icon;
          if (g.href) {
            const active = isActive(pathname, g.href);
            return (
              <li key={g.label}>
                <Link href={g.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`${row} ${active ? "bg-blue-50 text-primary" : "text-ink-2 hover:bg-elevated hover:text-ink"}`}>
                  <Icon size={16} /> {g.label}
                </Link>
              </li>
            );
          }
          const expanded = open.has(g.label);
          const containsActive = g.label === activeGroup;
          return (
            <li key={g.label}>
              <button type="button" onClick={() => toggle(g.label)} aria-expanded={expanded} className={`${row} ${containsActive ? "text-ink" : "text-ink-2"} hover:bg-elevated hover:text-ink`}>
                <Icon size={16} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronRight size={14} className={`text-muted transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
              {expanded && (
                <ul className="mt-0.5 mb-1 ml-[1.2rem] space-y-0.5 border-l border-line-soft pl-2.5">
                  {g.items!.map((i) => {
                    const active = isActive(pathname, i.href);
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded px-2.5 py-1.5 ${active ? "bg-blue-50 font-medium text-primary" : "text-ink-2 hover:bg-elevated hover:text-ink"}`}
                        >
                          {i.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Guards every panel page: only signed-in admins get past this. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "offline">("loading");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api<User>("/auth/me")
      .then(({ data }) => {
        setUser(data);
        setState(data.isAdmin ? "ok" : "forbidden");
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setState("offline");
      });
  }, [router]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  if (state === "loading") return <p className="p-10 text-muted">Loading…</p>;
  if (state === "offline")
    return <p className="p-10 text-danger">Can&apos;t reach the AZMARO API. Start it with <code>npm run dev</code> in the API folder, then reload.</p>;
  if (state === "forbidden")
    return (
      <div className="p-10">
        <p className="text-danger">{user?.email} doesn&apos;t have admin access.</p>
        <button className="btn mt-4" onClick={signOut}>Sign in with another account</button>
      </div>
    );

  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
  return (
    <UserContext.Provider value={user}>
      <div className="min-h-dvh md:flex">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-line-soft bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-base font-bold text-ink">
            AZMARO <span className="font-normal text-muted">Admin</span>
          </Link>
          <button className="btn btn-icon" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <aside
          className={`${menuOpen ? "flex" : "hidden"} flex-col border-b border-line-soft bg-card md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:border-r md:border-b-0`}
        >
          <div className="hidden border-b border-line-soft px-4 py-3.5 md:block">
            <Link href="/dashboard" className="text-base font-bold text-ink">
              AZMARO <span className="font-normal text-muted">Admin</span>
            </Link>
          </div>
          <Sidebar pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-line-soft p-3">
            <a href={storefront} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2.5 rounded px-2.5 py-1.5 font-medium text-ink-2 hover:bg-elevated hover:text-ink">
              <Store size={16} /> View store
            </a>
            <p className="truncate px-2.5 text-xs text-ink-2">{user?.name}</p>
            <p className="truncate px-2.5 text-xs text-muted">{user?.email}</p>
            <button className="btn btn-sm mt-2 w-full" onClick={signOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
