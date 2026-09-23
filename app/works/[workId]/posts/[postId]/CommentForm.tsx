"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createCommentAction,
  deleteCommentAction,
  type CommentFormState,
} from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "등록 중…" : "댓글 등록"}
    </button>
  );
}

/** 댓글 작성. 검증과 권한 판정은 서버 액션에서 하고 여기서는 결과만 보여준다. */
export function CommentForm({
  workId,
  postId,
  userLabel,
}: {
  workId: string;
  postId: string;
  userLabel: string;
}) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    createCommentAction,
    {}
  );
  const ref = useRef<HTMLFormElement>(null);
  // 등록에 성공하면(오류 없음) 입력칸을 비운다.
  useEffect(() => {
    if (!state.error) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="comment-form">
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="postId" value={postId} />
      <label className="step-no" htmlFor="comment-body">
        댓글 — {userLabel}(시연 사용자)
      </label>
      <textarea
        id="comment-body"
        name="body"
        className="field"
        rows={3}
        placeholder="같은 진도에서 읽은 사람으로서 한마디 남겨주세요. 이 글의 범위를 넘는 내용은 적지 말아주세요."
      />
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="form-foot">
        <span>이 글을 읽을 수 있는 사람에게만 보입니다.</span>
        <SubmitButton />
      </div>
    </form>
  );
}

/** 내 댓글 삭제. 되돌릴 수 없으니 한 번 확인한다. */
export function DeleteCommentButton({
  workId,
  postId,
  commentId,
}: {
  workId: string;
  postId: string;
  commentId: string;
}) {
  return (
    <form
      action={deleteCommentAction}
      className="row"
      style={{ gap: 6 }}
      onSubmit={(e) => {
        if (!confirm("이 댓글을 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="commentId" value={commentId} />
      <button type="submit" className="textlink textlink-danger" style={{ fontSize: 12.5 }}>
        삭제
      </button>
    </form>
  );
}
