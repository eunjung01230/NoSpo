import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import {
  BOARD_CTA,
  BOARD_DESCRIPTIONS,
  BOARD_LABELS,
  boardPath,
  slugToBoard,
  stageQuestion,
  unitNoun,
} from "@/lib/boards";
import PostForm from "../../PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ workId: string; board: string }>;
}) {
  const { workId, board } = await params;
  const boardType = slugToBoard(board);
  if (!boardType) notFound();

  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
  ]);
  // 작성자의 전체 진도가 아니라 '글에 포함된 마지막 회차'를 고르는 자리다.
  const selectable = stages.filter((s) => s.stage_no <= progress);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "시작 전";

  return (
    <section
      className="container container-read stack"
      style={{ gap: 20, paddingBlock: "24px 96px" }}
    >
      <Link href={boardPath(workId, boardType)} className="backlink">
        ← {work.title} · {BOARD_LABELS[boardType]} 게시판
      </Link>

      <div className="sheet sheet-hi stack" style={{ gap: 30, padding: "clamp(24px, 6%, 52px)" }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="page-title" style={{ fontSize: "clamp(27px, 3.6vw, 34px)", color: "var(--ns-ink)" }}>
            {BOARD_CTA[boardType]}
          </h1>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "#5A4E46" }}>
            {BOARD_DESCRIPTIONS[boardType]}
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ns-ink-muted)" }}>
            {work.title} · 작성자 {user.display_name}(시연 사용자) · 현재 진도 {currentLabel}
          </span>
        </div>

        {selectable.length === 0 ? (
          <p className="form-error">
            아직 진도가 없어 글을 쓸 수 없습니다. 작품 화면에서 진도를 먼저 올려주세요.
          </p>
        ) : (
          <PostForm
            workId={work.id}
            boardType={boardType}
            stages={selectable}
            unit={unitNoun(work.progress_unit)}
            question={stageQuestion(work.progress_unit)}
          />
        )}
      </div>
    </section>
  );
}
