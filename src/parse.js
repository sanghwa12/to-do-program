// ============================================================
// 입력 텍스트에서 날짜 자동 인식 (F02 R9~R11)
// ------------------------------------------------------------
// 3가지 종류를 알아듣습니다:
//   마감(due)  : "도서 반납 (~7/2)", "~내일", "~금요일"  → 그날까지
//   당일(day)  : "연구실 안전점검 7/7" (맨 날짜, 문장 끝만) → 그날
//   기간(range): "학부실험 조교 11/11~11/23"             → 그 기간 동안
// 날짜 표기가 없으면 그냥 제목만 있는 할 일.
// ============================================================
import { todayStr } from "./date.js";

/** 연·월·일 숫자를 "YYYY-MM-DD" 문자열로 */
function fmt(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Date 객체 → "YYYY-MM-DD" */
function dateToStr(d) {
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 월/일이 말이 되는 값인지 */
function validMD(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** (연도?, 월, 일) → "YYYY-MM-DD". 연도 생략 시 올해.
 *  지난 날짜면 내년으로 올림 — 단 allowPast면 그대로 둠
 *  (할 일 마감은 미래를 뜻하지만, 공지의 날짜는 "그 일이 있는 날"이라 과거일 수도 있음) */
function resolveYMD(yearStr, monthStr, dayStr, allowPast = false) {
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!validMD(month, day)) return null; // 엉터리 날짜
  const year = yearStr ? Number(yearStr) : new Date().getFullYear();
  let result = fmt(year, month, day);
  if (!yearStr && !allowPast && result < todayStr()) {
    result = fmt(year + 1, month, day); // 예: 12월에 "1/5" → 내년 1월 5일
  }
  return result;
}

// "~오늘 / ~내일 / ~모레 / ~금요일" 같은 말 날짜 처리
const WEEKDAY_NUM = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function resolveWord(word) {
  const today = new Date(todayStr() + "T00:00:00");
  const plus = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return dateToStr(d);
  };
  if (word === "오늘") return plus(0);
  if (word === "내일") return plus(1);
  if (word === "모레") return plus(2);
  // "금요일" → 다가오는 금요일 (오늘이 금요일이면 오늘)
  const target = WEEKDAY_NUM[word[0]];
  const diff = (target - today.getDay() + 7) % 7;
  return plus(diff);
}

// 날짜 조각 패턴: (연도-)월-일, 구분자는 / - . 허용
const D = "(?:(\\d{4})[/\\-.])?(\\d{1,2})[/\\-.](\\d{1,2})";
// 기간: 날짜~날짜 (어디에 있어도 인식)
const RANGE_RE = new RegExp(`\\(?\\s*${D}\\s*~\\s*${D}\\s*\\)?`);
// 마감(숫자): ~날짜 (어디에 있어도 인식)
const DUE_NUM_RE = new RegExp(`\\(?\\s*~\\s*${D}\\s*\\)?`);
// 마감(말): ~오늘, ~내일, ~모레, ~월요일 ... ~일요일
const DUE_WORD_RE = /\(?\s*~\s*(오늘|내일|모레|[일월화수목금토]요일)\s*\)?/;
// 당일: 맨 날짜 — 문장 "끝"에 있을 때만 ("3/4 분량 읽기" 오인 방지)
const DAY_RE = new RegExp(`(?:^|\\s)\\(?${D}\\)?\\s*$`);

/** 인식된 표기를 제목에서 빼고 공백 정리 */
function stripTitle(text, matched) {
  return text.replace(matched, " ").replace(/\s+/g, " ").trim();
}

/**
 * 입력 텍스트를 { title, dueDate?, startDate?, dateKind? }로 분해.
 * 날짜 표기가 없거나 이상하면 전체를 제목으로 그대로 반환.
 * opts.allowPast: 지난 날짜를 내년으로 올리지 않음 (공지처럼 "있었던 날"도 유효할 때)
 */
export function parseQuickInput(text, { allowPast = false } = {}) {
  const plain = { title: text.trim() };

  // 1) 기간: 11/11~11/23 (마감 ~보다 먼저 검사해야 함 — "~11/23" 부분만 잡히지 않게)
  let m = text.match(RANGE_RE);
  if (m) {
    const start = resolveYMD(m[1], m[2], m[3], allowPast);
    let end = resolveYMD(m[4], m[5], m[6], allowPast);
    if (start && end) {
      // 연도 생략한 기간이 해를 넘는 경우 (예: 12/28~1/3) → 끝을 다음 해로
      if (end < start) {
        const [y, mo, d] = end.split("-").map(Number);
        end = fmt(y + 1, mo, d);
      }
      const title = stripTitle(text, m[0]);
      if (title) return { title, startDate: start, dueDate: end, dateKind: "range" };
    }
  }

  // 2) 마감: ~7/2 또는 ~내일 / ~금요일
  m = text.match(DUE_NUM_RE);
  if (m) {
    const due = resolveYMD(m[1], m[2], m[3], allowPast);
    if (due) {
      const title = stripTitle(text, m[0]);
      if (title) return { title, dueDate: due, dateKind: "due" };
    }
  }
  m = text.match(DUE_WORD_RE);
  if (m) {
    const due = resolveWord(m[1]);
    const title = stripTitle(text, m[0]);
    if (title) return { title, dueDate: due, dateKind: "due" };
  }

  // 3) 당일: 문장 끝의 맨 날짜 (예: "연구실 안전점검 7/7")
  m = text.match(DAY_RE);
  if (m) {
    const day = resolveYMD(m[1], m[2], m[3], allowPast);
    if (day) {
      const title = stripTitle(text, m[0]);
      if (title) return { title, dueDate: day, dateKind: "day" };
    }
  }

  return plain; // 날짜 표기 없음
}

// ============================================================
// 여러 줄 가져오기 (F02 R12)
// ------------------------------------------------------------
// 한 줄 → 할 일 하나로 변환. 날짜(R9~R11), #태그→카테고리,
// "- [ ]"/"- [x]" 체크박스, (높음/중간/낮음) 우선순위를 인식.
// 주석·섹션 제목(# 로 시작)과 빈 줄은 건너뜀(null 반환).
// ============================================================
const PR_WORD = { 높음: "high", 중간: "med", 낮음: "low" };

export function parseImportLine(line) {
  let t = line.trim();
  if (t === "" || t.startsWith("#")) return null; // 빈 줄·주석·섹션 제목

  // 앞머리 체크박스/불릿: "- [ ]", "- [x]", "-", "*"
  let done = false;
  const box = t.match(/^[-*]\s*\[([ xX])\]\s*/);
  if (box) {
    done = box[1].toLowerCase() === "x";
    t = t.slice(box[0].length);
  } else {
    t = t.replace(/^[-*]\s+/, "");
  }

  // 백업 파일의 "알아둘 것" 줄(📢 일정 공지 / 📎 참고)은 할 일로 만들지 않고 건너뜀
  // (알아둘 것을 가져오기로 복원하는 방법은 미결정 — 최소한 할 일 오염은 방지)
  if (t.startsWith("📢") || t.startsWith("📎")) return null;

  t = t.replace(/📅/g, " "); // 내보내기 형식의 달력 이모지 제거

  // 우선순위 (높음/중간/낮음)
  let priority;
  const pr = t.match(/\((높음|중간|낮음)\)/);
  if (pr) {
    priority = PR_WORD[pr[1]];
    t = t.replace(pr[0], " ");
  }

  // 카테고리 #태그 (첫 번째를 사용, 표기는 모두 제거)
  let category;
  const tag = t.match(/#(\S+)/);
  if (tag) {
    category = tag[1];
    t = t.replace(/#\S+/g, " ");
  }

  // "당일" 글자 제거 → 문장 끝 날짜가 당일로 인식되게 (내보내기 왕복 호환)
  t = t.replace(/\s*당일\s*/g, " ").replace(/\s+/g, " ").trim();
  if (t === "") return null;

  const parsed = parseQuickInput(t); // 제목 + 날짜 인식
  const draft = { title: parsed.title, done };
  if (parsed.dueDate) {
    draft.dueDate = parsed.dueDate;
    draft.dateKind = parsed.dateKind;
  }
  if (parsed.startDate) draft.startDate = parsed.startDate;
  if (priority) draft.priority = priority;
  if (category) draft.category = category;
  return draft;
}

/** 여러 줄 텍스트 → 할 일 초안 배열 (건너뛴 줄 제외) */
export function parseImport(text) {
  return text.split(/\r?\n/).map(parseImportLine).filter(Boolean);
}
