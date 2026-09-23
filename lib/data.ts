import { sql } from "./db";
import type { BoardType } from "./boards";
import type { Stage, VisiblePost, Work } from "./types";

export async function listWorks(): Promise<Work[]> {
  const db = sql();
  return (await db`
    select id, board, title, description, progress_unit, category, origin, genre,
           poster_url, year, creator
    from works
    order by title
  `) as Work[];
}

export async function getWork(workId: string): Promise<Work | null> {
  const db = sql();
  const rows = (await db`
    select id, board, title, description, progress_unit, category, origin, genre,
           poster_url, year, creator
    from works where id = ${workId}
  `) as Work[];
  return rows[0] ?? null;
}

export async function listStages(workId: string): Promise<Stage[]> {
  const db = sql();
  return (await db`
    select stage_no, label from work_stages
    where work_id = ${workId}
    order by stage_no
  `) as Stage[];
}

/** 사용자 + 작품 조합의 진도. 기록이 없으면 0(아직 안 봄). */
export async function getProgress(userId: string, workId: string): Promise<number> {
  const db = sql();
  const rows = (await db`
    select stage_no from user_progress
    where user_id = ${userId} and work_id = ${workId}
  `) as { stage_no: number }[];
  return rows[0]?.stage_no ?? 0;
}

/** 진도 설정. 올리기와 낮추기 모두 같은 경로를 쓰며 글은 지우지 않는다. */
export async function setProgress(userId: string, workId: string, stageNo: number) {
  const db = sql();
  await db`
    insert into user_progress (user_id, work_id, stage_no)
    values (${userId}, ${workId}, ${stageNo})
    on conflict (user_id, work_id) do update set stage_no = excluded.stage_no
  `;
}

/**
 * 공개 가능한 글만 조회한다. 게시판·내 글 필터는 공개 조건에 AND로 덧붙을 뿐이므로
 * 제한된 글의 제목·본문·미리보기는 어떤 조합에서도 응답에 포함되지 않는다.
 */
export async function listVisiblePosts(
  userId: string,
  workId: string,
  boardType: BoardType,
  mineOnly = false
): Promise<VisiblePost[]> {
  const db = sql();
  const progress = await getProgress(userId, workId);
  return (await db`
    select p.id, p.work_id, p.board_type, p.author_id, u.display_name as author_name,
           p.title, p.body, p.max_stage, s.label as stage_label, p.is_demo_seed,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p
      join users u on u.id = p.author_id
      join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.work_id = ${workId}
      and p.board_type = ${boardType}
      and p.max_stage <= ${progress}
      and (${mineOnly} = false or p.author_id = ${userId})
    order by p.max_stage, p.created_at
  `) as VisiblePost[];
}

/** 게시판 탭에 표시할, 지금 읽을 수 있는 글 수. */
export async function countVisibleByBoard(
  userId: string,
  workId: string,
  mineOnly = false
): Promise<Record<string, number>> {
  const db = sql();
  const progress = await getProgress(userId, workId);
  const rows = (await db`
    select board_type, count(*)::int as c
    from posts
    where work_id = ${workId}
      and max_stage <= ${progress}
      and (${mineOnly} = false or author_id = ${userId})
    group by board_type
  `) as { board_type: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.board_type, r.c]));
}

/** 상세 조회도 같은 조건을 서버에서 적용한다. 차단 시 null. */
export async function getVisiblePost(
  userId: string,
  workId: string,
  postId: string
): Promise<VisiblePost | null> {
  const db = sql();
  const progress = await getProgress(userId, workId);
  const rows = (await db`
    select p.id, p.work_id, p.board_type, p.author_id, u.display_name as author_name,
           p.title, p.body, p.max_stage, s.label as stage_label, p.is_demo_seed,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p
      join users u on u.id = p.author_id
      join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.id = ${postId} and p.work_id = ${workId} and p.max_stage <= ${progress}
  `) as VisiblePost[];
  return rows[0] ?? null;
}

/** 수정 화면용. 본인 글이면서 지금 읽을 수 있는 글만 돌려준다. */
export async function getOwnPost(
  userId: string,
  workId: string,
  postId: string
): Promise<VisiblePost | null> {
  const post = await getVisiblePost(userId, workId, postId);
  return post && post.author_id === userId ? post : null;
}

