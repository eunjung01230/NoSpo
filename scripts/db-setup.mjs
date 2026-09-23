// NoSpo 스키마 생성 + 시연 데이터 등록 (재실행해도 기존 사용자 변경을 덮어쓰지 않음)
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 비어 있습니다. .env.local을 먼저 채워주세요.");
  process.exit(1);
}
const db = neon(url);

await db`create table if not exists users (
  id text primary key,
  display_name text not null,
  is_demo boolean not null default true
)`;

await db`create table if not exists works (
  id text primary key,
  board text not null,
  title text not null,
  description text not null,
  progress_unit text not null
)`;

await db`create table if not exists work_stages (
  work_id text not null references works(id) on delete cascade,
  stage_no int not null,
  label text not null,
  primary key (work_id, stage_no)
)`;

await db`create table if not exists user_progress (
  user_id text not null references users(id) on delete cascade,
  work_id text not null references works(id) on delete cascade,
  stage_no int not null default 0,
  primary key (user_id, work_id)
)`;

await db`create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  work_id text not null references works(id) on delete cascade,
  author_id text not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  max_stage int not null,
  is_demo_seed boolean not null default false,
  created_at timestamptz not null default now()
)`;

// 게시판 타입은 posts를 확장해서 구분한다(게시판별 테이블을 만들지 않는다).
await db`alter table posts add column if not exists board_type text not null default 'review'`;
await db`alter table posts drop constraint if exists posts_board_type_check`;
await db`alter table posts add constraint posts_board_type_check
  check (board_type in ('review','question','interpretation','recap','free'))`;
await db`create index if not exists posts_work_board_stage_idx
  on posts (work_id, board_type, max_stage)`;

// 자유 게시판 글은 max_stage = 0으로 저장한다. 회차가 없는 글이므로 work_stages와
// 이어지지 않으며, 공개 조건(max_stage <= 진도)은 그대로 통과한다.
await db`alter table posts drop constraint if exists posts_max_stage_check`;
await db`alter table posts add constraint posts_max_stage_check check (max_stage >= 0)`;

// 댓글. 글에 딸린 소통 수단이라 글이 지워지면 함께 사라진다.
// 읽기·쓰기 권한은 언제나 '그 글이 지금 공개되는가'로 서버에서 다시 판정한다.
await db`create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id text not null references users(id) on delete cascade,
  body text not null,
  is_demo_seed boolean not null default false,
  created_at timestamptz not null default now()
)`;
await db`create index if not exists comments_post_idx on comments (post_id, created_at)`;

// 대댓글은 한 단계만 둔다(답글에 또 답글을 달지 않는다).
// 부모 댓글이 지워지면 그 아래 답글도 함께 사라진다.
await db`alter table comments add column if not exists parent_id uuid
  references comments(id) on delete cascade`;
await db`create index if not exists comments_parent_idx on comments (parent_id)`;

// 분야(영화/드라마/애니/만화/책) · 국내외 구분 · 장르는 works를 확장해서 담는다.
await db`alter table works add column if not exists category text`;
await db`alter table works add column if not exists origin text`;
await db`alter table works add column if not exists genre text`;
await db`alter table works add column if not exists poster_url text`;
await db`alter table works add column if not exists year text`;
await db`alter table works add column if not exists creator text`;
// 감상에 걸리는 시간(한 회차·편·권 평균 분). 러닝타임과 평균 분량만 담는 표시용 값이다.
await db`alter table works add column if not exists minutes_per_stage int`;
await db`create index if not exists works_category_idx on works (category, origin, genre)`;

// 신고·경고·관리자. 공개 판정(max_stage <= 진도)은 그대로 두고 그 위에 얹는 안전장치다.
// 관리자 여부는 users에 한 컬럼으로 두고, 시연 관리자 계정을 하나 등록한다.
await db`alter table users add column if not exists is_admin boolean not null default false`;

