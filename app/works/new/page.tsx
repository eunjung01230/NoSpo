import Link from "next/link";
import WorkForm from "../WorkForm";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 작품 추가. 검색에서 찾지 못한 작품을 직접 등록해 첫 글을 시작하는 자리다. */
export default async function NewWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const { title } = await searchParams;
  const user = await getCurrentUser();

  return (
    <section
      className="container container-read stack"
      style={{ gap: 20, paddingBlock: "24px 96px" }}
    >
      <Link href="/search" className="backlink">
        ← 작품 검색
      </Link>

      <div className="sheet sheet-hi stack" style={{ gap: 30, padding: "clamp(24px, 6%, 52px)" }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1
            className="page-title"
            style={{ fontSize: "clamp(27px, 3.6vw, 34px)", color: "var(--ns-ink)" }}
          >
            작품 추가
          </h1>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "#5A4E46" }}>
            목록에 없는 작품을 직접 등록하고 첫 글을 남길 수 있습니다.
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ns-ink-muted)" }}>
            등록자 {user.display_name}(시연 사용자)
          </span>
        </div>

        <WorkForm initialTitle={(title ?? "").trim()} />
      </div>
    </section>
  );
}
