import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프로젝트 규칙은 직접 관리하는 CLAUDE.md에만 둔다.
  agentRules: false,
  async headers() {
    // 사용자별 공개 범위가 달라지므로 어떤 응답도 공유 캐시에 남기지 않는다.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private, max-age=0" },
          { key: "Vary", value: "Cookie" },
        ],
      },
    ];
  },
};

export default nextConfig;
