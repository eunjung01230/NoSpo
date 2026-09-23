import { neon } from "@neondatabase/serverless";

/** Neon 연결. DATABASE_URL 이 없으면 값 자체를 로그에 남기지 않고 실패시킨다. */
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL이 설정되지 않았습니다. .env.local에 Neon 연결 문자열을 입력하세요."
    );
  }
  return neon(url);
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
