"use client";

import { useActionState } from "react";
import {
  createPostAction,
  updatePostAction,
  type PostFormState,
} from "@/app/actions";
import type { Stage } from "@/lib/types";
import type { BoardType } from "@/lib/boards";
import {
  BOARD_LABELS,
  BOARD_NUMERALS,
  BOARD_PLACEHOLDERS,
  isUngated,
} from "@/lib/boards";

/**
 * 작성과 수정이 같은 폼을 쓴다. postId가 있으면 수정 모드다.
 * 필드명(workId, boardType, postId, maxStage, title, body)과 서버 액션 연결은 그대로다.
 * 자유 게시판은 회차를 묻는 단계 자체가 없다(서버에서도 0으로 고정한다).
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
  const placeholders = BOARD_PLACEHOLDERS[boardType];
  const ungated = isUngated(boardType);
  const lastStage = stages[stages.length - 1];
  // 회차 단계가 빠지면 뒤 단계 번호도 하나씩 당긴다.
  const step = (n: number) => String(ungated ? n - 1 : n).padStart(2, "0");

  return (
    <form action={formAction} className="stack" style={{ gap: 30 }}>
      <input type="hidden" name="workId" value={workId} />
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

      {ungated ? (
        <div className="form-step">
          <span className="step-no">범위 없음</span>
          <span className="hint">
            자유 게시판 글은 회차를 지정하지 않습니다. 진도와 상관없이 모든 사람에게
            제목과 본문이 그대로 보이니, 뒷내용이 드러나는 이야기는 다른 게시판에 적어주세요.
          </span>
        </div>
      ) : (
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
      )}

      <div className="form-step">
        <label className="step-no" htmlFor="title">
          {step(3)} · 제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="field"
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
          placeholder={placeholders.body}
          defaultValue={state.values?.body ?? post?.body ?? ""}
        />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      {/* AI 사전 검토 결과. 등록을 막지 않고, 고쳐 쓸지 이대로 올릴지 작성자가 정한다. */}
      {state.warning && (
        <div className="ai-warn" role="status">
          <span className="head">
            <b>범위를 넘는 내용일 수 있어요</b>
            <span className="by">
              {state.warning.source === "claude" ? "AI 사전 검토" : "자동 검사(규칙)"}
            </span>
          </span>
          <p>{state.warning.reason}</p>
          <span className="note">
            판단이 틀릴 수도 있어요. 맞다면 위에서 범위를 올리거나 문장을 고쳐 주세요.
            그대로 올리면 글은 등록되고, 관리자 검토 목록에 함께 남습니다.
          </span>
        </div>
      )}

      <div className="form-foot">
        <span>
          {ungated
            ? `${BOARD_LABELS[boardType]} 게시판에 진도 제한 없이 등록됩니다.`
            : `${BOARD_LABELS[boardType]} 게시판에 선택한 범위까지의 내용으로 등록됩니다.`}
        </span>
        <span className="row" style={{ gap: 8 }}>
          {/* 경고를 본 뒤에만 나오는 버튼. 눌린 버튼의 name/value만 서버로 간다. */}
          {state.warning && (
            <button
              className="btn btn-on-paper"
              type="submit"
              name="aiConfirmed"
              value="1"
              disabled={pending}
            >
              이대로 등록
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "확인 중…" : state.warning ? "고쳐서 다시 확인" : post ? "수정 저장" : "등록"}
          </button>
        </span>
      </div>
    </form>
  );
}
