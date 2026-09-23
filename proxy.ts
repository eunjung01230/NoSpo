import { NextResponse } from "next/server";

/**
 * 공개 범위가 사용자마다 다르므로 어떤 응답도 저장되지 않게 한다.
 * next.config.ts의 headers()는 Next가 동적 라우트에 붙이는
 * `no-cache, must-revalidate`에 덮이므로 여기서 최종 값으로 고정한다.
 */
export default function proxy() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, private, max-age=0");
  const vary = res.headers.get("Vary");
  res.headers.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
