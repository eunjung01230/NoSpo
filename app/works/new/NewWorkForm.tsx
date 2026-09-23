"use client";

import { useActionState, useState } from "react";
import { createWorkAction, type WorkFormState } from "@/app/actions";
import { PROGRESS_UNITS, PROGRESS_UNIT_LABELS, unitNoun } from "@/lib/boards";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  ORIGINS,
  ORIGIN_LABELS,
  isCategory,
  usesOrigin,
} from "@/lib/categories";

/**
 * 새 작품 등록 폼. 저작권 보호를 위해 작품명·분야·진도 단위·한 줄 소개만 받는다.
 * 포스터·연도·제작자는 서버에서 공개 API로 한 번 찾아 채우므로 여기서 묻지 않는다.
 */
export default function NewWorkForm({ initialTitle }: { initialTitle: string }) {
  const [state, formAction, pending] = useActionState<WorkFormState, FormData>(
    createWorkAction,
    {}
  );
  const [category, setCategory] = useState(state.values?.category ?? "");
  const [unit, setUnit] = useState(state.values?.progressUnit ?? "episode");
  const single = unit === "single";
  const countNoun = unitNoun(single ? "episode" : unit);

  return (
    <form action={formAction} className="stack" style={{ gap: 28 }}>
      <div className="form-step">
        <label className="step-no" htmlFor="title">
          01 · 작품명
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="field"
          defaultValue={state.values?.title ?? initialTitle}
          placeholder="예: 오징어 게임 시즌 1"
        />
        <span className="hint">
          같은 작품이 이미 있으면 등록되지 않고 알려드려요. 시즌·부가 나뉘는 작품은
          시즌까지 적어주세요.
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
          onChange={(e) => setCategory(e.target.value)}
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
                  defaultChecked={(state.values?.origin ?? (i === 0 ? "domestic" : "")) === o}
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
          defaultValue={state.values?.genre ?? ""}
          placeholder="장르 (선택) — 예: 스릴러, SF, 액션"
        />
      </div>

      <div className="form-step">
        <label className="step-no" htmlFor="progressUnit">
          03 · 진도 단위
        </label>
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
              defaultValue={state.values?.stages ?? ""}
              placeholder={`전체 ${countNoun} 수 — 예: 9`}
            />
            <span className="hint">
              등록하면 1{countNoun}부터 순서대로 진도 단계가 만들어집니다.
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
          defaultValue={state.values?.description ?? ""}
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
          defaultValue={state.values?.minutes ?? ""}
          placeholder="분 단위 — 예: 60"
        />
        <span className="hint">
          남은 감상 시간과 추천에만 쓰는 값이에요. 공개 판정과는 상관없습니다.
        </span>
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-foot">
        <span>
          등록하면 바로 그 작품 화면으로 가서 진도를 정하고 첫 글을 쓸 수 있어요.
          포스터·연도·제작자는 공개 API에서 자동으로 찾아 채웁니다.
        </span>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "등록 중…" : "작품 등록"}
        </button>
      </div>
    </form>
  );
}
