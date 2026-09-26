"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const destinations = [
  { href: "/plan", label: "Plan" },
  { href: "/assignments", label: "Assignments" },
  { href: "/availability", label: "Availability" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inFocus = pathname.startsWith("/focus/");
  const onWelcome = pathname === "/";

  if (inFocus || onWelcome) {
    return <main className="standalone-page">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/plan">Deadline Rescue</Link>
        <nav aria-label="Main">
          {destinations.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href || (href === "/assignments" && pathname.startsWith("/assignments/")) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="page-content">{children}</main>
      <nav className="bottom-nav" aria-label="Main">
        {destinations.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href || (href === "/assignments" && pathname.startsWith("/assignments/")) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
