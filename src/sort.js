// ============================================================
// "전체" 탭 정렬 규칙 (F03 R8) — 급한 것부터, 완료는 맨 아래
// ① 미완료 + 날짜 있음 : 마감 빠른 순 (지난 것이 맨 위)
// ② 미완료 + 날짜 없음 : 우선순위 순 (높음→중간→낮음→없음), 같으면 최신 입력이 위
// ③ 완료               : 맨 아래
// ============================================================

const PRIORITY_RANK = { high: 0, med: 1, low: 2 }; // 없음은 3

export function sortForAllTab(tasks) {
  return [...tasks].sort((a, b) => {
    // ① 미완료가 완료보다 위
    if (a.done !== b.done) return a.done ? 1 : -1;
    // ② 날짜 있는 게 위, 날짜끼리는 마감 빠른 순 (급한 순)
    const aHas = !!a.dueDate;
    const bHas = !!b.dueDate;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    // ③ 우선순위 높은 순
    const ap = PRIORITY_RANK[a.priority] ?? 3;
    const bp = PRIORITY_RANK[b.priority] ?? 3;
    if (ap !== bp) return ap - bp;
    // ④ 마지막 기준: 최신 입력이 위
    return b.createdAt.localeCompare(a.createdAt);
  });
}
