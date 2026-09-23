/** 글 게시판 타입. posts.board_type 값과 1:1로 대응한다(게시판별 테이블은 없다). */
export const BOARD_TYPES = ["review", "question", "interpretation", "recap"] as const;
export type BoardType = (typeof BOARD_TYPES)[number];

/** URL 경로용 슬러그. 화면에서 게시판이 서로 다른 공간으로 보이도록 주소도 나눈다. */
export const BOARD_SLUGS: Record<BoardType, string> = {
  review: "impressions",
  question: "questions",
  interpretation: "analysis",
  recap: "reviews",
};

export const BOARD_LABELS: Record<BoardType, string> = {
  review: "감상",
  question: "질문",
  interpretation: "해석",
  recap: "후기",
};

/** 게시판 목록 화면에 쓰는 고유 제목과 설명. */
export const BOARD_TITLES: Record<BoardType, string> = {
  review: "감상 게시판",
  question: "질문 게시판",
  interpretation: "해석 게시판",
  recap: "후기 게시판",
};

export const BOARD_DESCRIPTIONS: Record<BoardType, string> = {
  review: "지금까지 본 내용에 대한 자유로운 감상을 나눕니다.",
  question: "현재 진도까지의 정보로 묻고 답하는 공간입니다.",
  interpretation: "인물, 복선, 장면의 의미에 대한 해석을 기록합니다.",
  recap: "현재까지 본 구간에 대한 정리와 평가를 남깁니다.",
};


/** 게시판 정체성 — 번호·영문 캡션·CTA·입력 안내. 표시 전용 값이다. */
export const BOARD_NUMERALS: Record<BoardType, string> = {
  review: 'I', question: 'II', interpretation: 'III', recap: 'IV',
};

export const BOARD_EN: Record<BoardType, string> = {
  review: 'NOTES', question: 'QUESTIONS', interpretation: 'READINGS', recap: 'RETROSPECTIVES',
};

export const BOARD_CTA: Record<BoardType, string> = {
  review: '감상 쓰기', question: '질문 남기기', interpretation: '해석 쓰기', recap: '후기 쓰기',
};

export const BOARD_PLACEHOLDERS: Record<BoardType, { title: string; body: string }> = {
  review: {
    title: '이 기록에 붙일 제목',
    body: '본 만큼의 느낌을 자유롭게 적어주세요. 한 줄 메모도 좋아요.',
  },
  question: {
    title: '궁금한 점을 한 문장으로',
    body: '어떤 장면에서 무엇이 궁금했는지 적어주세요. 아직 보지 않은 회차에 대한 추측은 빼주세요.',
  },
  interpretation: {
    title: '어떤 장면을 어떻게 읽었나요',
    body: '장면과 근거를 함께 적어주세요. 선택한 회차까지의 단서만으로요.',
  },
  recap: {
    title: '이 구간을 한 줄로 정리한다면',
    body: '처음부터 선택한 회차까지를 돌아보며 정리해주세요.',
  },
};

/** 글에 붙는 회차 표기. 게시판마다 말투가 다르다. */
export function stageTag(board: BoardType, stageLabel: string) {
  switch (board) {
    case "question":
      return `${stageLabel}까지 보고 묻는 질문`;
    case "interpretation":
      return `${stageLabel}까지 읽은 해석`;
    case "recap":
      return `처음부터 ${stageLabel}까지 정리`;
    default:
      return `${stageLabel}까지의 내용`;
  }
}

export function isBoardType(v: unknown): v is BoardType {
  return typeof v === "string" && (BOARD_TYPES as readonly string[]).includes(v);
}

export function toBoardType(v: unknown): BoardType {
  return isBoardType(v) ? v : "review";
}

/** 슬러그를 게시판 타입으로. 모르는 슬러그는 null이라 404로 처리한다. */
export function slugToBoard(slug: string): BoardType | null {
  const hit = BOARD_TYPES.find((b) => BOARD_SLUGS[b] === slug);
  return hit ?? null;
}

export function boardPath(workId: string, board: BoardType, mineOnly = false) {
  return `/works/${workId}/${BOARD_SLUGS[board]}${mineOnly ? "?mine=1" : ""}`;
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
