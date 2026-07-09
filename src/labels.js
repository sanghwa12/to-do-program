// 화면 여러 곳에서 같이 쓰는 표시용 이름들

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
