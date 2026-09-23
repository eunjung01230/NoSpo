import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHiddenOwnPost,
  getPostAsAdmin,
  getVisiblePost,
  getProgress,
  getWork,
  hasReported,
  listComments,
  listStages,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import DeletePostButton from "./DeletePostButton";
import Comments from "./Comments";
import ReportForm from "./ReportForm";
import {
  BOARD_COMMENTS,
  commentNoun,
  BOARD_LABELS,
  BOARD_NUMERALS,
  boardPath,
  commentScopeNote,
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
  // 관리자만은 신고를 판단하기 위해 가려진 글도 열어볼 수 있다(그 사실을 화면에 밝힌다).
  const visible = await getVisiblePost(user.id, workId, postId);
  const adminView = !visible && user.is_admin ? await getPostAsAdmin(workId, postId) : null;
  const post = visible ?? adminView;

  if (!post) {
    const [progress, stages, hiddenMine] = await Promise.all([
      getProgress(user.id, workId),
      listStages(workId),
      getHiddenOwnPost(user.id, workId, postId),
    ]);
    const label = stages.find((s) => s.stage_no === progress)?.label ?? "시작 전";

    // 내가 쓴 글이 신고로 가려진 경우. 글은 지워지지 않았고 관리자가 확인한다.
    if (hiddenMine) {
      return (
        <section
          className="container container-read stack"
          style={{ gap: 20, paddingBlock: "24px 96px" }}
        >
          <Link href={`/works/${workId}`} className="backlink">
            ← {work.title}
          </Link>
          <h1 className="page-title">신고로 가려진 내 글입니다</h1>
          <div className="notice-dark notice-warn">
            {hiddenMine.hidden_reason === "admin"
              ? "관리자가 이 글을 가렸습니다."
              : `스포일러 신고 ${hiddenMine.report_count}건이 모여 이 글이 가려졌습니다.`}{" "}
            글은 지워지지 않았고, 관리자가 확인하면 다시 열릴 수 있습니다. 누적 경고가
            쌓이면 새 글을 쓸 수 없게 됩니다.
          </div>
          <span className="muted">
            고른 회차보다 뒤의 내용이 담겨 있었는지 다시 살펴봐 주세요.
          </span>
        </section>
      );
    }
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
  const reported = isMine ? false : await hasReported(postId, user.id);
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

      {adminView && (
        <div className="notice-dark notice-warn">
          관리자 열람입니다. {adminView.hidden_at
            ? `이 글은 ${adminView.hidden_at}에 가려졌습니다.`
            : "이 글은 관리자의 진도로는 아직 열리지 않는 글입니다."}{" "}
          일반 사용자에게는 이 화면이 보이지 않습니다.
        </div>
      )}

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
          noun={commentNoun(post.board_type)}
          scopeNote={commentScopeNote(
            post.board_type,
            post.stage_label,
            work.progress_unit
          )}
        />
      )}

      {/* 신고. 읽을 수 있는 글에만 자리가 생기고, 내 글과 관리자 열람은 대상이 아니다. */}
      {!isMine && !adminView && (
        <div className="report-slot">
          <span className="muted" style={{ fontSize: 12.5 }}>
            내 진도보다 뒤의 내용이 적혀 있나요?
          </span>
          <ReportForm workId={workId} postId={postId} alreadyReported={reported} />
        </div>
      )}

      <Link className="btn" style={{ alignSelf: "flex-start" }} href={boardPath(workId, post.board_type)}>
        {BOARD_LABELS[post.board_type]} 게시판으로
      </Link>
    </section>
  );
}