// 글의 상태: 신고 누적으로 가려졌는지, AI 사전 검토 결과가 무엇이었는지.
// hidden_at이 채워진 글은 조회 단계에서 제외한다(관리자 화면에서만 본다).
await db`alter table posts add column if not exists hidden_at timestamptz`;
await db`alter table posts add column if not exists hidden_reason text`;
await db`alter table posts add column if not exists ai_verdict text`;
await db`alter table posts add column if not exists ai_reason text`;
await db`alter table posts add column if not exists ai_checked_at timestamptz`;
// 작성자가 AI 경고를 보고도 그대로 등록했는지. 관리자 화면의 '검토 필요' 목록 기준이다.
await db`alter table posts add column if not exists ai_acknowledged boolean not null default false`;
await db`create index if not exists posts_hidden_idx on posts (hidden_at)`;

// 신고. 한 사람이 같은 글을 여러 번 신고해도 1건으로 센다(unique).
await db`create table if not exists post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  reporter_id text not null references users(id) on delete cascade,
  reason text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
)`;

// 경고 누적. 신고 누적으로 글이 가려지면 작성자에게 1건 쌓이고,
// 관리자가 숨김을 풀면 그 글로 생긴 경고도 함께 지운다.
await db`create table if not exists user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  source text not null,
  note text,
  created_at timestamptz not null default now()
)`;
await db`create index if not exists user_warnings_user_idx on user_warnings (user_id)`;

await db`insert into users (id, display_name) values
  ('user-a', '시연 사용자 A'), ('user-b', '시연 사용자 B')
  on conflict (id) do nothing`;
await db`insert into users (id, display_name, is_admin) values
  ('user-admin', '시연 관리자', true)
  on conflict (id) do update set is_admin = true`;

