// ============================================================
// 입력 텍스트에서 날짜 자동 인식 (F02 R9~R11)
// ------------------------------------------------------------
// 3가지 종류를 알아듣습니다:
//   마감(due)  : "도서 반납 (~7/2)", "~내일", "~금요일"  → 그날까지
//   당일(day)  : "연구실 안전점검 7/7" (맨 날짜, 문장 끝만) → 그날
//   기간(range): "학부실험 조교 11/11~11/23"             → 그 기간 동안
// 날짜 표기가 없으면 그냥 제목만 있는 할 일.
// ============================================================
import { todayStr, nextNthWeekday, nextBusinessDay } from "./date.js";

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

/** 그 해 그 달에 실제로 있는 날짜인지 (2/30, 평년 2/29, 4/31 같은 것 거르기) */
function dayExists(year, month, day) {
  return day <= new Date(year, month, 0).getDate();
}

/** "YYYY-MM-DD"를 1년 뒤로 (2/29 → 2/28처럼 없는 날짜는 말일로) */
function plusOneYear(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const last = new Date(y + 1, m, 0).getDate();
  return fmt(y + 1, m, Math.min(d, last));
}

/** (연도?, 월, 일) → "YYYY-MM-DD". 연도 생략 시 올해.
 *  지난 날짜면 내년으로 올림 — 단 allowPast면 그대로 둠
 *  (할 일 마감은 미래를 뜻하지만, 공지의 날짜는 "그 일이 있는 날"이라 과거일 수도 있음)
 *  존재하지 않는 날짜(평년 2/29 등)는 무시(null). */
