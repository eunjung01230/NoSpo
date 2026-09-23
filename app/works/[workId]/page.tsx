import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { countVisibleByBoard, getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { setProgressAction } from "@/app/actions";
import {
  BOARD_DESCRIPTIONS,
  BOARD_TITLES,
  BOARD_TYPES,
  boardPath,
  isBoardType,
} from "@/lib/boards";

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
  // 게시판은 이제 각자의 주소를 가진다. 예전 ?board= 주소는 그쪽으로 보낸다.
  if (isBoardType(board)) redirect(boardPath(workId, board));

  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress, counts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    countVisibleByBoard(user.id, workId),
  ]);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "아직 보지 않음";

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
            글에 포함된 마지막 지점이 내 진도 이하일 때만 제목과 본문이 공개됩니다.
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
          진도를 낮추면 그 이후 범위의 글은 다시 숨겨집니다. 이미 쓴 글은 지워지지 않습니다.
        </p>
      </div>

      <h2>게시판</h2>
      <p className="muted">
        네 개의 게시판이 각각 따로 운영됩니다. 어느 게시판에서든 내 진도 이후의 글은 열리지 않습니다.
      </p>
      {BOARD_TYPES.map((b) => (
        <div className="card" key={b}>
          <h2 style={{ margin: "0 0 4px" }}>
            <Link href={boardPath(work.id, b)}>{BOARD_TITLES[b]}</Link>
          </h2>
          <p className="muted" style={{ margin: "0 0 8px" }}>{BOARD_DESCRIPTIONS[b]}</p>
          <p className="muted" style={{ margin: 0 }}>
            지금 읽을 수 있는 글 {counts[b] ?? 0}개
          </p>
        </div>
      ))}
    </>
  );
}
