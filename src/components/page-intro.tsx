import type { ReactNode } from "react";

export function PageIntro({
  titleEn,
  titleZh,
  children,
}: {
  titleEn: string;
  titleZh: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-zinc-800 px-4 py-5 md:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
        {titleEn}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
        {titleZh}
      </h1>
      {children && (
        <div className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          {children}
        </div>
      )}
    </header>
  );
}
