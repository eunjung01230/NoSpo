"use client";

import { useActionState, useState } from "react";
import {
  createWorkAction,
  searchArtworkAction,
  updateWorkAction,
  type WorkFormState,
} from "@/app/actions";
import type { ArtworkCandidate } from "@/lib/artwork-lookup";
import { PROGRESS_UNITS, PROGRESS_UNIT_LABELS, unitNoun } from "@/lib/boards";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  ORIGINS,
  ORIGIN_LABELS,
  isCategory,
  usesOrigin,
} from "@/lib/categories";

export type EditableWork = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  origin: string | null;
  genre: string | null;
  progress_unit: string;
  minutes_per_stage: number | null;
  poster_url: string | null;
  year: string | null;
  creator: string | null;
  total_stages: number;
};

/**
 * 작품 등록·수정 폼. 저작권 보호를 위해 작품명·분야·진도 단위·한 줄 소개만 받는다.
 *
 * 포스터·연도·제작자는 공개 API에서 찾은 **후보 중에서 고른다**. 제목이 조금만 달라도
 * 첫 결과가 엉뚱한 작품일 수 있어, 자동으로 붙이지 않고 눈으로 확인하고 고르게 한다.
 * 고르지 않아도 등록·수정은 그대로 되며 그때는 자리표시자가 나온다.
 */
