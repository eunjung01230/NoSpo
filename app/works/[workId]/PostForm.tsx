"use client";

import { useActionState, useState } from "react";
import {
  createPostAction,
  updatePostAction,
  type PostFormState,
} from "@/app/actions";
import type { Stage } from "@/lib/types";
import {
  POST_BODY_MAX,
  POST_TITLE_MAX,
  SCREEN_STATUS_LABELS,
  type Screening,
} from "@/lib/moderation";
import type { BoardType } from "@/lib/boards";
import {
  BOARD_LABELS,
  BOARD_NUMERALS,
  BOARD_PLACEHOLDERS,
} from "@/lib/boards";

/** 결과별 안내. 판정 문구(message)는 서버가 고정 문구에서 고른 것이고, 여기는 다음 행동만 알려준다. */
function nextStep(screening: Screening, unit: string) {
  switch (screening.status) {
    case "suspect":
      return `글이 다루는 마지막 ${unit}까지 기준 진도를 높이거나(내 진도 안에서), 선택한 범위 이후를 가리키는 문장을 고쳐 주세요. 그대로 올리면 글은 등록되고 관리자 검토 목록에 함께 남습니다.`;
    case "uncertain":
      return `선택한 범위 이후의 내용이 없다면 그대로 올려도 됩니다. 공개 범위는 고른 기준 진도 그대로입니다.`;
    case "unavailable":
      return `AI 판단 없이 등록됩니다. 선택한 범위 이후의 내용이 없는지 직접 확인해 주세요.`;
    case "clear":
      return null;
  }
}

/**
 * 작성과 수정이 같은 폼을 쓴다. postId가 있으면 수정 모드다.
 * 필드명(workId, boardType, postId, maxStage, title, body)과 서버 액션 연결은 그대로다.
 * 게시판에 따른 예외는 없다 — 자유 게시판도 같은 자리에서 기준 회차를 고른다.
 */
