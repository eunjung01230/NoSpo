import { countWorksByCategory, listWorkCards } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import CategorySidebar from "./CategorySidebar";
import WorkGrid from "./WorkGrid";

export const dynamic = "force-dynamic";

export default async function WorkBrowsePage() {
  if (!isDbConfigured()) {
    return (
      <section className="container stack" style={{ gap: 20, paddingBlock: 72 }}>
        <p className="display">
          다 본 사람 말고,
          <br />
          나만큼 본 사람들과.
        </p>
        <div className="notice-dark notice-warn">
          DATABASE_URL이 아직 설정되지 않았습니다. .env.local에 Neon 연결 문자열을
          입력하고 <code>npm run db:setup</code>을 실행한 뒤 새로고침하세요.
        </div>
      </section>
    );
  }

  const user = await getCurrentUser();
  const [works, categoryCounts] = await Promise.all([
    listWorkCards(user.id),
    countWorksByCategory(),
  ]);

  return (
    <>
      <section
        className="container"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "32px 64px",
          alignItems: "flex-end",
          paddingBlock: "clamp(44px, 7%, 88px) clamp(36px, 5%, 60px)",
        }}
      >
        <div className="stack" style={{ flex: "1 1 460px", gap: 20 }}>
          <span className="eyebrow">스포일러 없는 감상 공간</span>
          <p className="display">
            다 본 사람 말고,
            <br />
            나만큼 본 사람들과.
          </p>
          <p
            className="muted"
            style={{ margin: 0, maxWidth: "34em", fontSize: 16, lineHeight: 1.8 }}
          >
            내가 본 지점까지의 정보만으로 작품을 이해하고, 묻고, 해석하고, 감상을 나눕니다.
          </p>
        </div>
        <div className="promise" style={{ flex: "0 1 330px" }}>
          <b>이 방의 약속</b>
          <p>글에 포함된 마지막 지점이 내 진도 이하일 때만 제목과 본문이 공개됩니다.</p>
        </div>
      </section>

      <section className="band-low">
        <div className="container browse" style={{ paddingBlock: "40px 80px" }}>
          <CategorySidebar total={works.length} categoryCounts={categoryCounts} />

          <div className="stack" style={{ gap: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "10px 24px",
                flexWrap: "wrap",
                borderBottom: "1px solid var(--ns-line)",
                paddingBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <h1 className="section-title">전체 작품</h1>
                <span className="mono" style={{ color: "var(--ns-muted-dim)" }}>
                  {works.length}편
                </span>
              </div>
              <span className="muted">카드의 진도는 {user.display_name} 기준입니다.</span>
            </div>
            <WorkGrid works={works} />
          </div>
        </div>
      </section>
    </>
  );
}
