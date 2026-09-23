/**
 * 감상 소요 시간. 작품을 "얼마나 시간이 드는지"로 가늠하기 위한 표시용 값이며,
 * 공개 판정과는 무관하다. 저작권 문제가 없는 러닝타임·평균 분량만 쓴다
 * (works.minutes_per_stage = 한 회차/한 편/한 권을 보는 데 드는 평균 분).
 */

export function totalMinutes(minutesPerStage: number | null, stages: number) {
  if (!minutesPerStage || stages <= 0) return 0;
  return minutesPerStage * stages;
}

/** "약 2시간 30분" 꼴. 하루가 넘으면 시간으로만 말한다(체감이 더 정확하다). */
export function formatMinutes(minutes: number) {
  if (!minutes || minutes <= 0) return "정보 없음";
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 10) return `${h}시간`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 하루 몇 시간씩 보면 며칠인지. 긴 작품의 "예고" 감각을 주는 보조 문장. */
export function paceNote(minutes: number, hoursPerDay = 2) {
  if (!minutes) return null;
  const perDay = hoursPerDay * 60;
  if (minutes <= perDay) return "하루 만에 볼 수 있는 분량입니다.";
  const days = Math.ceil(minutes / perDay);
  return `하루 ${hoursPerDay}시간씩이면 약 ${days}일 걸립니다.`;
}

/** 진행 상황을 시간으로 환산한다. 남은 시간이 "다음에 뭘 볼지"의 기준이 된다. */
export function timeBudget(
  minutesPerStage: number | null,
  stages: number,
  progress: number
) {
  const total = totalMinutes(minutesPerStage, stages);
  const done = minutesPerStage ? minutesPerStage * Math.min(progress, stages) : 0;
  return {
    total,
    done,
    left: Math.max(total - done, 0),
    perStage: minutesPerStage ?? 0,
    known: total > 0,
  };
}
