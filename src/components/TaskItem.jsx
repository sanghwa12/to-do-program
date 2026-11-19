// ------------------------------------------------------------
// 할 일 한 줄 (F02 + F03)
// 보통 모드: 체크박스 + 제목 + 날짜·반복 뱃지 + 수정/삭제
// 편집 모드: 제목·메모에 더해 날짜·반복을 "나중에" 붙일 수 있음 (F03 R1)
// (우선순위는 2026-09-28, 카테고리는 2026-08-05에 화면에서 제거 — 저장된 값은 보존)
// ------------------------------------------------------------
import { useState } from "react";
import Icon from "./Icon.jsx";
import { updateTask } from "../db.js";
import {
  todayStr,
  daysLate,
  nextNthWeekday,
  nextWeekdayDate,
  nextMonthDay,
  nthOfDate,
  nextBusinessDay,
  nextYearlyDate,
  dateOnly,
  weekOf,
} from "../date.js";
import {
  WEEKDAY_LABEL,
  NTH_LABEL,
  repeatLabelOf,
  weekRangeText,
} from "../labels.js";
import ExceptionDates from "./ExceptionDates.jsx";
import {
  spanOfTask,
  isActiveOn,
  lastActiveDate,
  cleanExceptions,
  exceptionText,
  canSkip,
  ddayText,
} from "../span.js";

/** "YYYY-MM-DD"의 요일 (0=일~6=토) */
function weekdayOf(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay();
}

/** 저장된 반복 규칙이 프리셋 메뉴의 어느 항목에 해당하는지 (R10)
 *  날짜에서 계산되는 규칙과 일치하면 그 프리셋, 아니면 "custom" */
function presetFromTask(t) {
  if (!t.repeat) return "";
  if (t.repeat === "monthlyNth") {
    if (t.dueDate) {
      const info = nthOfDate(t.dueDate);
      if (info.nth === t.repeatNth && info.weekday === t.repeatWeekday) {
        return "monthlyNth";
      }
    }
    return "custom"; // 날짜와 다른 규칙 (예: 날짜는 9일인데 규칙은 첫째 월요일)
  }
  return t.repeat; // daily/weekdays/weekly/monthly/yearly — 날짜가 곧 기준
}

