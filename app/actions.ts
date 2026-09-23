"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  DEMO_USER_COOKIE,
  getCurrentUser,
  listDemoUsers,
  requireAdmin,
} from "@/lib/session";
import {
  canReplyTo,
  countWarnings,
  createComment,
  createPost,
  canEditWork,
  createWork,
  deleteOwnComment,
  deleteWork,
  findWorkByTitle,
  updateWork,
  workUsage,
  deleteOwnPost,
  getOwnPost,
  getProgress,
  getVisiblePost,
  getWork,
  hidePostByAdmin,
  listStages,
  reportPost,
  resolveAiFlag,
  revokeLatestWarning,
  setProgress,
  unhidePost,
  updateOwnPost,
  workExists,
} from "@/lib/data";
import {
  POST_BODY_MAX,
  POST_TITLE_MAX,
  REPORT_HIDE_THRESHOLD,
  WARNING_BLOCK_THRESHOLD,
  isReportReason,
  type Screening,
} from "@/lib/moderation";
import {
  reasonForDb,
  screenForSave,
  verdictForDb,
  type ScreeningScope,
} from "@/lib/screening";
import {
  BOARD_COMMENTS,
  BOARD_LABELS,
  commentNoun,
  boardPath,
  isProgressUnit,
  toBoardType,
  unitNoun,
} from "@/lib/boards";
import { boardLabelFor, isCategory, isOrigin, usesOrigin } from "@/lib/categories";
import { resolveCandidate, searchArtwork, type ArtworkCandidate } from "@/lib/artwork-lookup";

/** 시연 사용자 전환. 쿠키에는 서버에서 확인한 사용자 id만 저장한다. */
export async function switchUserAction(formData: FormData) {
  const wanted = String(formData.get("userId") ?? "");
  const users = await listDemoUsers();
  if (!users.some((u) => u.id === wanted)) {
    throw new Error("등록되지 않은 시연 사용자입니다.");
  }
  const jar = await cookies();
  jar.set(DEMO_USER_COOKIE, wanted, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/", "layout");
  const back = String(formData.get("redirectTo") ?? "/");
  redirect(back.startsWith("/") ? back : "/");
}

/**
 * 진도 설정. 올리기와 낮추기 모두 여기로 들어오고, 존재하는 회차인지 서버에서
 * 확인한다. 낮추면 그 이후 글은 조회 단계에서 다시 제외되며 글은 지우지 않는다.
 */
export async function setProgressAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const stageNo = Number(formData.get("stageNo"));
  const stages = await listStages(workId);
  const allowed = stageNo === 0 || stages.some((s) => s.stage_no === stageNo);
  if (!Number.isInteger(stageNo) || !allowed) {
    throw new Error("작품에 존재하지 않는 회차입니다.");
  }
  const before = await getProgress(user.id, workId);
  await setProgress(user.id, workId, stageNo);
  revalidatePath(`/works/${workId}`, "layout");
  // 무엇이 달라졌는지 화면에서 알려주기 위해 이전 진도만 넘긴다(글 내용은 넘기지 않는다).
  if (before !== stageNo) redirect(`/works/${workId}?from=${before}`);
}

export type PostFormState = {
  error?: string;
  /**
   * AI 사전 검토 결과. '문제 없음'이 아니면 저장하지 않고 이것만 돌려준다 — 작성자가
   * 회차를 고쳐 쓸지 이대로 올릴지 정한다(이대로 올려도 공개 판정은 max_stage 그대로다).
   * 서버가 고정 문구에서 고른 것만 담기며, AI의 자유 서술이나 원인 코드는 싣지 않는다.
   */
  screening?: Screening;
  /** 위 결과에 대한 서버 서명. 같은 내용으로 저장할 때 AI를 다시 부르지 않는 데 쓴다. */
  receipt?: string;
  /**
   * 되돌려주는 입력값. 서버 액션이 끝나면 React가 폼을 초기화하므로, 경고를 보여주고
   * 다시 고쳐 쓰게 하려면 쓰던 내용을 그대로 돌려줘야 한다(화면에서 defaultValue로 쓴다).
   */
  values?: { title: string; body: string; maxStage: number };
};

