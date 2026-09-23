/**
 * 신고·경고 문턱값과 사전 검토 결과의 이름표. 브라우저 쪽 폼에서도 가져다 쓰므로
 * 여기에는 서버 전용 코드(AI 호출, 서명)를 두지 않는다 — 그쪽은 lib/screening.ts.
 *
 * 이 서비스의 공개 판정은 어디까지나 `글의 max_stage <= 읽는 사람의 진도`이며,
 * 사전 검토는 "고른 회차가 글 내용과 맞는가"를 작성자에게 미리 알려주는 보조 장치일
 * 뿐이라 판정 결과로 등록을 막지 않는다. (막는 것은 신고 누적뿐이고, 그 판단도 사람이 한다.)
 */

/** 신고가 이만큼 쌓이면 글을 자동으로 가린다. 시연 사용자가 적어 낮게 잡았다. */
export const REPORT_HIDE_THRESHOLD = 2;
/** 경고가 이만큼 쌓인 사용자는 새 글을 쓸 수 없다. */
export const WARNING_BLOCK_THRESHOLD = 3;

/** 신고 사유. 값은 DB에 그대로 저장하므로 화면 문구와 한 곳에서 관리한다. */
export const REPORT_REASONS = {
  spoiler: "선택한 회차를 넘는 내용(스포일러)",
  wrong_board: "게시판·범위에 맞지 않는 글",
  abuse: "비방·욕설 등 부적절한 글",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" && v in REPORT_REASONS;
}

/**
 * 글 길이 한도. AI 사전 검토에 넘기는 양과 같아서, 등록되는 글은 언제나 끝까지 검토된다
 * (잘라서 앞부분만 보고 '문제 없음'이라고 하는 일이 없도록).
 */
export const POST_TITLE_MAX = 100;
export const POST_BODY_MAX = 5000;

/**
 * 사전 검토 결과 네 가지.
 * - clear: AI가 실제로 읽고 선택한 회차를 넘는 단서를 찾지 못했다(보조 판단일 뿐 '안전' 보증이 아니다).
 * - suspect: 선택한 회차보다 뒤의 내용을 담았을 가능성이 있다.
 * - uncertain: AI가 읽었지만 근거가 부족해 판단하지 못했다.
 * - unavailable: AI가 검토하지 못했다(키 없음, 호출 실패, 시간 초과 등).
 */
export type ScreenStatus = "clear" | "suspect" | "uncertain" | "unavailable";

export const SCREEN_STATUS_LABELS: Record<ScreenStatus, string> = {
  clear: "문제 없음",
  suspect: "뒤 회차 내용 의심",
  uncertain: "판단 불가",
  unavailable: "AI 사용 불가",
};

/** 화면에 내보내는 검토 결과. 서버가 고정 문구에서 고른 것만 담는다(AI의 자유 서술은 싣지 않는다). */
export type Screening = {
  status: ScreenStatus;
  /** 작성자에게 보여줄 한 줄. */
  message: string;
  /** AI가 검토하지 못했을 때 규칙 검사가 작성자 본인의 글에서 찾은 단서. */
  ruleHint: string | null;
};
