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

await db`insert into users (id, display_name) values
  ('user-a', '시연 사용자 A'), ('user-b', '시연 사용자 B')
  on conflict (id) do nothing`;

await db`insert into works (id, board, title, description, progress_unit) values
  ('squid-game-s1', '드라마(국내)', '오징어 게임 시즌 1',
   '빚에 몰린 참가자들이 정체불명의 게임에 초대되는 한국 드라마. 시즌 1은 전 9화 구성입니다.',
   'episode')
  on conflict (id) do nothing`;

for (let i = 1; i <= 9; i++) {
  await db`insert into work_stages (work_id, stage_no, label)
    values ('squid-game-s1', ${i}, ${i + "화"})
    on conflict (work_id, stage_no) do nothing`;
}

// 초기 진도: A=3화, B=8화. 이미 값이 있으면 사용자가 바꾼 것이므로 덮어쓰지 않는다.
await db`insert into user_progress (user_id, work_id, stage_no) values
  ('user-a', 'squid-game-s1', 3), ('user-b', 'squid-game-s1', 8)
  on conflict (user_id, work_id) do nothing`;

// 시연 글: 2·3·4·5·8화 범위. 실제 사건이나 결말을 지어내지 않은 스포일러 없는 감상.
const seeds = [
  ["11111111-1111-4111-8111-000000000002", "user-b", 2, "초반 분위기부터 몰입됐어요",
   "아직 2화까지만 이야기할게요. 화면 색감과 음악이 상황의 긴장을 잘 끌고 갑니다. 인물들이 각자 사정을 안고 모였다는 점이 초반부터 또렷하게 전해져서 다음 화가 궁금해졌어요."],
  ["11111111-1111-4111-8111-000000000003", "user-a", 3, "인물 소개가 촘촘합니다",
   "3화까지의 감상입니다. 짧은 장면 하나에도 인물의 성격이 드러나게 배치해 둔 점이 좋았습니다. 누구에게 마음이 가는지 친구들과 이야기해 보면 재미있을 것 같아요."],
  ["11111111-1111-4111-8111-000000000004", "user-b", 4, "긴장감이 한 단계 올라갑니다",
   "4화 범위까지만 적습니다. 이야기의 속도가 빨라지면서 인물들의 선택에 무게가 실리기 시작해요. 연출이 차분해서 오히려 더 조마조마했습니다."],
  ["11111111-1111-4111-8111-000000000005", "user-b", 5, "관계의 결이 달라지는 구간",
   "5화까지 본 기준의 감상입니다. 인물들 사이의 거리감이 조금씩 달라지는 게 보여서 대사 하나하나를 곱씹게 됐어요. 세부 내용은 적지 않을게요."],
  ["11111111-1111-4111-8111-000000000008", "user-b", 8, "후반부는 호흡이 길어집니다",
   "8화 범위까지의 감상입니다. 화면을 오래 머무르게 하는 장면이 늘어나면서 인물의 감정을 따라가게 됩니다. 여기까지 본 분들과 이야기 나누고 싶어요."],
];

for (const [id, author, stage, title, body] of seeds) {
  await db`insert into posts (id, work_id, author_id, title, body, max_stage, is_demo_seed)
    values (${id}, 'squid-game-s1', ${author}, ${title}, ${body}, ${stage}, true)
    on conflict (id) do nothing`;
}

console.log("스키마 생성과 시연 데이터 등록을 완료했습니다.");
