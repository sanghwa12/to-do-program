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