// onConvert(할 일): "📢 일정으로 바꾸기"를 눌렀을 때 (F11 R9) — 안 주면 버튼이 안 보임
// dayContext + onSkipDay(할 일, 날짜): 달력에서 고른 날짜 — 기간 할 일에 "이 날 빼기" (F03 R9)
// onPostpone(할 일): "이번 주" 할 일의 "다음 주로" 버튼 (F03 R11) — 안 주면 버튼이 안 보임
export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onConvert,
  dayContext,
  onSkipDay,
  onPostpone,
}) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [confirmDelete, setConfirmDelete] = useState(false); // 삭제 확인 중?
  const [confirmConvert, setConfirmConvert] = useState(false); // 일정 변환 확인 중? (반복일 때)
  // 기간의 예외 날짜 (F03 R9): 제외한 날들 / 추가한 날들
  const [skipDates, setSkipDates] = useState(task.skipDates ?? []);
  const [extraDates, setExtraDates] = useState(task.extraDates ?? []);
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [dueTime, setDueTime] = useState(task.dueTime || ""); // 시간 (선택, F02 R15)
  const [dateKind, setDateKind] = useState(task.dateKind || "due"); // 날짜의 의미
  const [startDate, setStartDate] = useState(task.startDate || ""); // 기간의 시작
  const [repeat, setRepeat] = useState(task.repeat || ""); // 반복 주기 (F09, 사용자화용)
  const [presetChoice, setPresetChoice] = useState(presetFromTask(task)); // 프리셋 메뉴 (R10)
  const [repeatNth, setRepeatNth] = useState(task.repeatNth ?? 1); // 매월 N번째 (R8)
  // 요일 (매주·매월N번째 공용): 저장된 값 → 없으면 현재 날짜의 요일 → 없으면 월요일
  const [repeatWeekday, setRepeatWeekday] = useState(
    task.repeatWeekday ?? (task.dueDate ? weekdayOf(task.dueDate) : 1)
  );
  // 매달 며칠 (R9): 현재 날짜의 일 → 없으면 오늘의 일
  const [monthDay, setMonthDay] = useState(
    task.dueDate ? Number(task.dueDate.slice(8, 10)) : new Date().getDate()
  );
  // ⚠️ 훅(useState 등)을 더할 땐 반드시 여기(early return 위)에 —
  //    편집 모드의 return보다 아래에 두면 수정 버튼 클릭 시 앱 전체가 하얗게 죽는다 (실제 사고)

  // 폼 내용을 저장할 값으로 정리 — 저장과 "일정으로 바꾸기"가 함께 씀. 제목이 비면 null
  function buildChanges() {
    const newTitle = title.trim();
    if (newTitle === "") return null; // 제목을 비워서 저장하는 건 막음
    // 날짜 종류 정리: 날짜가 없으면 종류도 없음. "기간"인데 시작일이 없으면 "마감"으로.
    let kind = !dueDate ? undefined : dateKind === "range" && !startDate ? "due" : dateKind;
    // 기간의 시작일이 끝일보다 늦으면 앞뒤를 자동으로 바꿔줌
    // (역전된 기간은 달력 등에서 안 보이게 되므로 저장 시점에 바로잡음)
    let saveStart = kind === "range" ? startDate : undefined;
    let saveDue = dueDate || undefined;
    if (kind === "range" && saveStart > saveDue) {
      [saveStart, saveDue] = [saveDue, saveStart];
    }
    // 이번 주 중에 (F03 R10): 날짜 칸의 날짜가 든 주 → 월요일~일요일로 저장
    if (kind === "week") {
      const w = weekOf(dueDate);
      saveStart = w.start;
      saveDue = w.end;
    }
    // 반복 정리 (F09 R1·R6·R8·R9·R10) — 기간·이번 주에는 반복 없음
    let saveRepeat;
    let saveNth;
    let saveWeekday;
    if (kind !== "range" && kind !== "week") {
      if (presetChoice && presetChoice !== "custom") {
        // 프리셋 (R10): 규칙은 할 일의 날짜(없으면 등록날짜)에서 뽑고,
        // 날짜가 없던 할 일은 "다가오는 회차"를 첫 날짜로 (지난 날짜로 저장 방지)
        const base = saveDue || dateOnly(task.createdAt);
        const today = todayStr();
        saveRepeat = presetChoice;
        if (presetChoice === "monthlyNth") {
          const info = nthOfDate(base);
          saveNth = info.nth;
          saveWeekday = info.weekday;
        }
        if (saveDue) {
          // 날짜가 있으면 그대로 (주중 매일인데 주말이면 다음 월요일로만 보정)
          if (presetChoice === "weekdays") saveDue = nextBusinessDay(saveDue);
        } else if (presetChoice === "daily") {
          saveDue = today;
        } else if (presetChoice === "weekdays") {
          saveDue = nextBusinessDay(today);
        } else if (presetChoice === "weekly") {
          saveDue = nextWeekdayDate(weekdayOf(base), today);
        } else if (presetChoice === "monthly") {
          saveDue = nextMonthDay(Number(base.slice(8, 10)), today);
        } else if (presetChoice === "monthlyNth") {
          saveDue = nextNthWeekday(saveNth, saveWeekday, today);
        } else if (presetChoice === "yearly") {
          saveDue = nextYearlyDate(base, today);
        }
        if (!kind) kind = "day";
      } else if (presetChoice === "custom" && repeat) {
        // 사용자화 (R8·R9): 상세 드롭다운의 규칙대로 날짜 자동 계산
        saveRepeat = repeat;
        if (repeat === "monthlyNth") {
          saveNth = repeatNth === "last" ? "last" : Number(repeatNth);
          saveWeekday = Number(repeatWeekday);
          saveDue = nextNthWeekday(saveNth, saveWeekday, todayStr());
          kind = "day";
          saveStart = undefined;
        } else if (repeat === "weekly") {
          // 매주 X요일: 날짜가 이미 그 요일이면 유지, 아니면 다가오는 그 요일로
          const wd = Number(repeatWeekday);
          if (!saveDue || weekdayOf(saveDue) !== wd) {
            saveDue = nextWeekdayDate(wd, todayStr());
          }
        } else if (repeat === "monthly") {
          // 매달 N일: 날짜가 이미 그 일(말일 클램프 포함)이면 유지, 아니면 다가오는 그 일로
          const dom = Number(monthDay);
          const matches =
            saveDue &&
            Number(saveDue.slice(8, 10)) ===
              Math.min(
                dom,
                new Date(
                  Number(saveDue.slice(0, 4)),
                  Number(saveDue.slice(5, 7)),
                  0
                ).getDate()
              );
          if (!matches) saveDue = nextMonthDay(dom, todayStr());
        } else if (!saveDue) {
          saveDue = todayStr(); // 매일·매년인데 날짜가 없으면 오늘부터
        }
        if (!kind) kind = "day"; // 자동 계산된 날짜는 "당일" 성격
      }
    }
    // 예외 날짜 정리 (F03 R9): 기간에만 남기고, 기간을 고쳐 범위를 벗어난 것은 뺌
    const exc =
      kind === "range"
        ? cleanExceptions(saveStart, saveDue, skipDates, extraDates)
        : { skipDates: undefined, extraDates: undefined };
    return {
      title: newTitle,
      memo: memo.trim() || undefined,       // 비워두면 필드 자체를 없앰
      dueDate: saveDue,
      // 기간·이번 주엔 시간 없음
      dueTime: kind && kind !== "range" && kind !== "week" && dueTime ? dueTime : undefined,
      dateKind: kind,
      startDate: saveStart,
      skipDates: exc.skipDates,
      extraDates: exc.extraDates,
      repeat: saveRepeat,
      repeatNth: saveNth,
      repeatWeekday: saveWeekday,
      // 우선순위(2026-09-28)·카테고리(2026-08-05)는 화면에서 제거 —
      // update에서 제외해 저장된 값은 보존
    };
  }

  // 편집 내용 저장
  async function handleSave(e) {
    e.preventDefault();
    const changes = buildChanges();
    if (!changes) return;
    await updateTask(task.id, changes);
    setEditing(false);
  }

  // 📢 일정으로 바꾸기 (F11 R9): 지금 폼에 보이는 내용 그대로 일정이 됨.
  // 반복은 일정에 없는 개념이라 사라지므로, 반복 할 일이면 한 번 더 물어봄 (confirmed)
  function handleConvert(confirmed) {
    const changes = buildChanges();
    if (!changes || !changes.dueDate) return; // 일정은 날짜가 있어야 함
    if (changes.repeat && !confirmed) {
      setConfirmConvert(true);
      return;
    }
    setConfirmConvert(false);
    setEditing(false);
    onConvert({ ...task, ...changes });
  }

  // 폼 내용을 지금 저장돼 있는 값으로 다시 채움
  function syncFormFromTask() {
    setTitle(task.title);
    setMemo(task.memo || "");
    setDueDate(task.dueDate || "");
    setDueTime(task.dueTime || "");
    setDateKind(task.dateKind || "due");
    setStartDate(task.startDate || "");
    setRepeat(task.repeat || "");
    setPresetChoice(presetFromTask(task));
    setRepeatNth(task.repeatNth ?? 1);
    setRepeatWeekday(
      task.repeatWeekday ?? (task.dueDate ? weekdayOf(task.dueDate) : 1)
    );
    setMonthDay(
      task.dueDate ? Number(task.dueDate.slice(8, 10)) : new Date().getDate()
    );
    setSkipDates(task.skipDates ?? []);
    setExtraDates(task.extraDates ?? []);
    setConfirmConvert(false);
  }

  // 편집 시작 — 반드시 최신 값으로 폼을 채우고 시작
  // (폼 밖에서 바뀐 값이, 저장할 때 옛 값으로 되돌아가지 않게)
  function startEditing() {
    syncFormFromTask();
    setEditing(true);
  }

  // 편집 취소 — 고치던 내용은 버리고 원래대로
  function handleCancel() {
    syncFormFromTask();
    setEditing(false);
  }

  // ----- 편집 모드 화면 -----
  if (editing) {
    // 반복 프리셋 문구는 할 일의 날짜, 없으면 "등록날짜" 기준으로 계산 (R10)
    // — 수정 화면을 언제 열어도 같은 선택지가 나오게
    const base = dueDate || dateOnly(task.createdAt);
    const baseWd = weekdayOf(base);
    const baseMonth = Number(base.slice(5, 7));
    const baseDay = Number(base.slice(8, 10));
    const baseNth = nthOfDate(base);
    // 예외 날짜 칸 (F03 R9)은 기간일 때만. 폼의 시작·끝이 뒤바뀌어 있어도 바로잡아 넘기고,
    // 기간을 고치는 중에 범위를 벗어난 예외는 화면에서도 바로 빠지게 정리해서 보여줌
    const isRangeForm = dueDate && dateKind === "range" && startDate;
    const [rangeFrom, rangeTo] =
      startDate <= dueDate ? [startDate, dueDate] : [dueDate, startDate];
    const shownExc = isRangeForm
      ? cleanExceptions(rangeFrom, rangeTo, skipDates, extraDates)
      : {};
    return (
      <li className="task-item editing">
        <form onSubmit={handleSave} className="edit-form">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
          />
          {/* F03: 날짜·반복 — 전부 선택 사항 */}
          <div className="edit-extras">
            <label>
              {/* 이번 주 중에(F03 R10)를 고르면 이 날짜가 든 주(월~일)로 저장됨 */}
              {dueDate && dateKind === "week" ? "날짜 (이 날이 든 주)" : "날짜"}
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            {/* 날짜의 의미: ~까지 마감 / 그날 당일 / 기간 */}
            {dueDate && (
              <label>
                날짜 종류
                <select
                  value={dateKind}
                  onChange={(e) => setDateKind(e.target.value)}
                >
                  <option value="due">마감 (~까지)</option>
                  <option value="day">당일</option>
                  <option value="range">기간</option>
                  <option value="week">이번 주 중에 (요일 미정)</option>
                </select>
              </label>
            )}
            {/* 시간 (선택, R15) — 기간·이번 주가 아닐 때만 */}
            {dueDate && dateKind !== "range" && dateKind !== "week" && (
              <label>
                시간
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </label>
            )}
            {dueDate && dateKind === "range" && (
              <label>
                시작일
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
            )}
            {/* 반복 프리셋 (R10): 날짜에서 계산된 구체적 선택지를 한 번에 고름 — 기간·이번 주엔 없음 */}
            {!(dueDate && (dateKind === "range" || dateKind === "week")) && (
              <label>
                반복
                <select
                  value={presetChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPresetChoice(v);
                    // 사용자화로 처음 들어갈 때 규칙 기본값
                    if (v === "custom" && !repeat) setRepeat("weekly");
                  }}
                >
                  <option value="">없음</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주 {WEEKDAY_LABEL[baseWd]}요일</option>
                  <option value="monthly">매월 {baseDay}일</option>
                  <option value="monthlyNth">
                    매월 {NTH_LABEL[baseNth.nth]}{" "}
                    {WEEKDAY_LABEL[baseNth.weekday]}요일
                  </option>
                  <option value="yearly">
                    매년 {baseMonth}월 {baseDay}일
                  </option>
                  <option value="weekdays">주중 매일 (월~금)</option>
                  <option value="custom">사용자화…</option>
                </select>
              </label>
            )}
            {/* 사용자화 (R8·R9): 날짜와 다른 규칙을 직접 조립 */}
            {presetChoice === "custom" && dateKind !== "range" && dateKind !== "week" && (
              <label>
                규칙
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                >
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매달</option>
                  <option value="yearly">매년</option>
                  <option value="monthlyNth">매월 N번째 요일</option>
                </select>
              </label>
            )}
            {presetChoice === "custom" &&
              repeat === "monthlyNth" &&
              dateKind !== "range" && dateKind !== "week" && (
                <label>
                  몇째 주
                  <select
                    value={String(repeatNth)}
                    onChange={(e) => setRepeatNth(e.target.value)}
                  >
                    <option value="1">첫째</option>
                    <option value="2">둘째</option>
                    <option value="3">셋째</option>
                    <option value="4">넷째</option>
                    <option value="last">마지막</option>
                  </select>
                </label>
              )}
            {presetChoice === "custom" &&
              (repeat === "weekly" || repeat === "monthlyNth") &&
              dateKind !== "range" && dateKind !== "week" && (
                <label>
                  요일
                  <select
                    value={String(repeatWeekday)}
                    onChange={(e) => setRepeatWeekday(e.target.value)}
                  >
                    {WEEKDAY_LABEL.map((w, i) => (
                      <option key={i} value={String(i)}>
                        {w}요일
                      </option>
                    ))}
                  </select>
                </label>
              )}
            {presetChoice === "custom" &&
              repeat === "monthly" &&
              dateKind !== "range" && dateKind !== "week" && (
                <label>
                  며칠
                  <select
                    value={String(monthDay)}
                    onChange={(e) => setMonthDay(e.target.value)}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {i + 1}일
                      </option>
                    ))}
                  </select>
                </label>
              )}
          </div>
          {/* 기간의 예외 날짜 (F03 R9): 제외할 날 / 추가할 날 — 기간일 때만 */}
          {isRangeForm && (
            <ExceptionDates
              start={rangeFrom}
              end={rangeTo}
              skip={shownExc.skipDates ?? []}
              extra={shownExc.extraDates ?? []}
              onChange={({ skip, extra }) => {
                setSkipDates(skip);
                setExtraDates(extra);
              }}
            />
          )}
          <div className="edit-buttons">
            {/* 📢 일정으로 바꾸기 (F11 R9) — 날짜가 있을 때만. 왼쪽에 따로 떨어뜨려 둠 */}
            {onConvert &&
              dueDate &&
              (confirmConvert ? (
                <span className="danger-confirm convert-left">
                  반복은 일정에 없어서 사라져요. 바꿀까요?
                  <button type="button" onClick={() => handleConvert(true)}>
                    바꾸기
                  </button>
                  <button type="button" onClick={() => setConfirmConvert(false)}>
                    취소
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="convert-left"
                  onClick={() => handleConvert(false)}
                  title="체크 없는 일정으로 바꾸기 — 제목·메모·날짜는 그대로 옮겨져요"
                >
                  <Icon name="calendar" /> 일정으로 바꾸기
                </button>
              ))}
            <button type="submit">저장</button>
            <button type="button" onClick={handleCancel}>
              취소
            </button>
          </div>
        </form>
      </li>
    );
  }

  // ----- 보통 모드 화면 -----
  const today = todayStr();
  const isRange = task.dateKind === "range" && task.startDate;
  const span = spanOfTask(task); // 걸리는 날 계산용 (날짜 없으면 null)
  // 마지막으로 걸리는 날 — 기간이면 끝, 추가한 날이 더 뒤면 그 날 (F03 R9)
  const lastDay = span ? lastActiveDate(span) ?? span.end : null;
  // 날짜가 지났는지 (미완료 + 마지막 날이 오늘 이전)
  const late = !task.done && lastDay && lastDay < today;
  // 기간이 오늘을 지나는 중인지 (예: 11/11~11/23 사이의 오늘). 제외한 날에는 아님
  const ongoing = !task.done && isRange && isActiveOn(span, today);
  // 남은 날 (F03 R12): "D-3" · 오늘이면 "D-day" · 기간은 시작 전에 "시작 D-3".
  // 끝낸 것과 "이번 주" 할 일(요일을 안 정한 것)에는 없음
  const dday =
    !task.done && task.dateKind !== "week" ? ddayText(span, today) : "";

  // 날짜 뱃지 문구: 종류에 따라 다르게 (F03 R2b). 기간의 예외 날짜도 뒤에 (R9)
  function dateBadgeText() {
    if (isRange)
      return `${task.startDate} ~ ${task.dueDate}${exceptionText(task)}`;
    // 이번 주 중에 (F03 R10): 오늘이 그 주면 "이번 주", 아니면 그 주의 날짜만
    if (task.dateKind === "week" && task.startDate) {
      const thisWeek = task.startDate <= today && today <= task.dueDate;
      return thisWeek
        ? `이번 주 (${weekRangeText(task)})`
        : `${weekRangeText(task)} 주`;
    }
    const time = task.dueTime ? ` ${task.dueTime}` : ""; // 시간이 있으면 뒤에 (R15)
    if (task.dateKind === "day") return `${task.dueDate} 당일${time}`;
    return `~${task.dueDate}${time}`; // 마감 (예전 데이터도 마감으로 취급)
  }

  return (
    <li className={"task-item task-row" + (task.done ? " done" : "")}>
      <div className="task-content">
        <div className="task-main-row">
          <label className="task-main">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => onToggle(task)}
            />
            <span className="task-title">{task.title}</span>
          </label>
        </div>
        {task.memo && <p className="task-memo">{task.memo}</p>}

        {/* 날짜·카테고리 뱃지 (있는 것만 표시) */}
        {task.dueDate && (
          <div className="task-badges">
            {task.dueDate && (
              <span
                className={
                  "badge" +
                  (late ? " late" : "") +
                  // 오늘 걸린 것은 굵게: 진행 중인 기간, 오늘이 그날(D-day)
                  (ongoing || dday === "D-day" ? " ongoing" : "")
                }
              >
                <Icon name="calendar" /> {dateBadgeText()}
                {late && ` · ${daysLate(lastDay)}일 지남`}
                {ongoing && " · 진행중"}
                {dday && ` · ${dday}`}
                {/* 이번 주의 마지막 날(일요일) (F03 R10) */}
                {!task.done &&
                  task.dateKind === "week" &&
                  task.dueDate === today &&
                  " · 오늘까지"}
              </span>
            )}
            {/* 반복 주기 (F09 R5) */}
            {task.repeat && (
              <span className="badge"><Icon name="repeat" /> {repeatLabelOf(task)}</span>
            )}
          </div>
        )}

      </div>
      {/* 평소엔 수정/삭제 버튼, 삭제 누르면 그 자리에서 한 번 더 확인 (R7a) */}
      {confirmDelete ? (
        <div className="task-buttons confirm">
          <span className="confirm-text">삭제할까요?</span>
          <button
            className="delete"
            onClick={() => {
              onDelete(task);
              setConfirmDelete(false);
            }}
          >
            삭제
          </button>
          <button onClick={() => setConfirmDelete(false)}>취소</button>
        </div>
      ) : (
        <div className="task-buttons">
          {/* 달력에서 고른 날짜만 빼기 (F03 R9) — 기간 할 일이고, 뺄 수 있는 날일 때만 */}
          {dayContext && onSkipDay && isRange && canSkip(span, dayContext) && (
            <button
              onClick={() => onSkipDay(task, dayContext)}
              title="이 날짜만 빼기 — 기간의 다른 날은 그대로"
            >
              이 날 빼기
            </button>
          )}
          {/* 다음 주로 미루기 (F03 R11) — 끝내지 않은 "이번 주" 할 일에만 */}
          {onPostpone && !task.done && task.dateKind === "week" && task.startDate && (
            <button
              onClick={() => onPostpone(task)}
              title="다음 주에 할 일로 미루기 — 다음 주 월요일부터 다시 보여요"
            >
              다음 주로
            </button>
          )}
          <button className="icon-btn" onClick={startEditing} aria-label="수정" title="수정"><Icon name="edit" /></button>
          <button className="icon-btn delete" onClick={() => setConfirmDelete(true)} aria-label="삭제" title="삭제">
            <Icon name="trash" />
          </button>
        </div>
      )}
    </li>
  );
}
