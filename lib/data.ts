import { sql } from "./db";
import type { BoardType } from "./boards";
import type { Stage, VisiblePost, Work } from "./types";

export async function listWorks(): Promise<Work[]> {
  const db = sql();
  return (await db`
    select id, board, title, description, progress_unit
    from works
    order by title
  `) as Work[];
}

export async function getWork(workId: string): Promise<Work | null> {
  const db = sql();
  const rows = (await db`
    select id, board, title, description, progress_unit
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
