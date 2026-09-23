import Link from "next/link";
import { notFound } from "next/navigation";
import { countWarnings, getProgress, getWork, listStages } from "@/lib/data";
import { WARNING_BLOCK_THRESHOLD } from "@/lib/moderation";
import { getCurrentUser } from "@/lib/session";
import {
  BOARD_CTA,
  BOARD_DESCRIPTIONS,
  BOARD_LABELS,
  boardPath,
  isUngated,
  slugToBoard,
  progressSummary,
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
  const [stages, progress, warnings] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    countWarnings(user.id),
  ]);
  // 정지 여부는 화면에서도 미리 알려주지만, 실제 차단은 서버 액션에서 다시 판정한다.
  const blocked = warnings >= WARNING_BLOCK_THRESHOLD;
  // 작성자의 전체 진도가 아니라 '글에 포함된 마지막 회차'를 고르는 자리다.
  const selectable = stages.filter((s) => s.stage_no <= progress);
  const currentStage = stages.find((s) => s.stage_no === progress) ?? null;

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
            {work.title} · 작성자 {user.display_name}(시연 사용자)
            {isUngated(boardType)
              ? " · 진도 제한 없는 게시판"
              : ` · 현재 진도 ${progressSummary(work.progress_unit, currentStage?.label ?? null)}`}
          </span>
        </div>

        {blocked ? (
          <p className="form-error">
            신고가 확인된 글이 {warnings}건 있어 글쓰기가 멈춰 있습니다. 관리자가 확인하면
            다시 쓸 수 있습니다.
          </p>
        ) : selectable.length === 0 && !isUngated(boardType) ? (
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
