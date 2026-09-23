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
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  categoryPath,
  genreFromSlug,
  isCategory,
  isOrigin,
  usesOrigin,
} from "@/lib/categories";
import CategorySidebar from "@/app/CategorySidebar";
import WorkGrid from "@/app/WorkGrid";

export const dynamic = "force-dynamic";

/** 영화·드라마의 국내/외국 아래 장르 화면. 예: /categories/movie/foreign/sf */
export default async function GenrePage({
  params,
}: {
  params: Promise<{ category: string; sub: string; genre: string }>;
}) {
  const { category, sub, genre: genreSlugParam } = await params;
  if (!isCategory(category) || !usesOrigin(category) || !isOrigin(sub)) notFound();

  const genres = await listGenres(category, sub);
  const genre = genreFromSlug(
    genreSlugParam,
    genres.map((g) => g.genre)
  );
  if (!genre) notFound();

  const user = await getCurrentUser();
  const [works, allWorks, categoryCounts, originCounts] = await Promise.all([
    listWorkCards(user.id, { category, origin: sub, genre }),
    listWorkCards(user.id),
    countWorksByCategory(),
    countByOrigin(category),
  ]);

  return (
    <section className="band-low" style={{ borderTop: "none" }}>
      <div className="container browse" style={{ paddingBlock: "32px 80px" }}>
        <CategorySidebar
          total={allWorks.length}
          categoryCounts={categoryCounts}
          originCounts={originCounts}
          genres={genres}
          current={{ category, origin: sub, genre }}
        />

        <div className="stack" style={{ gap: 20 }}>
          <Link href={categoryPath(category, sub)} className="backlink">
            ← {ORIGIN_LABELS[sub]} {CATEGORY_LABELS[category]}
          </Link>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">
              카테고리 · {CATEGORY_LABELS[category]} · {ORIGIN_LABELS[sub]}
            </span>
            <h1 className="page-title">
              {ORIGIN_LABELS[sub]} {genre} {CATEGORY_LABELS[category]}
            </h1>
            <span className="muted">
              {ORIGIN_LABELS[sub]} {CATEGORY_LABELS[category]} 중 {genre} 장르 작품입니다.
            </span>
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
            <h2 className="section-title">작품</h2>
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
