import Link from "next/link";
import { progressSummary, unitNoun } from "@/lib/boards";
import { formatMinutes, timeBudget } from "@/lib/runtime";
import type { WorkCard } from "@/lib/data";
import Poster from "./Poster";

/** 작품 카드 그리드. 탐색·분야·장르 화면이 같은 그리드를 쓴다. */
export default function WorkGrid({ works }: { works: WorkCard[] }) {
  if (works.length === 0) {
    return <div className="notice-dark">이 분류에 등록된 작품이 아직 없습니다.</div>;
  }

  return (
    <div className="work-grid">
      {works.map((w) => {
        const unit = unitNoun(w.progress_unit);
        const length =
          w.progress_unit === "single" ? "단일 작품" : `전 ${w.total_stages}${unit}`;
        const pct = w.total_stages
          ? Math.round((w.progress / w.total_stages) * 100)
          : 0;
        const t = timeBudget(w.minutes_per_stage, w.total_stages, w.progress);
        const progressLabel = progressSummary(
          w.progress_unit,
          w.progress === 0 ? null : (w.progress_label ?? `${w.progress}${unit}`)
        );
        return (
          <Link key={w.id} href={`/works/${w.id}`} className="work-card">
            <Poster workId={w.id} posterUrl={w.poster_url} title={w.title} />
            <div className="stack" style={{ gap: 5 }}>
              <div className="meta">
                <span style={{ color: "var(--ns-rose)" }}>{w.board}</span>
                <span style={{ color: "#6E6259" }}>·</span>
                <span style={{ color: "var(--ns-muted-dim)" }}>{length}</span>
                {t.known && (
                  <>
                    <span style={{ color: "#6E6259" }}>·</span>
                    <span style={{ color: "var(--ns-muted-dim)" }}>
                      {formatMinutes(t.total)}
                    </span>
                  </>
                )}
                {w.year && (
                  <>
                    <span style={{ color: "#6E6259" }}>·</span>
                    <span style={{ color: "var(--ns-muted-dim)" }}>{w.year}</span>
                  </>
                )}
              </div>
              <span className="title">{w.title}</span>
              <p className="intro">{w.description}</p>
            </div>
            <div className="stack" style={{ gap: 5, marginTop: "auto" }}>
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: w.progress === 0 ? "var(--ns-muted-dim)" : "var(--ns-rose)",
                }}
              >
                {progressLabel}
                {t.known && t.left > 0 && ` · 남은 시간 ${formatMinutes(t.left)}`}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
