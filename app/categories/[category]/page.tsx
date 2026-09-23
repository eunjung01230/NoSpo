import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countByOrigin,
  countWorksByCategory,
  listGenres,
  listWorkCards,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  isCategory,
  usesOrigin,
} from "@/lib/categories";
import CategorySidebar from "@/app/CategorySidebar";
import WorkGrid from "@/app/WorkGrid";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound();

  const user = await getCurrentUser();
  const [works, allWorks, categoryCounts, genres, originCounts] = await Promise.all([
    listWorkCards(user.id, { category }),
    listWorkCards(user.id),
    countWorksByCategory(),
    usesOrigin(category)
      ? Promise.resolve([] as { genre: string; c: number }[])
      : listGenres(category),
    usesOrigin(category)
      ? countByOrigin(category)
      : Promise.resolve({} as Record<string, number>),
  ]);

  return (
    <section className="band-low" style={{ borderTop: "none" }}>
      <div className="container browse" style={{ paddingBlock: "32px 80px" }}>
        <CategorySidebar
          total={allWorks.length}
          categoryCounts={categoryCounts}
          originCounts={originCounts}
          genres={genres}
          current={{ category }}
        />

        <div className="stack" style={{ gap: 20 }}>
          <Link href="/" className="backlink">
            ← 전체 작품
          </Link>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">카테고리</span>
            <h1 className="page-title">{CATEGORY_LABELS[category]}</h1>
            <span className="muted">{CATEGORY_DESCRIPTIONS[category]}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              borderBottom: "1px solid var(--ns-line)",
              paddingBottom: 14,
            }}
          >
            <h2 className="section-title">{CATEGORY_LABELS[category]} 전체</h2>
            <span className="mono" style={{ color: "var(--ns-muted-dim)" }}>
              {works.length}편
            </span>
          </div>
          <WorkGrid works={works} />
        </div>
      </div>
    </section>
  );
}
