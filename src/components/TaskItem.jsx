// ------------------------------------------------------------
// 할 일 한 줄 (F02 + F03)
// 보통 모드: 체크박스 + 제목 + 날짜·우선순위·카테고리 뱃지 + 수정/삭제
// 편집 모드: 제목·메모에 더해 날짜·우선순위·카테고리를 "나중에" 붙일 수 있음 (F03 R1)
// ------------------------------------------------------------
import { useState, useRef } from "react";
import { db, updateTask } from "../db.js";
import { todayStr, daysLate, nextNthWeekday } from "../date.js";
import { PRIORITY_LABEL, repeatLabelOf } from "../labels.js";

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
  const [repeat, setRepeat] = useState(task.repeat || ""); // 반복 주기 (F09)
  const [repeatNth, setRepeatNth] = useState(task.repeatNth ?? 1); // 매월 N번째 (R8)
  const [repeatWeekday, setRepeatWeekday] = useState(task.repeatWeekday ?? 1); // 그 요일
  const [priority, setPriority] = useState(task.priority || "");
  const [category, setCategory] = useState(task.category || "");

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
    // 반복 정리 (F09 R1·R6·R8)
    let saveRepeat;
    let saveNth;
    let saveWeekday;
    if (repeat === "monthlyNth" && kind !== "range") {
      // 매월 N번째 요일: 날짜는 규칙으로 자동 계산 (다가오는 해당 날짜)
      saveRepeat = "monthlyNth";
      saveNth = repeatNth === "last" ? "last" : Number(repeatNth);
      saveWeekday = Number(repeatWeekday);
      saveDue = nextNthWeekday(saveNth, saveWeekday, todayStr());
      kind = "day";
      saveStart = undefined;
    } else if (saveDue && kind !== "range" && repeat) {
      saveRepeat = repeat;
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
    setRepeatNth(task.repeatNth ?? 1);
    setRepeatWeekday(task.repeatWeekday ?? 1);
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
            {/* 반복 주기 (F09) — 기간이 아닐 때. "매월 N번째 요일"은 날짜 없이도 선택 가능(자동 계산) */}
            {!(dueDate && dateKind === "range") && (
              <label>
                반복
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                >
                  <option value="">없음</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매달</option>
                  <option value="yearly">매년</option>
                  <option value="monthlyNth">매월 N번째 요일</option>
                </select>
              </label>
            )}
            {/* 매월 N번째 요일 상세 (R8) — 날짜는 규칙으로 자동 계산됨 */}
            {repeat === "monthlyNth" && dateKind !== "range" && (
              <>
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
                <label>
                  요일
                  <select
                    value={String(repeatWeekday)}
                    onChange={(e) => setRepeatWeekday(e.target.value)}
                  >
                    <option value="0">일요일</option>
                    <option value="1">월요일</option>
                    <option value="2">화요일</option>
                    <option value="3">수요일</option>
                    <option value="4">목요일</option>
                    <option value="5">금요일</option>
                    <option value="6">토요일</option>
                  </select>
                </label>
              </>
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
  const clickQueue = useRef(Promise.resolve());
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
