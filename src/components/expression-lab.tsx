"use client";

import { ExpressionSidebar } from "@/components/expression-sidebar";
import { ExpressionTrainer } from "@/components/expression-trainer";
import { PageIntro } from "@/components/page-intro";
import { useExpressionLab } from "@/hooks/use-expression-lab";

export function ExpressionLab() {
  const lab = useExpressionLab();

  if (!lab.hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-sm text-zinc-500">
        正在加载本地会话…
      </div>
    );
  }

  const { state } = lab;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:min-h-screen">
      <PageIntro titleEn="Expression Lab" titleZh="表达实验室">
        输入一句英文 → AI 帮你{" "}
        <span className="text-zinc-400">native 化 / 升级 / 展开</span>
        ，并用英文追问；下方可<strong className="text-zinc-400">多选改写风格</strong>
        （或写自定义说明），不选则默认口语 / 书面 / 进阶三档。左侧可分类管理会话，数据保存在本机。
      </PageIntro>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <ExpressionSidebar
          categories={state.categories}
          sessions={state.sessions}
          activeCategoryId={state.activeCategoryId}
          activeSessionId={state.activeSessionId}
          onSelectCategory={lab.selectCategory}
          onSelectSession={lab.selectSession}
          onAddCategory={lab.addCategory}
          onRenameCategory={lab.renameCategory}
          onDeleteCategory={lab.deleteCategory}
          onAddSession={lab.addSession}
          onRenameSession={lab.renameSession}
          onDeleteSession={lab.deleteSession}
        />
        <ExpressionTrainer
          key={state.activeSessionId ?? "none"}
          messages={lab.messages}
          onMessagesChange={lab.setMessages}
        />
      </div>
    </div>
  );
}
