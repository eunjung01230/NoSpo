"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCommentAction,
  deleteCommentAction,
  type CommentFormState,
} from "@/app/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "등록 중…" : label}
    </button>
  );
}

/**
 * 댓글·답글 작성 폼. 검증과 권한 판정은 서버 액션에서 하고 여기서는 결과만 보여준다.
 * parentId가 있으면 그 댓글에 달리는 답글이다(답글에는 다시 답글을 달 수 없다).
 */
function Editor({
  workId,
  postId,
  parentId,
  noun,
  label,
  placeholder,
  autoFocus,
  onDone,
}: {
  workId: string;
  postId: string;
  parentId?: string;
  noun: string;
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    createCommentAction,
    {}
  );
  const ref = useRef<HTMLFormElement>(null);
  // 등록에 성공하면(오류 없음) 입력칸을 비우고, 답글 폼은 닫는다.
  useEffect(() => {
    if (state.error) return;
    ref.current?.reset();
    onDone?.();
    // onDone은 매 렌더마다 새로 만들어지므로 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldId = parentId ? `reply-${parentId}` : "comment-body";

  return (
    <form ref={ref} action={formAction} className="comment-form">
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="step-no" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        name="body"
        className="field"
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
      />
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="form-foot">
        <span>이 글을 읽을 수 있는 사람에게만 보입니다.</span>
        <SubmitButton label={`${noun} 등록`} />
      </div>
    </form>
  );
}

/** 글 아래의 댓글 작성 폼. */
export function CommentForm({
  workId,
  postId,
  userLabel,
  noun,
}: {
  workId: string;
  postId: string;
  userLabel: string;
  noun: string;
}) {
  return (
    <Editor
      workId={workId}
      postId={postId}
      noun={noun}
      label={`${noun} — ${userLabel}(시연 사용자)`}
      placeholder={
        noun === "답글"
          ? "위에 적힌 범위까지의 단서로 답해주세요."
          : "같은 지점까지 본 사람으로서 한마디 남겨주세요."
      }
    />
  );
}

/** 댓글에 달리는 답글. 평소에는 버튼만 두고, 누를 때 입력칸을 연다. */
export function ReplyForm({
  workId,
  postId,
  parentId,
  toName,
}: {
  workId: string;
  postId: string;
  parentId: string;
  toName: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="textlink" onClick={() => setOpen(true)}>
        답글
      </button>
    );
  }

  return (
    <div className="reply-editor">
      <Editor
        workId={workId}
        postId={postId}
        parentId={parentId}
        noun="답글"
        label={`${toName}님에게 답글`}
        placeholder="이 댓글에 대한 답글입니다."
        autoFocus
        onDone={() => setOpen(false)}
      />
      <button type="button" className="textlink" onClick={() => setOpen(false)}>
        답글 취소
      </button>
    </div>
  );
}

/** 내 댓글 삭제. 되돌릴 수 없으니 한 번 확인한다. */
export function DeleteCommentButton({
  workId,
  postId,
  commentId,
  hasReplies,
}: {
  workId: string;
  postId: string;
  commentId: string;
  hasReplies?: boolean;
}) {
  return (
    <form
      action={deleteCommentAction}
      className="row"
      style={{ gap: 6 }}
      onSubmit={(e) => {
        const message = hasReplies
          ? "이 댓글을 삭제하면 달린 답글도 함께 사라집니다. 삭제할까요?"
          : "이 댓글을 삭제할까요? 되돌릴 수 없습니다.";
        if (!confirm(message)) e.preventDefault();
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
