"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { ADMIN_ITEM, NAV_GROUPS, activeGroupId, isActive, type NavItem } from "./navGroups";

const ADMIN_USERNAME = "MSACC";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  const isAdmin = username === ADMIN_USERNAME;
  const currentGroup = activeGroupId(pathname);

  // An open menu closes when a link in it is clicked, on Escape and on a click outside the bar.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openGroup]);

  const itemClass = (item: NavItem) =>
    `flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg no-underline whitespace-nowrap ${
      isActive(pathname, item.href) ? "text-accent bg-accent/8" : "text-muted hover:text-text hover:bg-hover"
    }`;

  return (
    <>
      {/* Top bar: above the page content so its menus open on top; below the modals (z-50) so they still cover it */}
      <header className="relative z-40 flex items-center justify-between px-6 h-14 bg-gradient-to-r from-surface to-surface2 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 no-underline">
          <Image
            src="/saaf-logo-white.png"
            alt="SAAF"
            width={110}
            height={32}
            className="h-8 w-auto logo-invert"
            style={{ width: "auto", height: "32px" }}
            loading="eager"
          />
          <span className="text-lg font-extrabold bg-gradient-to-r from-accent to-saaf-purple bg-clip-text text-transparent">
            Portal
          </span>
        </Link>

        <nav ref={navRef} aria-label="Main" className="hidden md:flex items-center gap-1">
          {NAV_GROUPS.map((group) => {
            const open = openGroup === group.id;
            const active = currentGroup === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    active ? "text-accent bg-accent/8 border-b-2 border-accent" : "text-muted hover:text-text hover:bg-hover"
                  }`}
                >
                  {group.label} <span className="text-[10px] opacity-60">▾</span>
                </button>
                {open && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] bg-surface border border-border rounded-xl shadow-lg p-1.5">
                    <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-muted uppercase tracking-wider">{group.hint}</div>
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpenGroup(null)} className={itemClass(item)}>
                        <span className="opacity-50 w-4 text-center">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isAdmin && (
            <Link
              href={ADMIN_ITEM.href}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-lg no-underline ${
                isActive(pathname, ADMIN_ITEM.href) ? "text-accent bg-accent/8 border-b-2 border-accent" : "text-muted hover:text-text hover:bg-hover"
              }`}
            >
              {ADMIN_ITEM.label}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://saafproject.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:block text-xs text-muted hover:text-text no-underline"
          >
            saafproject.com ↗
          </a>
          <ThemeToggle />
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-7 h-7 rounded-full border border-border"
                />
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-muted hover:text-text cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="md:hidden text-muted hover:text-text cursor-pointer text-xl"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav aria-label="Main" className="md:hidden bg-surface border-b border-border px-4 py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="py-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                {group.label} <span className="normal-case font-normal tracking-normal">· {group.hint}</span>
              </div>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={itemClass(item)}>
                  <span className="opacity-50 w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          {isAdmin && (
            <Link href={ADMIN_ITEM.href} onClick={() => setMobileOpen(false)} className={itemClass(ADMIN_ITEM)}>
              <span className="opacity-50 w-4 text-center">{ADMIN_ITEM.icon}</span>
              {ADMIN_ITEM.label}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