/**
 * 작성·수정 공통 검증: 빈 제목·본문, 길이, 없는 회차, 내 진도 초과를 서버에서 막는다.
 * 게시판에 따른 예외는 없다. 자유 게시판도 회차를 받아 같은 공개 조건
 * (`max_stage <= 읽는 사람의 진도`)을 그대로 따른다.
 */
async function validate(
  userId: string,
  workId: string,
  title: string,
  body: string,
  maxStage: number
) {
  if (!title) return "제목을 입력해 주세요.";
  if (!body) return "본문을 입력해 주세요.";
  if (title.length > POST_TITLE_MAX) return `제목은 ${POST_TITLE_MAX}자까지 쓸 수 있습니다.`;
  if (body.length > POST_BODY_MAX) return `본문은 ${POST_BODY_MAX}자까지 쓸 수 있습니다.`;
  const stages = await listStages(workId);
  if (!Number.isInteger(maxStage) || !stages.some((s) => s.stage_no === maxStage)) {
    return "작품에 존재하지 않는 회차입니다.";
  }
  // 작성자의 진도보다 앞선 회차는 고를 수 없다.
  if (maxStage > (await getProgress(userId, workId))) {
    return "내 감상 진도까지의 회차만 선택할 수 있습니다.";
  }
  return null;
}

/** 폼이 보낸 회차 값. 모든 게시판이 같은 필드를 쓴다. */
function stageFromForm(formData: FormData) {
  return Number(formData.get("maxStage"));
}

/** 경고가 쌓인 사용자는 새 글·수정을 멈춘다. 판정은 항상 DB의 누적 경고 수로 한다. */
async function blockedByWarnings(userId: string): Promise<string | null> {
  const warnings = await countWarnings(userId);
  if (warnings < WARNING_BLOCK_THRESHOLD) return null;
  return `신고가 확인된 글이 ${warnings}건 있어 글쓰기가 멈춰 있습니다. 관리자 확인 후 다시 쓸 수 있습니다.`;
}

/** 폼에서 검토 단계에 필요한 값을 꺼내고, 영수증을 못 쓸 때만 작품·회차 이름을 읽는다. */
function screenPostForm(formData: FormData, scope: ScreeningScope) {
  return screenForSave({
    scope,
    receipt: formData.get("screenReceipt"),
    confirmed: formData.get("aiConfirmed") === "1",
    checkOnly: formData.get("intent") === "check",
    loadInput: async () => {
      const [work, stages] = await Promise.all([getWork(scope.workId), listStages(scope.workId)]);
      return {
        workTitle: work?.title ?? "",
        boardType: scope.boardType,
        stageLabel: stages.find((s) => s.stage_no === scope.maxStage)?.label ?? null,
        totalStages: stages.length,
        maxStage: scope.maxStage,
        title: scope.title,
        body: scope.body,
      };
    },
  });
}

