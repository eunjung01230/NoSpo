/** 글 게시판 타입. posts.board_type 값과 1:1로 대응한다(게시판별 테이블은 없다). */
export const BOARD_TYPES = ["review", "question", "interpretation", "recap", "free"] as const;
export type BoardType = (typeof BOARD_TYPES)[number];

/** URL 경로용 슬러그. 화면에서 게시판이 서로 다른 공간으로 보이도록 주소도 나눈다. */
export const BOARD_SLUGS: Record<BoardType, string> = {
  review: "impressions",
  question: "questions",
  interpretation: "analysis",
  recap: "reviews",
  free: "lounge",
};

export const BOARD_LABELS: Record<BoardType, string> = {
  review: "감상",
  question: "질문",
  interpretation: "해석",
  recap: "후기",
  free: "자유",
};

/**
 * 진도 제한이 없는 게시판은 두지 않는다. 자유 게시판도 다른 게시판과 똑같이
 * 글의 max_stage를 받아 `max_stage <= 읽는 사람의 진도`로만 공개한다.
 * '자유'는 진도의 자유가 아니라 이야기 주제의 자유를 뜻한다.
 */

/** 댓글은 모든 게시판에서 받는다. 답글은 한 단계까지만 달린다. */
export const BOARD_COMMENTS: Record<BoardType, boolean> = {
  review: true,
  question: true,
  interpretation: true,
  recap: true,
  free: true,
};

/**
 * 게시판마다 댓글을 부르는 말이 다르다. 질문 게시판에서는 댓글이 곧 답변이라
 * "답글"이라고 부른다. 댓글에 달리는 한 단계 아래 글은 어디서나 "답글"이다.
 */
export const COMMENT_NOUN: Record<BoardType, string> = {
  review: "댓글",
  question: "답글",
  interpretation: "댓글",
  recap: "댓글",
  free: "댓글",
};

export function commentNoun(board: BoardType) {
  return COMMENT_NOUN[board];
}

/** 게시판 목록 화면에 쓰는 고유 제목과 설명. */
export const BOARD_TITLES: Record<BoardType, string> = {
  review: "감상 게시판",
  question: "질문 게시판",
  interpretation: "해석 게시판",
  recap: "후기 게시판",
  free: "자유 게시판",
};

export const BOARD_DESCRIPTIONS: Record<BoardType, string> = {
  review: "지금까지 본 내용에 대한 자유로운 감상을 나눕니다.",
  question: "내가 본 회차까지의 내용으로 궁금한 점을 남기는 곳입니다.",
  interpretation: "인물, 복선, 장면의 의미에 대한 해석을 기록합니다.",
  recap: "현재까지 본 구간에 대한 정리와 평가를 남깁니다.",
  free: "회차에 매이지 않는 이야기를 나눕니다. 주제는 자유롭지만 공개 범위는 다른 게시판과 같습니다.",
};


/** 게시판 정체성 — 번호·영문 캡션·CTA·입력 안내. 표시 전용 값이다. */
export const BOARD_NUMERALS: Record<BoardType, string> = {
  review: 'I', question: 'II', interpretation: 'III', recap: 'IV', free: 'V',
};

export const BOARD_EN: Record<BoardType, string> = {
  review: 'NOTES', question: 'QUESTIONS', interpretation: 'READINGS',
  recap: 'RETROSPECTIVES', free: 'LOUNGE',
};

export const BOARD_CTA: Record<BoardType, string> = {
  review: '감상 쓰기', question: '질문 남기기', interpretation: '해석 쓰기',
  recap: '후기 쓰기', free: '자유롭게 쓰기',
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
  free: {
    title: '무엇에 대한 이야기인가요',
    body: '주제는 자유롭게 고르되, 위에서 고른 회차까지의 내용으로만 적어주세요. 그 뒤의 전개나 암시는 빼주세요.',
  },
};