export async function createPost(input: {
  workId: string;
  boardType: BoardType;
  authorId: string;
  title: string;
  body: string;
  maxStage: number;
}) {
  const db = sql();
  await db`
    insert into posts (work_id, board_type, author_id, title, body, max_stage, is_demo_seed)
    values (${input.workId}, ${input.boardType}, ${input.authorId}, ${input.title},
            ${input.body}, ${input.maxStage}, false)
  `;
}

/** 소유권은 SQL 조건으로 강제한다. 수정된 행이 없으면 권한이 없는 것이다. */
export async function updateOwnPost(input: {
  postId: string;
  workId: string;
  authorId: string;
  title: string;
  body: string;
  maxStage: number;
}): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    update posts set title = ${input.title}, body = ${input.body},
                     max_stage = ${input.maxStage}
    where id = ${input.postId} and work_id = ${input.workId}
      and author_id = ${input.authorId}
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function deleteOwnPost(
  postId: string,
  workId: string,
  authorId: string
): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    delete from posts
    where id = ${postId} and work_id = ${workId} and author_id = ${authorId}
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

export type WorkCard = Work & {
  total_stages: number;
  progress: number;
  progress_label: string | null;
};

/**
 * 작품 탐색 카드용 조회. 작품 메타와 내 진도만 읽으며 글은 건드리지 않는다.
 * (공개 판정과 무관한 표시용 데이터)
 */
export async function listWorkCards(
  userId: string,
  filter: { category?: string; origin?: string; genre?: string } = {}
): Promise<WorkCard[]> {
  const db = sql();
  const { category = null, origin = null, genre = null } = filter;
  return (await db`
    select w.id, w.board, w.title, w.description, w.progress_unit,
           w.category, w.origin, w.genre, w.poster_url, w.year, w.creator,
           (select count(*)::int from work_stages s where s.work_id = w.id) as total_stages,
           coalesce(up.stage_no, 0) as progress,
           (select s.label from work_stages s
             where s.work_id = w.id and s.stage_no = coalesce(up.stage_no, 0)) as progress_label
    from works w
      left join user_progress up on up.work_id = w.id and up.user_id = ${userId}
    where (${category}::text is null or w.category = ${category})
      and (${origin}::text is null or w.origin = ${origin})
      and (${genre}::text is null or w.genre = ${genre})
    order by w.board, w.title
  `) as WorkCard[];
}

/** 분야별 작품 수. 카테고리 화면의 인덱스에 쓴다. */
export async function countWorksByCategory(): Promise<Record<string, number>> {
  const db = sql();
  const rows = (await db`
    select category, count(*)::int as c from works
    where category is not null group by category
  `) as { category: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.category, r.c]));
}

/** 분야(+국내외) 아래의 장르 목록과 작품 수. */
export async function listGenres(
  category: string,
  origin?: string | null
): Promise<{ genre: string; c: number }[]> {
  const db = sql();
  const o = origin ?? null;
  return (await db`
    select genre, count(*)::int as c from works
    where category = ${category}
      and (${o}::text is null or origin = ${o})
      and genre is not null
    group by genre order by genre
  `) as { genre: string; c: number }[];
}

/** 분야 아래 국내/외국별 작품 수. */
export async function countByOrigin(category: string): Promise<Record<string, number>> {
  const db = sql();
  const rows = (await db`
    select origin, count(*)::int as c from works
    where category = ${category} and origin is not null
    group by origin
  `) as { origin: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.origin, r.c]));
}

/**
 * 지금 진도에서 아직 열리지 않은 글 수. 개수만 세고 제목·본문은 읽지 않는다.
 * 잠긴 글이 있다는 사실만 알려주기 위한 값이다.
 */
export async function countLockedByBoard(
  userId: string,
  workId: string
): Promise<Record<string, number>> {
  const db = sql();
  const progress = await getProgress(userId, workId);
  const rows = (await db`
    select board_type, count(*)::int as c
    from posts
    where work_id = ${workId} and max_stage > ${progress}
    group by board_type
  `) as { board_type: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.board_type, r.c]));
}

/** 진도를 옮겼을 때 새로 열린(또는 다시 잠긴) 글 수. 역시 개수만 센다. */
export async function countPostsBetween(
  workId: string,
  from: number,
  to: number
): Promise<number> {
  const db = sql();
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const rows = (await db`
    select count(*)::int as c from posts
    where work_id = ${workId} and max_stage > ${lo} and max_stage <= ${hi}
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}
