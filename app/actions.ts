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
  deleteOwnComment,
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
} from "@/lib/data";
import {
  REPORT_HIDE_THRESHOLD,
  WARNING_BLOCK_THRESHOLD,
  isReportReason,
  screenPost,
  type Screening,
} from "@/lib/moderation";
import {
  BOARD_COMMENTS,
  BOARD_LABELS,
  FREE_STAGE,
  commentNoun,
  boardPath,
  isUngated,
  toBoardType,
  type BoardType,
} from "@/lib/boards";

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
   * AI 사전 검토가 걸었을 때만 채운다. 등록을 막지는 않고, 작성자가
   * 회차를 고쳐 쓸지 이대로 올릴지 정하게 한다(이대로 올리면 관리자 화면에 쌓인다).
   */
  warning?: { reason: string; source: Screening["source"] };
  /**
   * 되돌려주는 입력값. 서버 액션이 끝나면 React가 폼을 초기화하므로, 경고를 보여주고
   * 다시 고쳐 쓰게 하려면 쓰던 내용을 그대로 돌려줘야 한다(화면에서 defaultValue로 쓴다).
   */
  values?: { title: string; body: string; maxStage: number };
};

/**
 * 작성·수정 공통 검증: 빈 제목·본문, 없는 회차, 내 진도 초과를 서버에서 막는다.
 * 자유 게시판은 회차가 없는 게시판이라 max_stage를 0으로만 받는다. 0은 어떤 진도보다도
 * 작거나 같으므로 `max_stage <= 진도`라는 공개 조건을 건드리지 않고 모두에게 열린다.
 */
async function validate(
  userId: string,
  workId: string,
  boardType: BoardType,
  title: string,
  body: string,
  maxStage: number
) {
  if (!title) return "제목을 입력해 주세요.";
  if (!body) return "본문을 입력해 주세요.";
  if (isUngated(boardType)) {
    return maxStage === FREE_STAGE
      ? null
      : "자유 게시판 글에는 회차를 지정하지 않습니다.";
  }
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

/** 폼이 보낸 회차 값. 자유 게시판이면 클라이언트 값과 무관하게 0으로 고정한다. */
function stageFromForm(boardType: BoardType, formData: FormData) {
  return isUngated(boardType) ? FREE_STAGE : Number(formData.get("maxStage"));
}

/**
 * 글이 고른 범위를 넘는지 AI에게 미리 물어본다. 결과는 경고까지이고 등록은 막지 않는다
 * (공개 판정은 여전히 `max_stage <= 진도`뿐이다). 작성자가 경고를 보고도 그대로
 * 올렸다면 confirmed = true로 저장되어 관리자 화면의 '검토 필요'에 쌓인다.
 */
async function screen(
  workId: string,
  boardType: BoardType,
  maxStage: number,
  title: string,
  body: string
): Promise<Screening> {
  const [work, stages] = await Promise.all([getWork(workId), listStages(workId)]);
  return screenPost({
    workTitle: work?.title ?? "",
    boardType,
    stageLabel: stages.find((s) => s.stage_no === maxStage)?.label ?? null,
    totalStages: stages.length,
    maxStage,
    title,
    body,
  });
}

/** 경고가 쌓인 사용자는 새 글·수정을 멈춘다. 판정은 항상 DB의 누적 경고 수로 한다. */
async function blockedByWarnings(userId: string): Promise<string | null> {
  const warnings = await countWarnings(userId);
  if (warnings < WARNING_BLOCK_THRESHOLD) return null;
  return `신고가 확인된 글이 ${warnings}건 있어 글쓰기가 멈춰 있습니다. 관리자 확인 후 다시 쓸 수 있습니다.`;
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
  const maxStage = stageFromForm(boardType, formData);

  const values = { title, body, maxStage };
  const error = await validate(user.id, workId, boardType, title, body, maxStage);
  if (error) return { error, values };
  const blocked = await blockedByWarnings(user.id);
  if (blocked) return { error: blocked, values };

  // 작성자가 경고를 이미 보고 '이대로 등록'을 누른 경우에만 통과시킨다.
  const confirmed = formData.get("aiConfirmed") === "1";
  const screening = await screen(workId, boardType, maxStage, title, body);
  if (screening.verdict === "warn" && !confirmed) {
    return {
      warning: { reason: screening.reason!, source: screening.source },
      values,
    };
  }

  await createPost({
    workId, boardType, authorId: user.id, title, body, maxStage,
    aiVerdict: screening.verdict,
    aiReason: screening.reason,
    aiAcknowledged: screening.verdict === "warn",
  });
  revalidatePath(`/works/${workId}`);
  redirect(boardPath(workId, boardType));
}

/** 수정. 소유권은 SQL 조건으로 확인하고 클라이언트가 보낸 작성자 값은 믿지 않는다. */
export async function updatePostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const boardType = toBoardType(formData.get("boardType"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = stageFromForm(boardType, formData);

  const values = { title, body, maxStage };
  const error = await validate(user.id, workId, boardType, title, body, maxStage);
  if (error) return { error, values };

  const own = await getOwnPost(user.id, workId, postId);
  if (!own) return { error: "내가 쓴 글만 수정할 수 있습니다.", values };

  const confirmed = formData.get("aiConfirmed") === "1";
  const screening = await screen(workId, boardType, maxStage, title, body);
  if (screening.verdict === "warn" && !confirmed) {
    return {
      warning: { reason: screening.reason!, source: screening.source },
      values,
    };
  }

  const ok = await updateOwnPost({
    postId, workId, authorId: user.id, title, body, maxStage,
    aiVerdict: screening.verdict,
    aiReason: screening.reason,
    aiAcknowledged: screening.verdict === "warn",
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

  await createComment({ postId, authorId: user.id, body, parentId });
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
