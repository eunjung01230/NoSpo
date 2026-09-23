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
import {
  BOARD_CTA,
  BOARD_DESCRIPTIONS,
  BOARD_LABELS,
  BOARD_NUMERALS,
  BOARD_SLUGS,
  boardPath,
  slugToBoard,
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
  const [stages, progress, posts, counts] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
    listVisiblePosts(user.id, workId, boardType, mineOnly),
    countVisibleByBoard(user.id, workId, mineOnly),
  ]);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "시작 전";
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
                  {user.display_name}님의 진도 {currentLabel} 기준 ·{" "}
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

            {boardType === "question" && (
              <div className="sheet-note">
                묻는 사람이 본 회차가 곧 대화의 경계예요. 질문자가 본 지점 이후의 전개는
                꺼내지 않기로 해요.
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
              </span>
            </div>

            {posts.length === 0 && (
              <div className="sheet-empty">
                <b>{mineOnly ? "아직 내가 쓴 글이 없어요." : "아직 열린 글이 없어요."}</b>
                <span>
                  {mineOnly
                    ? "이 게시판에서 첫 글을 남겨보세요."
                    : "진도를 올리면 더 많은 글이 열립니다."}
                </span>
              </div>
            )}

            {boardType === "review" &&
              posts.map((p) => (
                <Link key={p.id} href={href(p)} className="post-row">
                  <span className="ep">
                    <b>{p.stage_label}</b>
                    <span>까지의 내용</span>
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
                      <span className="ep-tag">{stageTag("question", p.stage_label)}</span>
                      <span>{p.author_name}</span>
                      <span>·</span>
                      <time>{p.created_at}</time>
                      {p.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
                      {p.author_id === user.id && <span className="ep-tag">내 글</span>}
                    </div>
                  </span>
                </Link>
              ))}

            {boardType === "interpretation" &&
              posts.map((p) => (
                <Link key={p.id} href={href(p)} className="post-article">
                  <span className="cap">{stageTag("interpretation", p.stage_label)}</span>
                  <span className="title">{p.title}</span>
                  <p className="excerpt">{excerpt(p.body)}</p>
                  <Meta post={p} mine={p.author_id === user.id} />
                </Link>
              ))}

            {boardType === "recap" && posts.length > 0 && (
              <div className="recap-grid">
                {posts.map((p) => (
                  <Link key={p.id} href={href(p)} className="recap-card">
                    <span className="range">{stageTag("recap", p.stage_label)}</span>
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