export async function createPostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const boardType = toBoardType(formData.get("boardType"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = stageFromForm(formData);

  const values = { title, body, maxStage };
  const error = await validate(user.id, workId, title, body, maxStage);
  if (error) return { error, values };
  const blocked = await blockedByWarnings(user.id);
  if (blocked) return { error: blocked, values };

  const { screening, receipt, mustShow } = await screenPostForm(formData, {
    userId: user.id, workId, postId: "new", boardType, maxStage, title, body,
  });
  if (mustShow) return { screening, receipt, values };

  await createPost({
    workId, boardType, authorId: user.id, title, body, maxStage,
    aiVerdict: verdictForDb(screening),
    aiReason: screening.status === "clear" ? null : reasonForDb(screening),
    aiAcknowledged: screening.status !== "clear",
  });
  revalidatePath(`/works/${workId}`);
  redirect(boardPath(workId, boardType));
}

/**
 * 수정. 소유권은 SQL 조건으로 확인하고 클라이언트가 보낸 작성자 값은 믿지 않는다.
 * 제목·본문·회차가 바뀌면 영수증이 맞지 않으므로 수정본을 다시 검토한다.
 */
export async function updatePostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = stageFromForm(formData);

  const values = { title, body, maxStage };
  const error = await validate(user.id, workId, title, body, maxStage);
  if (error) return { error, values };
  const blocked = await blockedByWarnings(user.id);
  if (blocked) return { error: blocked, values };

  const own = await getOwnPost(user.id, workId, postId);
  if (!own) return { error: "내가 쓴 글만 수정할 수 있습니다.", values };

  // 게시판은 글에 이미 정해진 값을 쓴다(폼 값은 믿지 않는다).
  const { screening, receipt, mustShow } = await screenPostForm(formData, {
    userId: user.id, workId, postId, boardType: own.board_type, maxStage, title, body,
  });
  if (mustShow) return { screening, receipt, values };

  const ok = await updateOwnPost({
    postId, workId, authorId: user.id, title, body, maxStage,
    aiVerdict: verdictForDb(screening),
    aiReason: screening.status === "clear" ? null : reasonForDb(screening),
    aiAcknowledged: screening.status !== "clear",
  });
  if (!ok) return { error: "내가 쓴 글만 수정할 수 있습니다.", values };

  revalidatePath(`/works/${workId}`);
  redirect(`/works/${workId}/posts/${postId}`);
}

export async function deletePostAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const boardType = toBoardType(formData.get("boardType"));

  const ok = await deleteOwnPost(postId, workId, user.id);
  if (!ok) throw new Error("내가 쓴 글만 삭제할 수 있습니다.");

  revalidatePath(`/works/${workId}`);
  redirect(boardPath(workId, boardType));
}

export type CommentFormState = { error?: string };

/** 댓글 id는 uuid다. 형식이 아니면 조회 단계에서 터지므로 먼저 걸러낸다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 댓글 작성. 댓글을 달 권한은 '그 글이 지금 나에게 공개되는가'와 같다.
 * 글이 잠겨 있으면 글 내용을 받지 못하듯 댓글도 남길 수 없다.
 */
export async function createCommentAction(
  _prev: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;

  const post = await getVisiblePost(user.id, workId, postId);
  if (!post) return { error: "지금 읽을 수 없는 글에는 댓글을 남길 수 없습니다." };
  if (!BOARD_COMMENTS[post.board_type]) {
    return { error: `${BOARD_LABELS[post.board_type]} 게시판은 댓글을 받지 않습니다.` };
  }
  // 게시판마다 부르는 말이 다르다(질문 게시판은 답글).
  const noun = parentId ? "답글" : commentNoun(post.board_type);

  if (!body) return { error: `${noun} 내용을 입력해 주세요.` };
  if (body.length > 1000) return { error: `${noun}은 1000자까지 쓸 수 있습니다.` };
  // 답글은 한 단계까지만 — 답글에 다시 답글을 달 수는 없다.
  if (parentId && (!UUID.test(parentId) || !(await canReplyTo(parentId, postId)))) {
    return { error: "답글을 달 수 없는 댓글입니다." };
  }

  // 지금 내 진도를 함께 남긴다. 나보다 앞서 본 사람의 댓글은 뒤에 있는 사람에게 감춰진다.
  const authorProgress = await getProgress(user.id, workId);
  await createComment({ postId, authorId: user.id, body, parentId, authorProgress });
  revalidatePath(`/works/${workId}/posts/${postId}`);
  return {};
}

