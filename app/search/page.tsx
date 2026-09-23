import Link from "next/link";
import WorkGrid from "../WorkGrid";
import { searchWorks } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * 작품 검색. 찾는 대상은 작품 메타(제목·제작자·한 줄 소개)뿐이다.
 * 글은 검색하지 않으므로, 아직 열리지 않은 글의 제목이 검색으로 새어 나갈 길이 없다.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const user = await getCurrentUser();
  const works = query ? await searchWorks(user.id, query) : [];

  return (
    <>
      <section className="container stack" style={{ gap: 14, paddingBlock: "28px 24px" }}>
        <span className="eyebrow">작품 검색</span>
        <h1 className="page-title">무엇을 보고 오셨나요</h1>
        <span className="muted">
          작품을 고르면 내 진도를 정하고, 그 지점까지 열린 질문과 해석을 읽을 수 있어요.
        </span>
        <form className="search-bar" action="/search">
          <label className="sr-only" htmlFor="q">
            작품명
          </label>
          <input
            id="q"
            name="q"
            type="search"
            className="field"
            defaultValue={query}
            placeholder="작품명, 제작자, 소개로 찾기"
            autoFocus
          />
          <button className="btn btn-primary" type="submit">
            검색
          </button>
        </form>
        <span className="muted">
          작품만 찾습니다. 글은 검색되지 않아요 — 아직 내 진도에서 열리지 않은 글의 제목은
          어디에서도 보이지 않습니다.
        </span>
      </section>

      <section className="band-low">
        <div className="container stack" style={{ gap: 18, paddingBlock: "28px 88px" }}>
          {query && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">
                &lsquo;{query}&rsquo; 검색 결과 {works.length}편
              </span>
              <Link className="btn" href={`/works/new?title=${encodeURIComponent(query)}`}>
                찾는 작품이 없나요? 작품 추가
              </Link>
            </div>
          )}

          {!query && (
            <div className="notice-dark">
              작품명을 입력해 주세요. 목록에 없는 작품이라면{" "}
              <Link className="textlink" href="/works/new" style={{ color: "var(--ns-rose)" }}>
                직접 추가
              </Link>
              해서 첫 글을 남길 수 있습니다.
            </div>
          )}

          {query && works.length === 0 ? (
            <div className="notice-dark">
              찾는 작품이 아직 없습니다.{" "}
              <Link
                className="textlink"
                href={`/works/new?title=${encodeURIComponent(query)}`}
                style={{ color: "var(--ns-rose)" }}
              >
                이 제목으로 작품 추가하기
              </Link>
            </div>
          ) : (
            query && <WorkGrid works={works} />
          )}
        </div>
      </section>
    </>
  );
}
