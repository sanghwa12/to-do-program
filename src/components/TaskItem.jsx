// ------------------------------------------------------------
// 할 일 한 줄 (F02 + F03)
// 보통 모드: 체크박스 + 제목 + 날짜·우선순위·카테고리 뱃지 + 수정/삭제
// 편집 모드: 제목·메모에 더해 날짜·우선순위·카테고리를 "나중에" 붙일 수 있음 (F03 R1)
// ------------------------------------------------------------
import { useState } from "react";
import { toggleDone, updateTask } from "../db.js";
import { todayStr, daysLate } from "../date.js";
import { PRIORITY_LABEL } from "../labels.js";

export default function TaskItem({ task, categories, onDelete }) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [confirmDelete, setConfirmDelete] = useState(false); // 삭제 확인 중?
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [dateKind, setDateKind] = useState(task.dateKind || "due"); // 날짜의 의미
  const [startDate, setStartDate] = useState(task.startDate || ""); // 기간의 시작
  const [priority, setPriority] = useState(task.priority || "");
  const [category, setCategory] = useState(task.category || "");

  // 편집 내용 저장
  async function handleSave(e) {
    e.preventDefault();
    const newTitle = title.trim();
    if (newTitle === "") return; // 제목을 비워서 저장하는 건 막음
    // 날짜 종류 정리: 날짜가 없으면 종류도 없음. "기간"인데 시작일이 없으면 "마감"으로.
    const kind = !dueDate ? undefined : dateKind === "range" && !startDate ? "due" : dateKind;
    // 기간의 시작일이 끝일보다 늦으면 앞뒤를 자동으로 바꿔줌
    // (역전된 기간은 달력 등에서 안 보이게 되므로 저장 시점에 바로잡음)
    let saveStart = kind === "range" ? startDate : undefined;
    let saveDue = dueDate || undefined;
    if (kind === "range" && saveStart > saveDue) {
      [saveStart, saveDue] = [saveDue, saveStart];
    }
    await updateTask(task.id, {
      title: newTitle,
      memo: memo.trim() || undefined,       // 비워두면 필드 자체를 없앰
      dueDate: saveDue,
      dateKind: kind,
      startDate: saveStart,
      priority: priority || undefined,
      category: category.trim() || undefined,
    });
    setEditing(false);
  }

  // 편집 취소 — 고치던 내용은 버리고 원래대로
  function handleCancel() {
    setTitle(task.title);
    setMemo(task.memo || "");
    setDueDate(task.dueDate || "");
    setDateKind(task.dateKind || "due");
    setStartDate(task.startDate || "");
    setPriority(task.priority || "");
    setCategory(task.category || "");
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

  return (
    <li className={"task-item" + (task.done ? " done" : "")}>
      <label className="task-main">
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => toggleDone(task)}
        />
        <span className="task-title">{task.title}</span>
      </label>
      {task.memo && <p className="task-memo">{task.memo}</p>}

      {/* 날짜·우선순위·카테고리 뱃지 (있는 것만 표시) */}
      {(task.dueDate || task.priority || task.category) && (
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
          {task.priority && (
            <span className={"badge pri-" + task.priority}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
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
          <button onClick={() => setEditing(true)}>수정</button>
          <button className="delete" onClick={() => setConfirmDelete(true)}>
            삭제
          </button>
        </div>
      )}
    </li>
  );
}
