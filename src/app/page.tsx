import Link from "next/link";

export default function Home() {
  return (
    <div className="px-4 py-12 md:px-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium tracking-wide text-zinc-500">
          LingoSphere<span className="mx-1 text-zinc-600">｜</span>语界
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl">
          英语不是知识。
          <span className="mt-2 block text-xl font-normal text-zinc-400 md:text-2xl">
            English is a second mind — 第二思维系统。
          </span>
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-500">
          <p>为那些不满足于“学英语”的人而存在。</p>
          <p>
            写下想法，与 AI 对话。
            <br />
            从零散表达，到完整思维。
            <br />
            语言不会只是工具。
          </p>
          <p>
            当你开始用英语表达情绪、组织观点、思考世界时，
            <br />
            另一个“你”也会慢慢出现。
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/expression"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Open Expression Lab 进入表达实验室
          </Link>
          <span className="self-center text-xs text-zinc-600">
            无需登录 · No DB in MVP
          </span>
        </div>
      </div>
    </div>
  );
}
