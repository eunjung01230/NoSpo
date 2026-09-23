/**
 * 포스터 이미지가 없는 작품도 레이아웃이 깨지지 않도록 쓰는 자리표시자.
 * 색은 작품 id에서 결정적으로 만들며, 특정 작품을 하드코딩하지 않는다.
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
  className = "poster",
  style,
  label = true,
}: {
  workId: string;
  className?: string;
  style?: React.CSSProperties;
  label?: boolean;
}) {
  return (
    <div className={className} style={{ ...posterStyle(workId), ...style }} aria-hidden>
      {label && <span>POSTER</span>}
    </div>
  );
}
