import Anthropic from "@anthropic-ai/sdk";
import { BOARD_LABELS, type BoardType } from "./boards";

/**
 * 글이 '작성자가 고른 범위'를 넘는 내용을 담고 있는지 미리 살펴보는 자리.
 *
 * 이 서비스의 공개 판정은 어디까지나 `글의 max_stage <= 읽는 사람의 진도`이며,
 * 그 규칙은 여기서 건드리지 않는다. 여기는 "고른 회차가 글 내용과 맞는가"를
 * 작성자에게 미리 알려주는 보조 장치일 뿐이라, 판정 결과로 등록을 막지 않는다.
 * (막는 것은 신고 누적뿐이고, 그 판단도 사람이 한다.)
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

export type Verdict = "ok" | "warn";
export type Screening = {
  verdict: Verdict;
  /** 경고일 때 작성자에게 보여줄 한 줄. 글 내용을 그대로 옮기지 않는다. */
  reason: string | null;
  /** 무엇이 판단했는지. 화면에 그대로 밝힌다(AI가 확정한 것이 아니므로). */
  source: "claude" | "rules";
};

export type ScreenInput = {
  workTitle: string;
  boardType: BoardType;
  /** 작성자가 고른 범위의 이름. 자유 게시판이면 null. */
  stageLabel: string | null;
  /** 작품 전체 회차 수. 회차 번호 언급을 검사할 때 쓴다. */
  totalStages: number;
  maxStage: number;
  title: string;
  body: string;
};

const MODEL = "claude-opus-5";

/**
 * 규칙 기반 검사. API 키가 없거나 호출이 실패해도 서비스가 그대로 돌아가도록 두는
 * 대체 경로다. 결말을 가리키는 표현과, 고른 회차보다 뒤 회차 번호를 부르는 경우만 본다.
 */
const ENDING_WORDS = [
  "결말", "마지막 화", "최종화", "마지막 편", "엔딩", "반전", "정체가",
  "범인은", "죽습니다", "죽어요", "죽는다", "사망", "살아남", "부활",
  "마지막 권", "완결",
];

export function screenByRules(input: ScreenInput): Screening {
  const text = `${input.title}\n${input.body}`;
  const hit = ENDING_WORDS.find((w) => text.includes(w));
  if (hit) {
    return {
      verdict: "warn",
      reason: `'${hit}' 같은 표현이 있어요. 결말이나 뒤 전개를 가리키는 말이라면 같은 진도인 사람에게도 앞질러 보일 수 있습니다.`,
      source: "rules",
    };
  }
  // "12화", "30권"처럼 고른 범위보다 뒤를 부르는 표기.
  const ahead = [...text.matchAll(/(\d{1,4})\s*(화|권|편)/g)]
    .map((m) => Number(m[1]))
    .find((n) => n > input.maxStage && n <= input.totalStages);
  if (ahead !== undefined) {
    return {
      verdict: "warn",
      reason: `본문에 ${ahead}번째 회차가 언급됩니다. 고른 범위(${input.stageLabel ?? "선택한 범위"})보다 뒤예요.`,
      source: "rules",
    };
  }
  return { verdict: "ok", reason: null, source: "rules" };
}

function prompt(input: ScreenInput) {
  return [
    `작품: ${input.workTitle}`,
    `게시판: ${BOARD_LABELS[input.boardType]}`,
    input.stageLabel
      ? `작성자가 고른 글의 범위: ${input.stageLabel} (전체 ${input.totalStages}단계 중 ${input.maxStage}번째)`
      : "이 글은 진도 제한이 없는 자유 게시판 글이라, 아직 아무것도 보지 않은 사람에게도 그대로 보입니다.",
    "",
    `제목: ${input.title}`,
    "본문:",
    input.body,
  ].join("\n");
}

const SYSTEM = `당신은 감상 커뮤니티의 글을 작성자 본인에게 미리 보여주는 검토자입니다.
판단할 것은 단 하나입니다: 이 글의 내용이 작성자가 고른 범위를 넘어서는가?
- 범위 안의 이야기는 아무리 자세해도 문제가 아닙니다. 이 커뮤니티는 같은 진도끼리 마음껏 이야기하는 곳입니다.
- 범위를 넘는 전개·결말·생사·정체·반전을 드러내거나 강하게 암시하면 넘어선 것입니다.
- 자유 게시판 글이라면 기준이 더 엄격합니다. 아직 아무것도 보지 않은 사람에게 보이므로, 작품의 전개가 드러나면 넘어선 것입니다.
답은 아래 JSON 한 줄로만 하세요. 다른 말은 쓰지 마세요.
{"verdict":"ok"} 또는 {"verdict":"warn","reason":"작성자에게 건넬 한 문장"}
reason에는 글의 내용을 그대로 옮겨 적지 말고, 무엇이 걸리는지만 짧게 한국어로 적으세요.`;

function parseVerdict(text: string): Screening | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]) as { verdict?: string; reason?: string };
    if (parsed.verdict === "ok") return { verdict: "ok", reason: null, source: "claude" };
    if (parsed.verdict === "warn") {
      return {
        verdict: "warn",
        reason: parsed.reason?.trim() || "고른 범위를 넘는 내용이 있는 것 같습니다.",
        source: "claude",
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Claude로 한 번 물어보고, 키가 없거나 실패하면 규칙 기반으로 내려간다.
 * 어느 쪽이든 결과는 '경고'까지이며 등록 여부는 작성자가 정한다.
 */
export async function screenPost(input: ScreenInput): Promise<Screening> {
  if (!process.env.ANTHROPIC_API_KEY) return screenByRules(input);
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // 분류 한 번이라 깊게 생각할 필요가 없다. 비용과 지연을 낮춘다.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt(input) }],
    });
    if (response.stop_reason === "refusal") return screenByRules(input);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return parseVerdict(text) ?? screenByRules(input);
  } catch {
    // 판별이 실패했다고 글쓰기를 막지는 않는다. 규칙 기반 결과로 대신한다.
    return screenByRules(input);
  }
}
