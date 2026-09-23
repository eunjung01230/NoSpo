import { unitNoun } from "@/lib/boards";
import { formatMinutes, totalMinutes } from "@/lib/runtime";
import type { Work } from "@/lib/types";
import Poster from "@/app/Poster";

/** 작품 정보 — 감상방과 게시판 화면이 같은 머리글을 쓴다. */
export default function WorkIntro({
  work,
  totalStages,
  compact = false,
}: {
  work: Work;
  totalStages: number;
  compact?: boolean;
}) {
  const unit = unitNoun(work.progress_unit);
  const length =
    work.progress_unit === "single" ? "단일 작품" : `전 ${totalStages}${unit}`;
  // 작품을 고를 때 "시간이 얼마나 드는지"가 바로 보이도록 머리글에 함께 적는다.
  const runtime = totalMinutes(work.minutes_per_stage, totalStages);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        alignItems: "flex-start",
        flex: "1 1 440px",
      }}
    >
      <Poster
        workId={work.id}
        posterUrl={work.poster_url}
        title={work.title}
        label={false}
        style={{ flex: `0 0 ${compact ? 64 : 112}px`, borderColor: "#564A43" }}
      />
      <div className="stack" style={{ flex: "1 1 260px", gap: 9 }}>
        <span style={{ fontSize: 12.5, color: "var(--ns-rose)" }}>
          {work.board} · {length}
          {runtime > 0 ? ` · 총 ${formatMinutes(runtime)}` : ""}
          {work.year ? ` · ${work.year}` : ""}
        </span>
        {compact ? (
          <span className="page-title" style={{ fontSize: "clamp(22px, 2.6vw, 30px)" }}>
            {work.title}
          </span>
        ) : (
          <h1 className="page-title">{work.title}</h1>
        )}
        {!compact && work.creator && (
          <span style={{ fontSize: 13, color: "var(--ns-muted-dim)" }}>{work.creator}</span>
        )}
        {!compact && (
          <p
            className="muted"
            style={{ margin: 0, maxWidth: "56ch", fontSize: 15, lineHeight: 1.75 }}
          >
            {work.description}
          </p>
        )}
      </div>
    </div>
  );
}
