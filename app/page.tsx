import Link from "next/link";
import { listWorks } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkBrowsePage() {
  if (!isDbConfigured()) {
    return (
      <>
        <h1>NoSpo</h1>
        <p className="muted">다 본 사람 말고, 나만큼 본 사람들과.</p>
        <div className="notice error">
          DATABASE_URL이 아직 설정되지 않았습니다. .env.local에 Neon 연결 문자열을
          입력하고 <code>npm run db:setup</code>을 실행한 뒤 새로고침하세요.
        </div>
      </>
    );
  }

  const works = await listWorks();

  return (
    <>
      <h1>작품 탐색</h1>
      <p className="muted">다 본 사람 말고, 나만큼 본 사람들과.</p>
      <div className="notice">
        작품마다 진도를 따로 관리합니다. 같은 원작이어도 작품이 다르면 진도를 공유하지 않습니다.
      </div>
      {works.map((w) => (
        <div className="card" key={w.id}>
          <span className="tag">{w.board}</span>
          <h2 style={{ margin: "8px 0" }}>
            <Link href={`/works/${w.id}`}>{w.title}</Link>
          </h2>
          <p className="muted">{w.description}</p>
        </div>
      ))}
    </>
  );
}
