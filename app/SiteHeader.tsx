import Link from "next/link";
import { getCurrentUser, listDemoUsers } from "@/lib/session";
import { isDbConfigured } from "@/lib/db";
import { switchUserAction } from "./actions";
import BrandMark from "./BrandMark";

/** 워드마크 + 시연 사용자 전환. 전환 로직(서버 액션)은 그대로 쓴다. */
export default async function SiteHeader() {
  const wordmark = (
    <Link href="/" className="wordmark" aria-label="NoSpo 홈">
      <BrandMark />
      <span>
        No<s>Spo</s>
      </span>
      <span className="rule" aria-hidden />
      <span className="tagline">내가 본 만큼만</span>
    </Link>
  );

  if (!isDbConfigured()) {
    return (
      <header className="site-header">
        <div className="container inner">
          {wordmark}
          <span className="muted">
            .env.local의 DATABASE_URL을 설정한 뒤 npm run db:setup을 실행하세요.
          </span>
        </div>
      </header>
    );
  }

  const [users, current] = await Promise.all([listDemoUsers(), getCurrentUser()]);

  return (
    <header className="site-header">
      <div className="container inner">
        {wordmark}
        {/* 작품 탐색 입구. 검색은 작품만 찾고 글은 찾지 않는다. */}
        <nav className="head-nav">
          <Link href="/search" className="icon-btn" aria-label="작품 검색">
            <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden focusable="false">
              <circle cx="8.6" cy="8.6" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12.8 12.8 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>검색</span>
          </Link>
          <Link href="/works/new" className="icon-btn" aria-label="작품 추가">
            <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden focusable="false">
              <path d="M10 3.6 V16.4 M3.6 10 H16.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>작품 추가</span>
          </Link>
        </nav>

        <div className="user-switch">
          {/* 관리자로 전환했을 때만 보이는 입구. 권한은 화면에서 다시 확인한다. */}
          {current.is_admin && (
            <Link href="/admin" className="muted" style={{ fontSize: 12.5 }}>
              관리자 화면
            </Link>
          )}
          <span className="label">시연 사용자</span>
          <div className="seg" role="group" aria-label="시연 사용자 전환">
            {users.map((u) => (
              <form key={u.id} action={switchUserAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button type="submit" aria-pressed={u.id === current.id}>
                  {u.display_name.replace(/^시연 (사용자 )?/, "")}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
