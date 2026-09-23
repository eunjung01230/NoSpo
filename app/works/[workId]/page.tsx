import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgress, getWork, listStages, listVisiblePosts } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { raiseProgressAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function WorkRoomPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress, posts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    listVisiblePosts(user.id, workId),
  ]);
  const remaining = stages.filter((s) => s.stage_no > progress);

  return (
    <>
      <p className="muted"><Link href="/">← 작품 탐색</Link></p>
      <span className="tag">{work.board}</span>
      <h1>{work.title}</h1>
      <p className="muted">{work.description}</p>

      <h2>내 진도</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <b>{user.display_name}</b>님은 현재{" "}
          <b>{progress > 0 ? `${progress}화` : "아직 보지 않음"}</b>까지 봤습니다.
          <br />
          <span className="muted">
            글에 포함된 마지막 회차가 내 진도 이하일 때만 제목과 본문이 공개됩니다.
          </span>
        </p>
        {remaining.length > 0 ? (
          <form action={raiseProgressAction} className="row">
            <input type="hidden" name="workId" value={work.id} />
            <label htmlFor="stageNo" style={{ margin: 0 }}>진도 올리기</label>
            <select id="stageNo" name="stageNo" defaultValue={remaining[0].stage_no}
                    style={{ width: "auto" }}>
              {remaining.map((s) => (
                <option key={s.stage_no} value={s.stage_no}>{s.label}</option>
              ))}
            </select>
            <button className="btn primary" type="submit">여기까지 봤어요</button>
          </form>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>마지막 회차까지 봤습니다.</p>
        )}
      </div>

      <h2>감상 목록</h2>
      <p className="muted">
        이번 구현에서는 내 진도에서 읽을 수 있는 글만 표시합니다(기능 검증용 임시 방식).
      </p>
      <p>
        <Link className="btn primary" href={`/works/${work.id}/new`}
              style={{ textDecoration: "none" }}>
          감상 쓰기
        </Link>
      </p>
      {posts.length === 0 && (
        <div className="card muted">
          지금 진도에서 읽을 수 있는 감상이 아직 없습니다.
        </div>
      )}
      {posts.map((p) => (
        <div className="card" key={p.id}>
          <div className="row">
            <span className="tag">{p.max_stage}화까지의 내용</span>
            {p.is_demo_seed && <span className="badge">시연 데이터</span>}
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
