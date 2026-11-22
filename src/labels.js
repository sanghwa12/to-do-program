// 화면 여러 곳에서 같이 쓰는 표시용 이름들
import { weekOf, daysBetween } from "./date.js";

// 우선순위 코드 → 한글 표시
export const PRIORITY_LABEL = { high: "높음", med: "중간", low: "낮음" };

// 반복 주기 코드 → 한글 표시 (F09)
export const REPEAT_LABEL = {
  daily: "매일",
  weekdays: "주중 매일",
  weekly: "매주",
  monthly: "매달",
  yearly: "매년",
};

// 매월 N번째 요일 규칙의 표시용 이름 (F09 R8)
export const NTH_LABEL = { 1: "첫째", 2: "둘째", 3: "셋째", 4: "넷째", last: "마지막" };
export const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 할 일의 반복 규칙을 사람이 읽는 문구로 (예: "매주", "매월 첫째 월요일") */
export function repeatLabelOf(t) {
  if (!t.repeat) return "";
  if (t.repeat === "monthlyNth") {
    return `매월 ${NTH_LABEL[t.repeatNth] ?? ""} ${WEEKDAY_LABEL[t.repeatWeekday] ?? ""}요일`;
  }
  return REPEAT_LABEL[t.repeat];
}

/** 주 단위 할 일의 주를 부르는 말 (F03 R10): 오늘이 든 주면 "이번 주", 한 주 뒤면 "다음 주",
 *  두 주 뒤면 "다다음 주". 그 밖(더 먼 주·지난 주)은 "" — 그땐 날짜만 보여줌 */
export function weekNameOf(t, today) {
  const weeks = daysBetween(weekOf(today).start, t.startDate) / 7;
  return { 0: "이번 주", 1: "다음 주", 2: "다다음 주" }[weeks] ?? "";
}

/** 주 표기 한 줄: "다음 주 (11/30~12/6)" 또는 "12/7~12/13 주" */
export function weekLabelOf(t, today) {
  const name = weekNameOf(t, today);
  return name ? `${name} (${weekRangeText(t)})` : `${weekRangeText(t)} 주`;
}

/** "이번 주 중에" 할 일의 주 표기: "10/26~11/1" (F03 R10) */
export function weekRangeText(t) {
  const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;
  return `${md(t.startDate)}~${md(t.dueDate)}`;
}
