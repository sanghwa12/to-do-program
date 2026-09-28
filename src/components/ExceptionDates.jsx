// ------------------------------------------------------------
// 기간의 예외 날짜 고르기 (F03 R9): "제외할 날" / "추가할 날"
// 할 일 수정 화면과 일정 수정 화면이 함께 씀.
//  · 날짜를 고르고 옆의 버튼(제외/추가)을 누르면 아래에 칩으로 쌓임 (날짜 칸에서 Enter도 같음)
//    — 고르자마자 넣지 않는 이유: 키보드로 날짜를 치면 다 치기 전의 중간 값이 들어가 버림
//  · 칩의 ✕를 누르면 되돌림
//  · 기간 안의 날을 "추가할 날"로 고르면 = 제외했던 것을 되돌리는 것
// 저장은 부모(수정 화면)의 저장 버튼이 함 — 여기선 목록만 바꿔서 알려줌(onChange)
// ------------------------------------------------------------
import { useState } from "react";
import { isActiveOn, canSkip, skipDay, addDay } from "../span.js";

/** "2026-10-09" → "10/9" */
const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;

// start·end: 기간의 시작·끝 / skip·extra: 지금의 제외·추가 목록 / onChange({ skip, extra })
export default function ExceptionDates({ start, end, skip, extra, onChange }) {
  const [skipPick, setSkipPick] = useState(""); // 제외하려고 고른 날짜 (아직 목록엔 없음)
  const [extraPick, setExtraPick] = useState(""); // 추가하려고 고른 날짜
  const span = { start, end, skip, extra };

  // 넣을 수 있는 날짜인가 — 제외: 지금 걸리는 날이고 빼도 하루는 남음 / 추가: 아직 안 걸리는 날
  const skipOk = skipPick !== "" && canSkip(span, skipPick);
  const extraOk = extraPick !== "" && !isActiveOn(span, extraPick);

  function applySkip() {
    if (!skipOk) return;
    onChange(skipDay(span, skipPick));
    setSkipPick("");
  }
  function applyExtra() {
    if (!extraOk) return;
    onChange(addDay(span, extraPick));
    setExtraPick("");
  }
  // 날짜 칸에서 Enter = 옆의 버튼 누르기 (수정 화면 전체가 저장되며 닫히지 않게 막음)
  const onEnter = (apply) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  };

  return (
    <div className="exc">
      <div className="exc-row">
        <label>
          제외할 날
          <input
            type="date"
            value={skipPick}
            min={start}
            max={end}
            onChange={(e) => setSkipPick(e.target.value)}
            onKeyDown={onEnter(applySkip)}
          />
        </label>
        <button
          type="button"
          onClick={applySkip}
          disabled={!skipOk}
          title="기간 중에서 이 날만 빼기"
        >
          제외
        </button>
        <div className="exc-chips">
          {skip.map((d) => (
            <span key={d} className="exc-chip skip">
              {md(d)} 제외
              <button
                type="button"
                onClick={() => onChange(addDay(span, d))}
                aria-label={`${md(d)} 제외 취소`}
                title="제외 취소"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="exc-row">
        <label>
          추가할 날
          <input
            type="date"
            value={extraPick}
            onChange={(e) => setExtraPick(e.target.value)}
            onKeyDown={onEnter(applyExtra)}
          />
        </label>
        <button
          type="button"
          onClick={applyExtra}
          disabled={!extraOk}
          title="기간 밖의 날을 하루 더하기"
        >
          추가
        </button>
        <div className="exc-chips">
          {extra.map((d) => (
            <span key={d} className="exc-chip extra">
              {md(d)} 추가
              <button
                type="button"
                onClick={() => onChange(skipDay(span, d))}
                aria-label={`${md(d)} 추가 취소`}
                title="추가 취소"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
