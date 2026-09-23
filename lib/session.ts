import { cookies } from "next/headers";
import { sql } from "./db";
import type { DemoUser } from "./types";

export const DEMO_USER_COOKIE = "nospo_demo_user";

/** 시연 사용자 목록(운영 측에서 미리 등록한 계정들). 관리자는 목록 끝에 둔다. */
export async function listDemoUsers(): Promise<DemoUser[]> {
  const db = sql();
  return (await db`
    select id, display_name, is_admin from users order by is_admin, display_name
  `) as DemoUser[];
}

/**
 * 현재 시연 사용자. 쿠키 값은 신뢰하지 않고 DB에 존재하는지 서버에서 확인한다.
 * 유효하지 않으면 첫 번째 시연 사용자로 되돌린다.
 */
export async function getCurrentUser(): Promise<DemoUser> {
  const users = await listDemoUsers();
  if (users.length === 0) {
    throw new Error("시연 사용자가 없습니다. npm run db:setup 을 실행하세요.");
  }
  const jar = await cookies();
  const id = jar.get(DEMO_USER_COOKIE)?.value;
  return users.find((u) => u.id === id) ?? users[0];
}

/**
 * 관리자 전용 동작의 문지기. 쿠키 값이 아니라 DB의 is_admin으로 판정하며,
 * 화면(관리자 페이지)과 서버 액션 양쪽에서 매번 다시 확인한다.
 */
export async function requireAdmin(): Promise<DemoUser> {
  const user = await getCurrentUser();
  if (!user.is_admin) {
    throw new Error("관리자만 할 수 있는 작업입니다.");
  }
  return user;
}
