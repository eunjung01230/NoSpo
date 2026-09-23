import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getVisiblePost,
  getProgress,
  getWork,
  listComments,
  listStages,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import DeletePostButton from "./DeletePostButton";
import Comments from "./Comments";
import {
  BOARD_COMMENTS,
  BOARD_LABELS,
  BOARD_NUMERALS,
  boardPath,
  stageTag,
} from "@/lib/boards";

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
        <h1 className="page-title">지금은 볼 수 없는 글입니다</h1>
        <div className="notice-dark notice-warn">
          {user.display_name}님의 현재 진도는 {label}입니다. 이 진도 이후의 내용이 담긴
          글이거나 이미 삭제된 글이라 제목과 본문을 보내지 않습니다.
        </div>
        <span className="muted">
          {work.progress_unit === "single"
            ? "이 작품을 다 봤다고 표시하면 글이 열립니다. 잠긴 글의 제목은 미리 보여주지 않습니다."
            : "진도를 올리면 그 회차까지의 글이 열립니다. 잠긴 글의 제목은 미리 보여주지 않습니다."}
        </span>
      </section>
    );
  }

  const isMine = post.author_id === user.id;
  const canComment = BOARD_COMMENTS[post.board_type];
  // 댓글도 글과 같은 조건으로 서버에서 다시 판정한다(잠긴 글이면 null).
  const comments = canComment ? await listComments(user.id, workId, postId) : null;
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
          <span className="ep-tag">
            {stageTag(post.board_type, post.stage_label, work.progress_unit)}
          </span>
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
              <DeletePostButton
                workId={workId}
                postId={postId}
                boardType={post.board_type}
              />
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

      {canComment && comments && (
        <Comments
          workId={workId}
          postId={postId}
          comments={comments}
          currentUserId={user.id}
          userLabel={user.display_name}
        />
      )}

      {!canComment && (
        <p className="muted" style={{ margin: 0 }}>
          질문 게시판은 댓글 대신 같은 진도에서 각자 글로 이어집니다.
        </p>
      )}

      <Link className="btn" style={{ alignSelf: "flex-start" }} href={boardPath(workId, post.board_type)}>
        {BOARD_LABELS[post.board_type]} 게시판으로
      </Link>
    </section>
  );
}
