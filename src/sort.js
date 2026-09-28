// ============================================================
// "전체" 탭 정렬 규칙 (F03 R8) — 급한 것부터, 완료는 맨 아래
// ① 미완료 + 날짜 있음 : 마감 빠른 순 (지난 것이 맨 위)
// ② 미완료 + 날짜 없음 : 최신 입력이 위
// ③ 완료               : 맨 아래
// (우선순위 순은 2026-09-28 우선순위 제거와 함께 빠짐)
// ============================================================

/** 시간("HH:MM") 비교: 빠른 시간이 앞, 시간 없는 것은 맨 뒤.
 *  ⚠️ localeCompare를 쓰면 안 됨 — 기호("~")를 숫자보다 "앞"에 놓아서 시간 없는 것이
 *  맨 앞으로 와 버림 (2026-09-28 발견·수정). 글자 코드 순(<, >)으로 비교해야 "~"가 뒤 */
export function compareTime(a, b) {
  const x = a || "~";
  const y = b || "~";
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 날짜 빠른 순, 같은 날짜면 시간 순 (시간 없는 것은 뒤) — F02 R15 */
export function byDueDateTime(a, b) {
  if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  return compareTime(a.dueTime, b.dueTime);
}

export function sortForAllTab(tasks) {
  return [...tasks].sort((a, b) => {
    // ① 미완료가 완료보다 위
    if (a.done !== b.done) return a.done ? 1 : -1;
    // ② 날짜 있는 게 위, 날짜끼리는 마감 빠른 순 (급한 순)
    const aHas = !!a.dueDate;
    const bHas = !!b.dueDate;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) {
      const d = byDueDateTime(a, b);
      if (d !== 0) return d;
    }
    // ③ 마지막 기준: 최신 입력이 위
    return b.createdAt.localeCompare(a.createdAt);
  });
}
