// ============================================================
// 검색 (F13) — 화면과 분리된 순수 계산 함수 (Node로 테스트 가능)
// ------------------------------------------------------------
// 비유: 서랍 다섯 개(할 일·끝낸 할 일·일정·노트·하루 기록)를 한 번에 열어
// 찾는 단어가 적힌 쪽지만 서랍별로 꺼내 놓는 일.
// ============================================================
import { sortForAllTab } from "./sort.js";

/** 검색어를 단어들로 나눔: "출장  정산" → ["출장", "정산"] (영문은 소문자로) */
export function termsOf(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** 글에 단어가 "모두" 들어 있는가 (R2) */
function hasAll(text, terms) {
  const lower = (text ?? "").toLowerCase();
  return terms.every((w) => lower.includes(w));
}

/** 전부 훑어서 종류별로 돌려줌 (R3·R4·R6).
 *  tasks는 휴지통에 없는 할 일, memos는 노트+일정, dayLogs는 하루 기록 문서들.
 *  결과: { open, done, events, notes, days, total }
 *   - days의 한 줄: { id, date, kind: "plan" | "extra", text } */
export function searchAll(query, { tasks = [], memos = [], dayLogs = [] } = {}) {
  const terms = termsOf(query);
  if (terms.length === 0) {
    return { open: [], done: [], events: [], notes: [], days: [], total: 0 };
  }

  // 할 일: 제목 + 세부 메모
  const taskHits = tasks.filter((t) => hasAll(`${t.title}\n${t.memo ?? ""}`, terms));
  // 미완료 = 전체 탭과 같은 급한 순
  const open = sortForAllTab(taskHits.filter((t) => !t.done));
  // 끝낸 것 = 최근에 끝낸 순 (끝낸 시각이 없는 옛 데이터는 만든 시각으로)
  const doneAt = (t) => t.completedAt || t.createdAt || "";
  const done = taskHits
    .filter((t) => t.done)
    .sort((a, b) => doneAt(b).localeCompare(doneAt(a)));

  // 노트·일정: 글 전체. 날짜가 있으면 일정, 없으면 노트
  const memoHits = memos.filter((m) => hasAll(m.text, terms));
  const events = memoHits
    .filter((m) => m.date)
    .sort((a, b) => b.date.localeCompare(a.date)); // 날짜 최신 순
  const notes = memoHits
    .filter((m) => !m.date)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); // 최근 수정 순

  // 하루 기록: 계획 줄 + 계획 외에 한 일 줄
  const days = [];
  for (const log of dayLogs) {
    for (const p of log.plans ?? []) {
      if (hasAll(p.text, terms))
        days.push({ id: p.id, date: log.date, kind: "plan", text: p.text });
    }
    for (const x of log.extras ?? []) {
      if (hasAll(x.text, terms))
        days.push({ id: x.id, date: log.date, kind: "extra", text: x.text });
    }
  }
  days.sort((a, b) => b.date.localeCompare(a.date)); // 날짜 최신 순

  const total =
    open.length + done.length + events.length + notes.length + days.length;
  return { open, done, events, notes, days, total };
}
