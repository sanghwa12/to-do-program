// ============================================================
// 일정(날짜 있는 노트) 도우미 — 화면과 분리된 순수 계산 함수 (Node로 테스트 가능)
// ------------------------------------------------------------
// 일정 = 노트(memos) 중 날짜가 있는 것 (F11). 날짜 칸은 세 가지:
//   date     : 날짜 (기간이면 시작일)
//   endDate? : 기간의 끝 — 있으면 "기간 일정" (F11 R8, 2026-09-28)
//   time?    : 시간 "HH:MM" — 기간이 아닐 때만 (F11 R8)
// ============================================================
import { compareTime } from "./sort.js";

/** 노트의 첫 줄 = 제목 역할 */
export function firstLineOf(text) {
  return text.split("\n")[0];
}

/** 날짜 칸 정리 (저장 직전에 항상 거침):
 *  날짜가 없으면 끝·시간도 없음 / 끝이 시작보다 빠르면 앞뒤를 바꿈 /
 *  끝이 시작과 같으면 하루짜리 / 기간에는 시간 없음. 값이 있는 칸만 돌려줌 */
export function normalizeNoteDates({ date, endDate, time } = {}) {
  if (!date) return {};
  let from = date;
  let to = endDate || "";
  if (to && to < from) [from, to] = [to, from];
  if (to === from) to = "";
  if (to) return { date: from, endDate: to };
  return time ? { date: from, time } : { date: from };
}

/** 일정의 마지막 날 (기간이면 끝, 아니면 그 날짜) */
export function noteLastDate(note) {
  return note.endDate || note.date;
}

/** 그 날짜에 걸리는 일정들 — 기간 일정은 시작~끝의 모든 날에 걸림 */
export function notesOnDate(notes, dateStr) {
  return notes.filter(
    (n) => n.date && n.date <= dateStr && dateStr <= noteLastDate(n)
  );
}

/** 같은 날 안에서의 순서: 시간 있는 것 먼저(시간 순), 없는 것은 뒤.
 *  시간이 같으면(둘 다 없을 때 포함) 먼저 시작한 것 → 먼저 만든 것 순 —
 *  기준이 없으면 저장소가 주는 순서(무작위 id 순)라 볼 때마다 달라 보임 */
export function byNoteTime(a, b) {
  return (
    compareTime(a.time, b.time) ||
    (a.date || "").localeCompare(b.date || "") ||
    (a.createdAt || "").localeCompare(b.createdAt || "")
  );
}

/** 일정의 날짜 표기: "2026-10-06 ~ 2026-10-16" / "2026-10-01 14:00" / "2026-10-01" */
export function noteDateText(note) {
  if (note.endDate) return `${note.date} ~ ${note.endDate}`;
  return note.time ? `${note.date} ${note.time}` : note.date;
}

/** 입력 인식 결과(parseQuickInput) → 일정의 날짜 칸.
 *  텍스트에 날짜 표기가 없으면 fallbackDate(📅로 고른 날짜·달력에서 누른 칸)를 씀 */
export function noteDatesFrom(parsed, fallbackDate = "") {
  if (parsed.dateKind === "range" && parsed.startDate)
    return normalizeNoteDates({ date: parsed.startDate, endDate: parsed.dueDate });
  if (parsed.dueDate)
    return normalizeNoteDates({ date: parsed.dueDate, time: parsed.dueTime });
  return normalizeNoteDates({ date: fallbackDate });
}

// ------------------------------------------------------------
// 할 일 ↔ 일정 변환 (F11 R9) — 같은 id를 유지해서 되돌리기 쉽게
// ------------------------------------------------------------

/** 할 일 → 일정: 제목(+세부 메모) → 글, 날짜·기간·시간은 그대로.
 *  완료 체크·반복처럼 일정에 없는 것은 옮기지 않음. now = 바꾼 시각(ISO) */
export function taskToNote(task, now) {
  const isRange = task.dateKind === "range" && task.startDate;
  return {
    id: task.id,
    text: task.memo ? `${task.title}\n${task.memo}` : task.title,
    ...normalizeNoteDates(
      isRange
        ? { date: task.startDate, endDate: task.dueDate }
        : { date: task.dueDate, time: task.dueTime }
    ),
    createdAt: task.createdAt,
    updatedAt: now,
  };
}

/** 일정 → 할 일: 첫 줄 → 제목, 나머지 줄 → 세부 메모.
 *  기간 일정은 기간 할 일로, 하루짜리는 "당일" 할 일로 (미완료 상태) */
export function noteToTask(note) {
  const [first, ...rest] = note.text.split("\n");
  const memo = rest.join("\n").trim();
  const d = normalizeNoteDates(note);
  return {
    id: note.id,
    title: first.trim(),
    ...(memo && { memo }),
    dueDate: d.endDate || d.date,
    ...(d.endDate && { startDate: d.date }),
    dateKind: d.endDate ? "range" : "day",
    ...(d.time && { dueTime: d.time }),
    done: false,
    createdAt: note.createdAt,
  };
}