/** 댓글 삭제. 소유권은 SQL 조건으로 강제한다. */
export async function deleteCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  if (!UUID.test(commentId)) throw new Error("잘못된 댓글입니다.");

  // 글 자체가 지금 잠겨 있으면 댓글도 건드리지 않는다.
  const post = await getVisiblePost(user.id, workId, postId);
  if (!post) throw new Error("지금 읽을 수 없는 글입니다.");

  const ok = await deleteOwnComment(commentId, postId, user.id);
  if (!ok) throw new Error("내가 쓴 댓글만 삭제할 수 있습니다.");

  revalidatePath(`/works/${workId}/posts/${postId}`);
}

export type ReportFormState = { error?: string; done?: string };

/**
 * 스포일러 신고. 신고할 수 있는 권한은 '그 글이 지금 나에게 공개되는가'와 같다 —
 * 읽을 수 없는 글은 신고도 할 수 없다. 신고가 기준만큼 쌓이면 글은 자동으로 가려지고
 * 작성자에게 경고가 1건 쌓이며, 되돌리는 것은 관리자만 할 수 있다.
 */
export async function reportPostAction(
  _prev: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const reason = formData.get("reason");
  const detail = String(formData.get("detail") ?? "").trim();

  if (!isReportReason(reason)) return { error: "신고 사유를 선택해 주세요." };

  const post = await getVisiblePost(user.id, workId, postId);
  if (!post) return { error: "지금 읽을 수 없는 글은 신고할 수 없습니다." };
  if (post.author_id === user.id) return { error: "내가 쓴 글은 신고할 수 없습니다." };

  const { count, hidden } = await reportPost({
    postId,
    reporterId: user.id,
    reason,
    detail: detail || null,
    threshold: REPORT_HIDE_THRESHOLD,
  });

  revalidatePath(`/works/${workId}`, "layout");
  return {
    done: hidden
      ? `신고 ${count}건이 모여 이 글은 가려졌습니다. 관리자가 확인합니다.`
      : `신고를 접수했습니다. ${REPORT_HIDE_THRESHOLD}건이 모이면 글이 가려집니다. (현재 ${count}건)`,
  };
}

/* ── 관리자 동작. 모든 진입점에서 requireAdmin()으로 다시 확인한다. ── */

export async function unhidePostAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  await unhidePost(postId);
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function hidePostAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  await hidePostByAdmin(postId, "관리자가 직접 가린 글입니다.");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function resolveAiFlagAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  await resolveAiFlag(postId);
  revalidatePath("/admin");
}

export async function revokeWarningAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  await revokeLatestWarning(userId);
  revalidatePath("/admin");
}

export type WorkFormState = {
  error?: string;
  values?: Record<string, string>;
};

/** 제목으로 작품 id를 만든다. 한글 제목은 슬러그로 남지 않으므로 짧은 임의 문자열을 붙인다. */
function workIdFrom(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `work-${suffix}`;
}

/**
 * 새 작품 등록. 저작권 보호를 위해 작품명·분야·진도 단위·한 줄 소개만 받고,
 * 포스터 주소와 연도·제작자는 공개 API에서 한 번 찾아 채운다(실패해도 등록은 진행된다).
 * 회차 표기는 여기서 만들어 두고, 화면에서는 work_stages의 label만 읽는다.
 */
