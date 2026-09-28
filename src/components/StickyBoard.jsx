// ------------------------------------------------------------
// 메모판 (F03 R2c·R2d·R2e): 날짜 미정 + 미완료 할 일을 스티커 메모처럼
//  · 기본 스티커 "📌 메모" + 사용자가 만든 스티커들
//  · 세로 열 3개 — 스티커의 ⠿ 손잡이를 끌어 원하는 열·순서에 배치 (R2e)
//    (다른 스티커 위에 놓으면 그 아래로, 열의 빈 곳에 놓으면 그 열 맨 아래로)
//  · 체크 = 완료, 글자 클릭 = 그 자리에서 바로 수정 (제목 + 세부 내용 칸이 함께 열림)
//  · 메모를 끌어서 다른 메모 위·아래에 놓으면 순서 바꾸기 (R2f),
//    다른 스티커에 놓으면 그리로 이동 (R2d) — 놓일 자리는 갈색 줄로 미리 보임
//  · 스티커 제목 클릭 = 이름 바꾸기, ✕ = 삭제(메모는 기본으로 돌아감)
//  · 메모 줄의 ✕ = 휴지통으로 (한 번 더 확인 — R7a. 실행취소 가능)
// 날짜 붙이기 같은 세부 작업은 "전체" 탭에서.
// ------------------------------------------------------------
import { useState } from "react";
import {
  updateTask,
  addBoard,
  renameBoard,
  deleteBoard,
  saveMemoOrder,
  saveBoardLayout,
} from "../db.js";
import { byMemoOrder, placeMemo } from "../sort.js";

// 드래그할 때 실어 나르는 이름표 (종류 구분용)
const DRAG_TYPE = "text/task-id"; // 메모 한 줄
const BOARD_TYPE = "text/board-name"; // 스티커 자체 (R2e)

const NCOLS = 3; // 스티커 열 개수 (R2e)

// 지금 끌고 있는 스티커 이름 ("" = 기본 스티커, null = 스티커 안 끄는 중)
// — dragover 중엔 dataTransfer 내용을 읽을 수 없어서 모듈 변수로 기억
let draggingBoardName = null;
// 지금 끌고 있는 메모의 id (null = 메모 안 끄는 중) — 같은 이유로 모듈 변수 (R2f)
let draggingTaskId = null;

function isBoardDrag(e) {
  return e.dataTransfer.types.includes(BOARD_TYPE);
}

// ------------------------------------------------------------
// 메모를 놓을 자리 찾기 (R2f): 마우스에서 가장 가까운 메모 줄을 찾아
// 그 줄의 위쪽 절반이면 "앞", 아래쪽 절반이면 "뒤".
//  · 줄 위가 아니라 제목·여백에 있어도 가장 가까운 줄 기준 (제목 위 = 첫 줄 앞)
//  · 메모가 없는 스티커면 null (그냥 그 스티커로 이동)
// boardEl = 스티커 한 장의 요소, x·y = 마우스 위치
// ------------------------------------------------------------
function dropSpot(boardEl, x, y) {
  let best = null;
  for (const li of boardEl.querySelectorAll(".sticky-item[data-id]")) {
    const r = li.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right); // 줄 밖으로 벗어난 거리 (안이면 0)
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const dist = dx * dx + dy * dy;
    if (best === null || dist < best.dist) {
      best = { id: li.dataset.id, before: y < r.top + r.height / 2, dist };
    }
  }
  return best && { id: best.id, before: best.before };
}

// ------------------------------------------------------------
// 드래그 중 자동 스크롤 (R2d): 마우스가 화면 위/아래 가장자리에 있으면
// 화면이 스스로 스크롤 — 화면 밖 스티커로도 끌고 갈 수 있게.
//  · 드래그 이벤트는 멈춰 있으면 ~0.35초에 한 번만 와서 뚝뚝 끊김 →
//    이벤트에선 마우스 위치만 기억하고, 실제 스크롤은 매 화면 프레임마다 (부드럽게)
//  · 가장자리 근처 메모를 잡자마자 화면이 밀리지 않게, 마우스가 가장자리
//    "밖"을 한 번 지나간 뒤부터 작동 (armed)
// ------------------------------------------------------------
const EDGE = 90; // 가장자리로 인정하는 높이(px)
const SPEED = 12; // 프레임당 스크롤(px) — 초당 약 700px

const autoScroll = { y: null, armed: false, raf: null };

function rememberDragY(e) {
  autoScroll.y = e.clientY;
}

