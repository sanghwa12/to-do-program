// ------------------------------------------------------------
// 할 일 한 줄 (F02 + F03)
// 보통 모드: 체크박스 + 제목 + 날짜·우선순위·카테고리 뱃지 + 수정/삭제
// 편집 모드: 제목·메모에 더해 날짜·우선순위·카테고리를 "나중에" 붙일 수 있음 (F03 R1)
// ------------------------------------------------------------
import { useState } from "react";
import { toggleDone, updateTask, deleteTask } from "../db.js";
import { todayStr, daysLate } from "../date.js";
import { PRIORITY_LABEL } from "../labels.js";

export default function TaskItem({ task, categories }) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo || "");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [priority, setPriority] = useState(task.priority || "");
  const [category, setCategory] = useState(task.category || "");

  // 편집 내용 저장
  async function handleSave(e) {
    e.preventDefault();
    const newTitle = title.trim();
    if (newTitle === "") return; // 제목을 비워서 저장하는 건 막음
    await updateTask(task.id, {
      title: newTitle,
      memo: memo.trim() || undefined,       // 비워두면 필드 자체를 없앰
      dueDate: dueDate || undefined,
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
  // 마감이 지났는지 (미완료 + 마감일이 오늘 이전)
  const late = !task.done && task.dueDate && task.dueDate < todayStr();

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
            <span className={"badge" + (late ? " late" : "")}>
              📅 {task.dueDate}
              {late && ` · ${daysLate(task.dueDate)}일 지남`}
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

      <div className="task-buttons">
        <button onClick={() => setEditing(true)}>수정</button>
        <button className="delete" onClick={() => deleteTask(task.id)}>
          삭제
        </button>
      </div>
    </li>
  );
}
