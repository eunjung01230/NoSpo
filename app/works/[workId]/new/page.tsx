import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import PostForm from "./PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const [stages, progress] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
  ]);
  // 작성자의 전체 진도가 아니라 '글에 포함된 마지막 회차'를 고르는 자리다.
  const selectable = stages.filter((s) => s.stage_no <= progress);

  return (
    <>
      <p className="muted"><Link href={`/works/${workId}`}>← {work.title}</Link></p>
      <h1>감상 쓰기</h1>
      <p className="muted">
        {work.title} · 작성자 {user.display_name}(시연 사용자), 현재 진도{" "}
        {progress > 0 ? `${progress}화` : "미시청"}
      </p>
      {selectable.length === 0 ? (
        <div className="notice error">
          아직 진도가 없어 글을 쓸 수 없습니다. 작품 화면에서 진도를 먼저 올려주세요.
        </div>
      ) : (
        <PostForm workId={work.id} stages={selectable} />
      )}
    </>
  );
}
