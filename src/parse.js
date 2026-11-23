// ============================================================
// 입력 텍스트에서 날짜 자동 인식 (F02 R9~R11)
// ------------------------------------------------------------
// 3가지 종류를 알아듣습니다:
//   마감(due)  : "도서 반납 (~7/2)", "~내일", "~금요일"  → 그날까지
//   당일(day)  : "연구실 안전점검 7/7" (맨 날짜, 문장 끝만) → 그날
//   기간(range): "학부실험 조교 11/11~11/23"             → 그 기간 동안
// 날짜 표기가 없으면 그냥 제목만 있는 할 일.
// 메일·공지에서 복사한 여러 형식(2026년 9월 15일(화) 13:00부터 …)은 아래 "붙여 넣은 글" 단계가 맡음 (R18).
// ============================================================
import { todayStr, addDays, nextNthWeekday, nextBusinessDay, weekOf } from "./date.js";
import { cleanExceptions } from "./span.js";

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
// 시간 조각 (F02 R15): 14:00 / 14시 / 14시 30분 — 날짜 바로 뒤에만 인식.
// 2026-11-16 넓힘 (R18): 오전·오후(AM·PM) / "2시 반" / 초(10:00:00)까지.
// "2시간"(걸리는 시간)은 시간으로 보지 않음
const T1 =
  "(?:(?<![A-Za-z])(?:오전|오후|[AaPp]\\.?[Mm]\\.?)\\s*)?" +
  "(?:\\d{1,2}:\\d{2}(?::\\d{2})?|\\d{1,2}시(?!간)(?:\\s*\\d{1,2}분|\\s*반)?)" +
  "(?:\\s*[AaPp][Mm](?![A-Za-z]))?";
// 시작 시간(괄호로 잡음) + 끝 시간 "~ 11:00" — 끝 시간은 읽기만 하고 버림 (앱은 시작 시간만 저장)
const T = `(${T1})(?:\\s*[~\\-–]\\s*${T1})?`;
// 기간: 날짜~날짜 (어디에 있어도 인식)
const RANGE_RE = new RegExp(`\\(?\\s*${D}\\s*~\\s*${D}\\s*\\)?`);
// 마감(숫자): ~날짜 (+시간) (어디에 있어도 인식). 닫는 괄호는 날짜 뒤·시간 뒤 어디든
// (뒤에 바로 붙은 "까지"도 같이 뺌: "(~11/30까지)" — R18)
const DUE_NUM_RE = new RegExp(`\\(?\\s*~\\s*${D}\\)?(?:\\s+${T})?(?:\\s*까지)?\\s*\\)?`);
// 마감(말): ~오늘, ~내일, ~모레, ~월요일 ... ~일요일
const DUE_WORD_RE = /\(?\s*~\s*(오늘|내일|모레|[일월화수목금토]요일)(?:\s*까지)?\s*\)?/;
// 그 주 안에 (F02 R17): ~이번주 / ~다음주 / ~다다음주 / ~12/7주(그 날짜가 든 주)
// 띄어 써도 되고("~다음 주") 뒤에 "까지"가 붙어도 됨. 괄호 (~다음주)도.
// 뒤에 다른 글자가 바로 붙으면 인식 안 함 ("~12/7 주간회의"의 '주'를 잡지 않게)
const WEEK_RE = new RegExp(
  `\\(?\\s*~\\s*(?:(이번|다음|다다음)\\s?주|${D}\\s?주)(?:\\s*까지)?\\s*\\)?(?=\\s|$)`
);
// 빨리 하면 좋은 일 (F02 R19): ~빨리 / (~빨리) — 날짜는 없지만 빨리 처리하면 좋은 일
// 뒤에 다른 글자가 바로 붙으면 인식 안 함 ("~빨리끝내기")
const SOON_RE = /\(?\s*~\s*빨리\s*\)?(?=\s|$)/;
// "이번/다음/다다음 주" = 오늘에서 며칠 뒤가 든 주인가
const WEEK_WORD_DAYS = { 이번: 0, 다음: 7, 다다음: 14 };
// 당일: 맨 날짜 (+시간) — 문장 "끝"에 있을 때만 ("3/4 분량 읽기" 오인 방지)
// 닫는 괄호는 날짜 뒤·시간 뒤 어디든: "(9/7) 14:00", "(9/7 14:00)" 모두 인식
const DAY_RE = new RegExp(`(?:^|\\s)\\(?${D}\\)?(?:\\s+${T})?\\s*\\)?\\s*$`);

