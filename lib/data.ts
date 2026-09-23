import { sql } from "./db";
import type { BoardType } from "./boards";
import type { Comment, Stage, VisiblePost, Work } from "./types";

export async function listWorks(): Promise<Work[]> {
  const db = sql();
  return (await db`
    select id, board, title, description, progress_unit, category, origin, genre,
           poster_url, year, creator, minutes_per_stage
    from works
    order by title
  `) as Work[];
}

export async function getWork(workId: string): Promise<Work | null> {
  const db = sql();
  const rows = (await db`
    select id, board, title, description, progress_unit, category, origin, genre,
           poster_url, year, creator, minutes_per_stage
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
           (select count(*)::int from comments c
              where c.post_id = p.id
                and coalesce(c.author_progress, p.max_stage) <= ${progress}) as comment_count,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p
      join users u on u.id = p.author_id
      left join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.work_id = ${workId}
      and p.board_type = ${boardType}
      and p.max_stage <= ${progress}
      and p.hidden_at is null
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
      and hidden_at is null
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
           (select count(*)::int from comments c where c.post_id = p.id) as comment_count,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p
      join users u on u.id = p.author_id
      left join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.id = ${postId} and p.work_id = ${workId} and p.max_stage <= ${progress}
      and p.hidden_at is null
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

/**
 * 글 등록. AI 사전 검토 결과도 같이 남긴다. 경고를 보고도 그대로 올린 글
 * (ai_acknowledged)은 관리자 화면의 '검토 필요' 목록에 쌓인다.
 */
export async function createPost(input: {
  workId: string;
  boardType: BoardType;
  authorId: string;
  title: string;
  body: string;
  maxStage: number;
  aiVerdict?: string | null;
  aiReason?: string | null;
  aiAcknowledged?: boolean;
}): Promise<string> {
  const db = sql();
  const rows = (await db`
    insert into posts (work_id, board_type, author_id, title, body, max_stage, is_demo_seed,
                       ai_verdict, ai_reason, ai_checked_at, ai_acknowledged)
    values (${input.workId}, ${input.boardType}, ${input.authorId}, ${input.title},
            ${input.body}, ${input.maxStage}, false,
            ${input.aiVerdict ?? null}, ${input.aiReason ?? null}, now(),
            ${input.aiAcknowledged ?? false})
    returning id
  `) as { id: string }[];
  return rows[0].id;
}

/** 소유권은 SQL 조건으로 강제한다. 수정된 행이 없으면 권한이 없는 것이다. */
export async function updateOwnPost(input: {
  postId: string;
  workId: string;
  authorId: string;
  title: string;
  body: string;
  maxStage: number;
  aiVerdict?: string | null;
  aiReason?: string | null;
  aiAcknowledged?: boolean;
}): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    update posts set title = ${input.title}, body = ${input.body},
                     max_stage = ${input.maxStage},
                     ai_verdict = ${input.aiVerdict ?? null},
                     ai_reason = ${input.aiReason ?? null},
                     ai_checked_at = now(),
                     ai_acknowledged = ${input.aiAcknowledged ?? false}
    where id = ${input.postId} and work_id = ${input.workId}
      and author_id = ${input.authorId} and hidden_at is null
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
           w.minutes_per_stage,
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
    where work_id = ${workId} and max_stage > ${progress} and hidden_at is null
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
      and hidden_at is null
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}

/**
 * 댓글 조회. 댓글은 글에 딸린 것이므로 권한도 글과 같다 —
 * 지금 그 글이 공개되지 않으면 댓글도 한 줄도 내려보내지 않는다.
 *
 * 글이 열려 있어도 댓글은 한 번 더 거른다: 댓글을 쓸 당시 작성자의 진도가
 * 읽는 사람의 지금 진도보다 앞서면 본문을 select에서 빼고 자리만 남긴다.
 * (CSS로 가리는 것이 아니라 본문이 서버 응답에 아예 담기지 않는다.)
 * 이 규칙은 글쓴이 본인에게도 똑같이 적용한다.
 * author_progress가 없는 예전 댓글은 글의 기준 회차로 메운다 — 그 글이 열렸다면
 * 기준 회차는 이미 읽는 사람의 진도 이하이므로 지금처럼 그대로 보인다.
 */
export async function listComments(
  userId: string,
  workId: string,
  postId: string
): Promise<Comment[] | null> {
  const post = await getVisiblePost(userId, workId, postId);
  if (!post) return null;
  const db = sql();
  const progress = await getProgress(userId, workId);
  return (await db`
    select c.id, c.post_id, c.parent_id, c.author_id, u.display_name as author_name,
           coalesce(c.author_progress, ${post.max_stage}) as author_progress,
           coalesce(c.author_progress, ${post.max_stage}) > ${progress} as locked,
           case when coalesce(c.author_progress, ${post.max_stage}) > ${progress}
                then null else c.body end as body,
           c.is_demo_seed,
           to_char(c.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from comments c
      join users u on u.id = c.author_id
    where c.post_id = ${postId}
    order by c.created_at
  `) as Comment[];
}

/** 댓글을 쓸 때 그 사람의 그때 진도를 함께 남긴다. 나중에 진도를 올려도 이 값은 그대로다. */
export async function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentId?: string | null;
  authorProgress: number;
}) {
  const db = sql();
  await db`
    insert into comments (post_id, parent_id, author_id, body, author_progress, is_demo_seed)
    values (${input.postId}, ${input.parentId ?? null}, ${input.authorId}, ${input.body},
            ${input.authorProgress}, false)
  `;
}

/**
 * 답글을 달 수 있는 댓글인지 확인한다. 같은 글에 달린 댓글이어야 하고,
 * 그 자신이 답글이면 안 된다(답글의 답글은 만들지 않는다).
 */
export async function canReplyTo(parentId: string, postId: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    select id from comments
    where id = ${parentId} and post_id = ${postId} and parent_id is null
  `) as { id: string }[];
  return rows.length > 0;
}

/** 댓글 삭제도 소유권을 SQL 조건으로 강제한다. 0행이면 권한 없음이다. */
export async function deleteOwnComment(
  commentId: string,
  postId: string,
  authorId: string
): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    delete from comments
    where id = ${commentId} and post_id = ${postId} and author_id = ${authorId}
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

export type Recommendation = Work & {
  total_stages: number;
  progress: number;
  /** 처음부터 끝까지 보는 데 드는 시간(분). minutes_per_stage가 없으면 0. */
  total_minutes: number;
  /** 지금 지점부터 끝까지 남은 시간(분). 시간 대비로 고를 때 쓰는 값이다. */
  left_minutes: number;
  genre_match: boolean;
  category_match: boolean;
};

/**
 * 내가 글을 쓴 작품들의 분야·장르를 모아, 아직 다 보지 않은 작품을 권한다.
 * 글의 내용은 읽지 않고 어느 작품에 썼는지만 본다(공개 판정과 무관한 작품 메타 추천).
 * 같은 장르 → 같은 분야 → 아직 시작하지 않은 것 → 남은 시간이 적은 것 순이다.
 */
export async function recommendWorks(
  userId: string,
  limit = 4
): Promise<Recommendation[]> {
  const db = sql();
  return (await db`
    with mine as (
      select distinct w.category, w.genre
      from posts p join works w on w.id = p.work_id
      where p.author_id = ${userId}
    ),
    base as (
      select w.*,
             (select count(*)::int from work_stages s where s.work_id = w.id) as total_stages,
             coalesce(up.stage_no, 0) as progress
      from works w
        left join user_progress up on up.work_id = w.id and up.user_id = ${userId}
    )
    select b.id, b.board, b.title, b.description, b.progress_unit,
           b.category, b.origin, b.genre, b.poster_url, b.year, b.creator,
           b.minutes_per_stage, b.total_stages, b.progress,
           coalesce(b.minutes_per_stage, 0) * b.total_stages as total_minutes,
           coalesce(b.minutes_per_stage, 0) * (b.total_stages - b.progress) as left_minutes,
           exists (select 1 from mine m where m.genre is not null and m.genre = b.genre)
             as genre_match,
           exists (select 1 from mine m where m.category is not null and m.category = b.category)
             as category_match
    from base b
    where b.progress < b.total_stages
    order by genre_match desc, category_match desc, (b.progress = 0) desc,
             left_minutes asc, b.title
    limit ${limit}
  `) as Recommendation[];
}

/** 추천 이유 한 줄. 화면 문구를 한 곳에서만 만든다. */
export function recommendReason(r: Recommendation) {
  const started = r.progress > 0;
  if (r.genre_match && r.genre) {
    return started
      ? `내가 글을 남긴 ${r.genre} 작품 · 이어보기`
      : `내가 글을 남긴 ${r.genre} 작품과 같은 장르`;
  }
  if (r.category_match) {
    return started ? "내가 글을 남긴 분야 · 이어보기" : "내가 글을 남긴 분야의 새 작품";
  }
  return started ? "이어보기" : "시간이 적게 드는 것부터";
}

/** 추천 문구를 고르기 위한 값. 내가 쓴 글의 개수만 센다. */
export async function countMyPosts(userId: string): Promise<number> {
  const db = sql();
  const rows = (await db`
    select count(*)::int as c from posts where author_id = ${userId}
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}

/* ── 신고 · 경고 · 관리자 ───────────────────────────────────────────────
   공개 판정(max_stage <= 진도)은 그대로 두고 그 위에 얹는 안전장치다.
   숨긴 글은 위의 조회 함수들이 모두 hidden_at is null로 걸러내므로, 여기서만 읽는다. */

/** 이 사람이 이 글을 이미 신고했는가. 같은 글은 한 사람당 1건만 센다. */
export async function hasReported(postId: string, reporterId: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    select 1 from post_reports where post_id = ${postId} and reporter_id = ${reporterId}
  `) as unknown[];
  return rows.length > 0;
}

/**
 * 신고 접수. 신고가 기준치만큼 쌓이면 그 자리에서 글을 가리고 작성자에게 경고를 1건 남긴다.
 * 관리자가 숨김을 풀면 그 글로 생긴 경고도 함께 사라진다(unhidePost).
 */
export async function reportPost(input: {
  postId: string;
  reporterId: string;
  reason: string;
  detail: string | null;
  threshold: number;
}): Promise<{ count: number; hidden: boolean }> {
  const db = sql();
  await db`
    insert into post_reports (post_id, reporter_id, reason, detail)
    values (${input.postId}, ${input.reporterId}, ${input.reason}, ${input.detail})
    on conflict (post_id, reporter_id) do update
      set reason = excluded.reason, detail = excluded.detail
  `;
  const counted = (await db`
    select count(*)::int as c from post_reports where post_id = ${input.postId}
  `) as { c: number }[];
  const count = counted[0]?.c ?? 0;
  if (count < input.threshold) return { count, hidden: false };

  // 이미 가려진 글이면 경고를 두 번 세지 않는다(0행이면 아무 일도 하지 않는다).
  const hidden = (await db`
    update posts set hidden_at = now(), hidden_reason = 'reports'
    where id = ${input.postId} and hidden_at is null
    returning author_id
  `) as { author_id: string }[];
  if (hidden.length > 0) {
    await db`
      insert into user_warnings (user_id, post_id, source, note)
      values (${hidden[0].author_id}, ${input.postId}, 'reports',
              ${`신고 ${count}건으로 글이 가려졌습니다.`})
    `;
  }
  return { count, hidden: true };
}

/** 누적 경고 수. 글쓰기 정지 판단은 항상 이 값으로 서버에서 한다. */
export async function countWarnings(userId: string): Promise<number> {
  const db = sql();
  const rows = (await db`
    select count(*)::int as c from user_warnings where user_id = ${userId}
  `) as { c: number }[];
  return rows[0]?.c ?? 0;
}

/** 작성자 본인에게만, 자기 글이 가려졌다는 사실을 알려주기 위한 조회(내용은 주지 않는다). */
export async function getHiddenOwnPost(
  userId: string,
  workId: string,
  postId: string
): Promise<{ hidden_reason: string | null; report_count: number } | null> {
  const db = sql();
  const rows = (await db`
    select p.hidden_reason,
           (select count(*)::int from post_reports r where r.post_id = p.id) as report_count
    from posts p
    where p.id = ${postId} and p.work_id = ${workId}
      and p.author_id = ${userId} and p.hidden_at is not null
  `) as { hidden_reason: string | null; report_count: number }[];
  return rows[0] ?? null;
}

export type ModerationPost = {
  id: string;
  work_id: string;
  work_title: string;
  board_type: BoardType;
  author_id: string;
  author_name: string;
  title: string;
  max_stage: number;
  stage_label: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
  ai_verdict: string | null;
  ai_reason: string | null;
  ai_acknowledged: boolean;
  report_count: number;
  reasons: string | null;
  created_at: string;
};

const MODERATION_COLUMNS = `
  p.id, p.work_id, w.title as work_title, p.board_type, p.author_id,
  u.display_name as author_name, p.title, p.max_stage, s.label as stage_label,
  to_char(p.hidden_at, 'YYYY-MM-DD HH24:MI') as hidden_at, p.hidden_reason,
  p.ai_verdict, p.ai_reason, p.ai_acknowledged,
  (select count(*)::int from post_reports r where r.post_id = p.id) as report_count,
  (select string_agg(distinct r.reason, ',') from post_reports r where r.post_id = p.id) as reasons,
  to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
`;

/** 신고가 한 건이라도 있는 글. 가려진 글이 먼저 온다. */
export async function listReportedPosts(): Promise<ModerationPost[]> {
  const db = sql();
  return (await db`
    select ${db.unsafe(MODERATION_COLUMNS)}
    from posts p
      join works w on w.id = p.work_id
      join users u on u.id = p.author_id
      left join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where exists (select 1 from post_reports r where r.post_id = p.id)
    order by (p.hidden_at is not null) desc, report_count desc, p.created_at desc
  `) as ModerationPost[];
}

/**
 * AI가 경고했는데 작성자가 그대로 올린 글. 등록을 막지 않는 대신 여기에 쌓아 두고
 * 관리자가 직접 읽어 본다. 검토가 끝나면 ai_verdict를 'reviewed'로 바꾼다.
 */
export async function listAiFlaggedPosts(): Promise<ModerationPost[]> {
  const db = sql();
  return (await db`
    select ${db.unsafe(MODERATION_COLUMNS)}
    from posts p
      join works w on w.id = p.work_id
      join users u on u.id = p.author_id
      left join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.ai_verdict = 'warn'
    order by p.created_at desc
  `) as ModerationPost[];
}

export type WarnedUser = {
  id: string;
  display_name: string;
  warnings: number;
  reports_made: number;
};

/** 사용자별 경고·신고 현황. 관리자 화면의 마지막 표다. */
export async function listUserStanding(): Promise<WarnedUser[]> {
  const db = sql();
  return (await db`
    select u.id, u.display_name,
           (select count(*)::int from user_warnings w where w.user_id = u.id) as warnings,
           (select count(*)::int from post_reports r where r.reporter_id = u.id) as reports_made
    from users u
    where u.is_admin = false
    order by warnings desc, u.display_name
  `) as WarnedUser[];
}

/** 숨김 해제. 그 글 때문에 생긴 경고도 함께 지운다(잘못 가려진 글이었다는 뜻이므로). */
export async function unhidePost(postId: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    update posts set hidden_at = null, hidden_reason = null
    where id = ${postId} and hidden_at is not null
    returning id
  `) as { id: string }[];
  if (rows.length === 0) return false;
  await db`delete from user_warnings where post_id = ${postId}`;
  return true;
}

/** 관리자가 직접 가리기. 작성자에게 경고가 1건 쌓인다. */
export async function hidePostByAdmin(postId: string, note: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    update posts set hidden_at = now(), hidden_reason = 'admin'
    where id = ${postId} and hidden_at is null
    returning author_id
  `) as { author_id: string }[];
  if (rows.length === 0) return false;
  await db`
    insert into user_warnings (user_id, post_id, source, note)
    values (${rows[0].author_id}, ${postId}, 'admin', ${note})
  `;
  return true;
}

