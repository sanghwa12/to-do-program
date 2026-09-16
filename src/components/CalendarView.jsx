// ------------------------------------------------------------
// 달력 뷰 (F07): 날짜 있는 할 일을 월간 달력 위에서 보기
// - 마감·당일은 그 날짜 칸에, 기간은 시작~끝 모든 칸에 칩으로 표시
// - 칸을 클릭하면 아래에 그 날짜의 할 일 목록이 펼쳐짐
// - 펼친 영역 맨 위 입력칸으로 그 날짜에 바로 등록 (할 일 / 📢 일정, R9)
// ------------------------------------------------------------
import { useState } from "react";
import TaskItem from "./TaskItem.jsx";
import { todayStr } from "../date.js";
import { byDueDateTime } from "../sort.js";
import { addTask, addMemo } from "../db.js";
import { parseQuickInput } from "../parse.js";
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
  notes = [], // 날짜 있는 일정도 달력에 표시
  onToggle,
  onDelete,
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
  const notesOn = (dateStr) => notes.filter((n) => n.date === dateStr);
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

      {/* 요일 머리줄 */}
      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
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
              <span className="cal-day">{day}</span>
              {shownNotes.map((n) => (
                <span key={n.id} className="cal-chip notice">
                  📢 {n.text}
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
            {selected}{" "}
            <span className="group-count">{selectedTasks.length}</span>
          </h2>
          {/* 그 날짜에 바로 등록 (R9) — 날짜를 바꿔 클릭하면 입력칸도 새로 (key) */}
          <DayAdd key={selected} date={selected} />
          {/* 그날의 공지 (있으면 목록 위에) */}
          {selectedNotes.map((n) => (
            <p key={n.id} className="cal-note-line">
              📢 {n.text}
            </p>
          ))}
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

  async function handleSubmit(e) {
    e.preventDefault();
    const { title, ...fields } = parsed;
    if (title === "") return;
    if (kind === "note") {
      await addMemo(title, typedDate || date);
    } else if (parsed.dueDate || parsed.repeat) {
      await addTask(title, fields); // 텍스트 표기 우선 (맨 위 입력창과 동일)
    } else {
      await addTask(title, { dueDate: date, dateKind: "day" }); // 클릭한 날짜의 당일 일정
    }
    setText(""); // 커서는 그대로 → 연속 입력
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="cal-add">
        <button
          type="button"
          className={"date-toggle cal-kind" + (kind === "task" ? " active" : "")}
          onClick={() => setKind("task")}
        >
          할 일
        </button>
        <button
          type="button"
          className={"date-toggle cal-kind" + (kind === "note" ? " active" : "")}
          onClick={() => setKind("note")}
        >
          📢 일정
        </button>
        <input
          className="notice-input"
          type="text"
          placeholder={
            kind === "note" ? `${label} 일정 노트 + Enter` : `${label}에 할 일 + Enter`
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </div>
      {text.trim() !== "" && (
        <p className="parse-hint">
          "{parsed.title}" —{" "}
          {kind === "note"
            ? `📢 ${typedDate || date} 일정 노트로 저장됩니다`
            : typedDate
              ? `텍스트의 날짜 표기대로 저장됩니다 (📅 ${parsed.dueDate})`
              : `📅 ${date} 당일 할 일로 저장됩니다`}
        </p>
      )}
    </form>
  );
}
