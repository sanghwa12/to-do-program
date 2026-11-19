// ------------------------------------------------------------
// 일정 한 줄 (F11 R10): 할 일 줄(TaskItem)과 같은 방식으로 다룸
//  · 마우스를 올리면 수정/삭제
//  · 수정은 그 자리에서 (노트 에디터 재사용 — 글·날짜·끝 날짜·시간·할 일로 바꾸기)
//  · 할 일과의 차이: 체크박스 대신 📢, 왼쪽 줄이 보라색 (할 일은 파랑)
// 모양은 두 가지:
//  · 기본    — 달력 아래 목록의 카드 (할 일 카드와 같은 틀)
//  · compact — 오늘 탭 일정 블록의 한 줄 (when = "9/29 (화) · 내일" 같은 앞머리, 없으면 굵게)
// dayContext + onSkipDay(일정, 날짜): 달력에서 고른 날짜 — 기간 일정에 "이 날 빼기" (F03 R9)
// ------------------------------------------------------------
import { useState } from "react";
import Icon from "./Icon.jsx";
import { MemoEditor } from "./MemoView.jsx";
import { todayStr } from "../date.js";
import { noteDateText, noteLastDate } from "../notes.js";
import {
  spanOfNote,
  isActiveOn,
  exceptionText,
  canSkip,
  ddayText,
} from "../span.js";

/** "2026-10-06" → "10/6" */
const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;

export default function EventItem({
  note,
  onDelete,
  onConvert,
  compact = false,
  when = "",
  dayContext,
  onSkipDay,
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
  const span = spanOfNote(note);
  // 기간의 예외 날짜를 글로 (" · 제외 10/9 · 추가 10/19") — 기간일 때만
  const exceptions = note.endDate ? exceptionText(note) : "";

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
        {/* 달력에서 고른 날짜만 빼기 (F03 R9) — 기간 일정이고, 뺄 수 있는 날일 때만 */}
        {dayContext && onSkipDay && note.endDate && canSkip(span, dayContext) && (
          <button
            onClick={() => onSkipDay(note, dayContext)}
            title="이 날짜만 빼기 — 기간의 다른 날은 그대로"
          >
            이 날 빼기
          </button>
        )}
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="수정" title="수정"><Icon name="edit" /></button>
        <button className="icon-btn delete" onClick={() => setConfirmDelete(true)} aria-label="삭제" title="삭제">
          <Icon name="trash" />
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
            {exceptions}
          </span>
        )}
        {actions("event-actions")}
      </li>
    );
  }

  // 달력 아래 목록의 카드
  const today = todayStr();
  const isPast = noteLastDate(note) < today;
  const ongoing = note.endDate && isActiveOn(span, today); // 기간이 오늘을 지나는 중
  const dday = ddayText(span, today); // 남은 날 "D-3" (F03 R12 — 할 일과 같은 규칙)

  return (
    <li className={"task-item task-row event-item" + (isPast ? " past" : "")}>
      <div className="task-content">
        <div className="task-main-row">
          <span className="event-mark" aria-hidden="true">
            <Icon name="calendar" />
          </span>
          <span className="task-title">{first}</span>
        </div>
        {detail && <p className="task-memo">{detail}</p>}
        <div className="task-badges">
          <span className="badge">
            <Icon name="calendar" /> {noteDateText(note)}
            {exceptions}
            {isPast && " · 지남"}
            {ongoing && " · 진행중"}
            {dday && ` · ${dday}`}
          </span>
        </div>
      </div>
      {actions("task-buttons")}
    </li>
  );
}
