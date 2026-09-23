import Link from "next/link";
import { notFound } from "next/navigation";
import { countVisibleByBoard, getProgress, getWork, listStages, listVisiblePosts } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import {
  BOARD_DESCRIPTIONS,
  BOARD_LABELS,
  BOARD_SLUGS,
  BOARD_TITLES,
  boardPath,
  slugToBoard,
} from "@/lib/boards";
import BoardNav from "../BoardNav";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string; board: string }>;
  searchParams: Promise<{ mine?: string }>;
}) {
  const { workId, board } = await params;
  const { mine } = await searchParams;
  const boardType = slugToBoard(board);
  if (!boardType) notFound();

  const work = await getWork(workId);
  if (!work) notFound();

  const mineOnly = mine === "1";
  const user = await getCurrentUser();
  const [stages, progress, posts, counts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    listVisiblePosts(user.id, workId, boardType, mineOnly),
    countVisibleByBoard(user.id, workId, mineOnly),
  ]);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "아직 보지 않음";

  return (
    <>
      <p className="muted">
        <Link href={`/works/${workId}`}>← {work.title}</Link>
      </p>
      <BoardNav workId={workId} current={boardType} counts={counts} />

      <h1>{BOARD_TITLES[boardType]}</h1>
      <p className="muted">{BOARD_DESCRIPTIONS[boardType]}</p>
      <div className="notice">
        {work.title} · {user.display_name}님의 진도 <b>{currentLabel}</b> 기준으로
        읽을 수 있는 글만 표시합니다.
      </div>

      <div className="row" style={{ margin: "12px 0" }}>
        <Link className="btn primary" style={{ textDecoration: "none" }}
              href={`/works/${workId}/${BOARD_SLUGS[boardType]}/new`}>
          {BOARD_LABELS[boardType]} 글쓰기
        </Link>
        <Link className={`btn${mineOnly ? " active" : ""}`}
              style={{ textDecoration: "none" }}
              href={boardPath(workId, boardType, !mineOnly)}>
          {mineOnly ? "전체 글 보기" : "내 글만 보기"}
        </Link>
        <Link className="btn" style={{ textDecoration: "none" }}
              href={`/works/${workId}`}>
          진도 변경
        </Link>
      </div>

      {posts.length === 0 && (
        <div className="card muted">
          {mineOnly
            ? "이 게시판에 내가 쓴 글이 아직 없습니다."
            : "지금 진도에서 읽을 수 있는 글이 아직 없습니다."}
        </div>
      )}
      {posts.map((p) => (
        <div className="card" key={p.id}>
          <div className="row">
            <span className="tag">{p.stage_label}까지의 내용</span>
            {p.is_demo_seed && <span className="badge">시연 데이터</span>}
            {p.author_id === user.id && <span className="tag">내 글</span>}
          </div>
          <h2 style={{ margin: "8px 0 4px" }}>
            <Link href={`/works/${workId}/posts/${p.id}`}>{p.title}</Link>
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {p.author_name} · {p.created_at}
          </p>
        </div>
      ))}
    </>
  );
}
