// ============================================================
// 앱 메인 화면
// - 쏟아붓기 입력창 (F02)
// - 정리 뷰 탭 (F03): 오늘 / 전체 / 날짜 / 우선순위 / 카테고리
//   "계획을 세우는 건 앱, 사용자는 붓기만 한다"
// ============================================================
import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  toggleDone,
  uncheckTasks,
  trashTasks,
  restoreTasks,
  permanentDeleteTasks,
  emptyTrash,
  deleteMemo,
  restoreMemos,
  completeRepeatingTask,
  undoCompleteRepeating,
} from "./db.js";
import QuickInput from "./components/QuickInput.jsx";
import ImportBox from "./components/ImportBox.jsx";
import TaskItem from "./components/TaskItem.jsx";
import CalendarView from "./components/CalendarView.jsx";
import StickyBoard from "./components/StickyBoard.jsx";
import DayView from "./components/DayView.jsx";
import HelpView from "./components/HelpView.jsx";
import MemoView from "./components/MemoView.jsx";
import { todayStr } from "./date.js";
import { tasksOnDate } from "./calendar.js";
import { exportBackup } from "./export.js";
import { sortForAllTab } from "./sort.js";

// 탭 최소화 (D00 D안, 2026-08-03 사용자 결정):
// 날짜(→달력이 대체)·우선순위·카테고리 탭 제거. 점·뱃지·정렬은 유지.
// 오늘+하루 통합, 메모판 독립 (2026-08-05 사용자 결정)
const TABS = ["오늘", "메모", "달력", "전체", "정보"];

