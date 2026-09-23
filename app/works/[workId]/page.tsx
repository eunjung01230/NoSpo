import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countVisibleByBoard,
  getProgress,
  getWork,
  listStages,
  listVisiblePosts,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { setProgressAction } from "@/app/actions";
import { BOARD_HINTS, BOARD_LABELS, BOARD_TYPES, toBoardType, unitNoun } from "@/lib/boards";

export const dynamic = "force-dynamic";

export default async function WorkRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ board?: string; mine?: string }>;
}) {
  const { workId } = await params;
  const { board, mine } = await searchParams;
  const work = await getWork(workId);
  if (!work) notFound();

  const boardType = toBoardType(board);
  const mineOnly = mine === "1";
  const user = await getCurrentUser();
  const [stages, progress, posts, counts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    listVisiblePosts(user.id, workId, boardType, mineOnly),
    countVisibleByBoard(user.id, workId, mineOnly),
  ]);
  const unit = unitNoun(work.progress_unit);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "아직 보지 않음";
  const query = (next: { board?: string; mine?: boolean }) => {
    const p = new URLSearchParams();
    p.set("board", next.board ?? boardType);
    if (next.mine ?? mineOnly) p.set("mine", "1");
    return `/works/${work.id}?${p.toString()}`;
  };

  return (
    <>
      <p className="muted"><Link href="/">← 작품 탐색</Link></p>
      <span className="tag">{work.board}</span>
      <h1>{work.title}</h1>
      <p className="muted">{work.description}</p>

      <h2>내 진도</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <b>{user.display_name}</b>님은 현재 <b>{currentLabel}</b>까지 봤습니다.
          <br />
          <span className="muted">
            글에 포함된 마지막 {unit}가 내 진도 이하일 때만 제목과 본문이 공개됩니다.
          </span>
        </p>
        <form action={setProgressAction} className="row">
          <input type="hidden" name="workId" value={work.id} />
          <label htmlFor="stageNo" style={{ margin: 0 }}>진도 변경</label>
          <select id="stageNo" name="stageNo" defaultValue={progress}
                  style={{ width: "auto" }}>
            <option value={0}>아직 보지 않음</option>
            {stages.map((s) => (
              <option key={s.stage_no} value={s.stage_no}>{s.label}</option>
            ))}
          </select>
          <button className="btn primary" type="submit">여기까지 봤어요</button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          진도를 낮추면 그 이후 {unit}의 글은 다시 숨겨집니다. 이미 쓴 글은 지워지지 않습니다.
        </p>
      </div>

      <h2>게시판</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        {BOARD_TYPES.map((b) => (
          <Link key={b} href={query({ board: b })}
                className={`btn${b === boardType ? " active" : ""}`}
                style={{ textDecoration: "none" }}>
            {BOARD_LABELS[b]} {counts[b] ?? 0}
          </Link>
        ))}
      </div>
      <p className="muted">{BOARD_HINTS[boardType]}</p>
      <div className="row" style={{ marginBottom: 10 }}>
        <Link className={`btn${mineOnly ? " active" : ""}`}
              href={query({ mine: !mineOnly })} style={{ textDecoration: "none" }}>
          {mineOnly ? "전체 글 보기" : "내 글만 보기"}
        </Link>
        <Link className="btn primary"
              href={`/works/${work.id}/new?board=${boardType}`}
              style={{ textDecoration: "none" }}>
          {BOARD_LABELS[boardType]} 글쓰기
        </Link>
      </div>
      <p className="muted">
        이번 구현에서는 내 진도에서 읽을 수 있는 글만 표시합니다(기능 검증용 임시 방식).
      </p>

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
            <Link href={`/works/${work.id}/posts/${p.id}`}>{p.title}</Link>
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {p.author_name} · {p.created_at}
          </p>
        </div>
      ))}
    </>
  );
}
