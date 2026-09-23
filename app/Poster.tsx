/**
 * 작품 포스터. 공개 API가 준 이미지 주소가 있으면 그걸 쓰고, 없으면 레이아웃이
 * 깨지지 않도록 같은 비율의 자리표시자를 보여준다. 색은 작품 id에서 결정적으로
 * 만들며 특정 작품을 하드코딩하지 않는다.
 */
function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function posterStyle(workId: string) {
  const h = hash(workId);
  const hue = 16 + (h % 16); // 웜 브라운 계열 안에서만 변주
  const sat = 9 + (h % 5);
  const a = `hsl(${hue} ${sat}% 26%)`;
  const b = `hsl(${hue} ${sat}% 23%)`;
  return { background: `repeating-linear-gradient(135deg, ${a} 0 8px, ${b} 8px 16px)` };
}

export default function Poster({
  workId,
  posterUrl,
  title,
  className = "poster",
  style,
  label = true,
}: {
  workId: string;
  posterUrl?: string | null;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: boolean;
}) {
  if (posterUrl) {
    return (
      <div className={className} style={{ ...posterStyle(workId), ...style }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl}
          alt={title ? `${title} 포스터` : ""}
          loading="lazy"
          className="poster-img"
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ ...posterStyle(workId), ...style }} aria-hidden>
      {label && <span>POSTER</span>}
    </div>
  );
}
