"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWorkAction } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-primary"
      type="submit"
      disabled={pending}
      style={{ padding: "8px 14px", fontSize: 13 }}
    >
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}

/** 작품 삭제는 되돌릴 수 없으니 한 번 확인한다. 글이 있으면 서버에서도 막는다. */
export default function DeleteWorkButton({
  workId,
  title,
}: {
  workId: string;
  title: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="textlink textlink-danger"
        style={{ alignSelf: "flex-start" }}
        onClick={() => setAsking(true)}
      >
        이 작품 삭제
      </button>
    );
  }

  return (
    <form action={deleteWorkAction} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="workId" value={workId} />
      <span style={{ fontSize: 13, color: "var(--ns-ink)" }}>
        &lsquo;{title}&rsquo;을(를) 삭제할까요? 되돌릴 수 없습니다.
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
