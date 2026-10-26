// ============================================================
// 기간 + 예외(제외한 날·추가한 날) 계산 — 할 일·일정 공용
// 화면·저장소와 분리된 순수 함수 (Node로 테스트 가능) · F03 R9
// ------------------------------------------------------------
// "걸리는 날" = (시작~끝 사이의 날 − 제외한 날) + 추가한 날
//   span = { start, end, skip: [...], extra: [...] }   날짜는 모두 "YYYY-MM-DD"
//   예: 10/6~10/16, 10/9 제외, 10/19 추가 → 10/6·7·8, 10/10~16, 10/19
// 예외는 "기간"에만 붙는다 (하루짜리·마감·반복에는 없음).
// 저장 이름: 할 일·일정 모두 skipDates(제외한 날들), extraDates(추가한 날들)
// ============================================================
import { addDays } from "./date.js";

/** 할 일 → span. 기간이 아니면 그 날짜 하루짜리(예외 없음). 날짜가 없으면 null */
export function spanOfTask(t) {
  if (!t.dueDate) return null;
  if (t.dateKind === "range" && t.startDate) {
    // 혹시 시작·끝이 뒤바뀐 데이터여도 앞뒤를 바로잡아 계산
    const [start, end] =
      t.startDate <= t.dueDate ? [t.startDate, t.dueDate] : [t.dueDate, t.startDate];
    return { start, end, skip: t.skipDates ?? [], extra: t.extraDates ?? [] };
  }
  return { start: t.dueDate, end: t.dueDate, skip: [], extra: [] };
}

/** 일정(날짜 있는 노트) → span. 날짜가 없으면 null */
export function spanOfNote(n) {
  if (!n.date) return null;
  if (n.endDate)
    return {
      start: n.date,
      end: n.endDate,
      skip: n.skipDates ?? [],
      extra: n.extraDates ?? [],
    };
  return { start: n.date, end: n.date, skip: [], extra: [] };
}

/** 그 날짜에 걸리는가 */
export function isActiveOn(span, d) {
  if (!span) return false;
  if (span.extra.includes(d)) return true;
  return span.start <= d && d <= span.end && !span.skip.includes(d);
}

/** 기간 안에서 처음으로 걸리는 날 (전부 제외됐으면 null) */
function firstInRange(span) {
  for (let d = span.start; d <= span.end; d = addDays(d, 1)) {
    if (!span.skip.includes(d)) return d;
  }
  return null;
}

/** 기간 안에서 마지막으로 걸리는 날 (전부 제외됐으면 null) */
function lastInRange(span) {
  for (let d = span.end; d >= span.start; d = addDays(d, -1)) {
    if (!span.skip.includes(d)) return d;
  }
  return null;
}

/** 걸리는 첫 날 (기간과 추가한 날을 통틀어). 하나도 없으면 null */
export function firstActiveDate(span) {
  const all = [firstInRange(span), ...span.extra].filter(Boolean).sort();
  return all[0] ?? null;
}

/** 걸리는 마지막 날 — "지남/밀림" 판정의 기준. 하나도 없으면 null */
export function lastActiveDate(span) {
  const all = [lastInRange(span), ...span.extra].filter(Boolean).sort();
  return all[all.length - 1] ?? null;
}

/** d보다 뒤(d는 제외)에서 처음으로 걸리는 날. 없으면 null */
export function nextActiveAfter(span, d) {
  const found = [];
  let x = addDays(d, 1);
  if (x < span.start) x = span.start;
  for (; x <= span.end; x = addDays(x, 1)) {
    if (!span.skip.includes(x)) {
      found.push(x);
      break;
    }
  }
  for (const e of span.extra) if (e > d) found.push(e);
  return found.sort()[0] ?? null;
}

/** 걸리는 날들을 이어진 것끼리 묶은 조각 [{ from, to }] (날짜 순).
 *  구글 캘린더에 올릴 때 조각 하나가 이벤트 하나가 됨 */
export function activeSegments(span) {
  const days = [];
  for (let d = span.start; d <= span.end; d = addDays(d, 1)) {
    if (!span.skip.includes(d)) days.push(d);
  }
  for (const e of span.extra) if (!days.includes(e)) days.push(e);
  days.sort();
  const segs = [];
  for (const d of days) {
    const last = segs[segs.length - 1];
    if (last && addDays(last.to, 1) === d) last.to = d;
    else segs.push({ from: d, to: d });
  }
  return segs;
}

