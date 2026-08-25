// ------------------------------------------------------------
// 메모판 (F03 R2c·R2d): 날짜 미정 + 미완료 할 일을 스티커 메모처럼 보여줌
//  · 기본 스티커 "📌 메모" + 사용자가 만든 스티커들 (격자로 나란히)
//  · 체크 = 완료, 글자 클릭 = 그 자리에서 바로 수정
//  · 메모를 끌어서 다른 스티커에 놓으면 이동 (R2d, 2026-08-11)
//  · 스티커 제목 클릭 = 이름 바꾸기, ✕ = 삭제(메모는 기본으로 돌아감)
// 삭제·날짜 붙이기 같은 세부 작업은 "전체" 탭에서.
// ------------------------------------------------------------
import { useState } from "react";
import {
  updateTask,
  addBoard,
  renameBoard,
  deleteBoard,
  moveTaskToBoard,
} from "../db.js";

// 우선순위 정렬 순서: 높음 → 중간 → 낮음 → 미지정
const ORDER = { high: 0, med: 1, low: 2 };
const byPriority = (a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3);

// 드래그할 때 메모 id를 실어 나르는 이름표
const DRAG_TYPE = "text/task-id";

/** 등록 시각 → "M/D" 짧은 날짜 (좁은 칸에 맞게) */
function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StickyBoard({ tasks, boards, onToggle }) {
  const [newName, setNewName] = useState("");
  // 끌고 있는 메모를 지금 받을 스티커 이름 (강조용). "" = 기본 스티커, null = 없음
  const [dragOver, setDragOver] = useState(null);

  // 스티커 목록: 만든 순서대로
  const names = [...boards]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((b) => b.name);
  const known = new Set(names);
  // 기본 스티커: 소속 없는 메모 (혹시 없어진 스티커 이름이 남아 있어도 여기로)
  const defaultTasks = tasks
    .filter((t) => !t.board || !known.has(t.board))
    .sort(byPriority);
  const tasksOf = (name) => tasks.filter((t) => t.board === name).sort(byPriority);

  async function handleNewBoard(e) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    await addBoard(n);
    setNewName("");
  }

  // 드롭 = 메모를 그 스티커로 이동
  async function handleDrop(e, name) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (id) await moveTaskToBoard(id, name);
  }

  const dropProps = (name) => ({
    onDragOver: (e) => {
      e.preventDefault(); // 이걸 해야 드롭이 허용됨
      e.dataTransfer.dropEffect = "move";
      if (dragOver !== name) setDragOver(name);
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e) => handleDrop(e, name),
  });

  const solo = names.length === 0; // 스티커를 하나도 안 만들었으면 예전처럼 넓은 한 판

  return (
    <section className="sticky-area">
      <div className={"sticky-grid" + (solo ? " solo" : "")}>
        <Sticker
          title="📌 메모"
          tasks={defaultTasks}
          onToggle={onToggle}
          highlighted={dragOver === ""}
          emptyText={
            solo
              ? "메모가 없어요. 입력창에 날짜 없이 쓰고 Enter를 누르세요."
              : "비어 있음"
          }
          {...dropProps("")}
        />
        {names.map((n) => (
          <Sticker
            key={n}
            name={n}
            title={n}
            tasks={tasksOf(n)}
            onToggle={onToggle}
            highlighted={dragOver === n}
            emptyText="비어 있음 — 메모를 끌어다 놓으세요"
            {...dropProps(n)}
          />
        ))}
      </div>

      {/* 새 스티커 만들기 (R2d) — 이름 쓰고 Enter */}
      <form onSubmit={handleNewBoard}>
        <input
          className="sticky-new"
          type="text"
          placeholder="+ 새 스티커 이름 + Enter (예: 논문, 실험, 잡일)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </form>
      <p className="sticky-hint">
        체크하면 완료 · 글자를 누르면 바로 수정 · 메모를 끌어서 다른 스티커로 이동
      </p>
    </section>
  );
}

// 스티커 한 장: 제목(이름 바꾸기·삭제) + 메모 목록. 드롭을 받는 영역
function Sticker({
  name, // undefined면 기본 스티커 (이름 바꾸기·삭제 없음)
  title,
  tasks,
  onToggle,
  highlighted,
  emptyText,
  ...dropHandlers
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDefault = name === undefined;

  function saveName() {
    const v = draft.trim();
    if (v && v !== name) renameBoard(name, v);
    setRenaming(false);
  }

  return (
    <div
      className={"sticky-board" + (highlighted ? " drag-over" : "")}
      {...dropHandlers}
    >
      <div className="sticky-head">
        {renaming ? (
          <input
            className="sticky-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveName();
              }
              if (e.key === "Escape") {
                setDraft(title);
                setRenaming(false);
              }
            }}
            onBlur={saveName}
            autoFocus
          />
        ) : (
          <h2
            className={"sticky-title" + (isDefault ? "" : " editable")}
            onClick={
              isDefault
                ? undefined
                : () => {
                    setDraft(title);
                    setRenaming(true);
                  }
            }
            title={isDefault ? undefined : "클릭해서 이름 바꾸기"}
          >
            {title} <span className="group-count">{tasks.length}</span>
          </h2>
        )}
        {/* 스티커 삭제 (기본 스티커는 삭제 불가) — 한 번 더 확인 */}
        {!isDefault &&
          (confirmDelete ? (
            <span className="danger-confirm small">
              지울까요? (메모는 📌 메모로)
              <button className="delete" onClick={() => deleteBoard(name)}>
                삭제
              </button>
              <button onClick={() => setConfirmDelete(false)}>취소</button>
            </span>
          ) : (
            <button
              className="sticky-x"
              onClick={() => setConfirmDelete(true)}
              aria-label="스티커 삭제"
              title="스티커 삭제"
            >
              ✕
            </button>
          ))}
      </div>
      {tasks.length === 0 ? (
        <p className="sticky-empty">{emptyText}</p>
      ) : (
        <ul className="sticky-list">
          {tasks.map((t) => (
            <StickyItem key={t.id} task={t} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </div>
  );
}

// 메모 한 줄: 체크박스 + (점) + 글자(클릭하면 그 자리 수정) + 등록일. 끌 수 있음
function StickyItem({ task, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const [dragging, setDragging] = useState(false);

  function save() {
    const v = value.trim();
    if (v !== "" && v !== task.title) {
      updateTask(task.id, { title: v });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="sticky-item">
        <input
          className="sticky-edit"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setValue(task.title); // 고치던 내용 버리기
              setEditing(false);
            }
          }}
          onBlur={save}
          autoFocus
        />
      </li>
    );
  }

  return (
    <li
      className={"sticky-item" + (dragging ? " dragging" : "")}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task)}
      />
      {/* 우선순위가 있으면 색 점으로 표시 (R13과 동일한 색) */}
      {task.priority && (
        <span className={"pri-dot static pri-" + task.priority} />
      )}
      <span
        className={"sticky-text" + (task.priority === "high" ? " hi" : "")}
        onClick={() => {
          setValue(task.title);
          setEditing(true);
        }}
        title="클릭해서 수정"
      >
        {task.title}
      </span>
      {/* 언제 남긴 메모인지 (등록일) */}
      <span className="sticky-date">{shortDate(task.createdAt)}</span>
    </li>
  );
}