// 작품은 운영 측에서 미리 등록한다. 장르·포맷마다 진도 단위가 다르므로 억지로 통일하지 않는다.
// 저작권 보호를 위해 작품명·포맷·진도 단위와 한 줄 소개만 저장한다.
const works = [
  {
    id: "squid-game-s1", category: "drama", origin: "domestic", genre: "스릴러", board: "드라마(국내)", title: "오징어 게임 시즌 1",
    description: "빚에 몰린 사람들이 거액의 상금이 걸린 의문의 게임에 초대되는 한국 서바이벌 드라마. 시즌 1은 전 9화이며 황동혁이 각본과 연출을 맡았습니다.",
    year: "2021", creator: "황동혁 연출 · 넷플릭스",
    unit: "episode", stages: 9, suffix: "화", minutes: 60,
    progress: { "user-a": 3, "user-b": 8 },
  },
  {
    id: "stranger-things-s1", category: "drama", origin: "foreign", genre: "SF", board: "드라마(외국)", title: "기묘한 이야기 시즌 1",
    description: "1980년대 미국의 작은 마을에서 한 소년이 사라지며 시작되는 미스터리 드라마. 시즌 1은 전 8화이고 시대극 감성에 SF·호러가 섞여 있습니다.",
    year: "2016", creator: "더퍼 형제 · 넷플릭스",
    unit: "episode", stages: 8, suffix: "화", minutes: 50,
    progress: { "user-a": 2, "user-b": 6 },
  },
  {
    id: "attack-on-titan-s1", category: "anime", origin: null, genre: "액션", board: "애니", title: "진격의 거인 시즌 1",
    description: "거인의 위협 속에서 벽 안에 살아가는 인류를 그린 일본 애니메이션. 시즌 1은 전 25화이며 같은 원작의 만화와는 진도를 따로 관리합니다.",
    year: "2013", creator: "이사야마 하지메 원작 · WIT STUDIO",
    unit: "episode", stages: 25, suffix: "화", minutes: 24,
    progress: { "user-a": 5, "user-b": 18 },
  },
  {
    id: "one-piece-manga", category: "comic", origin: null, genre: "모험", board: "만화", title: "원피스 (만화책)",
    description: "해적왕을 꿈꾸는 소년과 동료들의 대항해를 그린 장편 만화. 연재가 이어지고 있어 진도는 몇 권까지 읽었는지로 기록합니다.",
    year: "1997~", creator: "오다 에이이치로 · 주간 소년 점프",
    unit: "volume", stages: 110, suffix: "권", minutes: 40,
    progress: { "user-a": 12, "user-b": 60 },
  },
  {
    id: "solo-leveling-webtoon", category: "comic", origin: null, genre: "액션", board: "만화", title: "나 혼자만 레벨업 (웹툰)",
    description: "게이트와 헌터가 등장하는 세계에서 가장 약한 헌터가 성장하는 한국 웹툰. 진도는 몇 화까지 읽었는지로 기록합니다.",
    year: "2018", creator: "추공 원작 · 장성락 작화 · 카카오페이지",
    unit: "episode", stages: 179, suffix: "화", minutes: 8,
    progress: { "user-a": 20, "user-b": 95 },
  },
  {
    id: "harry-potter-novels", category: "book", origin: null, genre: "판타지", board: "책", title: "해리 포터 시리즈 (소설)",
    description: "마법 학교 호그와트를 배경으로 한 판타지 소설 시리즈. 전 7권이며 진도는 몇 권까지 읽었는지로 기록합니다.",
    year: "1997~2007", creator: "J. K. 롤링",
    unit: "volume", stages: 7, suffix: "권", minutes: 540,
    progress: { "user-a": 2, "user-b": 5 },
  },
  {
    id: "mcu-infinity-saga", category: "movie", origin: "foreign", genre: "히어로", board: "영화(외국)", title: "마블 시네마틱 유니버스: 인피니티 사가",
    description: "여러 히어로 영화가 하나의 세계관으로 이어지는 미국 프랜차이즈. 인피니티 사가는 개봉 순 23편이며 진도는 몇 편까지 봤는지로 기록합니다.",
    year: "2008~2019", creator: "마블 스튜디오",
    unit: "film", stages: 23, suffix: "편", minutes: 130,
    progress: { "user-a": 6, "user-b": 15 },
  },
  {
    id: "dark-knight-trilogy", category: "movie", origin: "foreign", genre: "범죄", board: "영화(외국)", title: "다크 나이트 3부작",
    description: "한 도시의 자경단 히어로를 현실적인 톤으로 그린 영화 3부작. 진도는 몇 편까지 봤는지로 기록합니다.",
    year: "2005~2012", creator: "크리스토퍼 놀런 감독",
    unit: "film", stages: 3, suffix: "편", minutes: 145,
    progress: { "user-a": 1, "user-b": 3 },
  },
  {
    id: "interstellar", category: "movie", origin: "foreign", genre: "SF", board: "영화(외국)", title: "인터스텔라",
    description: "황폐해진 지구를 떠나 새로운 터전을 찾아 나서는 우주 탐사 영화. 169분 단일 작품이라 봤는지 여부만 기록합니다.",
    year: "2014", creator: "크리스토퍼 놀런 감독",
    unit: "single", stages: 1, suffix: "", minutes: 169, singleLabel: "봤다",
    progress: { "user-a": 0, "user-b": 1 },
  },
  {
    id: "parasite", category: "movie", origin: "domestic", genre: "스릴러", board: "영화(국내)", title: "기생충",
    description: "두 가족이 얽히며 벌어지는 일을 그린 한국 영화. 132분 단일 작품이라 봤는지 여부만 기록합니다.",
    year: "2019", creator: "봉준호 감독",
    unit: "single", stages: 1, suffix: "", minutes: 132, singleLabel: "봤다",
    progress: { "user-a": 1, "user-b": 0 },
  },
];

// 초기 시연에만 쓰였고 지금은 중복되는 작품은 정리한다.
// 사용자가 직접 쓴 글이 남아 있으면 지우지 않는다.
for (const oldId of ["frieren-s1", "lotr-trilogy"]) {
  const mine = await db`select count(*)::int c from posts
    where work_id = ${oldId} and is_demo_seed = false`;
  if (mine[0].c === 0) {
    await db`delete from posts where work_id = ${oldId}`;
    await db`delete from user_progress where work_id = ${oldId}`;
    await db`delete from work_stages where work_id = ${oldId}`;
    await db`delete from works where id = ${oldId}`;
  }
}

