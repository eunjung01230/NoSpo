import Link from "next/link";
import { getCurrentUser, listDemoUsers } from "@/lib/session";
import { isDbConfigured } from "@/lib/db";
import { switchUserAction } from "./actions";

/** 시연 사용자 전환 바. 실제 인증이 아니라 공개 시연용 전환 장치다. */
export default async function DemoUserBar() {
  if (!isDbConfigured()) {
    return (
      <div className="topbar">
        <div className="inner">
          <Link href="/" className="brand">NoSpo</Link>
          <span>.env.local의 DATABASE_URL을 설정한 뒤 npm run db:setup을 실행하세요.</span>
        </div>
      </div>
    );
  }

  const [users, current] = await Promise.all([listDemoUsers(), getCurrentUser()]);

  return (
    <div className="topbar">
      <div className="inner">
        <Link href="/" className="brand">NoSpo</Link>
        <span className="badge">시연 사용자 전환</span>
        {users.map((u) => (
          <form key={u.id} action={switchUserAction}>
            <input type="hidden" name="userId" value={u.id} />
            <button
              type="submit"
              className={`btn${u.id === current.id ? " active" : ""}`}
            >
              {u.display_name}
            </button>
          </form>
        ))}
        <span style={{ fontSize: 13 }}>현재: {current.display_name}</span>
      </div>
    </div>
  );
}
