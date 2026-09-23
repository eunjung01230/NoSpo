import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisiblePost, getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { deletePostAction } from "@/app/actions";
import { BOARD_LABELS } from "@/lib/boards";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ workId: string; postId: string }>;
}) {
  const { workId, postId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  // 상세 주소로 직접 들어와도 서버에서 사용자와 진도를 확인한다.
  const post = await getVisiblePost(user.id, workId, postId);

  if (!post) {
    const [progress, stages] = await Promise.all([
      getProgress(user.id, workId),
      listStages(workId),
    ]);
    const label = stages.find((s) => s.stage_no === progress)?.label ?? "미시청";
    return (
      <>
        <p className="muted"><Link href={`/works/${workId}`}>← {work.title}</Link></p>
        <h1>아직 열람할 수 없는 감상입니다</h1>
        <div className="notice error">
          이 글에는 {user.display_name}님의 현재 진도({label}) 이후의 내용이 포함되어 있어
          제목과 본문을 보내지 않습니다.
        </div>
        <p className="muted">진도를 올리면 열람할 수 있습니다.</p>
      </>
    );
  }

  const isMine = post.author_id === user.id;

  return (
    <>
      <p className="muted">
        <Link href={`/works/${workId}?board=${post.board_type}`}>← {work.title}</Link>
      </p>
      <div className="row">
        <span className="tag">{BOARD_LABELS[post.board_type]}</span>
        <span className="tag">{post.stage_label}까지의 내용</span>
        {post.is_demo_seed && <span className="badge">시연 데이터</span>}
      </div>
      <h1>{post.title}</h1>
      <p className="muted">{post.author_name} · {post.created_at}</p>
      <div className="card" style={{ whiteSpace: "pre-wrap" }}>{post.body}</div>
      {isMine && (
        <div className="row">
          <Link className="btn" style={{ textDecoration: "none" }}
                href={`/works/${workId}/posts/${postId}/edit`}>
            수정
          </Link>
          <form action={deletePostAction}>
            <input type="hidden" name="workId" value={workId} />
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="boardType" value={post.board_type} />
            <button className="btn" type="submit">삭제</button>
          </form>
        </div>
      )}
    </>
  );
}