/** 예외가 하나라도 있는가 (할 일·일정 어느 쪽이든) */
export function hasExceptions(item) {
  return (item.skipDates?.length ?? 0) + (item.extraDates?.length ?? 0) > 0;
}

/** 저장 직전 정리: 제외는 기간 "안"의 날만, 추가는 기간 "밖"의 날만, 중복 없이 날짜 순.
 *  기간을 고쳐서 범위를 벗어난 예외는 여기서 자동으로 빠짐. 비면 undefined(칸 자체를 없앰).
 *  걸리는 날이 하루도 안 남게 되면 제외를 무시 — 어디에도 안 보이는 항목이 되지 않게 */
export function cleanExceptions(start, end, skip = [], extra = []) {
  const uniq = (arr) => [...new Set(arr)].sort();
  let s = uniq(skip.filter((d) => start <= d && d <= end));
  const e = uniq(extra.filter((d) => d < start || d > end));
  if (e.length === 0 && firstInRange({ start, end, skip: s }) === null) s = [];
  return {
    skipDates: s.length > 0 ? s : undefined,
    extraDates: e.length > 0 ? e : undefined,
  };
}

/** 그 날을 뺄 수 있는가 — 지금 걸리는 날이고, 빼고 나서도 걸리는 날이 하루는 남아야 함 */
export function canSkip(span, d) {
  if (!isActiveOn(span, d)) return false;
  const after = skipDay(span, d);
  return firstActiveDate({ ...span, ...after }) !== null;
}

/** 그 날 빼기 → 새 { skip, extra }.
 *  추가했던 날이면 추가 목록에서 지우고, 기간 안의 날이면 제외 목록에 넣음 */
export function skipDay(span, d) {
  if (span.extra.includes(d)) {
    return { skip: span.skip, extra: span.extra.filter((x) => x !== d) };
  }
  return { skip: [...span.skip, d].sort(), extra: span.extra };
}

/** 날짜 더하기(걸리게 하기) → 새 { skip, extra }.
 *  기간 안의 날이면 "제외를 되돌림", 기간 밖이면 추가 목록에 넣음 */
export function addDay(span, d) {
  if (span.start <= d && d <= span.end) {
    return { skip: span.skip.filter((x) => x !== d), extra: span.extra };
  }
  if (span.extra.includes(d)) return { skip: span.skip, extra: span.extra };
  return { skip: span.skip, extra: [...span.extra, d].sort() };
}

/** "2026-10-09" → "10/9" */
function md(ds) {
  return `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;
}

/** 날짜 여러 개를 짧게: "10/9, 10/12" — 넷 이상이면 "10/9, 10/12, 10/13 외 2일" */
function listDates(dates) {
  if (dates.length <= 3) return dates.map(md).join(", ");
  return `${dates.slice(0, 3).map(md).join(", ")} 외 ${dates.length - 3}일`;
}

/** 예외를 뱃지용 글로: " · 제외 10/9 · 추가 10/19" (없으면 빈 글자) */
export function exceptionText(item) {
  let s = "";
  if (item.skipDates?.length) s += ` · 제외 ${listDates(item.skipDates)}`;
  if (item.extraDates?.length) s += ` · 추가 ${listDates(item.extraDates)}`;
  return s;
}

/** 오늘 탭 "오늘 할 일"에 나올 할 일인가 (미완료만, F03 R2):
 *   하루짜리·마감 → 그 날짜가 오늘이거나 지났음
 *   기간 → 오늘이 걸리는 날(진행 중)이거나, 마지막 날이 지났음(밀림).
 *          제외한 날에는 안 나오고, 끝난 뒤 추가한 날을 기다리는 동안에도 안 나옴 */
export function isDueToday(task, today) {
  if (task.done || !task.dueDate) return false;
  // 이번 주 중에 할 일 (F03 R10): 그 주 동안은 "이번 주에 할 일" 묶음에 있고,
  // 일요일이 지나서야 여기로 올라옴 (밀림)
  if (task.dateKind === "week") return task.dueDate < today;
  if (!(task.dateKind === "range" && task.startDate)) return task.dueDate <= today;
  const span = spanOfTask(task);
  const last = lastActiveDate(span) ?? span.end;
  return isActiveOn(span, today) || last < today;
}

/** 오늘 탭 "이번 주에 할 일" 묶음에 나올 할 일인가 (F03 R10):
 *  미완료 + "이번 주" 종류 + 오늘이 그 주(월~일) 안 */
export function isThisWeekTask(task, today) {
  return (
    !task.done &&
    task.dateKind === "week" &&
    !!task.startDate &&
    task.startDate <= today &&
    today <= task.dueDate
  );
}
