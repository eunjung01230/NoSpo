import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { countVisibleByBoard, getProgress, getWork, listStages } from "@/lib/data";
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
  searchParams: Promise<{ board?: string }>;
}) {
  const { workId } = await params;
  const { board } = await searchParams;
  // 게시판은 각자의 주소를 가진다. 예전 ?board= 주소는 그쪽으로 보낸다.
  if (isBoardType(board)) redirect(boardPath(workId, board));

  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress, counts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    countVisibleByBoard(user.id, workId),
  ]);

  return (
    <>
      <section className="container stack" style={{ gap: 24, paddingBlock: "24px 36px" }}>
        <Link href="/" className="backlink">
          ← 작품 탐색
        </Link>
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
              네 개의 게시판이 각각 따로 운영됩니다. 어느 게시판에서든 내 진도 이후의 글은
              열리지 않습니다.
            </span>
          </div>
          <BoardNav workId={work.id} counts={counts} />
        </div>
      </section>
    </>
  );
}
