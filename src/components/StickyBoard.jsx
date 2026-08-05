// ------------------------------------------------------------
// 메모판 (F03 R2c): 날짜 미정 + 미완료 할 일을 스티커 메모처럼
// 오늘 탭 하단에 항상 보여줌 — 잊히지 않게.
// 체크 = 완료, 글자 클릭 = 그 자리에서 바로 수정 (2026-08-05 추가)
// 삭제·날짜 붙이기 같은 세부 작업은 "전체" 탭에서.
// ------------------------------------------------------------
import { useState } from "react";
import { updateTask } from "../db.js";

// 우선순위 정렬 순서: 높음 → 중간 → 낮음 → 미지정
const ORDER = { high: 0, med: 1, low: 2 };

/** 등록 시각 → "M/D" 짧은 날짜 (좁은 칸에 맞게) */
function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StickyBoard({ tasks, onToggle }) {
  const sorted = [...tasks].sort(
    (a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3)
  );

  return (
    <section className="sticky-board">
      <h2 className="sticky-title">
        📌 메모 <span className="group-count">{tasks.length}</span>
      </h2>
      <ul className="sticky-list">
        {sorted.map((t) => (
          <StickyItem key={t.id} task={t} onToggle={onToggle} />
        ))}
      </ul>
      <p className="sticky-hint">체크하면 완료 · 글자를 누르면 바로 수정</p>
    </section>
  );
}

// 메모 한 줄: 체크박스 + (점) + 글자(클릭하면 그 자리 수정) + 등록일
function StickyItem({ task, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  function save() {
    const v = value.trim();
    if (v !== "" && v !== task.title) {
      updateTask(task.id, { title: v });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="sticky-item">
        <input
          className="sticky-edit"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setValue(task.title); // 고치던 내용 버리기
              setEditing(false);
            }
          }}
          onBlur={save}
          autoFocus
        />
      </li>
    );
  }

  return (
    <li className="sticky-item">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task)}
      />
      {/* 우선순위가 있으면 색 점으로 표시 (R13과 동일한 색) */}
      {task.priority && (
        <span className={"pri-dot static pri-" + task.priority} />
      )}
      <span
        className={"sticky-text" + (task.priority === "high" ? " hi" : "")}
        onClick={() => {
          setValue(task.title);
          setEditing(true);
        }}
        title="클릭해서 수정"
      >
        {task.title}
      </span>
      {/* 언제 남긴 메모인지 (등록일) */}
      <span className="sticky-date">{shortDate(task.createdAt)}</span>
    </li>
  );
}
