import { sql } from "./db";
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

export async function setProgress(userId: string, workId: string, stageNo: number) {
  const db = sql();
  await db`
    insert into user_progress (user_id, work_id, stage_no)
    values (${userId}, ${workId}, ${stageNo})
    on conflict (user_id, work_id) do update set stage_no = excluded.stage_no
  `;
}

/**
 * 공개 가능한 글만 조회한다. 제한된 글의 제목·본문·미리보기는 SQL 단계에서
 * 제외되므로 응답이나 초기 전달 데이터에 포함되지 않는다.
 */
export async function listVisiblePosts(
  userId: string,
  workId: string
): Promise<VisiblePost[]> {
  const db = sql();
  const progress = await getProgress(userId, workId);
  return (await db`
    select p.id, p.work_id, u.display_name as author_name, p.title, p.body,
           p.max_stage, p.is_demo_seed, to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p join users u on u.id = p.author_id
    where p.work_id = ${workId} and p.max_stage <= ${progress}
    order by p.max_stage, p.created_at
  `) as VisiblePost[];
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
    select p.id, p.work_id, u.display_name as author_name, p.title, p.body,
           p.max_stage, p.is_demo_seed, to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p join users u on u.id = p.author_id
    where p.id = ${postId} and p.work_id = ${workId} and p.max_stage <= ${progress}
  `) as VisiblePost[];
  return rows[0] ?? null;
}

export async function createPost(input: {
  workId: string;
  authorId: string;
  title: string;
  body: string;
  maxStage: number;
}) {
  const db = sql();
  await db`
    insert into posts (work_id, author_id, title, body, max_stage, is_demo_seed)
    values (${input.workId}, ${input.authorId}, ${input.title}, ${input.body},
            ${input.maxStage}, false)
  `;
}