export async function createWorkAction(
  _prev: WorkFormState,
  formData: FormData
): Promise<WorkFormState> {
  const user = await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const originRaw = String(formData.get("origin") ?? "");
  const genre = String(formData.get("genre") ?? "").trim();
  const progressUnit = String(formData.get("progressUnit") ?? "");
  const stagesRaw = Number(formData.get("stages"));
  const minutesRaw = String(formData.get("minutes") ?? "").trim();

  const values = {
    title, description, category, origin: originRaw, genre,
    progressUnit, stages: String(formData.get("stages") ?? ""), minutes: minutesRaw,
  };
  const fail = (error: string) => ({ error, values });

  if (!title) return fail("작품명을 입력해 주세요.");
  if (title.length > 80) return fail("작품명은 80자까지 쓸 수 있습니다.");
  if (!description) return fail("한 줄 소개를 입력해 주세요.");
  if (description.length > 300) {
    return fail("한 줄 소개는 300자까지 쓸 수 있습니다. 줄거리 전문은 넣지 말아주세요.");
  }
  if (!isCategory(category)) return fail("분야를 선택해 주세요.");
  if (!isProgressUnit(progressUnit)) return fail("진도 단위를 선택해 주세요.");

  // 영화·드라마만 국내/외국을 나눈다. 나머지 분야에서는 값을 받지 않는다.
  const origin = usesOrigin(category) ? originRaw : "";
  if (usesOrigin(category) && !isOrigin(origin)) return fail("국내·외국을 선택해 주세요.");

  // 단일 작품은 회차를 억지로 나누지 않는다(단계 1개).
  const stages = progressUnit === "single" ? 1 : stagesRaw;
  if (progressUnit !== "single" && (!Number.isInteger(stages) || stages < 1 || stages > 2000)) {
    return fail("회차 수는 1에서 2000 사이의 숫자로 적어주세요.");
  }
  const minutes = minutesRaw ? Number(minutesRaw) : null;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1000)) {
    return fail("한 회차 감상 시간은 1에서 1000분 사이로 적어주세요.");
  }

  const existing = await findWorkByTitle(title);
  if (existing) {
    return fail(`'${existing.title}'은(는) 이미 등록되어 있습니다. 검색에서 찾아 들어가 주세요.`);
  }

  let id = workIdFrom(title);
  while (await workExists(id)) id = workIdFrom(title);

  // 외부 조회는 실패하거나 느려도 등록을 막지 않는다(빈 메타로 진행).
  const meta = await resolveCandidate(
    String(formData.get("candidate") ?? ""),
    title,
    category
  );

  await createWork({
    id,
    title,
    description,
    category,
    origin: origin || null,
    genre: genre || null,
    progressUnit,
    stages,
    unitSuffix: unitNoun(progressUnit),
    minutesPerStage: minutes,
    boardLabel: boardLabelFor(category, origin || null),
    year: meta.year,
    creator: meta.creator,
    posterUrl: meta.posterUrl,
    createdBy: user.id,
  });

  revalidatePath("/", "layout");
  // 등록한 사람이 바로 진도를 정하고 글을 쓸 수 있도록 작품 화면으로 보낸다.
  redirect(`/works/${id}`);
}

export type CandidateState = {
  candidates?: ArtworkCandidate[];
  message?: string;
};

/** 영화·드라마·애니는 TMDB, 만화·책은 Open Library에서 찾는다(안내 문구 고르는 데만 쓴다). */
function usesTmdb(category: string) {
  return category === "movie" || category === "drama" || category === "anime";
}

/**
 * 작품 정보 후보 찾기. 제목이 조금 달라도 고를 수 있도록 목록만 돌려주고,
 * 무엇을 쓸지는 등록·수정하는 사람이 고른다. 찾지 못해도 등록은 막지 않는다.
 */
export async function searchArtworkAction(
  _prev: CandidateState,
  formData: FormData
): Promise<CandidateState> {
  await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  if (!title) return { message: "먼저 작품명을 입력해 주세요." };
  if (!isCategory(category)) return { message: "먼저 분야를 선택해 주세요." };

  const candidates = await searchArtwork(title, category);
  if (candidates.length === 0) {
    return {
      candidates: [],
      message: usesTmdb(category)
        ? "찾은 작품이 없습니다. 제목을 조금 바꿔 다시 찾거나, 연결하지 않고 등록해도 됩니다."
        : "찾은 작품이 없습니다. 원제(영문)로 찾으면 나올 때가 있어요.",
    };
  }
  return { candidates };
}

/**
 * 작품 수정. 등록한 사람 본인과 관리자만 할 수 있고 권한은 서버에서 다시 확인한다.
 * 진도 단위는 이미 쓰인 회차·글과 얽혀 있어 바꾸지 않는다. 회차 수는 늘릴 수 있고,
 * 줄이는 것은 그 뒤 회차에 글이나 진도가 없을 때만 받는다.
 */