for (const w of works) {
  await db`insert into works (id, board, title, description, progress_unit,
                             category, origin, genre, year, creator, poster_url, minutes_per_stage)
    values (${w.id}, ${w.board}, ${w.title}, ${w.description}, ${w.unit},
            ${w.category}, ${w.origin}, ${w.genre}, ${w.year ?? null},
            ${w.creator ?? null}, ${w.poster ?? null}, ${w.minutes ?? null})
    on conflict (id) do update set board = excluded.board, title = excluded.title,
      description = excluded.description, progress_unit = excluded.progress_unit,
      category = excluded.category, origin = excluded.origin, genre = excluded.genre,
      year = excluded.year, creator = excluded.creator,
      -- 감상 시간도 별도 스크립트(npm run runtimes)로 채우므로 이미 있는 값은 두고,
      -- 아직 비어 있을 때만 시연용 기본값을 넣는다.
      minutes_per_stage = coalesce(works.minutes_per_stage, excluded.minutes_per_stage),
      -- 포스터는 별도 스크립트(npm run posters)로 채우므로 기존 값을 지우지 않는다.
      poster_url = coalesce(excluded.poster_url, works.poster_url)`;
  if (w.singleLabel) {
    await db`insert into work_stages (work_id, stage_no, label)
      values (${w.id}, 1, ${w.singleLabel})
      on conflict (work_id, stage_no) do nothing`;
  } else {
    // 단계가 많은 작품도 한 번의 쿼리로 등록한다.
    await db`insert into work_stages (work_id, stage_no, label)
      select ${w.id}, i, i || ${w.suffix} from generate_series(1, ${w.stages}) as i
      on conflict (work_id, stage_no) do nothing`;
  }
  // 이미 값이 있으면 사용자가 바꾼 것이므로 덮어쓰지 않는다.
  for (const [userId, stage] of Object.entries(w.progress)) {
    await db`insert into user_progress (user_id, work_id, stage_no)
      values (${userId}, ${w.id}, ${stage})
      on conflict (user_id, work_id) do nothing`;
  }
}

// 관리자는 신고된 글을 직접 읽어야 하므로 모든 작품을 끝까지 본 상태로 시작한다.
// (이미 값이 있으면 건드리지 않는다.)
await db`insert into user_progress (user_id, work_id, stage_no)
  select 'user-admin', w.id, (select count(*)::int from work_stages s where s.work_id = w.id)
  from works w
  on conflict (user_id, work_id) do nothing`;

