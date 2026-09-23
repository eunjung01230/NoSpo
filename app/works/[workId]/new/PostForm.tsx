"use client";

import { useActionState } from "react";
import { createPostAction, type PostFormState } from "@/app/actions";
import type { Stage } from "@/lib/types";

export default function PostForm({
  workId,
  stages,
}: {
  workId: string;
  stages: Stage[];
}) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    createPostAction,
    {}
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="workId" value={workId} />

      <label htmlFor="maxStage">이 글에 몇 화까지의 내용이 포함되어 있나요?</label>
      <select id="maxStage" name="maxStage" defaultValue={stages[stages.length - 1].stage_no}>
        {stages.map((s) => (
          <option key={s.stage_no} value={s.stage_no}>{s.label}</option>
        ))}
      </select>
      <p className="notice">선택한 회차 이후의 내용과 암시는 포함하지 마세요.</p>

      <label htmlFor="title">제목</label>
      <input id="title" name="title" type="text" />

      <label htmlFor="body">본문</label>
      <textarea id="body" name="body" />

      {state.error && <p className="notice error">{state.error}</p>}

      <p>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "등록 중…" : "등록"}
        </button>
      </p>
    </form>
  );
}
