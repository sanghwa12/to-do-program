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
  movePlanLine,
  markPlanMovedToMemo,
  addExtraLine,
  deleteExtraLine,
  setDayNote,
  addTask,
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
  const movedCount = plans.filter((p) => p.movedTo).length;
  // 미루기 가능한 것 = 미완료이면서 아직 안 미룬 것
  const deferrable = plans.filter((p) => !p.done && !p.movedTo);
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
      {/* 오늘 탭에 포함된 블록 (2026-08-05 통합) — ◀▶로 지난 날 기록 열람 */}
      <h2 className="group-title">📓 하루 기록</h2>
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
          <PlanLine key={p.id} date={date} line={p} today={today} />
        ))}
      </ul>
      {/* 미완료 일괄 미루기 (R8) — 이미 미룬 것은 제외 */}
      {deferrable.length > 1 && (
        <button
          className="link-btn"
          onClick={async () => {
            const next = shiftDate(date, 1);
            for (const p of deferrable) {
              await movePlanLine(date, p.id, next);
            }
          }}
        >
          미완료 {deferrable.length}개 모두{" "}
          {date === today ? "내일로" : "다음날로"} →
        </button>
      )}
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

      {/* 비교 요약 + 회고 (R5) — 미룬 것도 총 개수에 포함 (기록 보존, R8) */}
      <div className="day-summary">
        계획 {plans.length}개 중 <b>{achieved}개 달성</b>
        {movedCount > 0 && <> · {movedCount}개 미룸</>} · 완료한 할 일{" "}
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

// 계획 한 줄 (R8): 체크·삭제 + 미완료면 미루기 (내일로/날짜…/메모로)
// 미룬 줄은 지우지 않고 "→ 어디로" 표시로 남음 (총 개수 보존)
function PlanLine({ date, line, today }) {
  const [showDatePick, setShowDatePick] = useState(false);
  const nextLabel = date === today ? "내일로" : "다음날로";

  // "언젠가 할 일"로: 날짜 없는 할 일 생성 → 노란 📌 메모판. 원본엔 미룸 표시
  async function toMemo() {
    await addTask(line.text);
    await markPlanMovedToMemo(date, line.id);
  }

  // 이미 미룬 줄: 흐리게 + 행선지만 표시 (체크·미루기 없음, 삭제만 가능)
  if (line.movedTo) {
    return (
      <li className="day-line moved">
        <span className="day-moved-mark">→</span>
        <span className="day-text">{line.text}</span>
        <span className="day-moved-badge">
          {line.movedTo === "memo" ? "메모로 미룸" : `${line.movedTo}로 미룸`}
        </span>
        <button
          className="day-delete"
          onClick={() => deletePlanLine(date, line.id)}
          aria-label="계획 줄 삭제"
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <li className={"day-line" + (line.done ? " done" : "")}>
      <label>
        <input
          type="checkbox"
          checked={line.done}
          onChange={() => togglePlanLine(date, line.id)}
        />
        <span className="day-text">{line.text}</span>
      </label>
      {!line.done && (
        <span className="day-actions">
          <button
            onClick={() => movePlanLine(date, line.id, shiftDate(date, 1))}
            title="다음 날 계획으로 보내기"
          >
            {nextLabel}
          </button>
          <button
            onClick={() => setShowDatePick((s) => !s)}
            title="원하는 날짜로 미루기"
          >
            날짜…
          </button>
          <button onClick={toMemo} title="날짜 없는 할 일(📌 메모)로 남겨두기">
            메모로
          </button>
        </span>
      )}
      <button
        className="day-delete"
        onClick={() => deletePlanLine(date, line.id)}
        aria-label="계획 줄 삭제"
      >
        ✕
      </button>
      {showDatePick && (
        <input
          type="date"
          className="day-datepick"
          onChange={(e) => {
            if (e.target.value) movePlanLine(date, line.id, e.target.value);
          }}
          autoFocus
        />
      )}
    </li>
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
