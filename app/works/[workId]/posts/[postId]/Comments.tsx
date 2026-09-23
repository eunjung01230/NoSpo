import type { Comment } from "@/lib/types";
import { CommentForm, DeleteCommentButton } from "./CommentForm";

/**
 * 댓글 영역. 글이 공개된 사람에게만 이 컴포넌트 자체가 렌더링된다
 * (잠긴 글은 상세 화면이 본문도 댓글도 받지 못한다).
 */
export default function Comments({
  workId,
  postId,
  comments,
  currentUserId,
  userLabel,
}: {
  workId: string;
  postId: string;
  comments: Comment[];
  currentUserId: string;
  userLabel: string;
}) {
  return (
    <section className="sheet comments" aria-label="댓글">
      <div className="comments-head">
        <h2>댓글</h2>
        <span className="mono">{comments.length}</span>
        <span className="desc">
          이 글이 열려 있는 사람들끼리 이야기하는 자리입니다.
        </span>
      </div>

      {comments.length === 0 ? (
        <p className="comment-empty">
          아직 댓글이 없습니다. 같은 지점까지 본 사람으로서 첫 마디를 남겨보세요.
        </p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="who">
                <span className="name">{c.author_name}</span>
                <time className="stamp">{c.created_at}</time>
                {c.is_demo_seed && <span className="seed-tag">시연 데이터</span>}
                {c.author_id === currentUserId && <span className="ep-tag">내 댓글</span>}
                {c.author_id === currentUserId && (
                  <span style={{ marginLeft: "auto" }}>
                    <DeleteCommentButton
                      workId={workId}
                      postId={postId}
                      commentId={c.id}
                    />
                  </span>
                )}
              </div>
              <p className="body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <CommentForm workId={workId} postId={postId} userLabel={userLabel} />
    </section>
  );
}
