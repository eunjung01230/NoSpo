/**
 * 작품 메타(포스터 주소·연도·제작자)를 공개 API에서 찾아온다.
 *
 * 저작권 보호를 위해 이미지 파일은 저장하지 않고 공개 API가 주는 주소만 담으며,
 * 줄거리 전문·대사는 가져오지 않는다.
 *  - 영화·드라마·애니: TMDB (TMDB_API_KEY 필요)
 *  - 만화·책: Open Library (키 없이 사용)
 *
 * 제목이 조금만 달라도 엉뚱한 작품이 첫 결과로 올라오기 때문에, 첫 결과를 그대로 쓰지 않고
 * 후보 목록을 돌려주어 등록하는 사람이 직접 고르게 한다. 키가 없거나 조회가 실패하면
 * 빈 목록이며, 그래도 등록·수정은 그대로 진행된다(메타가 비어 있을 뿐이다).
 */
import type { Category } from "./categories";

export type ArtworkCandidate = {
  /** 화면에서 후보를 구분하는 값. 폼으로 되돌아온 값을 이 키로 다시 찾는다. */
  key: string;
  title: string;
  year: string | null;
  creator: string | null;
  posterUrl: string | null;
  /** 영화/시리즈/책 중 어디서 찾았는지. 같은 제목이 섞여 있을 때 구분용으로 보여준다. */
  kind: string;
};

/** 분야를 TMDB 검색 종류로. 드라마·애니는 시리즈(tv), 영화는 movie, 만화·책은 TMDB를 쓰지 않는다. */
function tmdbTypes(category: Category): ("movie" | "tv")[] {
  if (category === "movie") return ["movie"];
  if (category === "drama" || category === "anime") return ["tv"];
  return [];
}

const KIND_LABELS: Record<string, string> = {
  movie: "영화",
  tv: "시리즈",
  book: "책·만화",
};

async function tmdbSearch(
  type: "movie" | "tv",
  query: string,
  key: string
): Promise<ArtworkCandidate[]> {
  const params = new URLSearchParams({
    api_key: key,
    query,
    language: "ko-KR",
    include_adult: "false",
  });
  const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      id: number;
      title?: string;
      name?: string;
      original_title?: string;
      original_name?: string;
      poster_path?: string | null;
      release_date?: string;
      first_air_date?: string;
    }[];
  };
  return (data.results ?? []).slice(0, 6).map((r) => {
    const date = type === "tv" ? r.first_air_date : r.release_date;
    return {
      key: `tmdb:${type}:${r.id}`,
      title: r.title ?? r.name ?? r.original_title ?? r.original_name ?? "",
      year: date ? date.slice(0, 4) : null,
      creator: null,
      posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
      kind: KIND_LABELS[type],
    };
  });
}

/**
 * 사람 이름 고르기. TMDB의 한국어 인명 데이터는 '백'처럼 성 한 글자만 들어 있는 경우가 있어,
 * 원어 이름이 한 글자면 기본 표기(로마자)를 쓴다. 이름이 반 토막으로 저장되지 않게 하기 위함이다.
 */
function pickName(entry: { name?: string; original_name?: string } | undefined) {
  if (!entry) return null;
  const original = entry.original_name?.trim() ?? "";
  const plain = entry.name?.trim() ?? "";
  if (original.length >= 2) return original;
  return plain || original || null;
}

/** 감독·제작자 한 명만 덧붙인다. 후보를 고른 뒤 한 번만 부른다(크레딧 전체는 저장하지 않는다). */
async function tmdbCreator(type: "movie" | "tv", id: string, key: string) {
  try {
    if (type === "tv") {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${key}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        created_by?: { name?: string; original_name?: string }[];
      };
      return pickName(data.created_by?.[0]);
    }
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${key}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      crew?: { job?: string; name?: string; original_name?: string }[];
    };
    return pickName(data.crew?.find((c) => c.job === "Director"));
  } catch {
    return null;
  }
}