// 시연 글. 실제 줄거리·대사·전개를 적지 않은 짧은 더미 감상문이다.
const seeds = [
  // 오징어 게임 시즌 1 (드라마, 화)
  ["11111111-1111-4111-8111-000000000002", "squid-game-s1", "review", "user-b", 2,
   "초반 분위기부터 몰입됐어요",
   "아직 2화까지만 이야기할게요. 화면 색감과 음악이 상황의 긴장을 잘 끌고 갑니다. 다음 화가 궁금해졌어요."],
  ["11111111-1111-4111-8111-000000000003", "squid-game-s1", "review", "user-a", 3,
   "인물 소개가 촘촘합니다",
   "3화까지의 감상입니다. 짧은 장면 하나에도 인물의 성격이 드러나게 배치해 둔 점이 좋았습니다."],
  ["11111111-1111-4111-8111-000000000004", "squid-game-s1", "review", "user-b", 4,
   "긴장감이 한 단계 올라갑니다",
   "4화 범위까지만 적습니다. 이야기의 속도가 빨라지면서 인물들의 선택에 무게가 실리기 시작해요."],
  ["11111111-1111-4111-8111-000000000005", "squid-game-s1", "review", "user-b", 5,
   "관계의 결이 달라지는 구간",
   "5화까지 본 기준의 감상입니다. 인물들 사이의 거리감이 조금씩 달라지는 게 보여서 대사를 곱씹게 됐어요."],
  ["11111111-1111-4111-8111-000000000008", "squid-game-s1", "review", "user-b", 8,
   "후반부는 호흡이 길어집니다",
   "8화 범위까지의 감상입니다. 화면을 오래 머무르게 하는 장면이 늘어납니다."],
  ["11111111-1111-4111-8111-000000000102", "squid-game-s1", "question", "user-a", 2,
   "2화까지 보고 생기는 궁금증",
   "2화까지만 본 기준입니다. 여기까지 보신 분들은 어떤 점이 가장 인상적이었나요? 이후 내용은 적지 말아주세요."],
  ["11111111-1111-4111-8111-000000000105", "squid-game-s1", "question", "user-b", 5,
   "5화까지 보신 분들께 묻습니다",
   "5화 범위까지의 질문입니다. 인물들의 선택을 어떤 기준으로 보셨는지 궁금합니다."],
  ["11111111-1111-4111-8111-000000000203", "squid-game-s1", "interpretation", "user-a", 3,
   "반복되는 색과 구도에 대한 메모",
   "3화까지의 해석입니다. 공간의 색과 인물 배치가 규칙적으로 반복되는 것처럼 보여 적어 둡니다."],
  ["11111111-1111-4111-8111-000000000303", "squid-game-s1", "recap", "user-a", 3,
   "3화까지의 짧은 후기",
   "여기까지는 인물을 알아가는 구간이라 부담 없이 볼 수 있었습니다."],

  ["11111111-1111-4111-8111-000000000208", "squid-game-s1", "interpretation", "user-b", 8,
   "후반부 연출 메모",
   "8화 범위까지의 해석 메모입니다. 화면이 인물을 오래 비추는 방식이 앞부분과 달라진 것 같아 기록해 둡니다."],
  ["11111111-1111-4111-8111-000000000304", "squid-game-s1", "recap", "user-b", 4,
   "4화까지의 짧은 후기",
   "4화까지 보고 남기는 후기입니다. 속도가 붙기 시작해서 다음 화를 바로 누르게 됩니다."],

  // 기묘한 이야기 시즌 1 (해외 드라마, 화)
  ["44444444-4444-4444-8444-000000000001", "stranger-things-s1", "review", "user-a", 1,
   "1화만 보고 남기는 첫인상",
   "1화까지의 감상입니다. 배경이 되는 시대의 분위기를 살린 미술이 먼저 눈에 들어왔어요."],
  ["44444444-4444-4444-8444-000000000004", "stranger-things-s1", "review", "user-b", 4,
   "4화까지의 감상",
   "4화 범위까지만 적습니다. 인물들이 각자 다른 자리에서 움직이는 구성이 마음에 듭니다."],
  ["44444444-4444-4444-8444-000000000006", "stranger-things-s1", "recap", "user-b", 6,
   "6화까지의 짧은 후기",
   "여기까지 보면 이야기의 방향이 잡히는 느낌입니다. 같은 진도인 분들과 이야기하고 싶네요."],

  // 진격의 거인 시즌 1 (애니, 화)
  ["55555555-5555-4555-8555-000000000003", "attack-on-titan-s1", "review", "user-a", 3,
   "초반 연출이 강합니다",
   "3화까지의 감상입니다. 음악과 카메라 움직임이 잘 맞물려서 집중하게 됩니다."],
  ["55555555-5555-4555-8555-000000000012", "attack-on-titan-s1", "question", "user-b", 12,
   "12화까지 보신 분들께",
   "12화 범위까지의 질문입니다. 인물들의 관계를 어떻게 정리하며 보고 계신가요?"],
  ["55555555-5555-4555-8555-000000000018", "attack-on-titan-s1", "interpretation", "user-b", 18,
   "18화까지의 연출 메모",
   "18화 범위까지의 해석 메모입니다. 장면 전환의 속도가 앞부분과 달라진 것 같아 적어 둡니다."],

  // 원피스 만화책 (만화, 권)
  ["66666666-6666-4666-8666-000000000005", "one-piece-manga", "review", "user-a", 5,
   "5권까지 읽은 감상",
   "5권까지의 감상입니다. 캐릭터가 늘어나는데도 소개가 깔끔해서 읽기 편했습니다."],
  ["66666666-6666-4666-8666-000000000030", "one-piece-manga", "recap", "user-b", 30,
   "30권까지의 짧은 후기",
   "여기까지 읽으면 여정의 규모가 커진 게 느껴집니다. 진도 맞는 분들과 이야기하고 싶어요."],
  ["66666666-6666-4666-8666-000000000060", "one-piece-manga", "question", "user-b", 60,
   "60권까지 읽으신 분들께",
   "60권 범위까지의 질문입니다. 어떤 순서로 다시 읽으면 좋을지 추천 부탁드립니다."],

  // 나 혼자만 레벨업 웹툰 (만화, 화)
  ["77777777-7777-4777-8777-000000000010", "solo-leveling-webtoon", "review", "user-a", 10,
   "10화까지의 감상",
   "10화까지 읽은 기준입니다. 연출이 시원시원해서 넘기는 재미가 있습니다."],
  ["77777777-7777-4777-8777-000000000080", "solo-leveling-webtoon", "interpretation", "user-b", 80,
   "80화까지의 해석 메모",
   "80화 범위까지의 메모입니다. 작화가 장면의 속도를 조절하는 방식을 적어 둡니다."],
  ["77777777-7777-4777-8777-000000000095", "solo-leveling-webtoon", "recap", "user-b", 95,
   "95화까지의 짧은 후기",
   "여기까지 읽고 남기는 후기입니다. 한 번에 몰아 읽기 좋았습니다."],

  // 해리 포터 소설 (책, 권)
  ["88888888-8888-4888-8888-000000000001", "harry-potter-novels", "review", "user-a", 1,
   "1권만 읽은 기준의 감상",
   "1권까지의 감상입니다. 세계관을 소개하는 방식이 친절해서 술술 읽혔습니다."],
  ["88888888-8888-4888-8888-000000000003", "harry-potter-novels", "question", "user-b", 3,
   "3권까지 읽으신 분들께",
   "3권 범위까지의 질문입니다. 번역본과 원서 중 어느 쪽으로 읽고 계신지 궁금합니다."],
  ["88888888-8888-4888-8888-000000000005", "harry-potter-novels", "recap", "user-b", 5,
   "5권까지의 짧은 후기",
   "여기까지 읽으면 분량이 늘어나는 게 체감됩니다. 천천히 읽는 걸 추천합니다."],

  // 마블 인피니티 사가 (영화 프랜차이즈, 편)
  ["99999999-9999-4999-8999-000000000003", "mcu-infinity-saga", "review", "user-a", 3,
   "개봉 순 3편까지의 감상",
   "3편까지 본 기준입니다. 작품마다 분위기가 달라서 순서대로 보는 재미가 있습니다."],
  ["99999999-9999-4999-8999-000000000010", "mcu-infinity-saga", "question", "user-b", 10,
   "10편까지 보신 분들께",
   "10편 범위까지의 질문입니다. 개봉 순과 시간 순 중 어느 쪽을 추천하시나요?"],
  ["99999999-9999-4999-8999-000000000015", "mcu-infinity-saga", "recap", "user-b", 15,
   "15편까지의 짧은 후기",
   "여기까지 보면 인물이 많아져서 메모하며 보게 됩니다."],

  // 다크 나이트 3부작 (영화 시리즈, 편)
  ["aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "dark-knight-trilogy", "review", "user-a", 1,
   "1편만 본 기준의 감상",
   "1편까지의 감상입니다. 도시를 담는 화면이 인상적이었습니다."],
  ["aaaaaaaa-aaaa-4aaa-8aaa-000000000003", "dark-knight-trilogy", "interpretation", "user-b", 3,
   "3편까지의 해석 메모",
   "3편 범위까지의 메모입니다. 세 편의 톤이 어떻게 달라지는지 적어 둡니다."],

  // 인터스텔라 (단일 영화)
  ["bbbbbbbb-bbbb-4bbb-8bbb-000000000001", "interstellar", "review", "user-b", 1,
   "본 사람끼리 나누는 감상",
   "작품을 본 분들과 나누는 감상입니다. 음악과 화면의 규모가 오래 기억에 남았습니다."],
  ["bbbbbbbb-bbbb-4bbb-8bbb-000000000002", "interstellar", "recap", "user-b", 1,
   "짧은 후기",
   "한 번에 몰입해서 보기 좋았습니다. 같은 작품을 본 분들과 이야기하고 싶어요."],

  // 기생충 (단일 영화)
  ["cccccccc-cccc-4ccc-8ccc-000000000001", "parasite", "review", "user-a", 1,
   "본 사람끼리 나누는 감상",
   "작품을 본 분들과 나누는 감상입니다. 공간을 활용한 연출이 특히 인상적이었습니다."],
  ["cccccccc-cccc-4ccc-8ccc-000000000002", "parasite", "interpretation", "user-a", 1,
   "공간 연출에 대한 메모",
   "본 사람 기준의 해석 메모입니다. 인물이 머무는 공간의 높낮이가 반복해서 쓰입니다."],
];

