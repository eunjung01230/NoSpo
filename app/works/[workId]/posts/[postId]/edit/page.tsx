import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnPost, getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { BOARD_LABELS, stageQuestion, unitNoun } from "@/lib/boards";
import PostForm from "../../../PostForm";

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
      <section
        className="container container-read stack"
        style={{ gap: 20, paddingBlock: "24px 96px" }}
      >
        <Link href={`/works/${workId}`} className="backlink">
          ← {work.title}
        </Link>
        <h1 className="page-title">수정할 수 없는 글입니다</h1>
        <div className="notice-dark notice-warn">내가 쓴 글만 수정할 수 있습니다.</div>
      </section>
    );
  }

  const [stages, progress] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
  ]);
  const selectable = stages.filter((s) => s.stage_no <= progress);

  return (
    <section
      className="container container-read stack"
      style={{ gap: 20, paddingBlock: "24px 96px" }}
    >
      <Link href={`/works/${workId}/posts/${postId}`} className="backlink">
        ← 글로 돌아가기
      </Link>

      <div className="sheet sheet-hi stack" style={{ gap: 30, padding: "clamp(24px, 6%, 52px)" }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1
            className="page-title"
            style={{ fontSize: "clamp(27px, 3.6vw, 34px)", color: "var(--ns-ink)" }}
          >
            {BOARD_LABELS[post.board_type]} 글 수정
          </h1>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ns-ink-muted)" }}>
            {work.title} · 작성자 {user.display_name}(시연 사용자)
          </span>
        </div>

        <PostForm
          workId={work.id}
          boardType={post.board_type}
          stages={selectable}
          unit={unitNoun(work.progress_unit)}
          question={stageQuestion(work.progress_unit)}
          post={{
            id: post.id,
            title: post.title,
            body: post.body,
            max_stage: post.max_stage,
          }}
        />
      </div>
    </section>
  );
}