/**
 * 글에 붙는 회차 표기. 게시판마다 말투가 다르다.
 * 단일 작품(progress_unit = single)은 회차가 없어 "봤다까지의 내용"처럼 말이 되지 않으므로
 * 회차 자리에 단계 이름을 넣지 않고 작품 전체를 가리키는 문장을 쓴다.
 */
export function stageTag(
  board: BoardType,
  stageLabel: string | null,
  progressUnit = "episode"
) {
  if (!stageLabel) return "회차 미지정";
  if (progressUnit === "single") {
    switch (board) {
      case "question":
        return "작품 전체를 보고 묻는 질문";
      case "interpretation":
        return "작품 전체를 두고 쓴 해석";
      case "recap":
        return "작품 전체 정리";
      default:
        return "작품 전체의 내용";
    }
  }
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

/**
 * 댓글 입력칸 옆에 붙는 대화의 경계. 이 글이 어느 회차까지를 다루는 글인지
 * 답을 쓰기 직전에 다시 한 번 밝힌다(질문 게시판은 "답해주세요"라고 말한다).
 */
export function commentScopeNote(
  board: BoardType,
  stageLabel: string | null,
  progressUnit: string
) {
  const verb = board === "question" ? "답해주세요" : "이야기해주세요";
  if (progressUnit === "single" || !stageLabel) {
    return `이 ${board === "question" ? "질문" : "글"}은 작품 전체를 본 사람들끼리의 자리예요. 다른 작품 이야기는 빼고 ${verb}.`;
  }
  return `이 ${board === "question" ? "질문" : "글"}은 ${stageLabel}까지의 내용으로 ${verb}. 그 뒤의 전개는 적지 말아주세요.`;
}

/**
 * 목록 행처럼 회차를 굵게 따로 보여주는 자리용. 앞(굵은 말)과 꼬리말을 나눠 준다.
 * 단일 작품은 "작품 전체 / 의 내용"이 된다.
 */
export function stageScopeParts(progressUnit: string, stageLabel: string | null) {
  if (progressUnit === "single") return { head: "작품 전체", tail: "의 내용" };
  return { head: stageLabel ?? "", tail: "까지의 내용" };
}

/**
 * 내 진도를 문장으로. 단일 작품은 "봤다까지 봤습니다"가 되지 않도록 따로 말하고,
 * 아직 보지 않은 상태(stageLabel 없음)도 여기서 함께 처리한다.
 */
export function progressSentence(progressUnit: string, stageLabel: string | null) {
  if (!stageLabel) return "아직 이 작품을 보지 않았습니다";
  if (progressUnit === "single") return "이 작품을 다 봤습니다";
  return `${stageLabel}까지 봤습니다`;
}

/** 카드·머리말에 쓰는 짧은 진도 표기. */
export function progressSummary(progressUnit: string, stageLabel: string | null) {
  if (!stageLabel) return "아직 보지 않음";
  return progressUnit === "single" ? "다 봄" : `${stageLabel}까지`;
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

/**
 * 진도 단위. 작품을 등록할 때 고르는 값이며 works.progress_unit에 그대로 들어간다.
 * 단일 작품(single)은 단계가 하나뿐이라 회차를 묻지 않는다.
 */
export const PROGRESS_UNITS = ["episode", "film", "volume", "single"] as const;
export type ProgressUnit = (typeof PROGRESS_UNITS)[number];

export const PROGRESS_UNIT_LABELS: Record<ProgressUnit, string> = {
  episode: "화 (드라마·애니·웹툰처럼 회차로 이어지는 작품)",
  film: "편 (시리즈로 이어지는 영화)",
  volume: "권 (책·만화책)",
  single: "단일 작품 (한 편으로 끝나는 영화·책)",
};

export function isProgressUnit(v: unknown): v is ProgressUnit {
  return typeof v === "string" && (PROGRESS_UNITS as readonly string[]).includes(v);
}