export async function updateWorkAction(
  _prev: WorkFormState,
  formData: FormData
): Promise<WorkFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const originRaw = String(formData.get("origin") ?? "");
  const genre = String(formData.get("genre") ?? "").trim();
  const minutesRaw = String(formData.get("minutes") ?? "").trim();

  const values = {
    title, description, category, origin: originRaw, genre,
    stages: String(formData.get("stages") ?? ""), minutes: minutesRaw,
  };
  const fail = (error: string) => ({ error, values });

  if (!(await canEditWork(workId, user.id, user.is_admin))) {
    return fail("내가 등록한 작품만 수정할 수 있습니다.");
  }
  const work = await getWork(workId);
  if (!work) return fail("작품을 찾을 수 없습니다.");

  if (!title) return fail("작품명을 입력해 주세요.");
  if (title.length > 80) return fail("작품명은 80자까지 쓸 수 있습니다.");
  if (!description) return fail("한 줄 소개를 입력해 주세요.");
  if (description.length > 300) {
    return fail("한 줄 소개는 300자까지 쓸 수 있습니다. 줄거리 전문은 넣지 말아주세요.");
  }
  if (!isCategory(category)) return fail("분야를 선택해 주세요.");
  const origin = usesOrigin(category) ? originRaw : "";
  if (usesOrigin(category) && !isOrigin(origin)) return fail("국내·외국을 선택해 주세요.");

  const single = work.progress_unit === "single";
  const stages = single ? 1 : Number(formData.get("stages"));
  if (!single && (!Number.isInteger(stages) || stages < 1 || stages > 2000)) {
    return fail("회차 수는 1에서 2000 사이의 숫자로 적어주세요.");
  }
  const minutes = minutesRaw ? Number(minutesRaw) : null;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1000)) {
    return fail("한 회차 감상 시간은 1에서 1000분 사이로 적어주세요.");
  }

  const usage = await workUsage(workId);
  if (!single && stages < usage.maxUsedStage) {
    return fail(
      `이미 ${usage.maxUsedStage}번째 회차까지 글이나 진도가 있어 그보다 적게 줄일 수 없습니다.`
    );
  }

  const duplicate = await findWorkByTitle(title);
  if (duplicate && duplicate.id !== workId) {
    return fail(`'${duplicate.title}'은(는) 이미 등록되어 있습니다.`);
  }

  // 후보를 새로 고른 경우에만 메타를 바꾼다. 고르지 않으면 지금 값을 그대로 둔다.
  const candidate = String(formData.get("candidate") ?? "");
  const clearMeta = formData.get("clearMeta") === "1";
  const meta = candidate
    ? await resolveCandidate(candidate, title, category)
    : clearMeta
      ? { posterUrl: null, year: null, creator: null }
      : { posterUrl: work.poster_url, year: work.year, creator: work.creator };

  await updateWork({
    id: workId,
    title,
    description,
    category,
    origin: origin || null,
    genre: genre || null,
    boardLabel: boardLabelFor(category, origin || null),
    stages,
    unitSuffix: unitNoun(work.progress_unit),
    minutesPerStage: minutes,
    year: meta.year,
    creator: meta.creator,
    posterUrl: meta.posterUrl,
  });

  revalidatePath("/", "layout");
  redirect(`/works/${workId}`);
}

/** 작품 삭제. 글이 하나라도 있으면 지우지 않는다(남이 쓴 글이 말없이 사라지지 않도록). */
export async function deleteWorkAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  if (!(await canEditWork(workId, user.id, user.is_admin))) {
    throw new Error("내가 등록한 작품만 삭제할 수 있습니다.");
  }
  const usage = await workUsage(workId);
  if (usage.posts > 0) {
    throw new Error("이 작품에는 이미 글이 있어 삭제할 수 없습니다.");
  }
  await deleteWork(workId);
  revalidatePath("/", "layout");
  redirect("/");
}
