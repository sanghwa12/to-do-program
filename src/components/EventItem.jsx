// ------------------------------------------------------------
// 일정 한 줄 (F11 R10): 할 일 줄(TaskItem)과 같은 방식으로 다룸
//  · 마우스를 올리면 수정/삭제
//  · 수정은 그 자리에서 (노트 에디터 재사용 — 글·날짜·끝 날짜·시간·할 일로 바꾸기)
//  · 할 일과의 차이: 체크박스 대신 📢, 보라색
// 모양은 두 가지:
//  · 기본    — 달력 아래 목록의 카드 (할 일 카드와 같은 틀)
//  · compact — 오늘 탭 일정 블록의 한 줄 (when = "9/29 (화) · 내일" 같은 앞머리, 없으면 굵게)
// ------------------------------------------------------------
import { useState } from "react";
import { MemoEditor } from "./MemoView.jsx";
import { todayStr } from "../date.js";
import { noteDateText, noteLastDate } from "../notes.js";

/** "2026-10-06" → "10/6" */
const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;

export default function EventItem({
  note,
  onDelete,
  onConvert,
  compact = false,
  when = "",
}) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [confirmDelete, setConfirmDelete] = useState(false); // 삭제 확인 중?

  // ----- 편집 모드: 그 자리에 에디터 -----
  if (editing) {
    return (
      <li className={(compact ? "event-line" : "task-item event-item") + " editing"}>
        <MemoEditor
          memo={note}
          rows={compact ? 3 : 4}
          onClose={() => setEditing(false)}
          onDelete={onDelete}
          onConvert={onConvert}
        />
      </li>
    );
  }

  // ----- 보통 모드 -----
  const [first, ...rest] = note.text.split("\n"); // 첫 줄 = 제목, 나머지 = 세부 내용
  const detail = rest.join("\n").trim();

  // 수정/삭제 버튼 — 삭제는 그 자리에서 한 번 더 확인 (할 일과 같은 방식)
  const actions = (className) =>
    confirmDelete ? (
      <div className={className + " confirm"}>
        <span className="confirm-text">삭제할까요?</span>
        <button
          className="delete"
          onClick={() => {
            onDelete(note);
            setConfirmDelete(false);
          }}
        >
          삭제
        </button>
        <button onClick={() => setConfirmDelete(false)}>취소</button>
      </div>
    ) : (
      <div className={className}>
        <button onClick={() => setEditing(true)}>수정</button>
        <button className="delete" onClick={() => setConfirmDelete(true)}>
          삭제
        </button>
      </div>
    );

  // 오늘 탭 일정 블록의 한 줄
  if (compact) {
    return (
      <li className={"event-line" + (when ? "" : " today")}>
        {when && <span className="event-when">{when}</span>}
        {note.time && <span className="event-time">{note.time}</span>}
        <span className="event-text" title={detail || undefined}>
          {first}
        </span>
        {note.endDate && (
          <span className="event-range">
            {md(note.date)}~{md(note.endDate)}
          </span>
        )}
        {actions("event-actions")}
      </li>
    );
  }

  // 달력 아래 목록의 카드
  const today = todayStr();
  const isPast = noteLastDate(note) < today;
  const ongoing = note.endDate && note.date <= today && !isPast; // 기간이 오늘을 지나는 중

  return (
    <li className={"task-item event-item" + (isPast ? " past" : "")}>
      <div className="task-main-row">
        <span className="event-mark" aria-hidden="true">
          📢
        </span>
        <span className="task-title">{first}</span>
      </div>
      {detail && <p className="task-memo">{detail}</p>}
      <div className="task-badges">
        <span className="badge">
          📅 {noteDateText(note)}
          {isPast && " · 지남"}
          {ongoing && " · 진행중"}
        </span>
      </div>
      {actions("task-buttons")}
    </li>
  );
}
