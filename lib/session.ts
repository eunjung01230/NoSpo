import { cookies } from "next/headers";
import { sql } from "./db";
import type { DemoUser } from "./types";

export const DEMO_USER_COOKIE = "nospo_demo_user";

/** 시연 사용자 목록(운영 측에서 미리 등록한 두 명). */
export async function listDemoUsers(): Promise<DemoUser[]> {
  const db = sql();
  return (await db`
    select id, display_name from users order by display_name
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
