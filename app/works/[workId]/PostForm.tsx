"use client";

import { useActionState } from "react";
import {
  createPostAction,
  updatePostAction,
  type PostFormState,
} from "@/app/actions";
import type { Stage } from "@/lib/types";
import type { BoardType } from "@/lib/boards";
import { BOARD_TITLES } from "@/lib/boards";

/** 작성과 수정이 같은 폼을 쓴다. postId가 있으면 수정 모드다. */
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

  return (
    <form action={formAction}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="boardType" value={boardType} />
      {post && <input type="hidden" name="postId" value={post.id} />}

      <p className="muted">게시판: {BOARD_TITLES[boardType]}</p>

      <label htmlFor="maxStage">{question}</label>
      <select id="maxStage" name="maxStage"
              defaultValue={post?.max_stage ?? stages[stages.length - 1].stage_no}>
        {stages.map((s) => (
          <option key={s.stage_no} value={s.stage_no}>{s.label}</option>
        ))}
      </select>
      <p className="notice">선택한 {unit} 이후의 내용과 암시는 포함하지 마세요.</p>

      <label htmlFor="title">제목</label>
      <input id="title" name="title" type="text" defaultValue={post?.title ?? ""} />

      <label htmlFor="body">본문</label>
      <textarea id="body" name="body" defaultValue={post?.body ?? ""} />

      {state.error && <p className="notice error">{state.error}</p>}

      <p>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "저장 중…" : post ? "수정 저장" : "등록"}
        </button>
      </p>
    </form>
  );
}
