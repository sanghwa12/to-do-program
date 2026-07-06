// 날짜 계산 도우미 함수들

/** 오늘 날짜를 "YYYY-MM-DD" 문자열로 반환 (이 컴퓨터의 시간대 기준) */
export function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // 월은 0부터 세므로 +1
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 마감일(dueDate)이 오늘 기준 며칠 지났는지. 예: 어제면 1, 오늘이면 0 */
export function daysLate(dueDate) {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(todayStr() + "T00:00:00");
  return Math.round((today - due) / (1000 * 60 * 60 * 24)); // 밀리초 차이를 일수로
}

// ------------------------------------------------------------
// 반복 할 일 (F09): 다음 회차 계산
// ------------------------------------------------------------

/** "YYYY-MM-DD"에서 하루(+1) 또는 일주일(+7) 더한 날짜 (매일·매주용) */
function advanceOnce(dateStr, repeat) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + (repeat === "daily" ? 1 : 7));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 연·월·일 → "YYYY-MM-DD" (반복 계산용 내부 도우미) */
function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 그 달의 "N번째 X요일" (nth: 1~4 또는 "last", weekday: 0=일~6=토) — F09 R8 */
export function nthWeekdayOfMonth(year, month, nth, weekday) {
  if (nth === "last") {
    // 말일에서 거꾸로 그 요일까지
    const lastDay = new Date(year, month, 0).getDate();
    const lastW = new Date(year, month - 1, lastDay).getDay();
    return ymd(year, month, lastDay - ((lastW - weekday + 7) % 7));
  }
  // 1일에서 첫 해당 요일을 찾고 (nth-1)주 더함 (4번째까지는 어떤 달에도 존재)
  const firstW = new Date(year, month - 1, 1).getDay();
  return ymd(year, month, 1 + ((weekday - firstW + 7) % 7) + (nth - 1) * 7);
}

/** minStr(포함) 이후 첫 "N번째 X요일" — 규칙 저장 시 첫 날짜 계산용 */
export function nextNthWeekday(nth, weekday, minStr) {
  let [y, m] = minStr.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    const candidate = nthWeekdayOfMonth(y, m, nth, weekday);
    if (candidate >= minStr) return candidate;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return minStr; // 여기 올 일은 없음 (안전망)
}

/** 다음 회차: 주기만큼 더하되, 오늘 이전이면 오늘 이후가 될 때까지 더함 (F09 R3)
 *  — 밀린 반복 일을 완료해도 다음 회차가 과거가 되지 않게.
 *  매달·매년은 원래 일자(day)를 기억한 채 건너뜀 — 밀린 것을 한참 뒤에 완료해도
 *  2월(말일 클램프)을 지나며 일자가 어긋나지 않게 (예: 1/31 → ... → 7/31) */
export function nextOccurrence(dateStr, repeat, extra = {}) {
  const today = todayStr();
  if (repeat === "monthlyNth") {
    // 매월 N번째 요일: 현재 회차와 오늘 중 늦은 날의 "다음 날"부터 첫 해당 날짜
    const base = dateStr > today ? dateStr : today;
    return nextNthWeekday(
      extra.nth ?? 1,
      extra.weekday ?? 1,
      advanceOnce(base, "daily")
    );
  }
  if (repeat === "daily" || repeat === "weekly") {
    let next = advanceOnce(dateStr, repeat);
    while (next <= today) {
      next = advanceOnce(next, repeat);
    }
    return next;
  }
  // monthly / yearly
  const [y0, m0, d0] = dateStr.split("-").map(Number);
  for (let k = 1; ; k++) {
    let y, m;
    if (repeat === "monthly") {
      const total = m0 - 1 + k;
      y = y0 + Math.floor(total / 12);
      m = (total % 12) + 1;
    } else {
      y = y0 + k;
      m = m0;
    }
    const lastDay = new Date(y, m, 0).getDate();
    const candidate = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d0, lastDay)).padStart(2, "0")}`;
    if (candidate > today) return candidate;
  }
}
