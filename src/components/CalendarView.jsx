// ------------------------------------------------------------
// 달력 뷰 (F07): 날짜 있는 할 일을 월간 달력 위에서 보기
// - 마감·당일은 그 날짜 칸에, 기간은 시작~끝 모든 칸에 칩으로 표시
// - 칸을 클릭하면 아래에 그 날짜의 할 일 목록이 펼쳐짐
// - 펼친 영역 맨 위 입력칸으로 그 날짜에 바로 등록 (할 일 / 📢 일정, R9)
// - 공휴일·일요일은 빨간 날짜, 공휴일은 이름도 표시 (R10)
// - 아래 목록에서 일정도 할 일처럼 수정/삭제 (F11 R10)
// ------------------------------------------------------------
import { useState } from "react";
import TaskItem from "./TaskItem.jsx";
import EventItem from "./EventItem.jsx";
import { todayStr } from "../date.js";
import { byDueDateTime } from "../sort.js";
import { addTask, addMemo } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { holidayName, hasHolidayData } from "../holidays.js";
import {
  firstLineOf,
  notesOnDate,
  byNoteTime,
  noteDatesFrom,
  noteDateText,
} from "../notes.js";
import {
  buildMonthCells,
  tasksOnDate,
  moveMonth,
  dateStrOf,
} from "../calendar.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_CHIPS = 3; // 한 칸에 보여줄 최대 칩 수 (R5)

