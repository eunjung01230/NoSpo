import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgress, getWork, listStages } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { BOARD_LABELS, stageQuestion, toBoardType, unitNoun } from "@/lib/boards";
import PostForm from "./PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  const { workId } = await params;
  const { board } = await searchParams;
  const work = await getWork(workId);
  if (!work) notFound();

  const boardType = toBoardType(board);
  const user = await getCurrentUser();
  const [stages, progress] = await Promise.all([
    listStages(workId),
    getProgress(user.id, workId),
  ]);
  // 작성자의 전체 진도가 아니라 '글에 포함된 마지막 회차'를 고르는 자리다.
  const selectable = stages.filter((s) => s.stage_no <= progress);
  const currentLabel =
    stages.find((s) => s.stage_no === progress)?.label ?? "아직 보지 않음";

  return (
    <>
      <p className="muted">
        <Link href={`/works/${workId}?board=${boardType}`}>← {work.title}</Link>
      </p>
      <h1>{BOARD_LABELS[boardType]} 글쓰기</h1>
      <p className="muted">
        {work.title} · 작성자 {user.display_name}(시연 사용자), 현재 진도 {currentLabel}
      </p>
      {selectable.length === 0 ? (
        <div className="notice error">
          아직 진도가 없어 글을 쓸 수 없습니다. 작품 화면에서 진도를 먼저 올려주세요.
        </div>
      ) : (
        <PostForm workId={work.id} boardType={boardType} stages={selectable}
                  unit={unitNoun(work.progress_unit)}
                  question={stageQuestion(work.progress_unit)} />
      )}
    </>
  );
}