/** 시간 글자("14:00", "오후 2시 30분", "8시 반", "2:00 PM") → "HH:MM".
 *  없거나 말이 안 되면(25시 등) null */
function resolveTime(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2}):(\d{2})|(\d{1,2})시(?:\s*(\d{1,2})분|\s*(반))?/);
  if (!m) return null;
  let hour = Number(m[1] ?? m[3]);
  let minute = 0;
  if (m[1] !== undefined) minute = Number(m[2]);
  else if (m[5]) minute = 30; // "8시 반"
  else if (m[4] !== undefined) minute = Number(m[4]);
  // 오후 2시 → 14시, 오전 12시 → 0시 (오후 12시는 그대로 12시)
  if (/오후|[Pp]\.?[Mm]/.test(str) && hour < 12) hour += 12;
  if (/오전|[Aa]\.?[Mm]/.test(str) && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// 붙여 넣은 글의 여러 날짜 형식 (F02 R18, 2026-11-16)
// 메일·공지에서 복사한 날짜는 모양이 제각각이라, 위의 기본 표기로 안 잡히는 것을 여기서 잡음:
//   2026-11-30 10:00 ~ 11:00 / 2026. 11. 30.(월) / 2026년 9월 15일(화) 13:00부터
//   11월 30일까지 / 11/30(월) 14:00 / (1106일마감) / 2026. 11. 16.(월) ~ 11. 20.(금)
// 확실한 날짜(연도가 있거나 "월·일" 글자가 있는 것)는 문장 어디에 있어도 인식.
// 짧은 표기(11/30, 11.30)는 뒤에 요일·시간·"까지/마감"이 붙었을 때만 — "3/4 분량" 오인 방지
// ------------------------------------------------------------
const FLEX_FORMS = [
  // 연도까지 쓴 숫자 날짜: 2026-11-30 · 2026/11/30 · 2026.11.30. · 2026. 11. 30.
  { src: "(?<![\\d.])(?<y>20\\d{2})\\s*[-/.]\\s*(?<mo>\\d{1,2})\\s*[-/.]\\s*(?<d>\\d{1,2})(?!\\d)\\.?" },
  // 한글 날짜: 2026년 9월 15일 · 26년 9월 15일 · 11월 30일
  { src: "(?<!\\d)(?:(?<y>(?:20)?\\d{2})년\\s*)?(?<mo>\\d{1,2})월\\s*(?<d>\\d{1,2})일" },
  // 붙여 쓴 네 자리: 1106일마감 · 1106일까지 (뒤에 마감/까지가 있을 때만)
  { src: "(?<!\\d)(?<mo>\\d{2})(?<d>\\d{2})일(?=\\s*(?:마감|까지))" },
  // 짧은 표기: 11/30 · 11.30 · 11. 30. — weak = 뒤에 요일·시간·까지/마감이 있어야 날짜로 봄
  { src: "(?<![\\d/.\\-:])(?<mo>\\d{1,2})\\s*[/.]\\s*(?<d>\\d{1,2})(?![\\d/:])일?\\.?", weak: true },
];
// 날짜 뒤에 붙는 것: 요일 "(화)"·"(화요일)"·"화요일" + 시간(끝 시간 포함)
const FLEX_TAIL =
  "(?<wd>\\s*\\(\\s*[일월화수목금토](?:요일)?\\s*\\)|\\s*[일월화수목금토]요일)?" +
  `(?:\\s*(?<t>${T1})(?:\\s*[~\\-–]\\s*${T1})?)?`;
for (const f of FLEX_FORMS) {
  f.any = new RegExp(f.src + FLEX_TAIL, "g"); // 문장 어디서든 찾기
  f.head = new RegExp("^" + f.src + FLEX_TAIL); // 바로 그 자리에서 시작하는지 (기간의 끝 날짜용)
}
// 기간의 끝이 "17일"처럼 일만 적힌 경우: 9월 15일 ~ 17일
const DAY_ONLY_HEAD = new RegExp("^(?<d>\\d{1,2})일" + FLEX_TAIL);
// 기간을 잇는 글자: ~ · - · – · 부터 (뒤에 날짜가 이어질 때만 기간으로 봄)
const RANGE_JOIN = /^\s*(?:~|–|-|부터)\s*/;

/** 문장 안의 날짜 후보들을 앞에서부터 차례로 */
function flexCandidates(text) {
  const found = [];
  FLEX_FORMS.forEach((f, order) => {
    for (const m of text.matchAll(f.any)) found.push({ f, m, order });
  });
  return found.sort((a, b) => a.m.index - b.m.index || a.order - b.order);
}

/** 두 자리 연도("26년")는 2000년대로: "26" → "2026" */
function fullYear(y) {
  return y && y.length === 2 ? "20" + y : y;
}

/** 인식한 구간 [from, to)를 제목에서 빼기 — 구간을 감싼 괄호 "( … )"도 같이 */
function cutTitle(text, from, to) {
  const before = text.slice(0, from);
  const after = text.slice(to);
  const open = before.match(/\(\s*$/);
  const close = after.match(/^\s*\)/);
  const head = open && close ? before.slice(0, open.index) : before;
  const tail = open && close ? after.slice(close[0].length) : after;
  return (head + " " + tail).replace(/\s+/g, " ").trim();
}

/** 붙여 넣은 형식의 "기간": 날짜 ~ 날짜 (끝 날짜에 연도·월이 없으면 시작 날짜 것을 따름) */
function parseFlexRange(text, allowPast) {
  for (const { m } of flexCandidates(text)) {
    const g = m.groups;
    let start = resolveYMD(fullYear(g.y), g.mo, g.d, true);
    if (!start) continue;
    const rest = text.slice(m.index + m[0].length);
    const join = rest.match(RANGE_JOIN);
    if (!join) continue;
    const afterJoin = rest.slice(join[0].length);
    let m2 = null;
    for (const f of FLEX_FORMS) if ((m2 = afterJoin.match(f.head))) break;
    m2 = m2 || afterJoin.match(DAY_ONLY_HEAD);
    if (!m2) continue;
    const g2 = m2.groups;
    // 끝 날짜: 연도가 없으면 시작과 같은 해, 월도 없으면("17일") 같은 달
    let end = resolveYMD(
      fullYear(g2.y) || start.slice(0, 4),
      g2.mo || start.slice(5, 7),
      g2.d,
      true
    );
    if (!end) continue;
    if (end < start && !g2.y) end = plusOneYear(end); // 해를 넘는 기간 (12/28 ~ 1/3)
    if (end <= start) continue;
    // 연도 없이 쓴 기간이 통째로 지났으면 내년으로 (기본 기간 표기와 같은 규칙)
    if (!allowPast && !g.y && !g2.y && end < todayStr()) {
      start = plusOneYear(start);
      end = plusOneYear(end);
    }
    const tailEnd = afterJoin.slice(m2[0].length).match(/^\s*까지/); // "…부터 …까지"의 까지
    const to =
      m.index + m[0].length + join[0].length + m2[0].length + (tailEnd ? tailEnd[0].length : 0);
    const title = cutTitle(text, m.index, to);
    if (title) return { title, startDate: start, dueDate: end, dateKind: "range" };
  }
  return null;
}

/** 붙여 넣은 형식의 날짜 하나 (+시간): 앞에 "~"가 있거나 뒤에 "까지/마감"이 붙으면 마감, 아니면 당일 */
function parseFlexSingle(text, allowPast) {
  for (const { f, m } of flexCandidates(text)) {
    const g = m.groups;
    const date = resolveYMD(fullYear(g.y), g.mo, g.d, allowPast);
    if (!date) continue;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    const tilde = before.match(/~\s*$/); // "~2026년 11월 30일"
    const dueWord = after.match(/^\s*(?:까지|마감)/); // "11월 30일까지", "1106일마감"
    // 날짜에 그냥 붙은 말은 같이 뺌: "13:00부터", "11월 30일에"
    const filler = dueWord ? null : after.match(/^\s*부터|^에(?=[\s)]|$)/);
    // 짧은 표기는 날짜라는 증거(요일·시간·마감 표시)가 있을 때만
    if (f.weak && !g.wd && !g.t && !dueWord && !tilde) continue;
    const from = tilde ? tilde.index : m.index;
    const to = m.index + m[0].length + ((dueWord || filler)?.[0].length ?? 0);
    const title = cutTitle(text, from, to);
    if (!title) continue;
    const time = resolveTime(g.t);
    return {
      title,
      dueDate: date,
      dateKind: tilde || dueWord ? "due" : "day",
      ...(time && { dueTime: time }),
    };
  }
  return null;
}

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
 * opts.weekable: 할 일 전용 표기 인식 여부 — "~이번주"·"~다음주" 같은 주 표기(F02 R17)와
 *                "~빨리"(F02 R19). 기본 켜짐 — 📢 일정 입력에선 끔
 */
