import Link from "next/link";
import { BOARD_LABELS, BOARD_TYPES, boardPath, type BoardType } from "@/lib/boards";

/** 작품 감상방 안에서 게시판 사이를 오가는 네비게이션. */
export default function BoardNav({
  workId,
  current,
  counts,
}: {
  workId: string;
  current?: BoardType;
  counts: Record<string, number>;
}) {
  return (
    <nav className="row" style={{ marginBottom: 12 }}>
      {BOARD_TYPES.map((b) => (
        <Link
          key={b}
          href={boardPath(workId, b)}
          className={`btn${b === current ? " active" : ""}`}
          style={{ textDecoration: "none" }}
          aria-current={b === current ? "page" : undefined}
        >
          {BOARD_LABELS[b]} {counts[b] ?? 0}
        </Link>
      ))}
    </nav>
  );
}
