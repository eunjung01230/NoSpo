import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  countLockedByBoard,
  countPostsBetween,
  countVisibleByBoard,
  getProgress,
  getWork,
  listStages,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { boardPath, isBoardType } from "@/lib/boards";
import BoardNav from "./BoardNav";
import ProgressPanel from "./ProgressPanel";
import WorkIntro from "./WorkIntro";

export const dynamic = "force-dynamic";

export default async function WorkRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ board?: string; from?: string }>;
}) {
  const { workId } = await params;
  const { board, from } = await searchParams;
  // 게시판은 각자의 주소를 가진다. 예전 ?board= 주소는 그쪽으로 보낸다.
  if (isBoardType(board)) redirect(boardPath(workId, board));

  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress, counts, locked] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    countVisibleByBoard(user.id, workId),
    countLockedByBoard(user.id, workId),
  ]);

  // 진도를 바꾼 직후에만 무엇이 달라졌는지 알려준다(개수만, 글 내용은 쓰지 않는다).
  const previous = from !== undefined ? Number(from) : null;
  const changed =
    previous !== null && Number.isInteger(previous) && previous !== progress;
  const movedCount = changed ? await countPostsBetween(workId, previous, progress) : 0;
  const raised = changed && progress > previous;
  const stageLabel = (n: number) =>
    stages.find((s) => s.stage_no === n)?.label ?? "아직 보지 않음";
  const lockedTotal = Object.values(locked).reduce((a, b) => a + b, 0);

  return (
    <>
      <section className="container stack" style={{ gap: 24, paddingBlock: "24px 36px" }}>
        <Link href="/" className="backlink">
          ← 작품 탐색
        </Link>

        {changed && previous !== null && (
          <div className="notice-dark" role="status">
            진도를 <b>{stageLabel(previous)}</b>에서 <b>{stageLabel(progress)}</b>로
            바꿨습니다. {raised ? "새로 열린 글" : "다시 잠긴 글"} <b>{movedCount}편</b>
            {raised
              ? " — 아래 게시판에서 확인해 보세요."
              : " — 글은 지워지지 않고, 진도를 다시 올리면 열립니다."}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 48px", alignItems: "flex-start" }}>
          <WorkIntro work={work} totalStages={stages.length} />
          <ProgressPanel
            work={work}
            stages={stages}
            progress={progress}
            userLabel={user.display_name}
          />
        </div>
      </section>

      <section className="band-low">
        <div className="container stack" style={{ gap: 20, paddingBlock: "32px 88px" }}>
          <div className="stack" style={{ gap: 6 }}>
            <h2 className="section-title">게시판</h2>
            <span className="muted">
              게시판 옆 숫자는 지금 진도에서 읽을 수 있는 글 수입니다.
              {lockedTotal > 0
                ? ` 내 진도 이후의 글 ${lockedTotal}편은 제목도 보이지 않습니다.`
                : " 지금 진도에서 이 작품의 글이 모두 열려 있습니다."}
            </span>
          </div>
          <BoardNav workId={work.id} counts={counts} />
        </div>
      </section>
    </>
  );
}
