"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deletePostAction } from "@/app/actions";
import type { BoardType } from "@/lib/boards";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}
            style={{ padding: "8px 14px", fontSize: 13 }}>
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}

/** 삭제는 되돌릴 수 없으니 한 번 확인한다. 실제 삭제는 서버 액션이 그대로 처리한다. */
export default function DeletePostButton({
  workId,
  postId,
  boardType,
}: {
  workId: string;
  postId: string;
  boardType: BoardType;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="textlink textlink-danger"
        onClick={() => setAsking(true)}
      >
        삭제
      </button>
    );
  }

  return (
    <form action={deletePostAction} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="boardType" value={boardType} />
      <span style={{ fontSize: 13, color: "var(--ns-ink)" }}>
        이 글을 삭제할까요? 되돌릴 수 없습니다.
      </span>
      <button
        type="button"
        className="btn btn-on-paper"
        style={{ padding: "8px 14px", fontSize: 13 }}
        onClick={() => setAsking(false)}
      >
        취소
      </button>
      <SubmitButton />
    </form>
  );
}
