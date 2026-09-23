import { unitNoun } from "@/lib/boards";
import { formatMinutes, paceNote, timeBudget } from "@/lib/runtime";
import type { Work } from "@/lib/types";

/**
 * 감상 시간 가늠. "다음에 뭘 볼지"를 시간으로 견줘보기 위한 표시 전용 패널이며,
 * 글 공개 판정과는 아무 관계가 없다.
 */
export default function TimePanel({
  work,
  totalStages,
  progress,
}: {
  work: Work;
  totalStages: number;
  progress: number;
}) {
  const unit = unitNoun(work.progress_unit);
  const t = timeBudget(work.minutes_per_stage, totalStages, progress);

  if (!t.known) {
    return (
      <div className="time-panel">
        <span className="cap">감상 시간</span>
        <span className="lead">아직 등록되지 않았습니다</span>
        <span className="note">
          이 작품에는 평균 감상 시간이 등록되어 있지 않습니다.
        </span>
      </div>
    );
  }

  const done = t.total - t.left;

  return (
    <div className="time-panel">
      <span className="cap">감상 시간</span>
      <span className="lead">{formatMinutes(t.total)}</span>
      <span className="note">
        처음부터 끝까지 보는 데 드는 시간입니다
        {work.progress_unit === "single"
          ? "."
          : ` · 한 ${unit} 평균 ${formatMinutes(t.perStage)}.`}
      </span>
      <dl className="time-rows">
        <div>
          <dt>지금까지</dt>
          <dd>{done > 0 ? formatMinutes(done) : "0분"}</dd>
        </div>
        <div>
          <dt>남은 시간</dt>
          <dd className="left">{t.left > 0 ? formatMinutes(t.left) : "다 봤어요"}</dd>
        </div>
      </dl>
      {t.left > 0 && <span className="note">{paceNote(t.left)}</span>}
    </div>
  );
}