/** AI 경고를 관리자가 읽고 넘긴 표시. 글은 그대로 두고 목록에서만 내린다. */
export async function resolveAiFlag(postId: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    update posts set ai_verdict = 'reviewed' where id = ${postId} and ai_verdict = 'warn'
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

/** 경고 1건 취소. 관리자가 과했다고 판단했을 때 쓴다. */
export async function revokeLatestWarning(userId: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    delete from user_warnings
    where id = (select id from user_warnings where user_id = ${userId}
                order by created_at desc limit 1)
    returning id
  `) as { id: string }[];
  return rows.length > 0;
}

/**
 * 관리자 열람. 신고를 판단하려면 글을 직접 읽어야 하므로, 관리자에게만 진도 조건과
 * 숨김 조건을 빼고 글을 내려보낸다. 호출하는 쪽에서 requireAdmin()으로 막는다.
 */
export async function getPostAsAdmin(
  workId: string,
  postId: string
): Promise<(VisiblePost & { hidden_at: string | null }) | null> {
  const db = sql();
  const rows = (await db`
    select p.id, p.work_id, p.board_type, p.author_id, u.display_name as author_name,
           p.title, p.body, p.max_stage, s.label as stage_label, p.is_demo_seed,
           to_char(p.hidden_at, 'YYYY-MM-DD HH24:MI') as hidden_at,
           (select count(*)::int from comments c where c.post_id = p.id) as comment_count,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from posts p
      join users u on u.id = p.author_id
      left join work_stages s on s.work_id = p.work_id and s.stage_no = p.max_stage
    where p.id = ${postId} and p.work_id = ${workId}
  `) as (VisiblePost & { hidden_at: string | null })[];
  return rows[0] ?? null;
}

/* ── 작품 검색 · 작품 등록 ─────────────────────────────────────────────
   검색은 작품 메타(제목·제작자·한 줄 소개)만 훑는다. 글은 검색하지 않으므로
   잠긴 글의 제목·본문이 검색 결과로 새어 나갈 길이 없다. */

/** 작품 검색. 카드에 필요한 값은 탐색 화면과 같은 모양으로 돌려준다. */
export async function searchWorks(userId: string, query: string): Promise<WorkCard[]> {
  const q = query.trim();
  if (!q) return [];
  const db = sql();
  const like = `%${q}%`;
  return (await db`
    select w.id, w.board, w.title, w.description, w.progress_unit,
           w.category, w.origin, w.genre, w.poster_url, w.year, w.creator,
           w.minutes_per_stage,
           (select count(*)::int from work_stages s where s.work_id = w.id) as total_stages,
           coalesce(up.stage_no, 0) as progress,
           (select s.label from work_stages s
             where s.work_id = w.id and s.stage_no = coalesce(up.stage_no, 0)) as progress_label
    from works w
      left join user_progress up on up.work_id = w.id and up.user_id = ${userId}
    where w.title ilike ${like}
       or coalesce(w.creator, '') ilike ${like}
       or w.description ilike ${like}
    order by (w.title ilike ${q + "%"}) desc, w.title
    limit 40
  `) as WorkCard[];
}

/** 같은 제목이 이미 있는지. 중복 등록 대신 기존 작품으로 안내하기 위한 조회다. */
export async function findWorkByTitle(title: string): Promise<{ id: string; title: string } | null> {
  const db = sql();
  const rows = (await db`
    select id, title from works where lower(trim(title)) = lower(trim(${title})) limit 1
  `) as { id: string; title: string }[];
  return rows[0] ?? null;
}

export async function workExists(id: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`select 1 from works where id = ${id}`) as unknown[];
  return rows.length > 0;
}

/**
 * 새 작품 등록. 회차는 작품 등록과 한 묶음이라 여기서 함께 만든다.
 * 단일 작품(progress_unit = single)은 단계가 하나뿐이고 이름은 '봤다'이다.
 */
export async function createWork(input: {
  id: string;
  title: string;
  description: string;
  category: string;
  origin: string | null;
  genre: string | null;
  progressUnit: string;
  stages: number;
  unitSuffix: string;
  minutesPerStage: number | null;
  boardLabel: string;
  year: string | null;
  creator: string | null;
  posterUrl: string | null;
  createdBy: string;
}) {
  const db = sql();
  await db`
    insert into works (id, board, title, description, progress_unit, category, origin, genre,
                       year, creator, poster_url, minutes_per_stage, created_by)
    values (${input.id}, ${input.boardLabel}, ${input.title}, ${input.description},
            ${input.progressUnit}, ${input.category}, ${input.origin}, ${input.genre},
            ${input.year}, ${input.creator}, ${input.posterUrl}, ${input.minutesPerStage},
            ${input.createdBy})
  `;
  if (input.progressUnit === "single") {
    await db`
      insert into work_stages (work_id, stage_no, label) values (${input.id}, 1, '봤다')
      on conflict (work_id, stage_no) do nothing
    `;
  } else {
    await db`
      insert into work_stages (work_id, stage_no, label)
      select ${input.id}, i, i || ${input.unitSuffix} from generate_series(1, ${input.stages}) as i
      on conflict (work_id, stage_no) do nothing
    `;
  }
}

/** 작품 수정·삭제 권한. 등록한 사람 본인과 관리자만이며, 판정은 항상 서버에서 한다. */
export async function canEditWork(workId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const db = sql();
  const rows = (await db`
    select 1 from works where id = ${workId} and created_by = ${userId}
  `) as unknown[];
  return rows.length > 0;
}

/** 이 작품에 달린 글 수와, 실제로 쓰이고 있는 가장 뒤 회차. 회차를 줄여도 되는지 판단한다. */
export async function workUsage(workId: string): Promise<{ posts: number; maxUsedStage: number }> {
  const db = sql();
  const rows = (await db`
    select (select count(*)::int from posts p where p.work_id = ${workId}) as posts,
           greatest(
             coalesce((select max(max_stage) from posts p where p.work_id = ${workId}), 0),
             coalesce((select max(stage_no) from user_progress up where up.work_id = ${workId}), 0)
           ) as max_used_stage
  `) as { posts: number; max_used_stage: number }[];
  return { posts: rows[0]?.posts ?? 0, maxUsedStage: rows[0]?.max_used_stage ?? 0 };
}

/**
 * 작품 수정. 진도 단위는 회차·글과 얽혀 있어 여기서 바꾸지 않고, 회차 수만 조정한다.
 * 회차를 늘리면 뒤에 단계를 더 만들고, 줄이면 쓰이지 않는 뒤 단계만 지운다
 * (쓰이는 회차가 남아 있으면 호출하는 쪽에서 미리 막는다).
 */
export async function updateWork(input: {
  id: string;
  title: string;
  description: string;
  category: string;
  origin: string | null;
  genre: string | null;
  boardLabel: string;
  stages: number;
  unitSuffix: string;
  minutesPerStage: number | null;
  year: string | null;
  creator: string | null;
  posterUrl: string | null;
}) {
  const db = sql();
  await db`
    update works set title = ${input.title}, description = ${input.description},
                     category = ${input.category}, origin = ${input.origin},
                     genre = ${input.genre}, board = ${input.boardLabel},
                     minutes_per_stage = ${input.minutesPerStage},
                     year = ${input.year}, creator = ${input.creator},
                     poster_url = ${input.posterUrl}
    where id = ${input.id}
  `;
  await db`
    insert into work_stages (work_id, stage_no, label)
    select ${input.id}, i, i || ${input.unitSuffix} from generate_series(1, ${input.stages}) as i
    on conflict (work_id, stage_no) do nothing
  `;
  await db`delete from work_stages where work_id = ${input.id} and stage_no > ${input.stages}`;
}

/** 작품 삭제. 글이 하나라도 있으면 호출하는 쪽에서 막는다(글을 말없이 지우지 않기 위해). */
export async function deleteWork(workId: string) {
  const db = sql();
  await db`delete from works where id = ${workId}`;
}
