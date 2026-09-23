// DB 연결 최소 검증. 연결 문자열은 출력하지 않고 결과만 알린다.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url || url.includes("SENSITIVE")) {
  console.error("DATABASE_URL이 비어 있습니다. .env.local을 먼저 채워주세요.");
  process.exit(1);
}

try {
  const db = neon(url);
  const rows = await db`select current_database() as db, version() as v`;
  console.log("연결 성공:", rows[0].db, "|", rows[0].v.split(",")[0]);
} catch (e) {
  console.error("연결 실패:", e.message);
  process.exit(1);
}