export default function PostForm({
  workId,
  boardType,
  stages,
  unit,
  question,
  post,
}: {
  workId: string;
  boardType: BoardType;
  stages: Stage[];
  unit: string;
  question: string;
  post?: { id: string; title: string; body: string; max_stage: number };
}) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    post ? updatePostAction : createPostAction,
    {}
  );
  // 결과를 받은 뒤 내용을 고치면 그 결과는 더는 이 글의 것이 아니다. 저장할 때 서버가 다시 검토한다.
  const [editedAfter, setEditedAfter] = useState<PostFormState | null>(null);
  const screening = editedAfter === state ? undefined : state.screening;
  const needsDecision = screening !== undefined && screening.status !== "clear";
  const guide = screening ? nextStep(screening, unit) : null;
  const placeholders = BOARD_PLACEHOLDERS[boardType];
  const lastStage = stages[stages.length - 1];
  const step = (n: number) => String(n).padStart(2, "0");

  return (
    <form
      // 서버 응답마다 폼을 새로 그린다. 액션이 끝나면 React가 폼을 리셋하는데, 그대로 두면
      // 회차 select가 처음 값(마지막 회차)으로 돌아가 작성자가 고른 회차와 다른 값이 저장된다.
      key={state.receipt ?? `${state.error ?? ""}|${JSON.stringify(state.values ?? null)}`}
      action={formAction}
      className="stack"
      style={{ gap: 30 }}
      onChange={() => setEditedAfter(state)}
    >
      <input type="hidden" name="workId" value={workId} />
      {/* 서버가 서명한 검토 영수증. 같은 내용이면 AI를 다시 부르지 않고, 내용이 바뀌면 무효다. */}
      <input type="hidden" name="screenReceipt" value={state.receipt ?? ""} />
      <input type="hidden" name="boardType" value={boardType} />
      {post && <input type="hidden" name="postId" value={post.id} />}

      <div className="form-step">
        <span className="step-no">01 · 게시판</span>
        <div className="row" style={{ gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 4,
              background: "var(--ns-primary)",
              color: "var(--ns-text)",
            }}
          >
            <span style={{ fontFamily: "var(--ns-serif)", fontSize: 13 }}>
              {BOARD_NUMERALS[boardType]}
            </span>
            <span style={{ fontFamily: "var(--ns-serif)", fontSize: 17 }}>
              {BOARD_LABELS[boardType]}
            </span>
          </span>
          <span className="hint">이 글은 {BOARD_LABELS[boardType]} 게시판에 등록됩니다.</span>
        </div>
      </div>

      <div className="form-step">
        <span className="step-no">02 · 기준 진도</span>
        <label className="ask" htmlFor="maxStage">
          {question}
        </label>
        <select
          id="maxStage"
          name="maxStage"
          className="field"
          defaultValue={state.values?.maxStage ?? post?.max_stage ?? lastStage?.stage_no}
        >
          {stages.map((s) => (
            <option key={s.stage_no} value={s.stage_no}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="hint">
          선택한 {unit} 이후의 내용과 암시는 포함하지 마세요. 내 진도({lastStage?.label})보다
          뒤는 고를 수 없어요.
        </span>
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="title">
          {step(3)} · 제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="field"
          maxLength={POST_TITLE_MAX}
          placeholder={placeholders.title}
          defaultValue={state.values?.title ?? post?.title ?? ""}
        />
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="body">
          {step(4)} · 본문
        </label>
        <textarea
          id="body"
          name="body"
          className="field"
          maxLength={POST_BODY_MAX}
          placeholder={placeholders.body}
          defaultValue={state.values?.body ?? post?.body ?? ""}
        />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      {/* AI 사전 검토 결과. 보조 경고일 뿐 등록을 막지 않고, 고쳐 쓸지 이대로 올릴지 작성자가 정한다. */}
      {screening && (
        <div className={`ai-warn is-${screening.status}`} role="status">
          <span className="head">
            <b>{SCREEN_STATUS_LABELS[screening.status]}</b>
            <span className="by">
              {screening.status === "unavailable" ? "AI 미검토" : "AI 사전 검토 · 보조 판단"}
            </span>
          </span>
          <p>{screening.message}</p>
          {screening.ruleHint && <p>참고(자동 규칙 검사): {screening.ruleHint}</p>}
          {guide && <span className="note">{guide}</span>}
        </div>
      )}
      {state.screening && !screening && (
        <p className="hint">내용이 바뀌었어요. 저장할 때 바뀐 내용으로 다시 검토합니다.</p>
      )}

      <div className="form-foot">
        <span>
          {BOARD_LABELS[boardType]} 게시판에 선택한 범위까지의 내용으로 등록됩니다.
        </span>
        <span className="row" style={{ gap: 8 }}>
          {/* 기본 버튼은 DOM 맨 앞(Enter 키가 누르는 버튼)에 두고 화면에서는 맨 뒤로 보낸다.
              입력칸에서 Enter를 쳐도 '이대로 등록'이 눌리지 않도록. */}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={pending}
            style={{ order: 1 }}
          >
            {pending ? "확인 중…" : needsDecision ? "고쳐서 다시 확인" : post ? "수정 저장" : "등록"}
          </button>
          {/* 저장 없이 검토만. 받은 결과는 영수증으로 남아 곧바로 저장해도 AI를 다시 부르지 않는다. */}
          {!needsDecision && (
            <button
              className="btn btn-on-paper"
              type="submit"
              name="intent"
              value="check"
              disabled={pending}
            >
              AI로 미리 확인
            </button>
          )}
          {/* 결과를 본 뒤에만 나오는 버튼. 눌린 버튼의 name/value만 서버로 간다. */}
          {needsDecision && (
            <button
              className="btn btn-on-paper"
              type="submit"
              name="aiConfirmed"
              value="1"
              disabled={pending}
            >
              {post ? "이대로 저장" : "이대로 등록"}
            </button>
          )}
        </span>
      </div>
    </form>
  );
}
