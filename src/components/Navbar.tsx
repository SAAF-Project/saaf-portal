"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◆" },
  { href: "/profile", label: "Profile", icon: "●" },
  { href: "/leaderboard", label: "Leaderboard", icon: "★" },
  { href: "/participants", label: "Participants", icon: "👥" },
  { href: "/tracks", label: "Tracks", icon: "▶" },
  { href: "/my-repos", label: "My Repos", icon: "◇" },
  { href: "/onboarding", label: "How to Contribute", icon: "→" },
  { href: "/e-learning", label: "E-Learning", icon: "▣" },
  { href: "/agent-library", label: "Agent Library", icon: "◈" },
];

const ADMIN_USERNAME = "MSACC";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  const isAdmin = username === ADMIN_USERNAME;
  const navItems = isAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin", icon: "⚙" }]
    : NAV_ITEMS;

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 bg-gradient-to-r from-surface to-surface2 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 no-underline">
          <Image
            src="/saaf-logo-white.png"
            alt="SAAF"
            width={110}
            height={32}
            className="h-8 w-auto"
            style={{ width: "auto", height: "32px" }}
            loading="eager"
          />
          <span className="text-lg font-extrabold bg-gradient-to-r from-accent to-saaf-purple bg-clip-text text-transparent">
            Portal
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all no-underline ${
                  active
                    ? "text-accent bg-accent/8 border-b-2 border-accent"
                    : "text-muted hover:text-text hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://saafproject.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:block text-xs text-muted hover:text-text no-underline"
          >
            saafproject.com ↗
          </a>
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
            className="md:hidden text-muted hover:text-text cursor-pointer text-xl"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block py-2 px-3 text-sm rounded-lg no-underline ${
                  active
                    ? "text-accent bg-accent/8"
                    : "text-muted hover:text-text"
                }`}
              >
                <span className="mr-2 opacity-50">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
