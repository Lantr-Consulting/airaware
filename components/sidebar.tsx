"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const NAV = [
  {
    href: "/",
    label: "Today",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </Icon>
    ),
  },
  {
    href: "/planner",
    label: "Planner",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </Icon>
    ),
  },
  {
    href: "/activities",
    label: "Activities",
    icon: (
      <Icon>
        <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8z" />
      </Icon>
    ),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: (
      <Icon>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </Icon>
    ),
  },
  {
    href: "/advisor",
    label: "Advisor",
    icon: (
      <Icon>
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
      </Icon>
    ),
  },
  {
    href: "/briefings",
    label: "Briefings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </Icon>
    ),
  },
  {
    href: "/profile",
    label: "Profile & settings",
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </Icon>
    ),
  },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent">
        <svg
          aria-hidden
          viewBox="0 0 32 32"
          className="size-4"
          fill="none"
          stroke="#04121c"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12h14a4 4 0 1 0-4-6" />
          <path d="M4 20h20a4 4 0 1 1-4 6" />
        </svg>
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-tight tracking-tight">
          AirAware
        </span>
        <span className="block text-[11px] leading-tight text-ink-muted">
          Outdoor guidance · sample data
        </span>
      </span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-hairline bg-page px-3 py-5 max-md:hidden">
      <Wordmark />
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/10 font-medium text-ink"
                  : "text-ink-2 hover:bg-white/5 hover:text-ink"
              }`}
            >
              <span className={active ? "text-accent" : "text-ink-muted"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-3">
        <div className="text-[11px] leading-relaxed text-ink-muted">
          A Lantr sample project.
          <br />
          General guidance, not medical advice.
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-hairline bg-page px-3 py-2 md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
              active ? "bg-white/10 font-medium text-ink" : "text-ink-2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
