// ------------------------------------------------------------
// 하루 기록 (F04): 매일 쓰는 계획서 + 일기
//  · 오늘의 계획: 자유 줄 작성 + 달성 체크 (할 일 앱과 독립)
//  · 실제 한 일: 그날 완료한 할 일 자동 + 계획 외 한 일 수기
//  · 비교 요약 + 회고 한 줄
// ------------------------------------------------------------
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  addPlanLine,
  togglePlanLine,
  deletePlanLine,
  addExtraLine,
  deleteExtraLine,
  setDayNote,
} from "../db.js";
import { todayStr, dateOnly } from "../date.js";
import { WEEKDAY_LABEL } from "../labels.js";

/** "YYYY-MM-DD"를 delta일만큼 이동 */
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DayView({ tasks }) {
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [planText, setPlanText] = useState("");
  const [extraText, setExtraText] = useState("");

  // 그 날짜의 기록 (없으면 undefined — 빈 상태로 표시)
  const log = useLiveQuery(() => db.dayLogs.get(date), [date]);
  const plans = log?.plans ?? [];
  const extras = log?.extras ?? [];

  // 그날 완료한 할 일 자동 수집 (R4①) — 완료 시각이 그 날짜인 것
  const doneTasks = tasks
    .filter((t) => t.done && t.completedAt && dateOnly(t.completedAt) === date)
    .sort((a, b) => (a.completedAt || "").localeCompare(b.completedAt || ""));

  const achieved = plans.filter((p) => p.done).length;
  const weekday = WEEKDAY_LABEL[new Date(date + "T00:00:00").getDay()];

  async function handleAddPlan(e) {
    e.preventDefault();
    const text = planText.trim();
    if (!text) return;
    await addPlanLine(date, text);
    setPlanText("");
  }

  async function handleAddExtra(e) {
    e.preventDefault();
    const text = extraText.trim();
    if (!text) return;
    await addExtraLine(date, text);
    setExtraText("");
  }

  return (
    <div className="day-view">
      {/* 날짜 이동 */}
      <div className="cal-nav">
        <button onClick={() => setDate(shiftDate(date, -1))} aria-label="어제">
          ◀
        </button>
        <span className="cal-month-label">
          {date} ({weekday})
        </span>
        <button onClick={() => setDate(shiftDate(date, 1))} aria-label="다음날">
          ▶
        </button>
        <button className="cal-today-btn" onClick={() => setDate(todayStr())}>
          오늘
        </button>
      </div>

      {/* 오늘의 계획 (R3) — 자유 작성 */}
      <h2 className="group-title">
        📝 오늘의 계획 <span className="group-count">{plans.length}</span>
      </h2>
      <ul className="day-list">
        {plans.map((p) => (
          <li key={p.id} className={"day-line" + (p.done ? " done" : "")}>
            <label>
              <input
                type="checkbox"
                checked={p.done}
                onChange={() => togglePlanLine(date, p.id)}
              />
              <span className="day-text">{p.text}</span>
            </label>
            <button
              className="day-delete"
              onClick={() => deletePlanLine(date, p.id)}
              aria-label="계획 줄 삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddPlan}>
        <input
          className="day-input"
          type="text"
          placeholder="계획 한 줄 쓰고 Enter (자유롭게)"
          value={planText}
          onChange={(e) => setPlanText(e.target.value)}
        />
      </form>

      {/* 실제 한 일 (R4) */}
      <h2 className="group-title">
        ✅ 실제 한 일{" "}
        <span className="group-count">{doneTasks.length + extras.length}</span>
      </h2>
      {doneTasks.length === 0 && extras.length === 0 && (
        <p className="hint small">아직 없어요. 할 일을 완료하면 여기 자동으로 쌓여요.</p>
      )}
      <ul className="day-list">
        {doneTasks.map((t) => (
          <li key={t.id} className="day-line auto">
            <span className="day-text">✓ {t.title}</span>
            <span className="day-time">
              {new Date(t.completedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
        {extras.map((x) => (
          <li key={x.id} className="day-line">
            <span className="day-text">+ {x.text}</span>
            <button
              className="day-delete"
              onClick={() => deleteExtraLine(date, x.id)}
              aria-label="계획 외 줄 삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddExtra}>
        <input
          className="day-input"
          type="text"
          placeholder="계획에 없었는데 한 일 + Enter"
          value={extraText}
          onChange={(e) => setExtraText(e.target.value)}
        />
      </form>

      {/* 비교 요약 + 회고 (R5) */}
      <div className="day-summary">
        계획 {plans.length}개 중 <b>{achieved}개 달성</b> · 완료한 할 일{" "}
        {doneTasks.length}건 · 계획 외 {extras.length}건
      </div>
      <NoteLine
        key={date + "|" + (log ? "1" : "0")}
        date={date}
        initial={log?.note ?? ""}
      />
    </div>
  );
}

// 회고 한 줄 — Enter나 칸 밖 클릭으로 저장
function NoteLine({ date, initial }) {
  const [val, setVal] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDayNote(date, val);
      }}
    >
      <input
        className="day-input note"
        type="text"
        placeholder="오늘 한 줄 회고 (선택) — Enter로 저장"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => setDayNote(date, val)}
      />
    </form>
  );
}
