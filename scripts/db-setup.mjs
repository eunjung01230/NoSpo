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
  check (board_type in ('review','question','interpretation','recap'))`;
await db`create index if not exists posts_work_board_stage_idx
  on posts (work_id, board_type, max_stage)`;

await db`insert into users (id, display_name) values
  ('user-a', '시연 사용자 A'), ('user-b', '시연 사용자 B')
  on conflict (id) do nothing`;

// 작품은 운영 측에서 미리 등록한다. 장르·포맷마다 진도 단위가 다르므로 억지로 통일하지 않는다.
// 저작권 보호를 위해 작품명·포맷·진도 단위와 한 줄 소개만 저장한다.
const works = [
  {
    id: "squid-game-s1", board: "드라마(국내)", title: "오징어 게임 시즌 1",
    description: "정체불명의 게임에 초대된 참가자들을 다룬 한국 드라마. 시즌 1은 전 9화 구성입니다.",
    unit: "episode", stages: 9, suffix: "화",
    progress: { "user-a": 3, "user-b": 8 },
  },
  {
    id: "stranger-things-s1", board: "드라마(외국)", title: "기묘한 이야기 시즌 1",
    description: "작은 마을에서 벌어지는 사건을 다룬 미국 드라마. 시즌 1은 전 8화 구성입니다.",
    unit: "episode", stages: 8, suffix: "화",
    progress: { "user-a": 2, "user-b": 6 },
  },
  {
    id: "attack-on-titan-s1", board: "애니", title: "진격의 거인 시즌 1",
    description: "거인과 인류의 대립을 그린 일본 애니메이션. 시즌 1은 전 25화 구성입니다.",
    unit: "episode", stages: 25, suffix: "화",
    progress: { "user-a": 5, "user-b": 18 },
  },
  {
    id: "one-piece-manga", board: "만화", title: "원피스 (만화책)",
    description: "해적들의 대항해를 그린 일본 만화. 진도는 몇 권까지 읽었는지로 기록합니다.",
    unit: "volume", stages: 110, suffix: "권",
    progress: { "user-a": 12, "user-b": 60 },
  },
  {
    id: "solo-leveling-webtoon", board: "만화", title: "나 혼자만 레벨업 (웹툰)",
    description: "헌터들이 등장하는 한국 웹툰. 진도는 몇 화까지 읽었는지로 기록합니다.",
    unit: "episode", stages: 179, suffix: "화",
    progress: { "user-a": 20, "user-b": 95 },
  },
  {
    id: "harry-potter-novels", board: "책", title: "해리 포터 시리즈 (소설)",
    description: "마법 학교를 배경으로 한 판타지 소설 시리즈. 진도는 몇 권까지 읽었는지로 기록합니다.",
    unit: "volume", stages: 7, suffix: "권",
    progress: { "user-a": 2, "user-b": 5 },
  },
  {
    id: "mcu-infinity-saga", board: "영화(외국)", title: "마블 시네마틱 유니버스: 인피니티 사가",
    description: "여러 영화가 이어지는 미국 슈퍼히어로 프랜차이즈. 진도는 개봉 순으로 몇 편까지 봤는지 기록합니다.",
    unit: "film", stages: 23, suffix: "편",
    progress: { "user-a": 6, "user-b": 15 },
  },
  {
    id: "dark-knight-trilogy", board: "영화(외국)", title: "다크 나이트 3부작",
    description: "한 히어로를 다룬 영화 3부작. 진도는 몇 편까지 봤는지로 기록합니다.",
    unit: "film", stages: 3, suffix: "편",
    progress: { "user-a": 1, "user-b": 3 },
  },
  {
    id: "interstellar", board: "영화(외국)", title: "인터스텔라",
    description: "우주 탐사를 다룬 단일 영화. 회차가 없으므로 봤는지 여부만 기록합니다.",
    unit: "single", stages: 1, suffix: "", singleLabel: "봤다",
    progress: { "user-a": 0, "user-b": 1 },
  },
  {
    id: "parasite", board: "영화(국내)", title: "기생충",
    description: "두 가족을 둘러싼 이야기를 그린 한국 단일 영화. 봤는지 여부만 기록합니다.",
    unit: "single", stages: 1, suffix: "", singleLabel: "봤다",
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
  await db`insert into works (id, board, title, description, progress_unit)
    values (${w.id}, ${w.board}, ${w.title}, ${w.description}, ${w.unit})
    on conflict (id) do update set board = excluded.board, title = excluded.title,
      description = excluded.description, progress_unit = excluded.progress_unit`;
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

console.log("스키마 생성과 시연 데이터 등록을 완료했습니다.");
