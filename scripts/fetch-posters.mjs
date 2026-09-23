/**
 * 작품 포스터 URL 채우기.
 *
 * 포스터 이미지는 저작권이 있으므로 파일을 복사해 두지 않고, 공개 API가 제공하는
 * 이미지 주소만 works.poster_url에 저장해 그대로 불러온다.
 *  - 영화 / 드라마 / 애니: TMDB (TMDB_API_KEY 필요, 출처 표기 조건)
 *  - 책 / 만화: Open Library (키 없이 사용 가능)
 * 키가 없으면 그 부분만 건너뛰고 나머지를 채운다.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 비어 있습니다. .env.local을 먼저 채워주세요.");
  process.exit(1);
}
const db = neon(url);
const TMDB_KEY = process.env.TMDB_API_KEY;

/** 작품별 검색 조건. 작품을 추가하면 여기에 한 줄만 더하면 된다. */
const LOOKUP = {
  "squid-game-s1": { source: "tmdb", type: "tv", query: "Squid Game", year: "2021" },
  "stranger-things-s1": { source: "tmdb", type: "tv", query: "Stranger Things", year: "2016" },
  "attack-on-titan-s1": { source: "tmdb", type: "tv", query: "Attack on Titan", year: "2013" },
  "mcu-infinity-saga": { source: "tmdb", type: "movie", query: "The Avengers", year: "2012" },
  "dark-knight-trilogy": { source: "tmdb", type: "movie", query: "The Dark Knight", year: "2008" },
  interstellar: { source: "tmdb", type: "movie", query: "Interstellar", year: "2014" },
  parasite: { source: "tmdb", type: "movie", query: "Parasite", year: "2019" },
  "harry-potter-novels": {
    source: "openlibrary",
    query: "Harry Potter and the Philosopher's Stone Rowling",
  },
  "one-piece-manga": { source: "openlibrary", query: "One Piece Eiichiro Oda" },
  "solo-leveling-webtoon": { source: "openlibrary", query: "Solo Leveling Chugong" },
};

async function fromTmdb({ type, query, year }) {
  if (!TMDB_KEY) return null;
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query,
    language: "ko-KR",
    include_adult: "false",
  });
  if (year) params.set(type === "tv" ? "first_air_date_year" : "year", year);
  const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  const path = data.results?.find((r) => r.poster_path)?.poster_path;
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}

async function fromOpenLibrary({ query }) {
  const params = new URLSearchParams({ q: query, limit: "5", fields: "cover_i,title" });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = await res.json();
  const cover = data.docs?.find((d) => d.cover_i)?.cover_i;
  return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : null;
}

const works = await db`select id, title from works order by title`;
let filled = 0;
let skipped = 0;

for (const w of works) {
  const lookup = LOOKUP[w.id];
  if (!lookup) {
    console.log(`- ${w.title}: 검색 조건 없음`);
    skipped++;
    continue;
  }
  try {
    const poster =
      lookup.source === "tmdb" ? await fromTmdb(lookup) : await fromOpenLibrary(lookup);
    if (!poster) {
      console.log(
        `- ${w.title}: 포스터를 찾지 못함${
          lookup.source === "tmdb" && !TMDB_KEY ? " (TMDB_API_KEY 없음)" : ""
        }`
      );
      skipped++;
      continue;
    }
    await db`update works set poster_url = ${poster} where id = ${w.id}`;
    console.log(`✓ ${w.title}`);
    filled++;
  } catch (e) {
    console.log(`- ${w.title}: ${e.message}`);
    skipped++;
  }
}

console.log(`\n포스터 ${filled}건 등록, ${skipped}건 건너뜀.`);
if (!TMDB_KEY) {
  console.log(
    "영화·드라마·애니 포스터를 채우려면 .env.local에 TMDB_API_KEY=... 를 넣고 다시 실행하세요."
  );
}
