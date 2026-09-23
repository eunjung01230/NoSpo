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
};

export type Stage = {
  stage_no: number;
  label: string;
};

/** 목록/상세에서 공개 판정을 통과한 글에만 title/body가 존재한다. */
export type VisiblePost = {
  id: string;
  work_id: string;
  author_name: string;
  title: string;
  body: string;
  max_stage: number;
  is_demo_seed: boolean;
  created_at: string;
};