function resolveYMD(yearStr, monthStr, dayStr, allowPast = false) {
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!validMD(month, day)) return null; // 엉터리 날짜
  const year = yearStr ? Number(yearStr) : new Date().getFullYear();
  if (!dayExists(year, month, day)) return null; // 그 해에 없는 날짜
  let result = fmt(year, month, day);
  if (!yearStr && !allowPast && result < todayStr()) {
    if (!dayExists(year + 1, month, day)) return null; // 내년에도 없으면 무시
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

// ------------------------------------------------------------
// 반복 표기 인식 (F09 R2): 매일 / 매주 (요일) / 매달·매월 (N일) / 매년 (M/D)
// "구매일지"의 '매일' 같은 오인을 막기 위해 앞뒤가 공백(또는 문장 끝)일 때만 인식
// ------------------------------------------------------------
const NTH_NUM = { 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, 마지막: "last" };

const REPEAT_PATTERNS = [
  // 매월 첫째(주) 월요일 / 매달 마지막 금요일 — "주"는 생략 가능 (R8)
  {
    re: /(?:^|\s)(?:매월|매달)\s*(첫째|둘째|셋째|넷째|마지막)\s*주?\s*([일월화수목금토])요일(?=\s|$)/,
    kind: "monthlyNth",
    type: "nthWeekday",
  },
  { re: /(?:^|\s)매주\s*([일월화수목금토])요일(?=\s|$)/, kind: "weekly", type: "weekday" },
  { re: /(?:^|\s)(?:매달|매월)\s*(\d{1,2})일(?=\s|$)/, kind: "monthly", type: "dom" },
  { re: /(?:^|\s)매년\s*(\d{1,2})[/\-.](\d{1,2})(?=\s|$)/, kind: "yearly", type: "md" },
  // "주중 매일"이 아래 "매일"에 먼저 잡히지 않게 이 순서 유지 (R10)
  { re: /(?:^|\s)(?:주중|평일)(?:\s*매일)?(?=\s|$)/, kind: "weekdays", type: "business" },
  { re: /(?:^|\s)매일(?=\s|$)/, kind: "daily", type: "plain" },
  { re: /(?:^|\s)매주(?=\s|$)/, kind: "weekly", type: "plain" },
  { re: /(?:^|\s)(?:매달|매월)(?=\s|$)/, kind: "monthly", type: "plain" },
  { re: /(?:^|\s)매년(?=\s|$)/, kind: "yearly", type: "plain" },
];

/** 반복 표기를 찾아 { repeat, anchor(기준일), rest(표기 뺀 텍스트) } 반환. 없으면 null */
function detectRepeat(text) {
  const today = todayStr();
  for (const p of REPEAT_PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    let anchor = today; // 기본 기준일: 오늘
    if (p.type === "business") {
      anchor = nextBusinessDay(today); // 오늘이 주말이면 다음 월요일부터
    }
    if (p.type === "nthWeekday") {
      // 매월 N번째 X요일: 다가오는 해당 날짜가 첫 회차 (R8)
      const nth = NTH_NUM[m[1]];
      const weekday = WEEKDAY_NUM[m[2]];
      return {
        repeat: p.kind,
        nth,
        weekday,
        anchor: nextNthWeekday(nth, weekday, today),
        rest: text.replace(m[0], " "),
      };
    }
    if (p.type === "weekday") {
      anchor = resolveWord(m[1] + "요일"); // 다가오는 그 요일 (오늘 포함)
    } else if (p.type === "dom") {
      // 매달 N일: 이번 달 N일이 아직 안 지났으면 이번 달, 지났으면 다음 달 (말일 처리)
      const day = Number(m[1]);
      // 무효한 값(매달 40일)이면 반복 인식 자체를 취소 —
      // 조용히 '매달(오늘 기준)'으로 강등되지 않게
      if (day < 1 || day > 31) return null;
      const now = new Date(today + "T00:00:00");
      let y = now.getFullYear();
      let mo = now.getMonth() + 1;
      let candidate = fmt(y, mo, Math.min(day, new Date(y, mo, 0).getDate()));
      if (candidate < today) {
        if (mo === 12) { y += 1; mo = 1; } else { mo += 1; }
        candidate = fmt(y, mo, Math.min(day, new Date(y, mo, 0).getDate()));
      }
      anchor = candidate;
    } else if (p.type === "md") {
      // 매년 M/D: 올해가 아직 안 지났으면 올해, 지났으면 내년
      const a = resolveYMD(undefined, m[1], m[2], false);
      if (!a) return null; // 무효한 날짜(매년 2/30)면 반복 인식 취소
      anchor = a;
    }
    return { repeat: p.kind, anchor, rest: text.replace(m[0], " ") };
  }
  return null;
}

/**
 * 입력 텍스트를 { title, dueDate?, startDate?, dateKind?, repeat? }로 분해.
 * 날짜 표기가 없거나 이상하면 전체를 제목으로 그대로 반환.
 * opts.allowPast: 지난 날짜를 내년으로 올리지 않음 (공지처럼 "있었던 날"도 유효할 때)
 * opts.repeatable: 반복 표기(매주 등) 인식 여부 (기본 켜짐 — 공지 입력에선 끔)
 */
export function parseQuickInput(text, { allowPast = false, repeatable = true } = {}) {
  // 반복 표기 먼저 확인 (F09) — 찾으면 표기를 뺀 나머지로 날짜·제목을 계속 해석
  if (repeatable) {
    const rep = detectRepeat(text);
    if (rep) {
      const inner = parseQuickInput(rep.rest, { allowPast, repeatable: false });
      if (inner.title === "") return { title: text.trim() }; // 제목이 없으면 인식 취소
      if (inner.dateKind === "range") {
        // 기간엔 반복 미지원 (R1) — '매주' 표기를 조용히 지우지 않고
        // 원문 그대로 기간으로 해석 (표기가 제목에 남아 사용자가 알 수 있게)
        return parseQuickInput(text, { allowPast, repeatable: false });
      }
      const title = inner.title.replace(/\s+/g, " ").trim(); // 표기 뺀 자리 공백 정리
      if (rep.repeat === "monthlyNth") {
        // 매월 N번째 요일: 날짜는 항상 규칙으로 계산 (직접 쓴 날짜는 무시)
        return {
          title,
          dueDate: rep.anchor,
          dateKind: "day",
          repeat: rep.repeat,
          repeatNth: rep.nth,
          repeatWeekday: rep.weekday,
        };
      }
      return {
        title,
        // 표기에 날짜가 따로 있으면 그 날짜, 없으면 반복 표기의 기준일
        dueDate: inner.dueDate || rep.anchor,
        dateKind: inner.dueDate ? inner.dateKind : "day",
        repeat: rep.repeat,
      };
    }
  }

  const plain = { title: text.trim() };

  // 1) 기간: 11/11~11/23 (마감 ~보다 먼저 검사해야 함 — "~11/23" 부분만 잡히지 않게)
  let m = text.match(RANGE_RE);
  if (m) {
    // 시작·끝 모두 일단 올해 그대로 해석 — "진행 중인 기간"(시작은 지났고 끝은 남음)을
    // 입력하는 흔한 경우를 내년으로 밀어버리지 않기 위해
    let start = resolveYMD(m[1], m[2], m[3], true);
    let end = resolveYMD(m[4], m[5], m[6], true);
    if (start && end) {
      // 연도 생략한 기간이 해를 넘는 경우 (예: 12/28~1/3) → 끝을 다음 해로
      if (end < start) end = plusOneYear(end);
      // 기간이 통째로 지난 경우에만 내년으로 (공지 입력(allowPast)은 지난 기간도 그대로)
      if (!allowPast && end < todayStr()) {
        start = plusOneYear(start);
        end = plusOneYear(end);
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

  // 백업 파일의 "알아둘 것"(📢/📎)·"하루 기록"(📓)·"메모"(📝) 줄은
  // 할 일로 만들지 않고 건너뜀 (복원 방법은 미결정 — 최소한 할 일 오염은 방지)
  if (
    t.startsWith("📢") ||
    t.startsWith("📎") ||
    t.startsWith("📓") ||
    t.startsWith("📝")
  )
    return null;

  // 내보내기 형식의 이모지 제거. 반복 인식은 🔁 표기가 "실제로 있던 줄"에만 적용 —
  // 제목에 우연히 '매일/매주' 단어가 든 일반 할 일이 반복으로 둔갑하지 않게 (R7)
  const hadRepeatMark = t.includes("🔁");
  t = t.replace(/📅/g, " ").replace(/🔁/g, " ");

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

  const parsed = parseQuickInput(t, { repeatable: hadRepeatMark }); // 제목+날짜(+반복) 인식
  const draft = { title: parsed.title, done };
  if (parsed.dueDate) {
    draft.dueDate = parsed.dueDate;
    draft.dateKind = parsed.dateKind;
  }
  if (parsed.startDate) draft.startDate = parsed.startDate;
  if (parsed.repeat) draft.repeat = parsed.repeat;
  if (parsed.repeatNth !== undefined) draft.repeatNth = parsed.repeatNth;
  if (parsed.repeatWeekday !== undefined) draft.repeatWeekday = parsed.repeatWeekday;
  if (priority) draft.priority = priority;
  if (category) draft.category = category;
  return draft;
}

/** 여러 줄 텍스트 → 할 일 초안 배열 (건너뛴 줄 제외) */
export function parseImport(text) {
  return text.split(/\r?\n/).map(parseImportLine).filter(Boolean);
}
