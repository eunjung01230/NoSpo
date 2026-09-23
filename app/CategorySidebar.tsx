import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  ORIGINS,
  ORIGIN_LABELS,
  categoryPath,
  usesOrigin,
  type Category,
  type Origin,
} from "@/lib/categories";

type Current = { category?: Category; origin?: Origin; genre?: string };

/**
 * 왼쪽 카테고리 목록. 지금 보고 있는 분야는 그 아래로 국내·외국과 장르가 펼쳐진다.
 * 분류는 탐색용이며 글 공개 판정과는 무관하다.
 */
export default function CategorySidebar({
  total,
  categoryCounts,
  originCounts = {},
  genres = [],
  current = {},
}: {
  total: number;
  categoryCounts: Record<string, number>;
  originCounts?: Record<string, number>;
  genres?: { genre: string; c: number }[];
  current?: Current;
}) {
  const atAll = !current.category;

  return (
    <nav className="sidebar" aria-label="카테고리">
      <span className="side-title">Categories</span>

      <div className="side-group">
        <Link href="/" className="side-link" aria-current={atAll ? "page" : undefined}>
          <span>전체 작품</span>
          <span className="count">{total}</span>
        </Link>
      </div>

      {CATEGORIES.map((c) => {
        const active = current.category === c;
        return (
          <div key={c}>
            <Link
              href={categoryPath(c)}
              className="side-link"
              aria-current={active && !current.origin && !current.genre ? "page" : undefined}
            >
              <span>{CATEGORY_LABELS[c]}</span>
              <span className="count">{categoryCounts[c] ?? 0}</span>
            </Link>

            {active && usesOrigin(c) &&
              ORIGINS.map((o) => (
                <div key={o}>
                  <Link
                    href={categoryPath(c, o)}
                    className="side-link sub"
                    aria-current={
                      current.origin === o && !current.genre ? "page" : undefined
                    }
                  >
                    <span>{ORIGIN_LABELS[o]}</span>
                    <span className="count">{originCounts[o] ?? 0}</span>
                  </Link>

                  {current.origin === o &&
                    genres.map((g) => (
                      <Link
                        key={g.genre}
                        href={categoryPath(c, o, g.genre)}
                        className="side-link sub-2"
                        aria-current={current.genre === g.genre ? "page" : undefined}
                      >
                        <span>{g.genre}</span>
                        <span className="count">{g.c}</span>
                      </Link>
                    ))}
                </div>
              ))}

            {active && !usesOrigin(c) &&
              genres.map((g) => (
                <Link
                  key={g.genre}
                  href={categoryPath(c, undefined, g.genre)}
                  className="side-link sub"
                  aria-current={current.genre === g.genre ? "page" : undefined}
                >
                  <span>{g.genre}</span>
                  <span className="count">{g.c}</span>
                </Link>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
