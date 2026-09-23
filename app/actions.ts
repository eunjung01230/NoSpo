"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_USER_COOKIE, getCurrentUser, listDemoUsers } from "@/lib/session";
import {
  createComment,
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  getOwnPost,
  getProgress,
  getVisiblePost,
  listStages,
  setProgress,
  updateOwnPost,
} from "@/lib/data";
import {
  BOARD_COMMENTS,
  BOARD_LABELS,
  FREE_STAGE,
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

export type PostFormState = { error?: string };

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

  const error = await validate(user.id, workId, boardType, title, body, maxStage);
  if (error) return { error };

  await createPost({ workId, boardType, authorId: user.id, title, body, maxStage });
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

  const error = await validate(user.id, workId, boardType, title, body, maxStage);
  if (error) return { error };

  const own = await getOwnPost(user.id, workId, postId);
  if (!own) return { error: "내가 쓴 글만 수정할 수 있습니다." };

  const ok = await updateOwnPost({
    postId, workId, authorId: user.id, title, body, maxStage,
  });
  if (!ok) return { error: "내가 쓴 글만 수정할 수 있습니다." };

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

  if (!body) return { error: "댓글 내용을 입력해 주세요." };
  if (body.length > 1000) return { error: "댓글은 1000자까지 쓸 수 있습니다." };

  const post = await getVisiblePost(user.id, workId, postId);
  if (!post) return { error: "지금 읽을 수 없는 글에는 댓글을 남길 수 없습니다." };
  if (!BOARD_COMMENTS[post.board_type]) {
    return { error: `${BOARD_LABELS[post.board_type]} 게시판은 댓글을 받지 않습니다.` };
  }

  await createComment({ postId, authorId: user.id, body });
  revalidatePath(`/works/${workId}/posts/${postId}`);
  return {};
}

/** 댓글 삭제. 소유권은 SQL 조건으로 강제한다. */
export async function deleteCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");

  // 글 자체가 지금 잠겨 있으면 댓글도 건드리지 않는다.
  const post = await getVisiblePost(user.id, workId, postId);
  if (!post) throw new Error("지금 읽을 수 없는 글입니다.");

  const ok = await deleteOwnComment(commentId, postId, user.id);
  if (!ok) throw new Error("내가 쓴 댓글만 삭제할 수 있습니다.");

  revalidatePath(`/works/${workId}/posts/${postId}`);
}
