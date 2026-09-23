import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisiblePost, getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { deletePostAction } from "@/app/actions";
import { BOARD_LABELS, BOARD_NUMERALS, boardPath, stageTag } from "@/lib/boards";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ workId: string; postId: string }>;
}) {
  const { workId, postId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  // 상세 주소로 직접 들어와도 서버에서 사용자와 진도를 확인한다.
  const post = await getVisiblePost(user.id, workId, postId);

  if (!post) {
    const [progress, stages] = await Promise.all([
      getProgress(user.id, workId),
      listStages(workId),
    ]);
    const label = stages.find((s) => s.stage_no === progress)?.label ?? "시작 전";
    return (
      <section
        className="container container-read stack"
        style={{ gap: 20, paddingBlock: "24px 96px" }}
      >
        <Link href={`/works/${workId}`} className="backlink">
          ← {work.title}
        </Link>
        <h1 className="page-title">아직 열람할 수 없는 글입니다</h1>
        <div className="notice-dark notice-warn">
          이 글에는 {user.display_name}님의 현재 진도({label}) 이후의 내용이 포함되어 있어
          제목과 본문을 보내지 않습니다.
        </div>
        <span className="muted">진도를 올리면 열람할 수 있습니다.</span>
      </section>
    );
  }

  const isMine = post.author_id === user.id;
  const paragraphs = post.body.split(/\n{2,}|\n/).filter((p) => p.trim());

  return (
    <section
      className="container container-read stack"
      style={{ gap: 20, paddingBlock: "24px 96px" }}
    >
      <Link href={boardPath(workId, post.board_type)} className="backlink">
        ← {work.title} · {BOARD_LABELS[post.board_type]} 게시판
      </Link>

      <article className="sheet sheet-article">
        <div className="row" style={{ gap: "8px 10px", fontSize: 12.5 }}>
          <span className="ep-tag">{stageTag(post.board_type, post.stage_label)}</span>
          <span style={{ color: "#5A4E46" }}>
            {BOARD_NUMERALS[post.board_type]} {BOARD_LABELS[post.board_type]}
          </span>
          <span style={{ color: "var(--ns-muted-dim)" }}>·</span>
          <span style={{ color: "#5A4E46" }}>{work.title}</span>
          {post.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
        </div>

        <h1
          className="page-title"
          style={{ fontSize: "clamp(27px, 4vw, 38px)", lineHeight: 1.32, color: "var(--ns-ink)" }}
        >
          {post.title}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 13,
            color: "var(--ns-ink-muted)",
          }}
        >
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{post.author_name}</span>
            <span>·</span>
            <span className="stamp">{post.created_at}</span>
          </span>
          {isMine && (
            <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Link className="textlink" href={`/works/${workId}/posts/${postId}/edit`}>
                수정
              </Link>
              <form action={deletePostAction}>
                <input type="hidden" name="workId" value={workId} />
                <input type="hidden" name="postId" value={postId} />
                <input type="hidden" name="boardType" value={post.board_type} />
                <button className="textlink textlink-danger" type="submit">
                  삭제
                </button>
              </form>
            </span>
          )}
        </div>

        <div className="hr" />

        <div className="read-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>

      <Link className="btn" style={{ alignSelf: "flex-start" }} href={boardPath(workId, post.board_type)}>
        {BOARD_LABELS[post.board_type]} 게시판으로
      </Link>
    </section>
  );
}
