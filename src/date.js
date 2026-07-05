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

/** 다음 회차: 주기만큼 더하되, 오늘 이전이면 오늘 이후가 될 때까지 더함 (F09 R3)
 *  — 밀린 반복 일을 완료해도 다음 회차가 과거가 되지 않게.
 *  매달·매년은 원래 일자(day)를 기억한 채 건너뜀 — 밀린 것을 한참 뒤에 완료해도
 *  2월(말일 클램프)을 지나며 일자가 어긋나지 않게 (예: 1/31 → ... → 7/31) */
export function nextOccurrence(dateStr, repeat) {
  const today = todayStr();
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
