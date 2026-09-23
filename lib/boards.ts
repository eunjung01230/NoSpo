/** 글 게시판 타입. posts.board_type 값과 1:1로 대응한다. */
export const BOARD_TYPES = ["review", "question", "interpretation", "recap"] as const;
export type BoardType = (typeof BOARD_TYPES)[number];

export const BOARD_LABELS: Record<BoardType, string> = {
  review: "감상",
  question: "질문",
  interpretation: "해석",
  recap: "후기",
};

export const BOARD_HINTS: Record<BoardType, string> = {
  review: "내가 본 범위 안에서 나눈 감상입니다.",
  question: "내가 본 회차까지의 내용에 대해 묻는 공간입니다.",
  interpretation: "장면·인물·복선에 대한 해석을 기록합니다.",
  recap: "지금까지 본 구간에 대한 짧은 후기입니다.",
};

export function isBoardType(v: unknown): v is BoardType {
  return typeof v === "string" && (BOARD_TYPES as readonly string[]).includes(v);
}

export function toBoardType(v: unknown): BoardType {
  return isBoardType(v) ? v : "review";
}

/**
 * 작품의 진도 단위 표기. 작품마다 화/편/권/단일 작품이 다르므로 하드코딩하지 않고
 * works.progress_unit에서 가져온다.
 */
const UNIT_NOUNS: Record<string, string> = {
  episode: "화",
  film: "편",
  volume: "권",
  single: "범위",
};

export function unitNoun(progressUnit: string) {
  return UNIT_NOUNS[progressUnit] ?? "화";
}

/** 작성 화면에서 글의 내용 범위를 묻는 문장. 단일 작품은 회차를 억지로 만들지 않는다. */
export function stageQuestion(progressUnit: string) {
  return progressUnit === "single"
    ? "이 글의 내용 범위를 선택해 주세요."
    : `이 글에 몇 ${unitNoun(progressUnit)}까지의 내용이 포함되어 있나요?`;
}