function scrollFrame() {
  const y = autoScroll.y;
  if (y !== null) {
    const inBottom = y > window.innerHeight - EDGE;
    const inTop = y < EDGE;
    if (!inBottom && !inTop) autoScroll.armed = true; // 가장자리 밖에 나갔다 옴
    else if (autoScroll.armed) window.scrollBy(0, inBottom ? SPEED : -SPEED);
  }
  autoScroll.raf = requestAnimationFrame(scrollFrame);
}

function startAutoScroll() {
  autoScroll.y = null;
  autoScroll.armed = false;
  document.addEventListener("dragover", rememberDragY);
  if (autoScroll.raf === null) autoScroll.raf = requestAnimationFrame(scrollFrame);
}

function stopAutoScroll() {
  document.removeEventListener("dragover", rememberDragY);
  if (autoScroll.raf !== null) cancelAnimationFrame(autoScroll.raf);
  autoScroll.raf = null;
}

// ------------------------------------------------------------
// 스티커 배치 계산 (R2e): boards 행들 → 열 3개짜리 이름 배열
//  · 자리(col·ord)가 저장된 스티커는 그 자리에
//  · 아직 안 옮긴 스티커는 만든 순서대로 왼쪽 열부터 한 장씩
//  · "" = 기본 📌 메모 스티커 (자리 저장용 예약 이름)
// ------------------------------------------------------------
function computeColumns(rows) {
  const rowOf = new Map(rows.map((r) => [r.name, r]));
  const userNames = rows
    .filter((r) => r.name !== "")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => r.name);
  const items = ["", ...userNames];
  const hasPos = (n) => {
    const r = rowOf.get(n);
    return r && r.col !== undefined && r.ord !== undefined;
  };
  const cols = Array.from({ length: NCOLS }, () => []);
  // 저장된 자리부터 (열 안 순서대로)
  items
    .filter(hasPos)
    .sort((a, b) => rowOf.get(a).ord - rowOf.get(b).ord)
    .forEach((n) => cols[Math.min(rowOf.get(n).col, NCOLS - 1)].push(n));
  // 자리 정보가 없는 것 (아직 안 옮김·새 스티커)
  items.forEach((n, i) => {
    if (!hasPos(n)) cols[i % NCOLS].push(n);
  });
  return cols;
}