export default function WorkForm({
  work,
  initialTitle = "",
}: {
  work?: EditableWork;
  initialTitle?: string;
}) {
  const editing = Boolean(work);
  const [state, formAction, pending] = useActionState<WorkFormState, FormData>(
    editing ? updateWorkAction : createWorkAction,
    {}
  );

  const [title, setTitle] = useState(state.values?.title ?? work?.title ?? initialTitle);
  const [category, setCategory] = useState(
    state.values?.category ?? work?.category ?? ""
  );
  const [unit, setUnit] = useState(
    state.values?.progressUnit ?? work?.progress_unit ?? "episode"
  );
  const single = unit === "single";
  const countNoun = unitNoun(single ? "episode" : unit);

  // 후보 찾기는 폼 제출과 별개로 돌아간다(서버 액션을 직접 호출한다).
  const [candidates, setCandidates] = useState<ArtworkCandidate[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<ArtworkCandidate | null>(null);
  const [cleared, setCleared] = useState(false);
  const [searching, setSearching] = useState(false);

  async function findCandidates() {
    setSearching(true);
    setNotice(null);
    const data = new FormData();
    data.set("title", title);
    data.set("category", category);
    const result = await searchArtworkAction({}, data);
    setCandidates(result.candidates ?? null);
    setNotice(result.message ?? null);
    setSearching(false);
  }

  const currentPoster = picked?.posterUrl ?? (cleared ? null : work?.poster_url ?? null);
  const currentYear = picked?.year ?? (cleared ? null : work?.year ?? null);
  const currentCreator = picked?.creator ?? (cleared ? null : work?.creator ?? null);

  return (
    <form action={formAction} className="stack" style={{ gap: 28 }}>
      {work && <input type="hidden" name="workId" value={work.id} />}
      {picked && <input type="hidden" name="candidate" value={picked.key} />}
      {cleared && !picked && <input type="hidden" name="clearMeta" value="1" />}

      <div className="form-step">
        <label className="step-no" htmlFor="title">
          01 · 작품명
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 오징어 게임 시즌 1"
        />
        <span className="hint">
          같은 작품이 이미 있으면 등록되지 않고 알려드려요. 시즌·부가 나뉘는 작품은 시즌까지
          적어주세요.
        </span>
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="category">
          02 · 분야
        </label>
        <select
          id="category"
          name="category"
          className="field"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCandidates(null);
            setPicked(null);
          }}
        >
          <option value="">분야 선택</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        {isCategory(category) && usesOrigin(category) && (
          <div className="row" style={{ gap: 14 }}>
            {ORIGINS.map((o, i) => (
              <label key={o} className="report-reason">
                <input
                  type="radio"
                  name="origin"
                  value={o}
                  defaultChecked={
                    (state.values?.origin ?? work?.origin ?? (i === 0 ? "domestic" : "")) === o
                  }
                />
                <span>{ORIGIN_LABELS[o]}</span>
              </label>
            ))}
          </div>
        )}

        <input
          name="genre"
          type="text"
          className="field"
          defaultValue={state.values?.genre ?? work?.genre ?? ""}
          placeholder="장르 (선택) — 예: 스릴러, SF, 액션"
        />
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="progressUnit">
          03 · 진도 단위
        </label>
        {editing ? (
          <>
            <input type="hidden" name="progressUnit" value={unit} />
            <span className="field" style={{ background: "#F1EBE1", color: "var(--ns-ink-muted)" }}>
              {PROGRESS_UNIT_LABELS[unit as keyof typeof PROGRESS_UNIT_LABELS]}
            </span>
            <span className="hint">
              진도 단위는 이미 쌓인 회차·진도·글과 얽혀 있어 등록 뒤에는 바꾸지 않습니다.
              단위를 잘못 골랐다면 글이 없을 때 작품을 지우고 다시 등록해 주세요.
            </span>
          </>
        ) : (
          <select
            id="progressUnit"
            name="progressUnit"
            className="field"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {PROGRESS_UNITS.map((u) => (
              <option key={u} value={u}>
                {PROGRESS_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        )}

        {single ? (
          <span className="hint">
            단일 작품은 회차를 나누지 않습니다. 진도는 &lsquo;봤다&rsquo; 하나뿐이에요.
          </span>
        ) : (
          <>
            <input
              name="stages"
              type="number"
              min={1}
              max={2000}
              className="field"
              defaultValue={state.values?.stages ?? (work ? String(work.total_stages) : "")}
              placeholder={`전체 ${countNoun} 수 — 예: 9`}
            />
            <span className="hint">
              {editing
                ? `회차는 늘릴 수 있어요. 줄이는 것은 그 뒤 ${countNoun}에 글이나 진도가 없을 때만 됩니다.`
                : `등록하면 1${countNoun}부터 순서대로 진도 단계가 만들어집니다.`}
            </span>
          </>
        )}
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="description">
          04 · 한 줄 소개
        </label>
        <textarea
          id="description"
          name="description"
          className="field"
          rows={3}
          defaultValue={state.values?.description ?? work?.description ?? ""}
          placeholder="어떤 작품인지 한두 문장으로 적어주세요."
        />
        <span className="hint">
          줄거리 전문이나 결말은 적지 말아주세요. 이 소개는 아직 보지 않은 사람에게도 그대로
          보입니다.
        </span>
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="minutes">
          05 · 한 {single ? "편" : countNoun} 감상 시간 (선택)
        </label>
        <input
          id="minutes"
          name="minutes"
          type="number"
          min={1}
          max={1000}
          className="field"
          defaultValue={
            state.values?.minutes ?? (work?.minutes_per_stage ? String(work.minutes_per_stage) : "")
          }
          placeholder="분 단위 — 예: 60"
        />
        <span className="hint">
          남은 감상 시간과 추천에만 쓰는 값이에요. 공개 판정과는 상관없습니다.
        </span>
      </div>

      <div className="form-step">
        <span className="step-no">06 · 포스터와 정보 연결 (선택)</span>

        <div className="meta-now">
          {currentPoster ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={currentPoster} alt="" className="meta-thumb" />
          ) : (
            <span className="meta-thumb meta-thumb-empty" aria-hidden />
          )}
          <span className="stack" style={{ gap: 3 }}>
            <b>{currentPoster ? "연결된 포스터가 있습니다" : "연결된 포스터가 없습니다"}</b>
            <span className="hint">
              {currentYear || currentCreator
                ? [currentYear, currentCreator].filter(Boolean).join(" · ")
                : "연도·제작자도 비어 있습니다. 연결하지 않아도 등록은 됩니다."}
            </span>
          </span>
          <span className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-on-paper"
              style={{ padding: "8px 13px", fontSize: 13 }}
              onClick={findCandidates}
              disabled={searching}
            >
              {searching ? "찾는 중…" : "작품 정보 찾기"}
            </button>
            {(currentPoster || currentYear || currentCreator) && (
              <button
                type="button"
                className="textlink"
                onClick={() => {
                  setPicked(null);
                  setCleared(true);
                }}
              >
                연결 해제
              </button>
            )}
          </span>
        </div>

        {notice && <span className="hint">{notice}</span>}

        {candidates && candidates.length > 0 && (
          <div className="candidates">
            {candidates.map((c) => {
              const chosen = picked?.key === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  className="candidate"
                  aria-pressed={chosen}
                  onClick={() => {
                    setPicked(c);
                    setCleared(false);
                  }}
                >
                  {c.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.posterUrl} alt="" className="meta-thumb" />
                  ) : (
                    <span className="meta-thumb meta-thumb-empty" aria-hidden />
                  )}
                  <span className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <b>{c.title}</b>
                    <span>
                      {[c.kind, c.year, c.creator].filter(Boolean).join(" · ") || "정보 없음"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <span className="hint">
          이미지 파일은 저장하지 않고 공개 API가 주는 주소만 담습니다. 맞는 작품이 없으면
          고르지 않아도 됩니다.
        </span>
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-foot">
        <span>
          {editing
            ? "고친 내용은 바로 작품 화면에 반영됩니다."
            : "등록하면 바로 그 작품 화면으로 가서 진도를 정하고 첫 글을 쓸 수 있어요."}
        </span>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "저장 중…" : editing ? "수정 저장" : "작품 등록"}
        </button>
      </div>
    </form>
  );
}
