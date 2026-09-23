import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countLockedByBoard,
  countVisibleByBoard,
  getProgress,
  getWork,
  listStages,
  listVisiblePosts,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import {
  BOARD_CTA,
  BOARD_DESCRIPTIONS,
  BOARD_LABELS,
  BOARD_NUMERALS,
  BOARD_SLUGS,
  boardPath,
  commentNoun,
  slugToBoard,
  progressSentence,
  stageScopeParts,
  stageTag,
} from "@/lib/boards";
import type { VisiblePost } from "@/lib/types";
import BoardNav from "../BoardNav";
import WorkIntro from "../WorkIntro";

export const dynamic = "force-dynamic";

function excerpt(body: string) {
  return body.replace(/\s+/g, " ").trim();
}

function Meta({ post, mine }: { post: VisiblePost; mine: boolean }) {
  return (
    <div className="post-meta">
      <span>{post.author_name}</span>
      <span>·</span>
      <time>{post.created_at}</time>
      {post.comment_count > 0 && (
        <span className="cmt">
          {commentNoun(post.board_type)} {post.comment_count}
        </span>
      )}
      {post.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
      {mine && <span className="ep-tag">내 글</span>}
    </div>
  );
}

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
  const [stages, progress, posts, counts, locked] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    listVisiblePosts(user.id, workId, boardType, mineOnly),
    countVisibleByBoard(user.id, workId, mineOnly),
    countLockedByBoard(user.id, workId),
  ]);
  // 잠긴 글은 개수만 센다. 제목·본문은 조회하지 않는다.
  const lockedHere = locked[boardType] ?? 0;
  const currentStage = stages.find((s) => s.stage_no === progress) ?? null;
  const currentLabel = currentStage?.label ?? "시작 전";
  const href = (p: VisiblePost) => `/works/${workId}/posts/${p.id}`;

  return (
    <>
      <section className="container stack" style={{ gap: 20, paddingBlock: "24px 28px" }}>
        <Link href={`/works/${workId}`} className="backlink">
          ← {work.title}
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px 32px", alignItems: "flex-end" }}>
          <WorkIntro work={work} totalStages={stages.length} compact />
          <div className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 12.5, color: "var(--ns-muted)" }}>내 진도</span>
            <span style={{ fontFamily: "var(--ns-serif)", fontSize: 24 }}>{currentLabel}</span>
            <Link href={`/works/${workId}`} className="muted" style={{ fontSize: 12.5 }}>
              진도 변경 →
            </Link>
          </div>
        </div>
      </section>

      <section className="band-low">
        <div className="container stack" style={{ gap: 12, paddingBlock: "28px 88px" }}>
          <BoardNav workId={workId} current={boardType} counts={counts} />

          <div className="sheet">
            <div className="sheet-head">
              <div className="stack" style={{ gap: 8, maxWidth: 560 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span
                    style={{
                      fontFamily: "var(--ns-serif)",
                      fontSize: 18,
                      color: "var(--ns-primary)",
                    }}
                  >
                    {BOARD_NUMERALS[boardType]}
                  </span>
                  <h2>{BOARD_LABELS[boardType]} 게시판</h2>
                </div>
                <span className="desc">{BOARD_DESCRIPTIONS[boardType]}</span>
                <span className="caption">
                  {user.display_name}님은{" "}
                  {progressSentence(work.progress_unit, currentStage?.label ?? null)} ·
                  이번 구현에서는 내 진도에서 읽을 수 있는 글만 표시합니다.
                </span>
              </div>
              <Link
                className="btn btn-primary"
                href={`/works/${workId}/${BOARD_SLUGS[boardType]}/new`}
              >
                {BOARD_CTA[boardType]}
              </Link>
            </div>

            {boardType === "free" && (
              <div className="sheet-note">
                자유로운 건 이야기의 주제예요. 공개 범위는 다른 게시판과 같아서, 글쓴이가
                고른 회차가 내 진도 이하일 때만 제목과 본문이 열립니다.
              </div>
            )}

            {boardType === "question" && (
              <div className="sheet-note">
                묻는 사람이 본 회차가 곧 대화의 경계예요. 질문자가 본 지점 이후의 전개는
                꺼내지 않기로 해요. 답글은 질문자가 본 지점까지의 내용으로만 달아주세요.
              </div>
            )}

            <div className="sheet-tools">
              <Link
                className="btn btn-on-paper"
                style={{ padding: "7px 13px", fontSize: 13 }}
                aria-pressed={mineOnly}
                href={boardPath(workId, boardType, !mineOnly)}
              >
                {mineOnly ? "전체 글 보기" : "내 글만 보기"}
              </Link>
              <span>
                {posts.length}편 · {mineOnly ? "내가 쓴 글" : "지금 열람 가능한 글"}
                {lockedHere > 0 && ` · 내 진도 이후 ${lockedHere}편 잠김`}
              </span>
            </div>

            {posts.length === 0 && (
              <div className="sheet-empty">
                <b>{mineOnly ? "아직 내가 쓴 글이 없어요." : "아직 열린 글이 없어요."}</b>
                <span>
                  {mineOnly
                    ? "이 게시판에서 첫 글을 남겨보세요."
                    : lockedHere > 0
                      ? `이 게시판에는 내 진도(${currentLabel}) 이후의 글 ${lockedHere}편이 있습니다. 진도를 올리면 열립니다.`
                      : "이 게시판의 첫 글을 남겨보세요."}
                </span>
              </div>
            )}

            {/* 감상과 자유는 같은 행 형식을 쓴다. 회차를 앞에 세우는 것도 똑같다. */}
            {(boardType === "review" || boardType === "free") &&
              posts.map((p) => (
                <Link key={p.id} href={href(p)} className="post-row">
                  <span className="ep">
                    <b>{stageScopeParts(work.progress_unit, p.stage_label).head}</b>
                    <span>{stageScopeParts(work.progress_unit, p.stage_label).tail}</span>
                  </span>
                  <span className="stack" style={{ gap: 6 }}>
                    <span className="title">{p.title}</span>
                    <p className="excerpt">{excerpt(p.body)}</p>
                    <Meta post={p} mine={p.author_id === user.id} />
                  </span>
                </Link>
              ))}

            {boardType === "question" &&
              posts.map((p) => (
                <Link key={p.id} href={href(p)} className="post-row post-row-q">
                  <span className="q">Q.</span>
                  <span className="stack" style={{ gap: 8 }}>
                    <span className="title">{p.title}</span>
                    <div className="post-meta">
                      <span className="ep-tag">
                        {stageTag("question", p.stage_label, work.progress_unit)}
                      </span>
                      <span>{p.author_name}</span>
                      <span>·</span>
                      <time>{p.created_at}</time>
                      {p.comment_count > 0 && (
                        <span className="cmt">답글 {p.comment_count}</span>
                      )}
                      {p.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
                      {p.author_id === user.id && <span className="ep-tag">내 글</span>}
                    </div>
                  </span>
                </Link>
              ))}

            {boardType === "interpretation" &&
              posts.map((p) => (
                <Link key={p.id} href={href(p)} className="post-article">
                  <span className="cap">
                    {stageTag("interpretation", p.stage_label, work.progress_unit)}
                  </span>
                  <span className="title">{p.title}</span>
                  <p className="excerpt">{excerpt(p.body)}</p>
                  <Meta post={p} mine={p.author_id === user.id} />
                </Link>
              ))}

            {boardType === "recap" && posts.length > 0 && (
              <div className="recap-grid">
                {posts.map((p) => (
                  <Link key={p.id} href={href(p)} className="recap-card">
                    <span className="range">
                      {stageTag("recap", p.stage_label, work.progress_unit)}
                    </span>
                    <span className="title">{p.title}</span>
                    <p className="excerpt">{excerpt(p.body)}</p>
                    <div
                      className="post-meta"
                      style={{
                        marginTop: "auto",
                        paddingTop: 6,
                        borderTop: "1px solid #DDD2C3",
                      }}
                    >
                      <span>{p.author_name}</span>
                      <span>·</span>
                      <time>{p.created_at}</time>
                      {p.comment_count > 0 && (
                        <span className="cmt">댓글 {p.comment_count}</span>
                      )}
                      {p.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
                      {p.author_id === user.id && <span className="ep-tag">내 글</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
