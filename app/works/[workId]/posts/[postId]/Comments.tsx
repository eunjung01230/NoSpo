import type { Comment } from "@/lib/types";
import { CommentForm, DeleteCommentButton, ReplyForm } from "./CommentForm";

/**
 * 댓글 영역. 글이 공개된 사람에게만 이 컴포넌트 자체가 렌더링된다
 * (잠긴 글은 상세 화면이 본문도 댓글도 받지 못한다).
 * 답글은 한 단계까지만 있으므로 부모 하나에 자식 목록을 붙이는 구조로 충분하다.
 */
export default function Comments({
  workId,
  postId,
  comments,
  currentUserId,
  userLabel,
  noun,
}: {
  workId: string;
  postId: string;
  comments: Comment[];
  currentUserId: string;
  userLabel: string;
  noun: string;
}) {
  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

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
        <span className="mono">{comments.length}</span>
        <span className="desc">
          이 글이 열려 있는 사람들끼리 이야기하는 자리입니다.
        </span>
      </div>

      {roots.length === 0 ? (
        <p className="comment-empty">
          아직 {noun}이 없습니다. 같은 지점까지 본 사람으로서 첫 마디를 남겨보세요.
        </p>
      ) : (
        <ul className="comment-list">
          {roots.map((c) => {
            const replies = repliesOf(c.id);
            const mine = c.author_id === currentUserId;
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
                    {replies.map((r) => {
                      const mineReply = r.author_id === currentUserId;
                      return (
                        <li key={r.id} className="comment reply">
                          <Line c={r} mine={mineReply} />
                          <p className="body">{r.body}</p>
                          {mineReply && (
                            <div className="comment-tools">
                              <DeleteCommentButton
                                workId={workId}
                                postId={postId}
                                commentId={r.id}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CommentForm
        workId={workId}
        postId={postId}
        userLabel={userLabel}
        noun={noun}
      />
    </section>
  );
}
