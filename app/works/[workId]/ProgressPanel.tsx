import { setProgressAction } from "@/app/actions";
import { unitNoun } from "@/lib/boards";
import type { Stage, Work } from "@/lib/types";

/**
 * 내 진도 패널. 폼 필드명(workId, stageNo)과 서버 액션 연결은 그대로 두고
 * 표시만 디자인에 맞춘다. 진도 올리기·내리기 모두 이 폼 하나로 처리한다.
 */
export default function ProgressPanel({
  work,
  stages,
  progress,
  userLabel,
}: {
  work: Work;
  stages: Stage[];
  progress: number;
  userLabel: string;
}) {
  const unit = unitNoun(work.progress_unit);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "시작 전";
  // 단계가 많은 작품은 30칸으로 압축해 보여준다(표시 전용).
  const segmentCount = Math.min(stages.length, 30);
  const filled = stages.length
    ? Math.round((progress / stages.length) * segmentCount)
    : 0;

  return (
    <div className="panel stack" style={{ flex: "0 1 380px", gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: 12.5, color: "var(--ns-muted)" }}>내 진도</span>
        <span className="progress-value">
          {currentLabel}
          {work.progress_unit !== "single" && (
            <span className="of">
              {" "}
              / {stages.length}
              {unit}
            </span>
          )}
        </span>
      </div>

      <div className="segments" aria-hidden>
        {Array.from({ length: segmentCount }, (_, i) => (
          <i key={i} className={i < filled ? "on" : undefined} />
        ))}
      </div>

      <span style={{ fontSize: 13, lineHeight: 1.6, color: "#E0D5C7" }}>
        {userLabel}님은 <b style={{ fontWeight: 600 }}>{currentLabel}</b>까지 봤습니다.
        이 진도까지의 글만 열립니다.
      </span>

      <form
        action={setProgressAction}
        className="stack"
        style={{ gap: 10, borderTop: "1px solid #4E433C", paddingTop: 14 }}
      >
        <input type="hidden" name="workId" value={work.id} />
        <label htmlFor="stageNo" style={{ fontSize: 12.5, color: "var(--ns-muted)" }}>
          어디까지 보셨나요?
        </label>
        <div className="row" style={{ gap: 8 }}>
          <select
            id="stageNo"
            name="stageNo"
            defaultValue={progress}
            className="field"
            style={{
              flex: "1 1 140px",
              width: "auto",
              background: "transparent",
              borderColor: "#6A5A50",
              color: "var(--ns-text)",
              padding: "10px 12px",
              fontSize: 14,
            }}
          >
            <option value={0}>아직 보지 않음</option>
            {stages.map((s) => (
              <option key={s.stage_no} value={s.stage_no}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            진도 적용
          </button>
        </div>
        <span style={{ fontSize: 12, lineHeight: 1.55, color: "#D9A79C" }}>
          진도를 내리면 그 이후 범위의 글은 다시 보이지 않아요. 이미 쓴 글은 지워지지 않습니다.
        </span>
      </form>
    </div>
  );
}
