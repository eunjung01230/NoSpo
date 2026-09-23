import { Fragment } from "react";
import type { Comment } from "@/lib/types";
import { CommentForm, DeleteCommentButton, ReplyForm } from "./CommentForm";

/**
 * 댓글 영역. 글이 공개된 사람에게만 이 컴포넌트 자체가 렌더링된다
 * (잠긴 글은 상세 화면이 본문도 댓글도 받지 못한다).
 * 답글은 한 단계까지만 있으므로 부모 하나에 자식 목록을 붙이는 구조로 충분하다.
 *
 * 글이 열려 있어도 댓글 하나하나는 다시 걸러진다. 쓴 사람이 나보다 앞서 본 시점에
 * 남긴 댓글은 body가 null로 내려오므로(쿼리 단계에서 제외) 여기서는 자리만 그린다.
 */
export default function Comments({
  workId,
  postId,
  comments,
  currentUserId,
  userLabel,
  noun,
  scopeNote,
}: {
  workId: string;
  postId: string;
  comments: Comment[];
  currentUserId: string;
  userLabel: string;
  noun: string;
  /** 이 글이 어느 회차까지를 다루는지. 답을 쓰기 직전에 경계를 다시 밝힌다. */
  scopeNote: string;
}) {
  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const openCount = comments.filter((c) => !c.locked).length;
  const lockedCount = comments.length - openCount;

  // 내 진도 이후에 쓰인 댓글. 본문은 서버에서 오지 않았고 여기서는 안내만 남긴다.
  const Locked = ({ reply }: { reply?: boolean }) => (
    <li className={reply ? "comment reply comment-locked" : "comment comment-locked"}>
      <span>현재 진도 이후에 작성된 {reply ? "답글" : noun}입니다.</span>
      <span className="hint">진도를 더 진행하면 확인할 수 있어요.</span>
    </li>
  );

  // 답글 한 줄. 부모가 감춰져도 답글은 각자의 시점으로 다시 판정하므로 따로 그린다.
  const Reply = ({ r }: { r: Comment }) => {
    if (r.locked) return <Locked reply />;
    const mineReply = r.author_id === currentUserId;
    return (
      <li className="comment reply">
        <Line c={r} mine={mineReply} />
        <p className="body">{r.body}</p>
        {mineReply && (
          <div className="comment-tools">
            <DeleteCommentButton workId={workId} postId={postId} commentId={r.id} />
          </div>
        )}
      </li>
    );
  };

  const Line = ({ c, mine }: { c: Comment; mine: boolean }) => (
    <div className="who">
      <span className="name">{c.author_name}</span>
      <time className="stamp">{c.created_at}</time>
      {c.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
      {mine && <span className="ep-tag">내 {c.parent_id ? "답글" : noun}</span>}
    </div>
  );

  return (
    <section className="sheet comments" aria-label={noun}>
      <div className="comments-head">
        <h2>{noun}</h2>
        <span className="mono">{openCount}</span>
        <span className="desc">
          이 글이 열려 있는 사람들끼리 이야기하는 자리입니다.
          {lockedCount > 0 &&
            ` 내 진도 이후에 쓰인 ${lockedCount}개는 감춰져 있습니다.`}
        </span>
      </div>

      {openCount === 0 && lockedCount === 0 ? (
        <p className="comment-empty">
          아직 {noun}이 없습니다. 같은 지점까지 본 사람으로서 첫 마디를 남겨보세요.
        </p>
      ) : (
        <ul className="comment-list">
          {roots.map((c) => {
            const replies = repliesOf(c.id);
            const mine = c.author_id === currentUserId;
            // 부모가 감춰져도 그 아래 답글은 각자의 시점으로 다시 판정한다.
            if (c.locked) {
              return (
                <Fragment key={c.id}>
                  <Locked />
                  {replies.length > 0 && (
                    <ul className="reply-list">
                      {replies.map((r) => (
                        <Reply key={r.id} r={r} />
                      ))}
                    </ul>
                  )}
                </Fragment>
              );
            }
            return (
              <li key={c.id} className="comment">
                <Line c={c} mine={mine} />
                <p className="body">{c.body}</p>
                <div className="comment-tools">
                  <ReplyForm
                    workId={workId}
                    postId={postId}
                    parentId={c.id}
                    toName={c.author_name}
                  />
                  {mine && (
                    <DeleteCommentButton
                      workId={workId}
                      postId={postId}
                      commentId={c.id}
                      hasReplies={replies.length > 0}
                    />
                  )}
                </div>

                {replies.length > 0 && (
                  <ul className="reply-list">
                    {replies.map((r) => (
                      <Reply key={r.id} r={r} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="comment-scope">{scopeNote}</div>

      <CommentForm
        workId={workId}
        postId={postId}
        userLabel={userLabel}
        noun={noun}
      />
    </section>
  );
}
