import Link from "next/link";
import { getCurrentUser, listDemoUsers } from "@/lib/session";
import { isDbConfigured } from "@/lib/db";
import { switchUserAction } from "./actions";

/** 워드마크 + 시연 사용자 전환. 전환 로직(서버 액션)은 그대로 쓴다. */
export default async function SiteHeader() {
  const wordmark = (
    <Link href="/" className="wordmark">
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
        <div className="user-switch">
          <span className="label">시연 사용자</span>
          <div className="seg" role="group" aria-label="시연 사용자 전환">
            {users.map((u) => (
              <form key={u.id} action={switchUserAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button type="submit" aria-pressed={u.id === current.id}>
                  {u.display_name.replace("시연 사용자 ", "")}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
