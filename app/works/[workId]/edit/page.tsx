import Link from "next/link";
import { notFound } from "next/navigation";
import WorkForm from "../../WorkForm";
import DeleteWorkButton from "./DeleteWorkButton";
import { canEditWork, getWork, listStages, workUsage } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 작품 수정. 등록한 사람 본인과 관리자만 들어올 수 있고, 권한은 액션에서도 다시 본다. */
export default async function EditWorkPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const user = await getCurrentUser();
  const allowed = await canEditWork(workId, user.id, user.is_admin);

  if (!allowed) {
    return (
      <section
        className="container container-read stack"
        style={{ gap: 16, paddingBlock: "32px 96px" }}
      >
        <Link href={`/works/${workId}`} className="backlink">
          ← {work.title}
        </Link>
        <h1 className="page-title">수정할 수 없는 작품입니다</h1>
        <div className="notice-dark notice-warn">
          작품 정보는 등록한 사람과 관리자만 고칠 수 있습니다. 내용이 틀렸다면 관리자에게
          알려주세요.
        </div>
      </section>
    );
  }

  const [stages, usage] = await Promise.all([listStages(workId), workUsage(workId)]);

  return (
    <section
      className="container container-read stack"
      style={{ gap: 20, paddingBlock: "24px 96px" }}
    >
      <Link href={`/works/${workId}`} className="backlink">
        ← {work.title}
      </Link>

      <div className="sheet sheet-hi stack" style={{ gap: 30, padding: "clamp(24px, 6%, 52px)" }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1
            className="page-title"
            style={{ fontSize: "clamp(27px, 3.6vw, 34px)", color: "var(--ns-ink)" }}
          >
            작품 수정
          </h1>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "#5A4E46" }}>
            잘못 연결된 포스터나 정보를 고칠 수 있습니다. 진도·글은 그대로 남습니다.
          </span>
        </div>

        <WorkForm
          work={{
            id: work.id,
            title: work.title,
            description: work.description,
            category: work.category,
            origin: work.origin,
            genre: work.genre,
            progress_unit: work.progress_unit,
            minutes_per_stage: work.minutes_per_stage,
            poster_url: work.poster_url,
            year: work.year,
            creator: work.creator,
            total_stages: stages.length,
          }}
        />

        <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--ns-paper-line)", paddingTop: 20 }}>
          <span className="step-no">작품 삭제</span>
          {usage.posts > 0 ? (
            <span className="hint">
              이 작품에는 글이 {usage.posts}편 있어 삭제할 수 없습니다. 남이 쓴 글이 말없이
              사라지지 않도록 막아 둡니다.
            </span>
          ) : (
            <>
              <span className="hint">
                아직 글이 없는 작품이라 지울 수 있습니다. 진도 기록도 함께 사라집니다.
              </span>
              <DeleteWorkButton workId={workId} title={work.title} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
