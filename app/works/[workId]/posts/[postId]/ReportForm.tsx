"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reportPostAction, type ReportFormState } from "@/app/actions";
import { REPORT_HIDE_THRESHOLD, REPORT_REASONS } from "@/lib/moderation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-primary"
      type="submit"
      disabled={pending}
      style={{ padding: "8px 14px", fontSize: 13 }}
    >
      {pending ? "접수 중…" : "신고하기"}
    </button>
  );
}

/**
 * 스포일러 신고. 신고 권한·중복 여부·누적 판정은 모두 서버 액션에서 하고,
 * 여기서는 사유를 고르고 결과 문장을 보여주기만 한다.
 */
export default function ReportForm({
  workId,
  postId,
  alreadyReported,
}: {
  workId: string;
  postId: string;
  alreadyReported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ReportFormState, FormData>(
    reportPostAction,
    {}
  );

  if (state.done) {
    return (
      <span className="report-done" role="status">
        {state.done}
      </span>
    );
  }

  if (alreadyReported) {
    return <span className="report-done">이미 신고한 글입니다. 관리자가 확인합니다.</span>;
  }

  if (!open) {
    return (
      <button type="button" className="textlink" onClick={() => setOpen(true)}>
        스포일러 신고
      </button>
    );
  }

  return (
    <form action={formAction} className="report-form">
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="postId" value={postId} />
      <span className="step-no">신고 사유</span>
      <div className="stack" style={{ gap: 6 }}>
        {Object.entries(REPORT_REASONS).map(([value, label], i) => (
          <label key={value} className="report-reason">
            <input type="radio" name="reason" value={value} defaultChecked={i === 0} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <input
        type="text"
        name="detail"
        className="field"
        placeholder="어디가 범위를 넘는지 짧게 적어주세요(선택). 내용을 그대로 옮기지 말아주세요."
      />
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="form-foot">
        <span>신고가 {REPORT_HIDE_THRESHOLD}건 모이면 글이 자동으로 가려집니다.</span>
        <span className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-on-paper"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => setOpen(false)}
          >
            취소
          </button>
          <SubmitButton />
        </span>
      </div>
    </form>
  );
}
