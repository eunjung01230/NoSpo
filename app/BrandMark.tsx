/**
 * NoSpo 심볼 — 크림색 둥근 사각형 안의 두 눈과 짧은 입.
 * 스포일러를 본 순간의 작은 놀람을 단순한 선으로만 표현한다.
 * 외부 이미지 없이 이 SVG 하나를 헤더와 파비콘이 함께 쓴다.
 */
export default function BrandMark({
  size = 38,
  className = "brandmark",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="NoSpo 심볼"
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="#F1EAE0" stroke="#D3C7B7" />
      <g
        stroke="#302A26"
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      >
        {/* 두 눈 — 살짝 크게 뜬 쪽이 놀란 인상을 만든다 */}
        <circle cx="13.8" cy="16.8" r="3.9" />
        <circle cx="26.2" cy="16.8" r="4.5" />
        {/* 짧은 입 — 작은 크기에서도 보이도록 살짝 위로 */}
        <path d="M16.6 26.8 h6.8" />
      </g>
    </svg>
  );
}
