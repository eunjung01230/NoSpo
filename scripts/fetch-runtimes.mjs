/**
 * 작품별 감상 소요 시간(works.minutes_per_stage) 채우기.
 *
 * 한 회차·편·권을 보는 데 드는 평균 시간(분)만 저장한다. 줄거리·대사 같은 내용은
 * 가져오지 않으며, 진도 단위(works.progress_unit)에 맞는 값을 고른다.
 *  - 드라마 / 애니(episode): TMDB의 회차 평균 러닝타임
 *  - 단일 영화(single): TMDB의 러닝타임
 *  - 영화 시리즈(film): 시리즈에 속한 편들의 러닝타임 평균
 *  - 책 / 만화(volume, 웹툰 화): 공개 API에 '읽는 시간'이 없어 건너뛴다(기존 값 유지).
 * TMDB_API_KEY가 없으면 아무것도 바꾸지 않는다.
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

/**
 * 작품별 조회 조건. 포스터 스크립트와 같은 검색어를 쓰고, 시간을 어떻게 셀지만 더한다.
 * 작품을 추가하면 여기에 한 줄만 더하면 된다.
 */
const LOOKUP = {
  "squid-game-s1": { kind: "tv", query: "Squid Game", year: "2021" },
  "stranger-things-s1": { kind: "tv", query: "Stranger Things", year: "2016" },
  "attack-on-titan-s1": { kind: "tv", query: "Attack on Titan", year: "2013" },
  interstellar: { kind: "movie", query: "Interstellar", year: "2014" },
  parasite: { kind: "movie", query: "Parasite", year: "2019" },
  // 3부작은 시리즈에 묶인 편들의 평균을 쓴다.
  "dark-knight-trilogy": { kind: "collection", query: "The Dark Knight", year: "2008" },
  // 인피니티 사가는 한 시리즈로 묶여 있지 않아 제작사와 개봉 시기로 편들을 모은다.
  "mcu-infinity-saga": {
    kind: "discover",
    company: 420, // Marvel Studios
    until: "2019-12-31",
    count: 23,
  },
};

const api = async (path, params = {}) => {
  const q = new URLSearchParams({ api_key: TMDB_KEY, language: "ko-KR", ...params });
  const res = await fetch(`https://api.themoviedb.org/3${path}?${q}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
};

const average = (nums) => {
  const ok = nums.filter((n) => Number.isFinite(n) && n > 0);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
};

/**
 * 검색 결과 중 가장 널리 알려진 것을 고른다. 첫 결과를 그대로 쓰면 같은 제목의
 * 단편·다큐가 잡혀 러닝타임이 엉뚱하게 들어온다(예: "Parasite" 2분짜리 단편).
 */
async function findId(type, query, year) {
  const params = { query, include_adult: "false" };
  if (year) params[type === "tv" ? "first_air_date_year" : "year"] = year;
  const data = await api(`/search/${type}`, params);
  const results = data.results ?? [];
  if (results.length === 0) return null;
  const best = [...results].sort(
    (a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0) || (b.popularity ?? 0) - (a.popularity ?? 0)
  )[0];
  return best.id;
}

/** 진도 단위별로 말이 되는 시간 범위. 벗어나면 잘못 찾은 것으로 보고 덮어쓰지 않는다. */
const SANE = {
  episode: [5, 120],
  film: [60, 300],
  single: [40, 300],
  volume: [10, 900],
};

function sane(minutes, progressUnit) {
  const [lo, hi] = SANE[progressUnit] ?? [1, 1000];
  return minutes >= lo && minutes <= hi;
}

async function minutesFor(lookup) {
  if (lookup.kind === "tv") {
    const id = await findId("tv", lookup.query, lookup.year);
    if (!id) return null;
    const tv = await api(`/tv/${id}`);
    const declared = average(tv.episode_run_time ?? []);
    if (declared) return declared;
    // episode_run_time이 비어 있는 작품이 많아, 시즌 1의 각 회차 길이로 평균을 낸다.
    const season = await api(`/tv/${id}/season/1`);
    return average((season.episodes ?? []).map((e) => e.runtime));
  }

  if (lookup.kind === "movie") {
    const id = await findId("movie", lookup.query, lookup.year);
    if (!id) return null;
    return average([(await api(`/movie/${id}`)).runtime]);
  }

  if (lookup.kind === "collection") {
    const id = await findId("movie", lookup.query, lookup.year);
    if (!id) return null;
    const collection = (await api(`/movie/${id}`)).belongs_to_collection;
    if (!collection) return null;
    const parts = (await api(`/collection/${collection.id}`)).parts ?? [];
    const runtimes = [];
    for (const p of parts) runtimes.push((await api(`/movie/${p.id}`)).runtime);
    return average(runtimes);
  }

  if (lookup.kind === "discover") {
    const data = await api("/discover/movie", {
      with_companies: String(lookup.company),
      "primary_release_date.lte": lookup.until,
      sort_by: "primary_release_date.asc",
      with_release_type: "3|2",
      // 같은 제작사의 단편·특별영상이 섞이지 않도록 장편만 센다.
      "with_runtime.gte": "70",
    });
    const films = (data.results ?? []).slice(0, lookup.count);
    const runtimes = [];
    for (const f of films) runtimes.push((await api(`/movie/${f.id}`)).runtime);
    return average(runtimes.filter((r) => r >= 70));
  }

  return null;
}

if (!TMDB_KEY) {
  console.log(
    "TMDB_API_KEY가 없어 아무것도 바꾸지 않았습니다. .env.local에 키를 넣고 다시 실행하세요."
  );
  process.exit(0);
}

const works = await db`select id, title, progress_unit, minutes_per_stage from works order by title`;
let filled = 0;
let skipped = 0;

for (const w of works) {
  const lookup = LOOKUP[w.id];
  if (!lookup) {
    console.log(`- ${w.title}: 조회 조건 없음(책·만화는 기존 값을 그대로 둡니다)`);
    skipped++;
    continue;
  }
  try {
    const minutes = await minutesFor(lookup);
    if (!minutes) {
      console.log(`- ${w.title}: 러닝타임을 찾지 못함`);
      skipped++;
      continue;
    }
    if (!sane(minutes, w.progress_unit)) {
      console.log(
        `- ${w.title}: ${minutes}분은 ${w.progress_unit} 단위에 맞지 않아 기존 값을 둡니다`
      );
      skipped++;
      continue;
    }
    await db`update works set minutes_per_stage = ${minutes} where id = ${w.id}`;
    const before = w.minutes_per_stage;
    console.log(
      `✓ ${w.title}: ${minutes}분${before && before !== minutes ? ` (이전 ${before}분)` : ""}`
    );
    filled++;
  } catch (e) {
    console.log(`- ${w.title}: ${e.message}`);
    skipped++;
  }
}

console.log(`\n감상 시간 ${filled}건 등록, ${skipped}건 건너뜀.`);
