// ============================================================
// 입력 텍스트에서 마감일 자동 인식 (F02 R9)
// ------------------------------------------------------------
// "도서 반납 (~7/2)"  → { title: "도서 반납", dueDate: "2026-07-02" }
// "보고서 초안쓰기"    → { title: "보고서 초안쓰기" }  (날짜 없음)
//
// 인식하는 표기: ~월/일  (괄호는 있어도 되고 없어도 됨)
//   예: ~7/2, (~7/2), ~7-2, ~2026/7/2, ~2026-07-02
// ============================================================
import { todayStr } from "./date.js";

/** 연·월·일 숫자를 "YYYY-MM-DD" 문자열로 */
function fmt(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 입력 텍스트를 { title, dueDate? }로 분해.
 * 날짜 표기가 없거나 이상하면 전체를 제목으로 그대로 반환.
 */
export function parseQuickInput(text) {
  const plain = { title: text.trim() }; // 날짜 없이 그대로 쓸 때의 결과

  // ~ 뒤에 오는 날짜 표기 찾기: (연도?)월(구분자)일 — 구분자는 / - . 허용
  const re = /\(?\s*~\s*(?:(\d{4})[/\-.])?(\d{1,2})[/\-.](\d{1,2})\s*\)?/;
  const m = text.match(re);
  if (!m) return plain; // ~날짜 표기가 없음 → 마감 없는 할 일

  const [matched, yearStr, monthStr, dayStr] = m;
  const month = Number(monthStr);
  const day = Number(dayStr);

  // 말이 안 되는 날짜(예: 13월, 40일)면 인식 취소
  if (month < 1 || month > 12 || day < 1 || day > 31) return plain;

  // 연도를 안 썼으면 올해로. 단, 이미 지난 날짜면 내년으로
  // (예: 12월에 "~1/5"라고 쓰면 내년 1월 5일이라는 뜻일 테니까)
  let year = yearStr ? Number(yearStr) : new Date().getFullYear();
  let dueDate = fmt(year, month, day);
  if (!yearStr && dueDate < todayStr()) {
    dueDate = fmt(year + 1, month, day);
  }

  // 날짜 표기를 제목에서 빼고, 남는 공백 정리
  const title = text.replace(matched, " ").replace(/\s+/g, " ").trim();
  if (title === "") return plain; // 날짜만 있고 제목이 없으면 인식 취소

  return { title, dueDate };
}
