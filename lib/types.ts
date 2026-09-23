import type { BoardType } from "./boards";

export type DemoUser = {
  id: string;
  display_name: string;
  /** 관리자 화면에 들어갈 수 있는 시연 계정인지. 판정은 항상 서버에서 다시 한다. */
  is_admin: boolean;
};

export type Work = {
  id: string;
  board: string;
  title: string;
  description: string;
  progress_unit: string;
  category: string | null;
  origin: string | null;
  genre: string | null;
  /** 공개 API가 제공하는 포스터 주소. 이미지 파일은 저장하지 않는다. */
  poster_url: string | null;
  year: string | null;
  creator: string | null;
  /** 한 회차·편·권을 보는 데 드는 평균 시간(분). 감상 시간 가늠에만 쓰는 표시용 값. */
  minutes_per_stage: number | null;
};

export type Stage = {
  stage_no: number;
  label: string;
};

/** 목록/상세에서 공개 판정을 통과한 글에만 title/body가 존재한다. */
export type VisiblePost = {
  id: string;
  work_id: string;
  board_type: BoardType;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  /** 자유 게시판 글은 0이다(회차가 없는 글). */
  max_stage: number;
  /** 회차가 없는 글은 null이라 화면에서 회차 표기를 하지 않는다. */
  stage_label: string | null;
  comment_count: number;
  is_demo_seed: boolean;
  created_at: string;
};

/** 댓글은 그 글이 지금 공개되는 사람에게만 조회된다(판정은 서버에서). */
export type Comment = {
  id: string;
  post_id: string;
  /** 답글이면 부모 댓글 id. 답글에 또 답글을 달지 않으므로 깊이는 한 단계다. */
  parent_id: string | null;
  author_id: string;
  author_name: string;
  body: string;
  is_demo_seed: boolean;
  created_at: string;
};