async function openLibrarySearch(query: string): Promise<ArtworkCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "6",
    fields: "key,cover_i,title,author_name,first_publish_year",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    docs?: {
      key?: string;
      cover_i?: number;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
    }[];
  };
  return (data.docs ?? []).map((d, i) => ({
    key: `openlibrary:${d.key ?? i}:${d.cover_i ?? 0}`,
    title: d.title ?? "",
    year: d.first_publish_year ? String(d.first_publish_year) : null,
    creator: d.author_name?.[0] ?? null,
    posterUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    kind: KIND_LABELS.book,
  }));
}

/**
 * 검색어 변형. TMDB·Open Library는 제목이 글자 단위로 맞아야 찾아주기 때문에
 * ('뷰티인사이드'는 0건, '뷰티 인사이드'는 정확히 나온다) 처음 질의가 비면
 * 띄어쓰기를 지운 형태와 앞부분만 남긴 형태로 점점 느슨하게 다시 찾는다.
 * 후보는 사람이 눈으로 보고 고르므로, 조금 넓게 걸려도 문제가 되지 않는다.
 */
function queryVariants(query: string) {
  const variants = [query];
  const squeezed = query.replace(/\s+/g, "");
  if (squeezed !== query) variants.push(squeezed);
  const spaced = query.includes(" ") ? null : query;
  // 앞부분만 남긴 형태(긴 제목 → 짧은 제목 순). 두 글자 미만으로는 줄이지 않는다.
  if (spaced) {
    for (let len = Math.max(2, Math.ceil(spaced.length / 2)); len >= 2; len--) {
      const prefix = spaced.slice(0, len);
      if (!variants.includes(prefix)) variants.push(prefix);
      if (variants.length >= 4) break;
    }
  }
  return variants;
}

/** 외부 호출이 느려도 화면을 붙잡지 않도록 시간을 제한한다. */
function withTimeout<T>(work: Promise<T>, fallback: T, ms = 8000): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * 제목과 분야로 후보를 찾는다. 결과가 없으면 빈 배열이고, 그 경우 화면에서는
 * '연결하지 않고 등록'으로 넘어간다(포스터는 자리표시자가 나온다).
 */
export async function searchArtwork(
  title: string,
  category: Category
): Promise<ArtworkCandidate[]> {
  const query = title.trim();
  if (!query) return [];
  const key = process.env.TMDB_API_KEY;
  const types = tmdbTypes(category);
  try {
    // 정확한 제목부터 시도하고, 비면 느슨한 형태로 한 단계씩 넓힌다.
    for (const variant of queryVariants(query)) {
      const found =
        types.length > 0
          ? key
            ? (
                await withTimeout(
                  Promise.all(types.map((t) => tmdbSearch(t, variant, key))),
                  []
                )
              ).flat()
            : []
          : await withTimeout(openLibrarySearch(variant), []);
      if (found.length > 0) return dedupe(found);
      if (types.length > 0 && !key) return [];
    }
    return [];
  } catch {
    return [];
  }
}

/** 변형 질의가 겹칠 수 있으므로 같은 후보는 한 번만 보여준다. */
function dedupe(candidates: ArtworkCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
}

/**
 * 고른 후보를 저장할 값으로 바꾼다. TMDB 후보는 이때 한 번 더 불러 감독·제작자를 채운다.
 * 폼에서 돌아온 key만 믿지 않고, 같은 검색을 다시 해 그 key가 실제 후보에 있는지 확인한다.
 */
export async function resolveCandidate(
  candidateKey: string,
  title: string,
  category: Category
): Promise<{ posterUrl: string | null; year: string | null; creator: string | null }> {
  const empty = { posterUrl: null, year: null, creator: null };
  if (!candidateKey) return empty;
  const candidates = await searchArtwork(title, category);
  const hit = candidates.find((c) => c.key === candidateKey);
  if (!hit) return empty;

  const [source, type, id] = hit.key.split(":");
  const key = process.env.TMDB_API_KEY;
  const creator =
    source === "tmdb" && key
      ? await withTimeout(tmdbCreator(type as "movie" | "tv", id, key), null, 6000)
      : hit.creator;
  return { posterUrl: hit.posterUrl, year: hit.year, creator };
}