for (const [id, workId, board, author, stage, title, body] of seeds) {
  await db`insert into posts (id, work_id, board_type, author_id, title, body, max_stage, is_demo_seed)
    values (${id}, ${workId}, ${board}, ${author}, ${title}, ${body}, ${stage}, true)
    on conflict (id) do nothing`;
}

// 자유 게시판 시연 글. 진도 제한이 없으므로 max_stage는 0으로 넣고,
// 작품의 전개·결말을 적지 않은 잡담만 담는다.
const freeSeeds = [
  ["f0000000-0000-4000-8000-000000000001", "squid-game-s1", "user-a",
   "다들 몇 화씩 끊어서 보시나요",
   "진도 제한이 없는 방이라 편하게 물어봅니다. 저는 하루 한 화씩 보는 중인데, 몰아보는 분들도 많더라고요."],
  ["f0000000-0000-4000-8000-000000000002", "attack-on-titan-s1", "user-b",
   "아직 시작 전인 분들께",
   "작품 내용은 적지 않을게요. 한 화가 짧은 편이라 생각보다 진도가 빨리 나갑니다."],
  ["f0000000-0000-4000-8000-000000000003", "one-piece-manga", "user-a",
   "종이책과 전자책 중에 어떤 쪽으로 보세요",
   "권수가 많아서 보관이 고민입니다. 내용 이야기 없이 읽는 방법만 여쭤봐요."],
  ["f0000000-0000-4000-8000-000000000004", "interstellar", "user-a",
   "아직 안 본 사람도 들어올 수 있는 방",
   "이 게시판은 진도와 상관없이 열려 있어서, 작품 이야기 대신 언제 볼지 같은 잡담을 남겨요."],
];

