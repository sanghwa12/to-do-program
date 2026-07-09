// ------------------------------------------------------------
// 할 일 한 줄 (F02 + F03)
// 보통 모드: 체크박스 + 제목 + 날짜·우선순위·카테고리 뱃지 + 수정/삭제
// 편집 모드: 제목·메모에 더해 날짜·우선순위·카테고리를 "나중에" 붙일 수 있음 (F03 R1)
// ------------------------------------------------------------
import { useState, useRef } from "react";
import { db, updateTask } from "../db.js";
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
} from "../date.js";
import {
  PRIORITY_LABEL,
  WEEKDAY_LABEL,
  NTH_LABEL,
  repeatLabelOf,
} from "../labels.js";

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

// 우선순위 점 클릭 시 순환 순서: 없음 → 높음 → 중간 → 낮음 → 없음
// (첫 클릭이 "높음"인 이유: 점을 누르는 상황 대부분이 "이거 중요해!" 표시라서)
const NEXT_PRIORITY = { high: "med", med: "low", low: undefined };

export default function TaskItem({ task, categories, onToggle, onDelete }) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [confirmDelete, setConfirmDelete] = useState(false); // 삭제 확인 중?
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
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
  const [priority, setPriority] = useState(task.priority || "");
  const [category, setCategory] = useState(task.category || "");
  // 우선순위 점 클릭 줄세우기용 (R13).
  // ⚠️ 훅은 항상 같은 순서로 전부 호출돼야 하므로 반드시 여기(early return 위)에 —
  //    편집 모드의 return보다 아래에 두면 수정 버튼 클릭 시 앱 전체가 하얗게 죽는다 (실제 사고)
  const clickQueue = useRef(Promise.resolve());

  // 편집 내용 저장
  async function handleSave(e) {
    e.preventDefault();
    const newTitle = title.trim();
    if (newTitle === "") return; // 제목을 비워서 저장하는 건 막음
    // 날짜 종류 정리: 날짜가 없으면 종류도 없음. "기간"인데 시작일이 없으면 "마감"으로.
    let kind = !dueDate ? undefined : dateKind === "range" && !startDate ? "due" : dateKind;
    // 기간의 시작일이 끝일보다 늦으면 앞뒤를 자동으로 바꿔줌
    // (역전된 기간은 달력 등에서 안 보이게 되므로 저장 시점에 바로잡음)
    let saveStart = kind === "range" ? startDate : undefined;
    let saveDue = dueDate || undefined;
    if (kind === "range" && saveStart > saveDue) {
      [saveStart, saveDue] = [saveDue, saveStart];
    }
    // 반복 정리 (F09 R1·R6·R8·R9·R10)
    let saveRepeat;
    let saveNth;
    let saveWeekday;
    if (kind !== "range") {
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
    await updateTask(task.id, {
      title: newTitle,
      memo: memo.trim() || undefined,       // 비워두면 필드 자체를 없앰
      dueDate: saveDue,
      dateKind: kind,
      startDate: saveStart,
      repeat: saveRepeat,
      repeatNth: saveNth,
      repeatWeekday: saveWeekday,
      priority: priority || undefined,
      category: category.trim() || undefined,
    });
    setEditing(false);
  }

  // 폼 내용을 지금 저장돼 있는 값으로 다시 채움
  function syncFormFromTask() {
    setTitle(task.title);
    setMemo(task.memo || "");
    setDueDate(task.dueDate || "");
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
    setPriority(task.priority || "");
    setCategory(task.category || "");
  }

  // 편집 시작 — 반드시 최신 값으로 폼을 채우고 시작
  // (점 클릭처럼 폼 밖에서 바뀐 값이, 저장할 때 옛 값으로 되돌아가지 않게)
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
          {/* F03: 날짜·우선순위·카테고리 — 전부 선택 사항 */}
          <div className="edit-extras">
            <label>
              날짜
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
                </select>
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
            {/* 반복 프리셋 (R10): 날짜에서 계산된 구체적 선택지를 한 번에 고름 */}
            {!(dueDate && dateKind === "range") && (
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
            {presetChoice === "custom" && dateKind !== "range" && (
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
              dateKind !== "range" && (
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
              dateKind !== "range" && (
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
              dateKind !== "range" && (
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
            <label>
              우선순위
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">없음</option>
                <option value="high">높음</option>
                <option value="med">중간</option>
                <option value="low">낮음</option>
              </select>
            </label>
            <label>
              카테고리
              <input
                type="text"
                placeholder="예: 업무"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-suggestions"
              />
              {/* 이미 써 본 카테고리를 자동완성 후보로 보여줌 */}
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="edit-buttons">
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
  // 날짜가 지났는지 (미완료 + 날짜(기간이면 끝)가 오늘 이전)
  const late = !task.done && task.dueDate && task.dueDate < today;
  // 기간 한가운데인지 (예: 11/11~11/23 사이의 오늘)
  const ongoing =
    !task.done &&
    task.dateKind === "range" &&
    task.startDate &&
    task.startDate <= today &&
    today <= task.dueDate;

  // 날짜 뱃지 문구: 종류에 따라 다르게 (F03 R2b)
  function dateBadgeText() {
    if (task.dateKind === "range" && task.startDate)
      return `📅 ${task.startDate} ~ ${task.dueDate}`;
    if (task.dateKind === "day") return `📅 ${task.dueDate} 당일`;
    return `📅 ~${task.dueDate}`; // 마감 (예전 데이터도 마감으로 취급)
  }

  // 우선순위 점 클릭 → 다음 단계로 순환 (R13)
  // 연타해도 한 클릭 = 한 단계가 되도록, 클릭들을 줄 세워 차례로 처리하고
  // 매번 저장소의 최신 값을 읽어 다음 단계를 계산함
  function cyclePriority() {
    clickQueue.current = clickQueue.current.then(async () => {
      const current = (await db.tasks.get(task.id))?.priority;
      const next = current ? NEXT_PRIORITY[current] : "high";
      await updateTask(task.id, { priority: next });
    });
  }

  return (
    <li className={"task-item" + (task.done ? " done" : "")}>
      <div className="task-main-row">
        {/* 우선순위 점: ●높음/●중간/●낮음/○없음 — 클릭하면 변경 */}
        <button
          className={"pri-dot pri-" + (task.priority || "none")}
          onClick={cyclePriority}
          title={
            "우선순위: " +
            (task.priority ? PRIORITY_LABEL[task.priority] : "없음") +
            " (클릭해서 변경)"
          }
          aria-label="우선순위 변경"
        />
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
      {(task.dueDate || task.category) && (
        <div className="task-badges">
          {task.dueDate && (
            <span
              className={
                "badge" + (late ? " late" : "") + (ongoing ? " ongoing" : "")
              }
            >
              {dateBadgeText()}
              {late && ` · ${daysLate(task.dueDate)}일 지남`}
              {ongoing && " · 진행중"}
            </span>
          )}
          {/* 반복 주기 (F09 R5) */}
          {task.repeat && (
            <span className="badge">🔁 {repeatLabelOf(task)}</span>
          )}
          {/* 우선순위는 제목 앞 점(●)으로 표시 — 글자 뱃지는 제거 (R13, D00) */}
          {task.category && <span className="badge cat">#{task.category}</span>}
        </div>
      )}

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
          <button onClick={startEditing}>수정</button>
          <button className="delete" onClick={() => setConfirmDelete(true)}>
            삭제
          </button>
        </div>
      )}
    </li>
  );
}
