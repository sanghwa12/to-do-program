// ============================================================
// 달력 계산 도우미 (F07)
// 화면과 분리된 순수 계산 함수들 — Node로 테스트할 수 있음
// ============================================================

/** 연·월·일 → "YYYY-MM-DD" */
export function dateStrOf(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 월간 격자 칸 만들기.
 * 일요일 시작 기준으로, 1일 앞과 말일 뒤를 null(빈 칸)로 채워
 * 7의 배수 길이 배열을 돌려줌. 값은 일(day) 숫자 또는 null.
 * 예: 2026년 7월 → [null,null,null,1,2,...,31] (7/1이 수요일이라 앞에 3칸)
 */
export function buildMonthCells(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate(); // 그 달의 마지막 날
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 1일의 요일 (0=일)
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null); // 1일 앞 빈 칸
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null); // 마지막 주 채우기
  return cells;
}

/**
 * 특정 날짜에 걸리는 할 일 찾기 (F07 R3).
 * - 마감(due)·당일(day): dueDate가 그 날짜인 것
 * - 기간(range): 시작일 ≤ 날짜 ≤ 끝일인 것
 */
export function tasksOnDate(tasks, dateStr) {
  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (t.dateKind === "range" && t.startDate) {
      // 혹시 시작일·끝일이 뒤바뀐 데이터가 있어도 안 사라지게 앞뒤를 정렬해서 비교
      const [from, to] =
        t.startDate <= t.dueDate
          ? [t.startDate, t.dueDate]
          : [t.dueDate, t.startDate];
      return from <= dateStr && dateStr <= to;
    }
    return t.dueDate === dateStr;
  });
}

/** 이전/다음 달 계산 (해 넘김 처리) — delta는 -1 또는 +1 */
export function moveMonth(year, month, delta) {
  let y = year;
  let m = month + delta;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return { year: y, month: m };
}
