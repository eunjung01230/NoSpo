import type { BoardType } from "./boards";

export type DemoUser = {
  id: string;
  display_name: string;
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
  max_stage: number;
  stage_label: string;
  is_demo_seed: boolean;
  created_at: string;
};
