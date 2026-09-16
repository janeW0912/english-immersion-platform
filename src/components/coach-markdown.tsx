"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h3 className="mt-4 border-b border-zinc-800 pb-1 text-base font-semibold tracking-tight text-zinc-100 first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold text-zinc-100 first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-2 text-sm font-medium text-zinc-200">{children}</h5>
  ),
  p: ({ children }) => (
    <p className="leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-2 pl-5 marker:text-emerald-500/80">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-2 pl-5 marker:text-zinc-500">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-emerald-300/95">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-zinc-400 not-italic">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-zinc-700 pl-3 text-zinc-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-zinc-800" />,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-200/90"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 font-mono text-xs text-zinc-300">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export function CoachMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-none text-sm leading-relaxed text-zinc-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