export default function StickyBoard({ tasks, boards, onToggle, onDelete }) {
  const [newName, setNewName] = useState("");
  // 끌고 있는 메모를 지금 받을 스티커 이름 (강조용). "" = 기본 스티커, null = 없음
  const [dragOver, setDragOver] = useState(null);
  // 스티커 자체를 끄는 중인지 (열 테두리 안내용, R2e)
  const [movingBoard, setMovingBoard] = useState(false);
  // 끌고 있는 메모가 놓일 자리: { id: 기준 메모, before: 그 앞이면 true } (갈색 줄 표시용, R2f)
  const [dropAt, setDropAt] = useState(null);

  const userNames = boards
    .filter((b) => b.name !== "") // ""는 기본 스티커의 자리 기록용
    .map((b) => b.name);
  const known = new Set(userNames);
  // 스티커별 메모 — "" = 기본 스티커: 소속 없는 메모 (없어진 스티커 이름이 남아 있어도 여기로).
  // 순서: 새 메모는 맨 위(최신순), 손으로 옮긴 뒤엔 그 순서 (R2f)
  const tasksOf = (name) =>
    tasks
      .filter((t) =>
        name === "" ? !t.board || !known.has(t.board) : t.board === name
      )
      .sort(byMemoOrder);

  async function handleNewBoard(e) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    await addBoard(n);
    setNewName("");
  }

  // 메모 드롭 = 놓은 자리로 (순서 바꾸기·스티커 이동) / 스티커 드롭 = 그 스티커 바로 아래로 (R2e)
  async function handleDrop(e, name) {
    e.preventDefault();
    stopAutoScroll(); // 드롭 후 원래 줄이 사라져 dragend가 안 올 수 있으니 여기서도 확실히 끔
    setDragOver(null);
    setDropAt(null);
    if (isBoardDrag(e)) {
      const dragged = draggingBoardName;
      draggingBoardName = null;
      setMovingBoard(false);
      if (dragged === null || dragged === name) return; // 자기 자신 위엔 무시
      const cols = computeColumns(boards).map((col) =>
        col.filter((n) => n !== dragged)
      );
      const ci = cols.findIndex((col) => col.includes(name));
      cols[ci].splice(cols[ci].indexOf(name) + 1, 0, dragged); // 받은 스티커 바로 아래
      await saveBoardLayout(cols);
      return;
    }
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    // 놓은 자리에 끼워 넣은 새 순서 (R2f). 제자리에 놓았으면 저장하지 않음
    const spot = dropSpot(e.currentTarget, e.clientX, e.clientY);
    const ids = tasksOf(name).map((t) => t.id);
    const next = placeMemo(ids, id, spot?.id, spot?.before);
    if (next.join() === ids.join()) return;
    await saveMemoOrder(next, id, name);
  }

  // 열의 빈 곳에 스티커 드롭 = 그 열 맨 아래로 (R2e)
  async function handleColumnDrop(e, colIdx) {
    if (!isBoardDrag(e)) return; // 메모는 스티커 위에만 놓을 수 있음
    e.preventDefault();
    stopAutoScroll();
    const dragged = draggingBoardName;
    draggingBoardName = null;
    setMovingBoard(false);
    if (dragged === null) return;
    const cols = computeColumns(boards).map((col) =>
      col.filter((n) => n !== dragged)
    );
    cols[colIdx].push(dragged);
    await saveBoardLayout(cols);
  }

  const dropProps = (name) => ({
    onDragOver: (e) => {
      e.preventDefault(); // 이걸 해야 드롭이 허용됨
      e.dataTransfer.dropEffect = "move";
      if (dragOver !== name) setDragOver(name);
      if (isBoardDrag(e)) return;
      // 메모를 끄는 중: 놓일 자리를 줄로 미리 보여줌 (R2f). 끌고 있는 줄 자신 위에선 표시 없음
      let spot = dropSpot(e.currentTarget, e.clientX, e.clientY);
      if (spot && spot.id === draggingTaskId) spot = null;
      if (spot?.id !== dropAt?.id || spot?.before !== dropAt?.before) {
        setDropAt(spot); // 바뀔 때만 (이 이벤트는 아주 자주 옴)
      }
    },
    onDragLeave: (e) => {
      // 스티커 안에서 줄 사이를 오갈 때도 오는 이벤트 — 스티커를 완전히 벗어났을 때만 지움
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setDragOver(null);
      setDropAt(null);
    },
    onDrop: (e) => {
      e.stopPropagation(); // 열의 드롭 처리와 겹치지 않게
      handleDrop(e, name);
    },
  });

  // 스티커 ⠿ 손잡이 끌기 (R2e)
  const handleProps = (name) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(BOARD_TYPE, name);
      e.dataTransfer.effectAllowed = "move";
      draggingBoardName = name;
      setMovingBoard(true);
      startAutoScroll();
    },
    onDragEnd: () => {
      draggingBoardName = null;
      setMovingBoard(false);
      stopAutoScroll();
    },
  });

  const solo = userNames.length === 0; // 스티커를 안 만들었으면 예전처럼 넓은 한 판

  const stickerOf = (n) =>
    n === "" ? (
      <Sticker
        key="__default__"
        name=""
        title="📌 메모"
        tasks={tasksOf("")}
        onToggle={onToggle}
        onDelete={onDelete}
        highlighted={dragOver === ""}
        dropAt={dropAt}
        solo={solo}
        handleProps={handleProps}
        emptyText={
          solo
            ? "메모가 없어요. 입력창에 날짜 없이 쓰고 Enter를 누르세요."
            : "비어 있음"
        }
        {...dropProps("")}
      />
    ) : (
      <Sticker
        key={n}
        name={n}
        title={n}
        tasks={tasksOf(n)}
        onToggle={onToggle}
        onDelete={onDelete}
        highlighted={dragOver === n}
        dropAt={dropAt}
        solo={solo}
        handleProps={handleProps}
        emptyText="비어 있음 — 메모를 끌어다 놓으세요"
        {...dropProps(n)}
      />
    );

  return (
    // 끌기가 어디서 끝나든(놓기·Esc 취소) 강조와 자리 표시를 지움 — 끝났다는 신호는 여기까지 올라옴
    <section
      className="sticky-area"
      onDragEnd={() => {
        setDragOver(null);
        setDropAt(null);
      }}
    >
      {solo ? (
        // 스티커가 없으면: 넓은 한 판 (여러 단, R2d)
        <div className="sticky-grid solo">{stickerOf("")}</div>
      ) : (
        // 스티커가 있으면: 세로 열 3개, 배치는 사용자가 ⠿로 (R2e)
        <div className="board-cols">
          {computeColumns(boards).map((col, ci) => (
            <div
              key={ci}
              className={"board-col" + (movingBoard ? " ready" : "")}
              onDragOver={(e) => {
                if (isBoardDrag(e)) e.preventDefault(); // 열 배경엔 스티커만
              }}
              onDrop={(e) => handleColumnDrop(e, ci)}
            >
              {col.map(stickerOf)}
            </div>
          ))}
        </div>
      )}

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
        체크하면 완료 · 글자를 누르면 제목·세부 내용 수정 · 메모를 끌어서 순서
        바꾸기·다른 스티커로 · 스티커는 ⠿를 끌어서 배치
      </p>
    </section>
  );
}

