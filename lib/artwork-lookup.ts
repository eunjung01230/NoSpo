/**
 * 새 작품을 등록할 때 공개 API에서 메타를 한 번 찾아온다.
 *
 * 저작권 보호를 위해 이미지 파일은 저장하지 않고 공개 API가 주는 주소만 담으며,
 * 줄거리 전문·대사는 가져오지 않는다(연도·제작자·포스터 주소까지만).
 *  - 영화·드라마·애니: TMDB (TMDB_API_KEY 필요)
 *  - 만화·책: Open Library (키 없이 사용)
 * 키가 없거나 찾지 못해도 등록은 그대로 진행된다. 메타는 비어 있을 뿐이다.
 */
import type { Category } from "./categories";

export type ArtworkMeta = {
  posterUrl: string | null;
  year: string | null;
  creator: string | null;
};

const EMPTY: ArtworkMeta = { posterUrl: null, year: null, creator: null };

/** 분야를 TMDB의 검색 종류로. 드라마·애니는 시리즈(tv)로 찾는다. */
function tmdbType(category: Category): "movie" | "tv" | null {
  if (category === "movie") return "movie";
  if (category === "drama" || category === "anime") return "tv";
  return null;
}

async function fromTmdb(type: "movie" | "tv", title: string): Promise<ArtworkMeta> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return EMPTY;
  const params = new URLSearchParams({
    api_key: key,
    query: title,
    language: "ko-KR",
    include_adult: "false",
  });
  const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
  if (!res.ok) return EMPTY;
  const data = (await res.json()) as {
    results?: {
      poster_path?: string | null;
      release_date?: string;
      first_air_date?: string;
      id?: number;
    }[];
  };
  const hit = data.results?.[0];
  if (!hit) return EMPTY;
  const date = type === "tv" ? hit.first_air_date : hit.release_date;
  return {
    posterUrl: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null,
    year: date ? date.slice(0, 4) : null,
    creator: await tmdbCreator(type, hit.id, key),
  };
}

/** 감독·제작자 한 명만. 크레딧 전체를 저장하지는 않는다. */
async function tmdbCreator(
  type: "movie" | "tv",
  id: number | undefined,
  key: string
): Promise<string | null> {
  if (!id) return null;
  try {
    if (type === "tv") {
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${id}?api_key=${key}&language=ko-KR`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { created_by?: { name?: string }[] };
      return data.created_by?.[0]?.name ?? null;
    }
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${key}&language=ko-KR`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { crew?: { job?: string; name?: string }[] };
    const director = data.crew?.find((c) => c.job === "Director");
    return director?.name ?? null;
  } catch {
    return null;
  }
}

async function fromOpenLibrary(title: string): Promise<ArtworkMeta> {
  const params = new URLSearchParams({
    q: title,
    limit: "5",
    fields: "cover_i,title,author_name,first_publish_year",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) return EMPTY;
  const data = (await res.json()) as {
    docs?: { cover_i?: number; author_name?: string[]; first_publish_year?: number }[];
  };
  const hit = data.docs?.find((d) => d.cover_i) ?? data.docs?.[0];
  if (!hit) return EMPTY;
  return {
    posterUrl: hit.cover_i ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg` : null,
    year: hit.first_publish_year ? String(hit.first_publish_year) : null,
    creator: hit.author_name?.[0] ?? null,
  };
}

/**
 * 제목과 분야로 메타를 한 번 찾아본다. 외부 호출이 느리거나 실패해도 등록을 막지 않으므로
 * 여기서 시간을 제한하고, 어떤 오류든 빈 메타로 돌려준다.
 */
export async function lookupArtwork(title: string, category: Category): Promise<ArtworkMeta> {
  const query = title.trim();
  if (!query) return EMPTY;
  const type = tmdbType(category);
  try {
    const work = type ? fromTmdb(type, query) : fromOpenLibrary(query);
    const timeout = new Promise<ArtworkMeta>((resolve) =>
      setTimeout(() => resolve(EMPTY), 8000)
    );
    return await Promise.race([work, timeout]);
  } catch {
    return EMPTY;
  }
}
