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

/**
 * 영화·드라마: /categories/[category]/[origin] — 국내·외국 목록.
 * 애니·만화·책: /categories/[category]/[genre] — 장르로 좁힌 목록.
 */
export default async function SubCategoryPage({
  params,
}: {
  params: Promise<{ category: string; sub: string }>;
}) {
  const { category, sub } = await params;
  if (!isCategory(category)) notFound();

  const user = await getCurrentUser();
  const originMode = usesOrigin(category);

  const [allWorks, categoryCounts] = await Promise.all([
    listWorkCards(user.id),
    countWorksByCategory(),
  ]);

  if (originMode) {
    if (!isOrigin(sub)) notFound();
    const [works, genres, originCounts] = await Promise.all([
      listWorkCards(user.id, { category, origin: sub }),
      listGenres(category, sub),
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
            current={{ category, origin: sub }}
          />
          <div className="stack" style={{ gap: 20 }}>
            <Link href={categoryPath(category)} className="backlink">
              ← {CATEGORY_LABELS[category]}
            </Link>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">
                카테고리 · {CATEGORY_LABELS[category]}
              </span>
              <h1 className="page-title">
                {ORIGIN_LABELS[sub]} {CATEGORY_LABELS[category]}
              </h1>
              <span className="muted">
                왼쪽에서 장르를 고르면 그 장르의 작품만 모아 볼 수 있습니다.
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

  // 국내외 구분이 없는 분야는 이 자리가 곧 장르다.
  const genres = await listGenres(category);
  const genre = genreFromSlug(
    sub,
    genres.map((g) => g.genre)
  );
  if (!genre) notFound();
  const works = await listWorkCards(user.id, { category, genre });

  return (
    <section className="band-low" style={{ borderTop: "none" }}>
      <div className="container browse" style={{ paddingBlock: "32px 80px" }}>
        <CategorySidebar
          total={allWorks.length}
          categoryCounts={categoryCounts}
          genres={genres}
          current={{ category, genre }}
        />
        <div className="stack" style={{ gap: 20 }}>
          <Link href={categoryPath(category)} className="backlink">
            ← {CATEGORY_LABELS[category]}
          </Link>
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">카테고리 · {CATEGORY_LABELS[category]}</span>
            <h1 className="page-title">
              {genre} {CATEGORY_LABELS[category]}
            </h1>
            <span className="muted">
              {CATEGORY_LABELS[category]} 중 {genre} 장르 작품입니다.
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
