import Link from "next/link";
import {
  BOARD_DESCRIPTIONS,
  BOARD_EN,
  BOARD_LABELS,
  BOARD_NUMERALS,
  BOARD_TYPES,
  boardPath,
  type BoardType,
} from "@/lib/boards";

/** 작품 감상방 안에서 게시판 사이를 오가는 인덱스. 각 게시판이 별개 공간으로 보이게 한다. */
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
    <nav className="board-nav" aria-label="게시판">
      {BOARD_TYPES.map((b) => (
        <Link
          key={b}
          href={boardPath(workId, b)}
          className="board-tab"
          aria-current={b === current ? "page" : undefined}
        >
          <span className="head">
            <span className="num">{BOARD_NUMERALS[b]}</span>
            <span className="name">{BOARD_LABELS[b]}</span>
            <span className="en">{BOARD_EN[b]}</span>
            <span className="count">{counts[b] ?? 0}</span>
          </span>
          <span className="desc">{BOARD_DESCRIPTIONS[b]}</span>
        </Link>
      ))}
    </nav>
  );
}