export default function App() {
  const [tab, setTab] = useState("오늘"); // 처음 열면 "오늘" 탭
  const [undo, setUndo] = useState(null); // 방금 휴지통에 넣은 것 (실행취소용)
  const [confirmClear, setConfirmClear] = useState(false); // 모두 지우기 확인 중?
  const [showTrash, setShowTrash] = useState(false); // 휴지통 화면 보는 중?
  const [showHelp, setShowHelp] = useState(false); // 도움말 화면 보는 중? (F10)
  const [menuOpen, setMenuOpen] = useState(false); // 상단 ⋯ 메뉴 열림?
  const [showImport, setShowImport] = useState(false); // 가져오기 박스 열림?

  // 목록: 휴지통에 없는 할 일만 (deletedAt 없는 것). DB가 바뀌면 자동 갱신
  const tasks = useLiveQuery(() =>
    db.tasks
      .orderBy("createdAt")
      .reverse()
      .filter((t) => !t.deletedAt)
      .toArray()
  );

  // 휴지통: 버려진(deletedAt 있는) 할 일. 최근 버린 것부터
  const trash = useLiveQuery(() =>
    db.tasks
      .filter((t) => !!t.deletedAt)
      .toArray()
      .then((arr) =>
        arr.sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""))
      )
  );

  // 노트 (F11 통합) — 날짜 있는 것은 일정 성격 (달력·오늘 한 줄에도 사용)
  const memos = useLiveQuery(() => db.memos.toArray());

  // 방금 한 동작을 기억해 "실행취소" 알림을 띄움
  // type: "trash"(휴지통으로 감) | "done"(완료로 체크됨)
  function showUndo(type, ids, label) {
    setUndo({ type, ids, label });
  }

  // 완료 체크: 미완료→완료로 바꿀 때만 실행취소 알림 (R5a)
  // (오늘 탭·메모판에선 체크 즉시 사라지므로, 잘못 눌러도 여기서 복구)
  // 처리 중인 항목의 재클릭은 무시 — 반복 할 일 연타 시 완료 기록이 중복 생기는 것 방지
  const togglingRef = useRef(new Set());
  async function handleToggle(task) {
    if (togglingRef.current.has(task.id)) return;
    togglingRef.current.add(task.id);
    try {
      // 반복 할 일 (F09): 완료 기록을 남기고 다음 회차로
      if (!task.done && task.repeat && task.dueDate) {
        const r = await completeRepeatingTask(task);
        setUndo({
          type: "repeat",
          recordId: r.recordId,
          taskId: task.id,
          prevDue: r.prevDue,
          nextDue: r.nextDue,
          label: `"${task.title}"`,
        });
        return;
      }
      await toggleDone(task);
      if (!task.done) {
        showUndo("done", [task.id], `"${task.title}"`);
      }
    } finally {
      togglingRef.current.delete(task.id);
    }
  }

  // 한 개 → 휴지통
  async function handleDelete(task) {
    await trashTasks([task.id]);
    showUndo("trash", [task.id], `"${task.title}"`);
  }

  // 전체 → 휴지통
  async function handleClearAll() {
    const all = tasks ?? [];
    await trashTasks(all.map((t) => t.id));
    setConfirmClear(false);
    showUndo("trash", all.map((t) => t.id), `전체 ${all.length}개`);
  }

  // 메모 삭제 (F11 R4 — 같은 방식)
  async function handleDeleteMemo(memo) {
    await deleteMemo(memo.id);
    const title = memo.text.split("\n")[0].slice(0, 20);
    setUndo({ type: "memo", memos: [memo], label: `"${title}" 노트` });
  }

  // 실행취소: 방금 한 동작을 되돌림
  async function handleUndo() {
    if (undo) {
      if (undo.type === "trash") await restoreTasks(undo.ids);
      else if (undo.type === "done") await uncheckTasks(undo.ids);
      else if (undo.type === "memo") await restoreMemos(undo.memos);
      else if (undo.type === "repeat")
        await undoCompleteRepeating(
          undo.recordId,
          undo.taskId,
          undo.prevDue,
          undo.nextDue
        );
    }
    setUndo(null);
  }

  return (
    <div className="app">
      <header className="top">
        <h1>할 일</h1>
        {/* 자주 안 쓰는 액션은 ⋯ 메뉴 하나로 모음 (D00: 액션 정리) */}
        {!showTrash && !showHelp && (
          <div className="menu-wrap">
            <button
              className="menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="메뉴"
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="menu">
                  <button
                    onClick={() => {
                      setShowImport(true);
                      setMenuOpen(false);
                    }}
                  >
                    가져오기
                  </button>
                  <button
                    onClick={() => {
                      exportBackup();
                      setMenuOpen(false);
                    }}
                  >
                    내보내기
                  </button>
                  <button
                    onClick={() => {
                      setShowTrash(true);
                      setMenuOpen(false);
                    }}
                  >
                    🗑 휴지통
                    {trash && trash.length > 0 ? ` (${trash.length})` : ""}
                  </button>
                  <button
                    onClick={() => {
                      setShowHelp(true);
                      setMenuOpen(false);
                    }}
                  >
                    ❓ 도움말
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setConfirmClear(true);
                      setMenuOpen(false);
                    }}
                  >
                    모두 지우기
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {showHelp ? (
        <HelpView onBack={() => setShowHelp(false)} />
      ) : showTrash ? (
        <TrashView
          trash={trash}
          onBack={() => setShowTrash(false)}
          onRestore={(t) => restoreTasks([t.id])}
          onPurge={(ids) => permanentDeleteTasks(ids)}
          onEmpty={emptyTrash}
        />
      ) : (
        <>
          <QuickInput />

          {/* F02 R12: 여러 줄 붙여넣기 (⋯ 메뉴 > 가져오기 에서 엶) */}
          <ImportBox open={showImport} onClose={() => setShowImport(false)} />

          {/* 모두 지우기 확인 (⋯ 메뉴에서 눌렀을 때) */}
          {confirmClear && (
            <div className="clear-confirm">
              모두 휴지통으로 보낼까요?
              <button className="delete" onClick={handleClearAll}>
                모두 보내기
              </button>
              <button onClick={() => setConfirmClear(false)}>취소</button>
            </div>
          )}

          {/* 정리 뷰 탭 */}
          <nav className="tabs">
            {TABS.map((name) => (
              <button
                key={name}
                className={"tab" + (tab === name ? " active" : "")}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </nav>

          {tasks === undefined ? (
            <p className="hint">불러오는 중...</p>
          ) : (
            <TaskView
              tab={tab}
              tasks={tasks}
              memos={memos ?? []}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onDeleteMemo={handleDeleteMemo}
            />
          )}

        </>
      )}

      {/* 실행취소 알림 (실행취소 또는 닫기를 누를 때까지 계속 떠 있음) */}
      {undo && (
        <div className="toast">
          <span>
            {undo.label}{" "}
            {undo.type === "trash"
              ? "휴지통으로 이동"
              : undo.type === "memo"
                ? "삭제됨"
                : undo.type === "repeat"
                  ? `완료 · 다음 ${undo.nextDue}`
                  : "완료됨"}
          </span>
          <button onClick={handleUndo}>실행취소</button>
          <button
            className="toast-close"
            onClick={() => setUndo(null)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 선택된 탭에 맞게 할 일을 정리해서 보여주는 부분
// ------------------------------------------------------------
function TaskView({
  tab,
  tasks,
  memos,
  onToggle,
  onDelete,
  onDeleteMemo,
}) {
  // 하루 기록에서 ◀▶로 보는 날짜 (F04 R9) — 오늘 탭의 할 일 목록도 이 날짜를 따라감
  // ⚠️ 훅은 항상 같은 순서로 호출돼야 하므로 반드시 탭 분기(return)보다 위에!
  const [dayDate, setDayDate] = useState(todayStr());

  // [메모] 날짜 없는 할 일들의 노란 판 — 독립 탭 (2026-08-05)
  if (tab === "메모") {
    const undated = tasks.filter((t) => !t.done && !t.dueDate);
    if (undated.length === 0) {
      return (
        <p className="hint">
          메모가 없어요. 입력창에 날짜 없이 쓰고 Enter를 누르세요.
        </p>
      );
    }
    return <StickyBoard tasks={undated} onToggle={onToggle} />;
  }

  // [정보] 통합 노트 — 일정(날짜 있음) + 기록 (F11, 2026-08-03 통합)
  if (tab === "정보") {
    return <MemoView memos={memos} onDelete={onDeleteMemo} />;
  }

  // [달력] 월간 달력 위에서 날짜 있는 할 일 + 공지 보기 (F07·F08)
  if (tab === "달력") {
    return (
      <CalendarView
        tasks={tasks}
        notes={memos
          .filter((m) => m.date)
          .map((m) => ({ ...m, text: m.text.split("\n")[0] }))}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    );
  }

  // [전체] 급한 것부터, 완료는 맨 아래 (F03 R8)
  if (tab === "전체") {
    return (
      <TaskList
        tasks={sortForAllTab(tasks)}
        onToggle={onToggle}
        onDelete={onDelete}
        emptyHint="할 일이 없어요. 위에 입력하고 Enter를 누르세요!"
      />
    );
  }

  // [오늘] 하루의 조종석 (2026-08-05 통합): 공지 → 하루 기록(계획/실제/회고) → 오늘 할 일
  if (tab === "오늘") {
    const today = todayStr();
    // 할 일 목록은 하루 기록의 ◀▶ 날짜를 따라감 (F04 R9):
    // 오늘 = 오늘 마감 + 밀린 것 (미완료만) / 다른 날 = 그 날짜에 걸린 할 일 (달력과 같은 규칙)
    const viewingToday = dayDate === today;
    const list = viewingToday
      ? tasks
          .filter(
            (t) =>
              !t.done &&
              t.dueDate &&
              (t.dateKind === "range" && t.startDate
                ? t.startDate <= today
                : t.dueDate <= today)
          )
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate)) // 밀린 것부터 위로
      : tasksOnDate(tasks, dayDate);
    // 다른 날 제목용 "M/D" (예: "8/9 할 일")
    const dayLabel = `${Number(dayDate.slice(5, 7))}/${Number(dayDate.slice(8, 10))}`;

    // 오늘 날짜인 일정 노트만 한 줄로 (놓침 방지 — 전체는 "정보" 탭에, F11 R5)
    const todaysNotices = memos
      .filter((m) => m.date === today)
      .map((m) => ({ ...m, text: m.text.split("\n")[0] }));

    return (
      <div>
        {todaysNotices.map((n) => (
          <p key={n.id} className="cal-note-line today-notice">
            📢 오늘: {n.text}
          </p>
        ))}
        {/* 하루 기록 (F04) — 계획/실제/회고, ◀▶로 지난 날도 열람 */}
        <DayView tasks={tasks} date={dayDate} onDateChange={setDayDate} />
        {/* 오늘 마감·밀린 할 일 — 다른 날을 보는 중엔 그 날짜의 할 일 (F04 R9) */}
        <h2 className="group-title today-tasks-title">
          📋 {viewingToday ? "오늘 할 일" : `${dayLabel} 할 일`}{" "}
          <span className="group-count">{list.length}</span>
        </h2>
        <TaskList
          tasks={list}
          onToggle={onToggle}
          onDelete={onDelete}
          emptyHint={
            viewingToday
              ? "오늘 마감인 할 일이 없어요."
              : "이 날짜의 할 일이 없어요."
          }
        />
      </div>
    );
  }

  return null; // TABS에 없는 탭은 없음
}

// ------------------------------------------------------------
// 휴지통 화면 (F02 R7d): 버린 할 일을 복원하거나 완전 삭제
// ------------------------------------------------------------
function TrashView({ trash, onBack, onRestore, onPurge, onEmpty }) {
  const items = trash ?? [];
  return (
    <div className="trash">
      <div className="trash-head">
        <button className="link-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="trash-title">휴지통 ({items.length})</h2>
        {items.length > 0 && (
          <EmptyTrashButton count={items.length} onEmpty={onEmpty} />
        )}
      </div>
      {items.length === 0 ? (
        <p className="hint">휴지통이 비어 있어요.</p>
      ) : (
        <ul className="task-list">
          {items.map((t) => (
            <li key={t.id} className="task-item trashed">
              <span className="task-title">{t.title}</span>
              <div className="task-buttons">
                <button onClick={() => onRestore(t)}>복원</button>
                <PurgeButton onConfirm={() => onPurge([t.id])} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 한 개 완전 삭제 버튼 (확인 필요) */
function PurgeButton({ onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button className="delete" onClick={() => setConfirm(true)}>
        완전 삭제
      </button>
    );
  }
  return (
    <span className="danger-confirm">
      완전히 지울까요?
      <button className="delete" onClick={onConfirm}>
        삭제
      </button>
      <button onClick={() => setConfirm(false)}>취소</button>
    </span>
  );
}

/** 휴지통 비우기 버튼 (확인 필요) */
function EmptyTrashButton({ count, onEmpty }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button className="reset-btn" onClick={() => setConfirm(true)}>
        비우기
      </button>
    );
  }
  return (
    <span className="danger-confirm">
      {count}개를 완전히 지울까요? (되돌릴 수 없음)
      <button
        className="delete"
        onClick={() => {
          onEmpty();
          setConfirm(false);
        }}
      >
        비우기
      </button>
      <button onClick={() => setConfirm(false)}>취소</button>
    </span>
  );
}

/** 할 일 목록 하나를 그리는 공통 부품 */
function TaskList({ tasks, onToggle, onDelete, emptyHint }) {
  if (tasks.length === 0) {
    return emptyHint ? <p className="hint">{emptyHint}</p> : null;
  }
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// 그룹핑 함수들 — 할 일 배열을 [{ title, tasks }] 모양으로 묶는다
// ------------------------------------------------------------

