"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", sub: "首页" },
  { href: "/expression", label: "Expression Lab", sub: "表达实验室" },
  { href: "/immersion", label: "Living Current", sub: "实时输入" },
  { href: "/speaking", label: "Mind Arena", sub: "思维竞技场" },
  { href: "/native-brain", label: "Native Brain", sub: "语言直觉" },
  { href: "/writing", label: "Writing Studio", sub: "写作工作室" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <aside className="shrink-0 border-b border-zinc-800 md:w-56 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-1 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <Link href="/" className="mb-4 block px-2">
            <span className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
              LingoSphere
            </span>
            <span className="mt-0.5 block text-sm font-semibold tracking-tight text-zinc-100">
              语界
            </span>
            <span className="text-[10px] leading-snug text-zinc-600">
              英语输出 · 表达与实时输入
            </span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors md:whitespace-normal",
                    active
                      ? "bg-zinc-800/80 text-emerald-300"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-1 text-xs text-zinc-500 md:ml-0 md:block">
                    {item.sub}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