// 스티커 한 장: ⠿ 손잡이 + 제목(이름 바꾸기·삭제) + 메모 목록. 드롭을 받는 영역
function Sticker({
  name, // "" = 기본 스티커 (이름 바꾸기·삭제 없음)
  title,
  tasks,
  onToggle,
  onDelete,
  highlighted,
  dropAt, // 끌고 있는 메모가 놓일 자리 { id, before } (R2f)
  solo,
  handleProps,
  emptyText,
  ...dropHandlers
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDefault = name === "";

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
        {/* ⠿ 손잡이: 끌어서 스티커 위치 옮기기 (R2e). 한 판일 땐 옮길 곳이 없어 숨김 */}
        {!solo && (
          <span
            className="sticky-handle"
            title="끌어서 스티커 위치 옮기기"
            {...handleProps(name)}
          >
            ⠿
          </span>
        )}
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
            <StickyItem
              key={t.id}
              task={t}
              onToggle={onToggle}
              onDelete={onDelete}
              // 이 줄 앞/뒤가 놓일 자리면 "before"/"after" (갈색 줄)
              dropMark={
                dropAt?.id === t.id ? (dropAt.before ? "before" : "after") : ""
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// 메모 한 줄: 체크박스 + 글자(클릭하면 그 자리 수정) + ✕(휴지통). 끌 수 있음
// 글자를 클릭하면 제목 칸 아래에 세부 내용 칸(task.memo)이 함께 열림 (2026-09-16)
// data-id는 끌어다 놓을 때 "어느 줄 근처인지" 찾는 표식 (dropSpot, R2f)
function StickyItem({ task, onToggle, onDelete, dropMark }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const [memoText, setMemoText] = useState(task.memo || ""); // 세부 내용
  const [dragging, setDragging] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false); // 삭제 한 번 더 확인 (R7a)

  function save() {
    const v = value.trim();
    const m = memoText.trim();
    const changes = {};
    if (v !== "" && v !== task.title) changes.title = v;
    if (m !== (task.memo || "")) changes.memo = m || undefined; // 비우면 필드 자체를 없앰
    if (Object.keys(changes).length > 0) updateTask(task.id, changes);
    setEditing(false);
  }

  function cancel() {
    setValue(task.title); // 고치던 내용 버리기
    setMemoText(task.memo || "");
    setEditing(false);
  }

  if (editing) {
    return (
      // 제목 칸 ↔ 세부 내용 칸 사이를 오갈 땐 안 닫히고, 둘 밖을 클릭하면 저장하고 닫힘
      <li
        className={"sticky-item editing" + (dropMark ? " drop-" + dropMark : "")}
        data-id={task.id}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) save();
        }}
      >
        <input
          className="sticky-edit"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") cancel();
          }}
          autoFocus
        />
        <textarea
          className="sticky-edit sticky-edit-memo"
          placeholder="세부 내용 (선택)"
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          rows={3}
        />
      </li>
    );
  }

  return (
    <li
      className={
        "sticky-item" +
        (dragging ? " dragging" : "") +
        (dropMark ? " drop-" + dropMark : "")
      }
      data-id={task.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = "move";
        draggingTaskId = task.id;
        setDragging(true);
        startAutoScroll();
      }}
      onDragEnd={() => {
        draggingTaskId = null;
        setDragging(false);
        stopAutoScroll();
      }}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task)}
      />
      <span
        className="sticky-text"
        onClick={() => {
          setValue(task.title);
          setMemoText(task.memo || "");
          setEditing(true);
        }}
        title="클릭해서 수정"
      >
        {task.title}
        {/* 세부 내용이 있으면 옅은 ⋯ — 마우스 올리면 내용 미리보기 */}
        {task.memo && (
          <span className="sticky-more" title={task.memo}>
            ⋯
          </span>
        )}
      </span>
      {/* 삭제 (2026-08-11 추가): 휴지통으로 — 한 번 더 확인, 실행취소 가능 */}
      {confirmDel ? (
        <span className="danger-confirm small">
          <button className="delete" onClick={() => onDelete(task)}>
            삭제
          </button>
          <button onClick={() => setConfirmDel(false)}>취소</button>
        </span>
      ) : (
        <button
          className="sticky-del"
          onClick={() => setConfirmDel(true)}
          aria-label="메모 삭제"
          title="휴지통으로"
        >
          ✕
        </button>
      )}
    </li>
  );
}
