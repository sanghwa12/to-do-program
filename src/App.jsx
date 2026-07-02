// ============================================================
// F02 · 빠른 입력 + 기본 목록 (쏟아붓기)
// ------------------------------------------------------------
// 이 앱의 존재 이유: 한 줄 치고 Enter → 끝. 다시 일하러 가기.
// ============================================================
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addTask, toggleDone, updateTask, deleteTask } from "./db.js";

export default function App() {
  // DB의 할 일 목록을 "실시간 구독" — DB가 바뀌면 화면도 자동으로 바뀝니다.
  // 최신 것이 위로 오도록 만든 시각(createdAt) 역순 정렬.
  const tasks = useLiveQuery(() =>
    db.tasks.orderBy("createdAt").reverse().toArray()
  );

  return (
    <div className="app">
      <h1>할 일</h1>

      {/* 쏟아붓기 입력창 */}
      <QuickInput />

      {/* 할 일 목록 */}
      {tasks === undefined ? (
        <p className="hint">불러오는 중...</p>
      ) : tasks.length === 0 ? (
        <p className="hint">
          할 일이 없어요. 위에 입력하고 Enter를 누르세요!
        </p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 쏟아붓기 입력창: 제목 쓰고 Enter만 누르면 추가.
// 추가 후 입력창은 비워지고 커서는 그대로 → 연속 입력 가능.
// ------------------------------------------------------------
function QuickInput() {
  const [text, setText] = useState("");

  // 폼 제출 = Enter를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault(); // 페이지 새로고침(폼 기본 동작) 막기
    const title = text.trim();
    if (title === "") return; // 빈 제목은 추가하지 않음
    await addTask(title);
    setText(""); // 입력창 비우기 (커서는 입력창에 그대로 남음)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="quick-input"
        type="text"
        placeholder="할 일을 쓰고 Enter (예: 보고서 초안 쓰기)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
    </form>
  );
}

// ------------------------------------------------------------
// 할 일 한 줄: 체크박스(완료) + 제목 + 수정/삭제 버튼.
// "수정"을 누르면 제목·메모를 고치는 편집 모드로 바뀝니다.
// ------------------------------------------------------------
function TaskItem({ task }) {
  const [editing, setEditing] = useState(false); // 편집 모드 여부
  const [title, setTitle] = useState(task.title);
  const [memo, setMemo] = useState(task.memo || "");

  // 편집 내용 저장
  async function handleSave(e) {
    e.preventDefault();
    const newTitle = title.trim();
    if (newTitle === "") return; // 제목을 비워서 저장하는 건 막음
    await updateTask(task.id, { title: newTitle, memo: memo.trim() });
    setEditing(false);
  }

  // 편집 취소 — 고치던 내용은 버리고 원래대로
  function handleCancel() {
    setTitle(task.title);
    setMemo(task.memo || "");
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
      <div className="task-buttons">
        <button onClick={() => setEditing(true)}>수정</button>
        <button className="delete" onClick={() => deleteTask(task.id)}>
          삭제
        </button>
      </div>
    </li>
  );
}
