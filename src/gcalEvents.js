// ============================================================
// F12 · 앱 항목 → 구글 캘린더 이벤트 변환 (순수 함수 — 브라우저·Node 어디서나 실행)
// ------------------------------------------------------------
// 기획서 "데이터 → 이벤트 매핑" 표를 그대로 코드로 옮긴 것.
// 구글 규칙: 종일 이벤트의 end.date는 "마지막 날의 다음 날" (끝 배타).
// ============================================================

function pad2(n) {
  return String(n).padStart(2, "0");
}
function fmtDate(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function fmtDateTime(dt) {
  return `${fmtDate(dt)}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:00`;
}

/** "YYYY-MM-DD"에 n일 더하기 (월·연 넘김 포함) */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return fmtDate(new Date(y, m - 1, d + n));
}

/** 그 날짜·시각부터 60분짜리 시작·끝 (앱에 길이 개념이 없어 기본값 60분) */
function hourFrom(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    start: { dateTime: fmtDateTime(start), timeZone: tz },
    end: { dateTime: fmtDateTime(end), timeZone: tz },
  };
}

/** 할 일 → 이벤트 본문. tz는 "Asia/Seoul" 같은 시간대 이름 (시간 있는 일정에만 쓰임) */
export function taskToEvent(task, tz) {
  // 시간 있음 (F02 R15): 그 시각부터 60분. 기간에는 시간 없음
  if (task.dueTime && task.dateKind !== "range") {
    return { summary: task.title, ...hourFrom(task.dueDate, task.dueTime, tz) };
  }
  // 종일: 당일·마감은 그날 하루, 기간은 시작일~끝일
  const first =
    task.dateKind === "range" && task.startDate ? task.startDate : task.dueDate;
  return {
    summary: task.title,
    start: { date: first },
    end: { date: addDays(task.dueDate, 1) },
  };
}

/** 일정(날짜 있는 노트) → 이벤트. 제목은 "📢 " + 첫 줄.
 *  시간 있으면 60분, 기간이면 시작~끝 종일, 아니면 그날 종일 (F11 R8) */
export function memoToEvent(memo, tz) {
  const summary = "📢 " + memo.text.split("\n")[0];
  if (memo.time && !memo.endDate) {
    return { summary, ...hourFrom(memo.date, memo.time, tz) };
  }
  return {
    summary,
    start: { date: memo.date },
    end: { date: addDays(memo.endDate || memo.date, 1) },
  };
}

/** 내용 지문 — "바뀌었나?" 비교용 (직렬화한 본문 그대로). 연결표의 hash 칸에 저장 */
export function fingerprint(event) {
  return JSON.stringify(event);
}
