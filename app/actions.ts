"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_USER_COOKIE, getCurrentUser, listDemoUsers } from "@/lib/session";
import {
  createPost,
  deleteOwnPost,
  getOwnPost,
  getProgress,
  listStages,
  setProgress,
  updateOwnPost,
} from "@/lib/data";
import { toBoardType } from "@/lib/boards";

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
  await setProgress(user.id, workId, stageNo);
  revalidatePath(`/works/${workId}`);
}

export type PostFormState = { error?: string };

/** 작성·수정 공통 검증: 빈 제목·본문, 없는 회차, 내 진도 초과를 서버에서 막는다. */
async function validate(
  userId: string,
  workId: string,
  title: string,
  body: string,
  maxStage: number
) {
  if (!title) return "제목을 입력해 주세요.";
  if (!body) return "본문을 입력해 주세요.";
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

export async function createPostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const boardType = toBoardType(formData.get("boardType"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = Number(formData.get("maxStage"));

  const error = await validate(user.id, workId, title, body, maxStage);
  if (error) return { error };

  await createPost({ workId, boardType, authorId: user.id, title, body, maxStage });
  revalidatePath(`/works/${workId}`);
  redirect(`/works/${workId}?board=${boardType}`);
}

/** 수정. 소유권은 SQL 조건으로 확인하고 클라이언트가 보낸 작성자 값은 믿지 않는다. */
export async function updatePostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = Number(formData.get("maxStage"));

  const error = await validate(user.id, workId, title, body, maxStage);
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
  redirect(`/works/${workId}?board=${boardType}`);
}
