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

// ============================================================
// 메모판 순서 (F03 R2f) — 메모를 끌어서 손으로 정한 순서
// 순서 값(memoOrder)은 끌어다 놓을 때만 생김: 그 스티커의 메모들에 위에서부터 0, 1, 2…
// ============================================================

/** 스티커 안 메모의 순서: 아직 순서 값이 없는 메모(새로 쓴 메모 등)는 맨 위에 최신순,
 *  그 아래로 손으로 정한 순서 */
export function byMemoOrder(a, b) {
  const aSet = typeof a.memoOrder === "number";
  const bSet = typeof b.memoOrder === "number";
  if (aSet !== bSet) return aSet ? 1 : -1; // 순서 값 없는 것이 위
  if (aSet && a.memoOrder !== b.memoOrder) return a.memoOrder - b.memoOrder;
  return b.createdAt.localeCompare(a.createdAt); // 같으면 최신 입력이 위
}

/** 끌어다 놓은 뒤의 새 순서 (id 목록).
 *  ids = 놓은 스티커의 메모 id들(보이는 순서), moved = 끌어온 메모,
 *  target = 놓은 자리의 메모 — 그 앞(before)이나 뒤에 끼움. target이 없으면(빈 스티커) 맨 아래 */
export function placeMemo(ids, moved, target, before) {
  if (target === moved) return ids; // 제자리에 놓음
  const rest = ids.filter((id) => id !== moved);
  const at = rest.indexOf(target);
  if (at === -1) return [...rest, moved];
  rest.splice(before ? at : at + 1, 0, moved);
  return rest;
}