for (const [id, workId, author, title, body] of freeSeeds) {
  await db`insert into posts (id, work_id, board_type, author_id, title, body, max_stage, is_demo_seed)
    values (${id}, ${workId}, 'free', ${author}, ${title}, ${body}, 0, true)
    on conflict (id) do nothing`;
}

// 시연 댓글. 댓글은 그 글이 지금 공개되는 사람에게만 보인다(판정은 조회할 때 서버에서 한다).
const commentSeeds = [
  ["c0000000-0000-4000-8000-000000000001", "11111111-1111-4111-8111-000000000003", "user-b",
   "같은 3화까지 본 입장에서 공감합니다. 인물 소개가 부담스럽지 않게 들어와서 좋았어요."],
  ["c0000000-0000-4000-8000-000000000002", "11111111-1111-4111-8111-000000000303", "user-b",
   "저도 이 구간까지는 편하게 봤습니다. 뒤 이야기는 여기서 말고 다른 글에서 이어가요."],
  ["c0000000-0000-4000-8000-000000000003", "cccccccc-cccc-4ccc-8ccc-000000000002", "user-a",
   "공간의 높낮이 이야기 잘 봤습니다. 다시 볼 때 그 부분을 눈여겨보려고요."],
  ["c0000000-0000-4000-8000-000000000004", "f0000000-0000-4000-8000-000000000001", "user-b",
   "저는 두 화씩 끊어 봅니다. 자유 게시판이라 진도 상관없이 이야기할 수 있어 좋네요."],
  ["c0000000-0000-4000-8000-000000000005", "11111111-1111-4111-8111-000000000102", "user-b",
   "저도 2화까지만 봤습니다. 같은 지점에서 궁금했던 걸 적어둘게요."],
];

// 답글(대댓글) 시연 데이터. parent_id로 위 댓글에 매단다.
const replySeeds = [
  ["c0000000-0000-4000-8000-000000000101", "11111111-1111-4111-8111-000000000003",
   "c0000000-0000-4000-8000-000000000001", "user-a",
   "읽어주셔서 고맙습니다. 같은 구간에서 비슷하게 느끼셨군요."],
];

for (const [id, postId, author, body] of commentSeeds) {
  await db`insert into comments (id, post_id, author_id, body, is_demo_seed)
    values (${id}, ${postId}, ${author}, ${body}, true)
    on conflict (id) do nothing`;
}

for (const [id, postId, parentId, author, body] of replySeeds) {
  await db`insert into comments (id, post_id, parent_id, author_id, body, is_demo_seed)
    values (${id}, ${postId}, ${parentId}, ${author}, ${body}, true)
    on conflict (id) do nothing`;
}

console.log("스키마 생성과 시연 데이터 등록을 완료했습니다.");
