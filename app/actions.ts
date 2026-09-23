"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_USER_COOKIE, getCurrentUser, listDemoUsers } from "@/lib/session";
import { createPost, getProgress, listStages, setProgress } from "@/lib/data";

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

/** 진도 올리기. 존재하는 회차인지, 현재보다 높은지 서버에서 검증한다. */
export async function raiseProgressAction(formData: FormData) {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const stageNo = Number(formData.get("stageNo"));
  const stages = await listStages(workId);
  if (!Number.isInteger(stageNo) || !stages.some((s) => s.stage_no === stageNo)) {
    throw new Error("작품에 존재하지 않는 회차입니다.");
  }
  const current = await getProgress(user.id, workId);
  if (stageNo <= current) {
    // 진도를 낮췄을 때의 동작은 미정이므로 이번 구현에서는 올리기만 허용한다.
    throw new Error("현재 진도보다 높은 회차만 선택할 수 있습니다.");
  }
  await setProgress(user.id, workId, stageNo);
  revalidatePath(`/works/${workId}`);
}

export type PostFormState = { error?: string };

/** 감상 작성. 빈 제목·본문, 없는 회차, 내 진도 초과를 서버에서 검증한다. */
export async function createPostAction(
  _prev: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const user = await getCurrentUser();
  const workId = String(formData.get("workId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const maxStage = Number(formData.get("maxStage"));

  if (!title) return { error: "제목을 입력해 주세요." };
  if (!body) return { error: "본문을 입력해 주세요." };

  const stages = await listStages(workId);
  if (!Number.isInteger(maxStage) || !stages.some((s) => s.stage_no === maxStage)) {
    return { error: "작품에 존재하지 않는 회차입니다." };
  }
  const progress = await getProgress(user.id, workId);
  if (maxStage > progress) {
    return { error: "내 감상 진도까지의 회차만 선택할 수 있습니다." };
  }

  await createPost({ workId, authorId: user.id, title, body, maxStage });
  revalidatePath(`/works/${workId}`);
  redirect(`/works/${workId}`);
}
