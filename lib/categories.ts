/**
 * 분야 → (국내/외국) → 장르 카테고리.
 * works.category / works.origin / works.genre 값과 1:1로 대응하는 표시 정보만 담는다.
 */
export const CATEGORIES = ["movie", "drama", "anime", "comic", "book"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  movie: "영화",
  drama: "드라마",
  anime: "애니",
  comic: "만화",
  book: "책",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  movie: "국내·외국으로 나뉘고, 그 안에서 장르별로 모여 있습니다.",
  drama: "국내·외국으로 나뉘고, 그 안에서 장르별로 모여 있습니다.",
  anime: "애니메이션 작품을 장르별로 모았습니다.",
  comic: "만화책과 웹툰을 장르별로 모았습니다.",
  book: "소설과 책을 장르별로 모았습니다.",
};

/** 국내/외국 구분을 쓰는 분야. 나머지는 분야 바로 아래가 장르다. */
export const ORIGIN_CATEGORIES: Category[] = ["movie", "drama"];

export const ORIGINS = ["domestic", "foreign"] as const;
export type Origin = (typeof ORIGINS)[number];

export const ORIGIN_LABELS: Record<Origin, string> = {
  domestic: "국내",
  foreign: "외국",
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export function isOrigin(v: unknown): v is Origin {
  return typeof v === "string" && (ORIGINS as readonly string[]).includes(v);
}

export function usesOrigin(category: Category) {
  return ORIGIN_CATEGORIES.includes(category);
}

/** 장르 라벨 ↔ URL 슬러그. 목록에 없는 라벨은 그대로 인코딩해 쓴다. */
const GENRE_SLUGS: Record<string, string> = {
  스릴러: "thriller",
  SF: "sf",
  호러: "horror",
  액션: "action",
  판타지: "fantasy",
  모험: "adventure",
  범죄: "crime",
  히어로: "hero",
  드라마: "drama",
  코미디: "comedy",
  로맨스: "romance",
};

export function genreSlug(label: string) {
  return GENRE_SLUGS[label] ?? encodeURIComponent(label);
}

export function genreFromSlug(slug: string, available: string[]) {
  return available.find((label) => genreSlug(label) === slug) ?? null;
}

export function categoryPath(category: Category, origin?: Origin, genre?: string) {
  const parts = ["/categories", category];
  if (origin) parts.push(origin);
  if (genre) parts.push(genreSlug(genre));
  return parts.join("/");
}
