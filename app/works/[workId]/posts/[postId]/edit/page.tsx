import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnPost, getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { BOARD_LABELS, stageQuestion, unitNoun } from "@/lib/boards";
import PostForm from "../../../new/PostForm";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ workId: string; postId: string }>;
}) {
  const { workId, postId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  // 본인 글인지 서버에서 확인한다. 아니면 폼 자체를 내려보내지 않는다.
  const post = await getOwnPost(user.id, workId, postId);
  if (!post) {
    return (
      <>
        <p className="muted"><Link href={`/works/${workId}`}>← {work.title}</Link></p>
        <h1>수정할 수 없는 글입니다</h1>
        <div className="notice error">내가 쓴 글만 수정할 수 있습니다.</div>
      </>
    );
  }

  const [stages, progress] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
  ]);
  const selectable = stages.filter((s) => s.stage_no <= progress);

  return (
    <>
      <p className="muted">
        <Link href={`/works/${workId}/posts/${postId}`}>← 감상 상세</Link>
      </p>
      <h1>{BOARD_LABELS[post.board_type]} 글 수정</h1>
      <p className="muted">{work.title} · 작성자 {user.display_name}(시연 사용자)</p>
      <PostForm workId={work.id} boardType={post.board_type} stages={selectable}
                unit={unitNoun(work.progress_unit)}
                question={stageQuestion(work.progress_unit)}
                post={{ id: post.id, title: post.title, body: post.body,
                        max_stage: post.max_stage }} />
    </>
  );
}