export function parseQuickInput(
  text,
  { allowPast = false, repeatable = true, weekable = true } = {}
) {
  // 빨리 하면 좋은 일 (F02 R19): ~빨리 → 표기를 빼고 나머지를 평소대로 해석.
  // 날짜·반복이 같이 적혀 있으면 그쪽이 우선 ("빨리"는 날짜 없는 일에만 붙는 표시)
  if (weekable) {
    const s = text.match(SOON_RE);
    if (s) {
      const inner = parseQuickInput(stripTitle(text, s[0]), {
        allowPast,
        repeatable,
        weekable,
      });
      if (inner.title === "") return { title: text.trim() }; // 제목이 없으면 인식 취소
      return inner.dueDate || inner.repeat ? inner : { ...inner, soon: true };
    }
  }

  // 반복 표기 먼저 확인 (F09) — 찾으면 표기를 뺀 나머지로 날짜·제목을 계속 해석
  if (repeatable) {
    const rep = detectRepeat(text);
    if (rep) {
      const inner = parseQuickInput(rep.rest, { allowPast, repeatable: false, weekable });
      if (inner.title === "") return { title: text.trim() }; // 제목이 없으면 인식 취소
      if (inner.dateKind === "range") {
        // 기간엔 반복 미지원 (R1) — '매주' 표기를 조용히 지우지 않고
        // 원문 그대로 기간으로 해석 (표기가 제목에 남아 사용자가 알 수 있게)
        return parseQuickInput(text, { allowPast, repeatable: false, weekable });
      }
      if (inner.dateKind === "week") {
        // 반복 + ~이번주: 반복이 우선 (F02 R17) — 이번 주 날짜는 버리고 반복 기준일로
        inner.dueDate = undefined;
        inner.dateKind = undefined;
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
        ...(inner.dueTime && { dueTime: inner.dueTime }), // 시간은 그대로 (R15)
        repeat: rep.repeat,
      };
    }
  }

  const plain = { title: text.trim() };

  // 0) 그 주 안에 (F03 R10): ~이번주·~다음주·~12/7주 → 그 주 월요일~일요일, 요일은 정하지 않음
  let m = weekable ? text.match(WEEK_RE) : null;
  if (m) {
    const title = stripTitle(text, m[0]);
    // 그 주에 든 날짜 하나: 말로 쓰면 오늘에서 0·7·14일 뒤, 날짜로 쓰면 그 날짜 (m[2]~m[4] = 연·월·일)
    const base = m[1]
      ? addDays(todayStr(), WEEK_WORD_DAYS[m[1]])
      : resolveYMD(m[2], m[3], m[4], true);
    if (title && base) {
      let week = weekOf(base);
      // 연도 없이 쓴 주가 통째로 지났으면 내년의 그 날짜가 든 주로 (기간 표기와 같은 규칙)
      if (!m[1] && !m[2] && week.end < todayStr()) week = weekOf(plusOneYear(base));
      return { title, startDate: week.start, dueDate: week.end, dateKind: "week" };
    }
  }

  // 1) 기간: 11/11~11/23 (마감 ~보다 먼저 검사해야 함 — "~11/23" 부분만 잡히지 않게)
  m = text.match(RANGE_RE);
  if (m) {
    // 시작·끝 모두 일단 올해 그대로 해석 — "진행 중인 기간"(시작은 지났고 끝은 남음)을
    // 입력하는 흔한 경우를 내년으로 밀어버리지 않기 위해
    let start = resolveYMD(m[1], m[2], m[3], true);
    let end = resolveYMD(m[4], m[5], m[6], true);
    if (start && end) {
      // 연도를 직접 적었으면 적은 대로 둔다 — 아래 두 보정은 "연도를 생략했을 때"만.
      // (2026-09-28 수정: 백업 파일처럼 연도가 적힌 지난 기간이 가져올 때 내년으로 밀리던 버그)
      const endYearGiven = !!m[4];
      const anyYearGiven = !!m[1] || endYearGiven;
      // 연도 생략한 기간이 해를 넘는 경우 (예: 12/28~1/3) → 끝을 다음 해로
      if (end < start && !endYearGiven) end = plusOneYear(end);
      // 기간이 통째로 지난 경우에만 내년으로 (공지 입력(allowPast)은 지난 기간도 그대로)
      if (!allowPast && !anyYearGiven && end < todayStr()) {
        start = plusOneYear(start);
        end = plusOneYear(end);
      }
      const title = stripTitle(text, m[0]);
      if (title) return { title, startDate: start, dueDate: end, dateKind: "range" };
    }
  }
  // 1-2) 붙여 넣은 형식의 기간 (R18): 2026. 11. 16.(월) ~ 11. 20.(금), 9월 15일 ~ 17일
  // (마감 ~보다 먼저 — 뒤쪽 "~ 11. 20." 만 마감으로 잡히지 않게)
  const flexRange = parseFlexRange(text, allowPast);
  if (flexRange) return flexRange;

  // 2) 마감: ~7/2 또는 ~내일 / ~금요일
  m = text.match(DUE_NUM_RE);
  if (m) {
    const due = resolveYMD(m[1], m[2], m[3], allowPast);
    if (due) {
      const title = stripTitle(text, m[0]);
      const time = resolveTime(m[4]); // 날짜 뒤 시간 (R15)
      if (title)
        return { title, dueDate: due, dateKind: "due", ...(time && { dueTime: time }) };
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
      const time = resolveTime(m[4]); // 날짜 뒤 시간 (R15)
      if (title)
        return { title, dueDate: day, dateKind: "day", ...(time && { dueTime: time }) };
    }
  }

  // 4) 붙여 넣은 형식의 날짜 하나 (R18): 문장 앞·가운데의 날짜, 한글 날짜, 요일 괄호, 오전·오후 …
  const flex = parseFlexSingle(text, allowPast);
  if (flex) return flex;

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
  // 🗓 = "이번 주 중에" 할 일 (F03 R10) — 내보내기가 "🗓 월요일 ~ 일요일"로 적음
  const hadWeekMark = t.includes("🗓");
  t = t.replace(/📅/g, " ").replace(/🔁/g, " ").replace(/🗓️?/g, " ");

  // 메모판 스티커 소속 📌이름 (F03 R2d) — 내보내기가 줄 맨 끝에 붙이므로 끝까지 이름
  let board;
  const pin = t.match(/📌\s*(.+?)\s*$/);
  if (pin) {
    board = pin[1];
    t = t.replace(pin[0], " ");
  }

  // 기간의 예외 날짜 (F03 R9): ➖제외한 날들 ➕추가한 날들 — 쉼표로 구분 (내보내기 형식)
  const takeDates = (mark) => {
    const found = t.match(new RegExp(mark + "\\s*([0-9][0-9,\\-\\s]*)"));
    if (!found) return [];
    t = t.replace(found[0], " ");
    return found[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  };
  const skipDates = takeDates("➖");
  const extraDates = takeDates("➕");

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
    if (parsed.dueTime) draft.dueTime = parsed.dueTime;
  }
  if (parsed.startDate) draft.startDate = parsed.startDate;
  if (hadWeekMark && parsed.dateKind === "range") {
    draft.dateKind = "week"; // 🗓 기간 = 그 주의 월~일 (예외 날짜 없음)
  } else if (parsed.dateKind === "range") {
    // 예외 날짜는 기간에만 — 범위를 벗어난 것은 정리하면서 빠짐
    const exc = cleanExceptions(parsed.startDate, parsed.dueDate, skipDates, extraDates);
    if (exc.skipDates) draft.skipDates = exc.skipDates;
    if (exc.extraDates) draft.extraDates = exc.extraDates;
  }
  if (parsed.soon) draft.soon = true; // 빨리 하면 좋은 일 (F03 R13) — 내보내기가 "~빨리"로 적음
  if (parsed.repeat) draft.repeat = parsed.repeat;
  if (parsed.repeatNth !== undefined) draft.repeatNth = parsed.repeatNth;
  if (parsed.repeatWeekday !== undefined) draft.repeatWeekday = parsed.repeatWeekday;
  if (priority) draft.priority = priority;
  if (category) draft.category = category;
  if (board) draft.board = board;
  return draft;
}

/** 여러 줄 텍스트 → 할 일 초안 배열 (건너뛴 줄 제외) */
export function parseImport(text) {
  return text.split(/\r?\n/).map(parseImportLine).filter(Boolean);
}