export default function CalendarView({
  tasks,
  notes = [], // 일정 (날짜 있는 노트) — 달력에 보라색 줄로 표시
  onToggle,
  onDelete,
  onConvert, // 할 일 → 일정으로 바꾸기 (F11 R9)
  onDeleteNote, // 일정 삭제 (F11 R10)
  onConvertNote, // 일정 → 할 일로 바꾸기
  onSkipDay, // (종류, 항목, 날짜) 기간에서 그 날만 빼기 (F03 R9) — 종류는 "task" | "note"
}) {
  const today = todayStr();
  const [todayY, todayM] = today.split("-").map(Number);

  const [year, setYear] = useState(todayY);
  const [month, setMonth] = useState(todayM); // 1~12
  const [selected, setSelected] = useState(null); // 클릭한 날짜 ("YYYY-MM-DD" 또는 null)

  // ◀ ▶ 로 달 이동 (해 넘김은 moveMonth가 처리)
  function handleMove(delta) {
    const next = moveMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
    setSelected(null); // 달이 바뀌면 선택 해제
  }

  // "오늘" 버튼: 이번 달로 돌아와 오늘을 선택
  // ※ 누르는 순간의 날짜를 새로 계산 — 자정을 넘겨 켜둔 화면에서도 진짜 오늘로 가게
  function handleToday() {
    const now = todayStr();
    const [y, m] = now.split("-").map(Number);
    setYear(y);
    setMonth(m);
    setSelected(now);
  }

  const cells = buildMonthCells(year, month);
  const selectedTasks = selected
    ? tasksOnDate(tasks, selected).sort(byDueDateTime) // 시간 있는 것 먼저, 시간 순
    : [];
  // 그 날짜에 걸린 일정 — 기간 일정은 시작~끝 모든 칸에, 같은 날은 시간 순 (F11 R8)
  const notesOn = (dateStr) => notesOnDate(notes, dateStr).sort(byNoteTime);
  const selectedNotes = selected ? notesOn(selected) : [];

  return (
    <div className="calendar">
      {/* 달 이동 헤더 */}
      <div className="cal-nav">
        <button onClick={() => handleMove(-1)} aria-label="이전 달">
          ◀
        </button>
        <span className="cal-month-label">
          {year}년 {month}월
        </span>
        <button onClick={() => handleMove(1)} aria-label="다음 달">
          ▶
        </button>
        <button className="cal-today-btn" onClick={handleToday}>
          오늘
        </button>
      </div>

      {/* 공휴일 표에 없는 해 (R10) — 빨간 날이 조용히 빠지지 않게 알려줌 */}
      {!hasHolidayData(year) && (
        <p className="cal-no-holiday">
          {year}년 공휴일 정보는 아직 없어요 (일요일만 빨갛게 표시)
        </p>
      )}

      {/* 요일 머리줄 — 일요일은 빨강 (R10) */}
      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={"cal-weekday" + (i === 0 ? " red" : "")}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 칸들 */}
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="cal-cell empty" />;
          }
          const ds = dateStrOf(year, month, day);
          const holiday = holidayName(ds); // 공휴일 이름 (없으면 undefined)
          const red = holiday || i % 7 === 0; // 빨간 날 = 공휴일 또는 일요일 (R10)
          const dayNotes = notesOn(ds); // 공지 먼저, 그다음 할 일
          const list = tasksOnDate(tasks, ds).sort(byDueDateTime);
          const shownNotes = dayNotes.slice(0, MAX_CHIPS);
          const shown = list.slice(0, Math.max(0, MAX_CHIPS - shownNotes.length));
          const hidden = dayNotes.length + list.length - shownNotes.length - shown.length;
          return (
            <button
              key={i}
              className={
                "cal-cell" +
                (ds === today ? " today" : "") +
                (ds === selected ? " selected" : "")
              }
              onClick={() => setSelected(ds === selected ? null : ds)}
            >
              <span className={"cal-day" + (red ? " red" : "")}>
                {day}
                {holiday && <span className="cal-holiday">{holiday}</span>}
              </span>
              {shownNotes.map((n) => (
                <span key={n.id} className="cal-chip notice">
                  📢 {n.time ? `${n.time} ` : ""}
                  {firstLineOf(n.text)}
                </span>
              ))}
              {shown.map((t) => (
                <span
                  key={t.id}
                  className={"cal-chip" + (t.done ? " done" : "")}
                >
                  {t.dueTime ? `${t.dueTime} ` : ""}
                  {t.title}
                </span>
              ))}
              {hidden > 0 && <span className="cal-more">+{hidden}</span>}
            </button>
          );
        })}
      </div>

      {/* 클릭한 날짜의 할 일 목록 (R6) */}
      {selected && (
        <div className="cal-selected">
          <h2 className="group-title">
            {selected}
            {holidayName(selected) && (
              <span className="holiday-name"> · {holidayName(selected)}</span>
            )}{" "}
            <span className="group-count">{selectedTasks.length}</span>
          </h2>
          {/* 그 날짜에 바로 등록 (R9) — 날짜를 바꿔 클릭하면 입력칸도 새로 (key) */}
          <DayAdd key={selected} date={selected} />
          {/* 그날의 일정 (할 일 목록 위에) — 할 일처럼 수정/삭제 가능 (F11 R10) */}
          {selectedNotes.length > 0 && (
            <ul className="task-list">
              {selectedNotes.map((n) => (
                <EventItem
                  key={n.id}
                  note={n}
                  onDelete={onDeleteNote}
                  onConvert={onConvertNote}
                  dayContext={selected}
                  onSkipDay={(note, day) => onSkipDay("note", note, day)}
                />
              ))}
            </ul>
          )}
          {selectedTasks.length === 0 ? (
            selectedNotes.length === 0 && (
              <p className="hint">이 날짜의 할 일이 없어요.</p>
            )
          ) : (
            <ul className="task-list">
              {selectedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onConvert={onConvert}
                  dayContext={selected}
                  onSkipDay={(t, day) => onSkipDay("task", t, day)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 선택한 날짜에 바로 등록 (R9): 제목만 치고 Enter — 날짜는 클릭한 칸(당일)
// "할 일"은 맨 위 입력창과 같은 규칙, "📢 일정"은 노트 입력줄과 같은 규칙.
// 텍스트에 날짜 표기(~9/25 등)를 쓰면 그게 우선 — 날짜가 제목에 글자로 박히지 않게.
// ------------------------------------------------------------
function DayAdd({ date }) {
  const [kind, setKind] = useState("task"); // "task" 할 일 | "note" 📢 일정
  const [text, setText] = useState("");

  const parsed =
    kind === "note"
      ? parseQuickInput(text, { allowPast: true, repeatable: false })
      : parseQuickInput(text);
  const typedDate = parsed.startDate || parsed.dueDate; // 텍스트에 날짜를 썼나
  const label = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`; // "9/20"
  // [일정] 날짜 칸: 텍스트 표기(기간·시간 포함)가 우선, 없으면 클릭한 날짜
  const noteDates = noteDatesFrom(parsed, date);

  async function handleSubmit(e) {
    e.preventDefault();
    const { title, ...fields } = parsed;
    if (title === "") return;
    if (kind === "note") {
      await addMemo(title, noteDates);
    } else if (parsed.dueDate || parsed.repeat) {
      await addTask(title, fields); // 텍스트 표기 우선 (맨 위 입력창과 동일)
    } else {
      await addTask(title, { dueDate: date, dateKind: "day" }); // 클릭한 날짜의 당일 할 일
    }
    setText(""); // 커서는 그대로 → 연속 입력
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="cal-add">
        <button
          type="button"
          className={"date-toggle kind-btn" + (kind === "task" ? " active" : "")}
          onClick={() => setKind("task")}
        >
          <span className="check-icon" aria-hidden="true" />
          할 일
        </button>
        <button
          type="button"
          className={
            "date-toggle kind-btn kind-note" + (kind === "note" ? " active" : "")
          }
          onClick={() => setKind("note")}
        >
          📢 일정
        </button>
        <input
          className={"notice-input" + (kind === "note" ? " note" : "")}
          type="text"
          placeholder={
            kind === "note" ? `${label}에 일정 + Enter` : `${label}에 할 일 + Enter`
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </div>
      {text.trim() !== "" && (
        <p className={"parse-hint" + (kind === "note" ? " event" : "")}>
          "{parsed.title}" —{" "}
          {kind === "note"
            ? `📢 ${noteDateText(noteDates)} 일정으로 저장됩니다`
            : typedDate
              ? `텍스트의 날짜 표기대로 저장됩니다 (📅 ${parsed.dueDate})`
              : `📅 ${date} 당일 할 일로 저장됩니다`}
        </p>
      )}
    </form>
  );
}
