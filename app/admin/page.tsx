import Link from "next/link";
import {
  listAiFlaggedPosts,
  listReportedPosts,
  listUserStanding,
  type ModerationPost,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { BOARD_LABELS } from "@/lib/boards";
import {
  REPORT_HIDE_THRESHOLD,
  REPORT_REASONS,
  WARNING_BLOCK_THRESHOLD,
  isReportReason,
} from "@/lib/moderation";
import {
  hidePostAction,
  resolveAiFlagAction,
  revokeWarningAction,
  unhidePostAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

/** 신고 사유 코드를 화면 문구로. 모르는 값이 와도 그대로 흘리지 않는다. */
function reasonText(reasons: string | null) {
  if (!reasons) return "사유 없음";
  return reasons
    .split(",")
    .map((r) => (isReportReason(r) ? REPORT_REASONS[r] : r))
    .join(" · ");
}

function PostLine({ p }: { p: ModerationPost }) {
  return (
    <span className="stack" style={{ gap: 4, minWidth: 0 }}>
      <span className="admin-title">{p.title}</span>
      <span className="admin-meta">
        {p.work_title} · {BOARD_LABELS[p.board_type]} · {p.stage_label ?? "진도 제한 없음"} ·{" "}
        {p.author_name} · {p.created_at}
      </span>
    </span>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser();

  // 관리자 여부는 쿠키가 아니라 DB의 is_admin으로 판정한다(시연 사용자 전환과 무관하게).
  if (!user.is_admin) {
    return (
      <section
        className="container container-read stack"
        style={{ gap: 16, paddingBlock: "32px 96px" }}
      >
        <h1 className="page-title">관리자 화면</h1>
        <div className="notice-dark notice-warn">
          {user.display_name}님은 관리자가 아닙니다. 위의 시연 사용자 전환에서 관리자를
          선택하면 신고와 검토 목록을 볼 수 있습니다.
        </div>
        <Link href="/" className="backlink">
          ← 작품 탐색으로
        </Link>
      </section>
    );
  }

  const [reported, flagged, standing] = await Promise.all([
    listReportedPosts(),
    listAiFlaggedPosts(),
    listUserStanding(),
  ]);

  return (
    <>
      <section className="container stack" style={{ gap: 10, paddingBlock: "24px 26px" }}>
        <span className="eyebrow">관리자</span>
        <h1 className="page-title">신고와 검토</h1>
        <p className="muted" style={{ maxWidth: 680, lineHeight: 1.7 }}>
          공개 판정(글의 범위가 읽는 사람의 진도 이하일 때만 열림)은 여기서 바꾸지 않습니다.
          이 화면은 신고로 가려진 글을 되돌리거나, AI 사전 검토에서 경고가 붙었는데도 올라온
          글을 사람이 다시 읽어보는 자리입니다. 신고 {REPORT_HIDE_THRESHOLD}건이면 글이
          자동으로 가려지고, 경고 {WARNING_BLOCK_THRESHOLD}건이면 그 사용자는 새 글을 쓸 수
          없습니다.
        </p>
      </section>

      <section className="band-low">
        <div className="container stack" style={{ gap: 16, paddingBlock: "28px 88px" }}>
          <div className="sheet">
            <div className="sheet-head">
              <div className="stack" style={{ gap: 6 }}>
                <h2>신고된 글</h2>
                <span className="desc">
                  신고가 한 건이라도 있는 글입니다. 가려진 글이 위에 옵니다.
                </span>
              </div>
              <span className="mono" style={{ color: "var(--ns-primary)" }}>
                {reported.length}건
              </span>
            </div>

            {reported.length === 0 && (
              <div className="sheet-empty">
                <b>신고된 글이 없습니다.</b>
                <span>글 상세 화면의 스포일러 신고로 접수됩니다.</span>
              </div>
            )}

            {reported.map((p) => (
              <div key={p.id} className="admin-row">
                <span className="admin-state">
                  <b className={p.hidden_at ? "off" : undefined}>
                    {p.hidden_at ? "가려짐" : "공개 중"}
                  </b>
                  <span>신고 {p.report_count}건</span>
                </span>
                <PostLine p={p} />
                <span className="admin-reason">{reasonText(p.reasons)}</span>
                <span className="admin-acts">
                  <Link className="textlink" href={`/works/${p.work_id}/posts/${p.id}`}>
                    글 보기
                  </Link>
                  {p.hidden_at ? (
                    <form action={unhidePostAction}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button className="btn btn-on-paper admin-btn" type="submit">
                        숨김 해제
                      </button>
                    </form>
                  ) : (
                    <form action={hidePostAction}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button className="btn btn-on-paper admin-btn" type="submit">
                        가리기
                      </button>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="sheet">
            <div className="sheet-head">
              <div className="stack" style={{ gap: 6 }}>
                <h2>AI 검토 필요</h2>
                <span className="desc">
                  사전 검토에서 경고가 붙었는데 작성자가 그대로 올린 글입니다. 등록을 막지 않는
                  대신 여기에 쌓입니다.
                </span>
              </div>
              <span className="mono" style={{ color: "var(--ns-primary)" }}>
                {flagged.length}건
              </span>
            </div>

            {flagged.length === 0 && (
              <div className="sheet-empty">
                <b>검토할 글이 없습니다.</b>
                <span>경고 없이 등록된 글은 여기 오지 않습니다.</span>
              </div>
            )}

            {flagged.map((p) => (
              <div key={p.id} className="admin-row">
                <span className="admin-state">
                  <b className={p.hidden_at ? "off" : undefined}>
                    {p.hidden_at ? "가려짐" : "공개 중"}
                  </b>
                  <span>AI 경고</span>
                </span>
                <PostLine p={p} />
                <span className="admin-reason">{p.ai_reason ?? "사유 기록 없음"}</span>
                <span className="admin-acts">
                  <Link className="textlink" href={`/works/${p.work_id}/posts/${p.id}`}>
                    글 보기
                  </Link>
                  {!p.hidden_at && (
                    <form action={hidePostAction}>
                      <input type="hidden" name="postId" value={p.id} />
                      <button className="btn btn-on-paper admin-btn" type="submit">
                        가리기
                      </button>
                    </form>
                  )}
                  <form action={resolveAiFlagAction}>
                    <input type="hidden" name="postId" value={p.id} />
                    <button className="btn btn-on-paper admin-btn" type="submit">
                      검토 완료
                    </button>
                  </form>
                </span>
              </div>
            ))}
          </div>

          <div className="sheet">
            <div className="sheet-head">
              <div className="stack" style={{ gap: 6 }}>
                <h2>사용자 경고</h2>
                <span className="desc">
                  신고로 글이 가려질 때마다 1건씩 쌓입니다. 숨김을 해제하면 그 글로 생긴 경고도
                  함께 사라집니다.
                </span>
              </div>
            </div>
            {standing.map((u) => (
              <div key={u.id} className="admin-row">
                <span className="admin-state">
                  <b className={u.warnings >= WARNING_BLOCK_THRESHOLD ? "off" : undefined}>
                    {u.warnings >= WARNING_BLOCK_THRESHOLD ? "글쓰기 정지" : "글쓰기 가능"}
                  </b>
                  <span>경고 {u.warnings}건</span>
                </span>
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="admin-title">{u.display_name}</span>
                  <span className="admin-meta">
                    정지 기준 {WARNING_BLOCK_THRESHOLD}건 · 이 사람이 신고한 글{" "}
                    {u.reports_made}건
                  </span>
                </span>
                <span className="admin-reason">
                  {u.warnings === 0 ? "기록 없음" : "신고로 가려진 글이 있습니다"}
                </span>
                <span className="admin-acts">
                  {u.warnings > 0 && (
                    <form action={revokeWarningAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn btn-on-paper admin-btn" type="submit">
                        경고 1건 취소
                      </button>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
