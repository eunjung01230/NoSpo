import Link from "next/link";
import { recommendReason, type Recommendation } from "@/lib/data";
import { formatMinutes } from "@/lib/runtime";
import { unitNoun } from "@/lib/boards";
import Poster from "./Poster";

/**
 * 내가 쓴 글을 바탕으로 다음에 볼 작품을 권한다.
 * 글의 내용은 읽지 않고 '어느 작품에 썼는지'만 보며, 보여주는 값도 작품 메타와 시간뿐이다.
 */
export default function Recommendations({
  works,
  userLabel,
  hasPosts,
}: {
  works: Recommendation[];
  userLabel: string;
  hasPosts: boolean;
}) {
  if (works.length === 0) return null;

  return (
    <section className="band">
      <div className="container stack" style={{ gap: 18, paddingBlock: "36px 40px" }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">다음에 볼 것</span>
          <h2 className="section-title">
            {hasPosts ? "내 기록에서 이어지는 추천" : "시간이 적게 드는 것부터"}
          </h2>
          <span className="muted">
            {hasPosts
              ? `${userLabel}님이 글을 남긴 작품의 분야·장르를 기준으로, 아직 다 보지 않은 작품을 남은 시간이 적은 순으로 골랐습니다.`
              : "아직 남긴 글이 없어 남은 시간이 적은 작품부터 보여드립니다. 글을 남기면 그 분야·장르를 따라 추천이 바뀝니다."}
          </span>
        </div>

        <div className="rec-row">
          {works.map((w) => {
            const unit = unitNoun(w.progress_unit);
            const length =
              w.progress_unit === "single" ? "단일 작품" : `전 ${w.total_stages}${unit}`;
            return (
              <Link key={w.id} href={`/works/${w.id}`} className="rec-card">
                <Poster
                  workId={w.id}
                  posterUrl={w.poster_url}
                  title={w.title}
                  label={false}
                  style={{ flex: "0 0 56px", borderColor: "#564A43" }}
                />
                <div className="stack" style={{ gap: 5, minWidth: 0 }}>
                  <span className="why">{recommendReason(w)}</span>
                  <span className="title">{w.title}</span>
                  <span className="meta">
                    {length}
                    {w.total_minutes > 0 &&
                      (w.progress > 0
                        ? ` · 남은 시간 ${formatMinutes(w.left_minutes)}`
                        : ` · 총 ${formatMinutes(w.total_minutes)}`)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
