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
  updateTask,
  trashTasks,
  restoreTasks,
  permanentDeleteTasks,
  emptyTrash,
  deleteMemo,
  restoreMemos,
  setMemoDone,
  completeRepeatingTask,
  undoCompleteRepeating,
  convertTaskToNote,
  convertNoteToTask,
  restoreTaskFromNote,
  restoreNoteFromTask,
  setExceptions,
  moveTaskWeek,
} from "./db.js";
import QuickInput from "./components/QuickInput.jsx";
import ImportBox from "./components/ImportBox.jsx";
import TaskItem from "./components/TaskItem.jsx";
import CalendarView from "./components/CalendarView.jsx";
import StickyBoard from "./components/StickyBoard.jsx";
import DayView from "./components/DayView.jsx";
import HelpView from "./components/HelpView.jsx";
import GcalView from "./components/GcalView.jsx";
import MemoView from "./components/MemoView.jsx";
import EventItem from "./components/EventItem.jsx";
import SearchView from "./components/SearchView.jsx";
import Icon from "./components/Icon.jsx";
import { todayStr, addDays } from "./date.js";
import { WEEKDAY_LABEL, weekRangeText } from "./labels.js";
import { tasksOnDate } from "./calendar.js";
import { exportBackup } from "./export.js";
import { sortForAllTab, byDueDateTime, compareTime } from "./sort.js";
import { firstLineOf, notesOnDate, byNoteTime } from "./notes.js";
import {
  spanOfTask,
  spanOfNote,
  isActiveOn,
  nextActiveAfter,
  skipDay,
  isDueToday,
  isThisWeekTask,
  thisMonthDate,
} from "./span.js";

// 탭 최소화 (D00 D안, 2026-08-03 사용자 결정):
// 날짜(→달력이 대체)·우선순위·카테고리 탭 제거. 점·뱃지·정렬은 유지.
// 오늘+하루 통합, 메모판 독립 (2026-08-05 사용자 결정)
// 정보 탭 제거 (2026-09-04 사용자 결정): 노트는 메모 탭 하단 구역으로
// 노트 탭 추가 (2026-11-26 사용자 결정): 메모 탭 하단에 있던 노트 구역을 제 탭으로
const TABS = ["오늘", "메모", "노트", "달력", "전체"];

// 메모판에 남기는 "끝낸 메모"의 기준 시각 (F03 R2c, 2026-11-19):
// 이 시각 뒤에 체크한 메모만 판에 체크 표시로 남는다.
// (그 전에 끝낸 옛 메모들이 한꺼번에 판으로 돌아오지 않게 — 그것들은 전체 탭 "완료"에 그대로)
const MEMO_DONE_SINCE = "2026-11-19T01:25:00.000Z";

export default function App() {
  const [tab, setTab] = useState("오늘"); // 처음 열면 "오늘" 탭
  const [undo, setUndo] = useState(null); // 방금 휴지통에 넣은 것 (실행취소용)
  const [confirmClear, setConfirmClear] = useState(false); // 모두 지우기 확인 중?
  const [showTrash, setShowTrash] = useState(false); // 휴지통 화면 보는 중?
  const [showHelp, setShowHelp] = useState(false); // 도움말 화면 보는 중? (F10)
  const [showGcal, setShowGcal] = useState(false); // 구글 달력 설정 화면 보는 중? (F12)
  const [showSearch, setShowSearch] = useState(false); // 검색 화면 보는 중? (F13)
  // 오늘 탭에서 ◀▶로 보는 날짜 (F04 R9) — 검색에서 "그 날짜로 열기"를 하려고 여기서 들고 있음 (F13 R5)
  const [dayDate, setDayDate] = useState(todayStr());
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

  // 메모판 스티커 목록 (F03 R2d)
  const boards = useLiveQuery(() => db.boards.toArray());

  // 방금 한 동작을 기억해 "실행취소" 알림을 띄움
  // type: "trash"(휴지통으로 감) | "done"(완료로 체크됨)
  function showUndo(type, ids, label) {
    setUndo({ type, ids, label });
  }

  // 완료 체크: 미완료→완료로 바꿀 때만 실행취소 알림 (R5a)
  // (오늘 탭에선 체크 즉시 사라지므로, 잘못 눌러도 여기서 복구.
  //  메모판은 체크 표시만 남지만 같은 알림 — 2026-11-19)
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

  // 끝낸 메모를 메모판에서만 치우기 (F03 R2c, 2026-11-26) — 지우는 게 아니라 판에서 안 보이게만.
  // 전체 탭 "완료"와 하루 기록에는 그대로 남음
  async function handleHideMemo(task) {
    await updateTask(task.id, { memoHidden: true });
    setUndo({ type: "hideMemo", id: task.id, label: `"${task.title}"` });
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

  // 노트 완료 / 완료 취소 (F11 R12): 지우지 않고 노트 탭에서만 안 보이게.
  // 완료할 때는 실행취소 알림 (취소할 때는 다시 보이게 되는 것뿐이라 알림 없음)
  async function handleToggleMemoDone(memo) {
    await setMemoDone(memo.id, !memo.doneAt);
    if (!memo.doneAt) {
      const title = firstLineOf(memo.text).slice(0, 20);
      setUndo({ type: "memoDone", id: memo.id, label: `"${title}" 노트` });
    } else {
      // 방금 완료한 그 노트의 알림이 아직 떠 있으면 닫음 (이미 되돌렸으니)
      setUndo((u) => (u?.type === "memoDone" && u.id === memo.id ? null : u));
    }
  }

  // 할 일 → 일정 (F11 R9). 실행취소를 위해 바꾸기 전 할 일을 통째로 기억해 둠
  async function handleConvertToNote(task) {
    await convertTaskToNote(task);
    setUndo({ type: "toNote", task, label: `"${task.title}"` });
  }

  // 일정 → 할 일 (F11 R9). 같은 방식으로 바꾸기 전 일정을 기억
  async function handleConvertToTask(note) {
    await convertNoteToTask(note);
    const title = firstLineOf(note.text).slice(0, 20);
    setUndo({ type: "toTask", note, label: `"${title}"` });
  }

  // 기간에서 그 날만 빼기 (F03 R9) — 달력의 "이 날 빼기". kind: "task" | "note"
  // 실행취소를 위해 빼기 전의 예외 목록을 기억해 둠
  async function handleSkipDay(kind, item, day) {
    const span = kind === "note" ? spanOfNote(item) : spanOfTask(item);
    const next = skipDay(span, day);
    await setExceptions(kind, item.id, next.skip, next.extra);
    const title = kind === "note" ? firstLineOf(item.text) : item.title;
    setUndo({
      type: "skipDay",
      kind,
      id: item.id,
      prevSkip: item.skipDates,
      prevExtra: item.extraDates,
      day: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`, // "10/9"
      label: `"${title.slice(0, 20)}"`,
    });
  }

  // "이번 주" 할 일을 다음 주로 미루기 (F03 R11) — 월요일·일요일을 7일씩 뒤로.
  // 실행취소를 위해 미루기 전의 주를 기억해 둠
  async function handlePostponeWeek(task) {
    const next = {
      startDate: addDays(task.startDate, 7),
      dueDate: addDays(task.dueDate, 7),
    };
    await moveTaskWeek(task.id, next.startDate, next.dueDate);
    setUndo({
      type: "postponeWeek",
      id: task.id,
      prevStart: task.startDate,
      prevDue: task.dueDate,
      nextDue: next.dueDate,
      week: weekRangeText(next), // "11/16~11/22"
      label: `"${task.title}"`,
    });
  }

  // 실행취소: 방금 한 동작을 되돌림
  async function handleUndo() {
    if (undo) {
      if (undo.type === "trash") await restoreTasks(undo.ids);
      else if (undo.type === "done") await uncheckTasks(undo.ids);
      else if (undo.type === "hideMemo")
        await updateTask(undo.id, { memoHidden: undefined });
      else if (undo.type === "memoDone") await setMemoDone(undo.id, false);
      else if (undo.type === "memo") await restoreMemos(undo.memos);
      else if (undo.type === "toNote") await restoreTaskFromNote(undo.task);
      else if (undo.type === "toTask") await restoreNoteFromTask(undo.note);
      else if (undo.type === "skipDay")
        await setExceptions(undo.kind, undo.id, undo.prevSkip, undo.prevExtra);
      else if (undo.type === "postponeWeek")
        await moveTaskWeek(undo.id, undo.prevStart, undo.prevDue, undo.nextDue);
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
        <h1>My planner</h1>
        {/* 자주 안 쓰는 액션은 ⋯ 메뉴 하나로 모음 (D00: 액션 정리) */}
        {!showTrash && !showHelp && !showGcal && !showSearch && (
          <div className="menu-wrap">
            {/* 검색 (F13) — 누르면 검색 화면으로 */}
            <button
              className="menu-btn search-btn"
              onClick={() => {
                setShowSearch(true);
                setMenuOpen(false);
              }}
              aria-label="검색"
              title="검색"
            >
              <Icon name="search" />
            </button>
            <button
              className="menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="메뉴"
              aria-expanded={menuOpen}
            >
              <Icon name="more" />
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
                      setShowGcal(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon name="calendar" /> 구글 달력
                  </button>
                  <button
                    onClick={() => {
                      setShowTrash(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon name="trash" /> 휴지통
                    {trash && trash.length > 0 ? ` (${trash.length})` : ""}
                  </button>
                  <button
                    onClick={() => {
                      setShowHelp(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon name="help" /> 도움말
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

      {showGcal ? (
        <GcalView onBack={() => setShowGcal(false)} />
      ) : showHelp ? (
        <HelpView onBack={() => setShowHelp(false)} />
      ) : showSearch ? (
        <SearchView
          tasks={tasks ?? []}
          memos={memos ?? []}
          onBack={() => setShowSearch(false)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onConvertToNote={handleConvertToNote}
          onDeleteMemo={handleDeleteMemo}
          onToggleMemoDone={handleToggleMemoDone}
          onConvertToTask={handleConvertToTask}
          // 하루 기록 줄을 누르면: 오늘 탭을 그 날짜로 열고 검색을 닫음 (R5)
          onOpenDay={(date) => {
            setDayDate(date);
            setTab("오늘");
            setShowSearch(false);
          }}
        />
      ) : showTrash ? (
        <TrashView
          trash={trash}
          onBack={() => setShowTrash(false)}
          onRestore={(t) => restoreTasks([t.id])}
          onPurge={(ids) => permanentDeleteTasks(ids)}
          onEmpty={emptyTrash}
        />
      ) : (
        // 왼쪽에 세로 탭, 오른쪽에 입력칸과 내용 (2026-11-26 사용자 결정 — 한눈에 들어오게)
        <div className="layout">
          {/* 정리 뷰 탭 */}
          <nav className="tabs" aria-label="보기 선택">
            {TABS.map((name) => (
              <button
                key={name}
                className={"tab" + (tab === name ? " active" : "")}
                onClick={() => setTab(name)}
                aria-current={tab === name ? "page" : undefined}
              >
                {name}
              </button>
            ))}
          </nav>

          <div className="layout-main">
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

          {tasks === undefined ? (
            <p className="hint">불러오는 중...</p>
          ) : (
            <TaskView
              tab={tab}
              tasks={tasks}
              memos={memos ?? []}
              boards={boards ?? []}
              dayDate={dayDate}
              onDayChange={setDayDate}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onDeleteMemo={handleDeleteMemo}
              onHideMemo={handleHideMemo}
              onToggleMemoDone={handleToggleMemoDone}
              onConvertToNote={handleConvertToNote}
              onConvertToTask={handleConvertToTask}
              onSkipDay={handleSkipDay}
              onPostponeWeek={handlePostponeWeek}
            />
          )}
          </div>
        </div>
      )}

      {/* 실행취소 알림 (실행취소 또는 닫기를 누를 때까지 계속 떠 있음) */}
      {undo && (
        <div className="toast">
          <span>
            {undo.label}{" "}
            {undo.type === "trash"
              ? "휴지통으로 이동"
              : undo.type === "hideMemo"
                ? "메모판에서 치움 (기록은 남아요)"
              : undo.type === "memoDone"
                ? "완료 (노트 탭에서 안 보여요)"
              : undo.type === "memo"
                ? "삭제됨"
                : undo.type === "toNote"
                  ? "일정으로 바꿈"
                  : undo.type === "toTask"
                    ? "할 일로 바꿈"
                    : undo.type === "skipDay"
                      ? `${undo.day} 제외됨`
                      : undo.type === "postponeWeek"
                        ? `다음 주(${undo.week})로 미룸`
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
            <Icon name="close" />
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
  boards,
  dayDate, // 오늘 탭에서 ◀▶로 보는 날짜 (F04 R9) — 할 일 목록도 이 날짜를 따라감
  onDayChange,
  onToggle,
  onDelete,
  onDeleteMemo,
  onHideMemo, // 끝낸 메모를 메모판에서만 치우기 (F03 R2c)
  onToggleMemoDone, // 노트 완료 / 완료 취소 (F11 R12)
  onConvertToNote, // 할 일 → 일정 (F11 R9)
  onConvertToTask, // 일정 → 할 일
  onSkipDay, // 기간에서 그 날만 빼기 (F03 R9)
  onPostponeWeek, // "이번 주" 할 일을 다음 주로 (F03 R11)
}) {
  // [메모] 날짜 없는 할 일들의 노란 판 — 독립 탭 (2026-08-05)
  // 스티커 여러 장으로 나눌 수 있음 (F03 R2d) — 빈 상태 안내도 판 안에서
  if (tab === "메모") {
    // 끝낸 메모도 사라지지 않고 체크 표시만 된 채 제자리에 남음 (R2c, 2026-11-19)
    // — 단, 끝낸 뒤 ✕로 치운 것(memoHidden)은 판에서 뺌 (2026-11-26)
    const undated = tasks.filter(
      (t) =>
        !t.dueDate &&
        !t.soon && // "빨리 하면 좋은 일"은 오늘 탭의 제 칸에 (F03 R13)
        (!t.done || (!t.memoHidden && (t.completedAt ?? "") >= MEMO_DONE_SINCE))
    );
    return (
      <StickyBoard
        tasks={undated}
        boards={boards}
        onToggle={onToggle}
        onDelete={onDelete}
        onHide={onHideMemo}
      />
    );
  }

  // [노트] 체크 없는 기록 (F11) — 메모 탭 하단에서 제 탭으로 (2026-11-26).
  // 일정(날짜 있는 노트)은 달력·오늘 탭에서 보고 고침 (2026-09-28)
  if (tab === "노트") {
    return (
      <div className="note-tab">
        <MemoView
          memos={memos}
          onDelete={onDeleteMemo}
          onConvert={onConvertToTask}
          onToggleDone={onToggleMemoDone}
        />
      </div>
    );
  }

  // [달력] 월간 달력 위에서 날짜 있는 할 일 + 공지 보기 (F07·F08)
  if (tab === "달력") {
    return (
      <CalendarView
        tasks={tasks}
        notes={memos.filter((m) => m.date)} // 일정 = 날짜 있는 노트 (글 전체를 넘김 — 달력에서 수정)
        onToggle={onToggle}
        onDelete={onDelete}
        onConvert={onConvertToNote}
        onDeleteNote={onDeleteMemo}
        onConvertNote={onConvertToTask}
        onSkipDay={onSkipDay}
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
        onConvert={onConvertToNote}
        emptyHint="할 일이 없어요. 위에 입력하고 Enter를 누르세요!"
      />
    );
  }

  // [오늘] 하루의 조종석 (2026-08-05 통합): 📢 일정 → 하루 기록(계획/실제) → 오늘 할 일
  if (tab === "오늘") {
    const today = todayStr();
    // 할 일 목록은 하루 기록의 ◀▶ 날짜를 따라감 (F04 R9):
    // 오늘 = 오늘 마감 + 밀린 것 (미완료만) / 다른 날 = 그 날짜에 걸린 할 일 (달력과 같은 규칙)
    // 기간 할 일은 제외한 날엔 안 나옴 — 규칙은 span.js의 isDueToday (F03 R9)
    const viewingToday = dayDate === today;
    const list = viewingToday
      ? tasks
          .filter((t) => isDueToday(t, today))
          .sort(byDueDateTime) // 밀린 것부터 위로, 같은 날은 시간 순
      : tasksOnDate(tasks, dayDate);
    // 이번 주 중에 할 일 (F03 R10) — 주가 지나면 위의 "오늘 할 일"로 올라감 (isDueToday)
    const weekList = tasks
      .filter((t) => isThisWeekTask(t, today))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // 이번 달에 할 일 (F03 R14): 날짜가 이번 달 안(내일~말일)에 걸린 할 일을 모아 보여줌.
    // 따로 입력하는 게 아니라 날짜만 보고 자동으로 — 달이 바뀌면 그 달 것이 올라옴.
    // 가까운 날부터, 같은 날은 시간 순
    const monthList = tasks
      .map((t) => ({ t, when: thisMonthDate(t, today) }))
      .filter((x) => x.when)
      .sort((a, b) => a.when.localeCompare(b.when) || compareTime(a.t.dueTime, b.t.dueTime))
      .map((x) => x.t);
    // 빨리 하면 좋은 일 (F03 R13): 날짜는 없지만 빨리 처리하면 좋은 것 — 최신 입력이 위
    const soonList = tasks
      .filter((t) => !t.done && t.soon && !t.dueDate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // 다른 날 제목용 "M/D" (예: "8/9 할 일")
    const dayLabel = `${Number(dayDate.slice(5, 7))}/${Number(dayDate.slice(8, 10))}`;

    return (
      <div>
        {/* 📢 일정 블록 (F11 R5): 보는 날짜의 일정 + 다가오는 7일. 여기서 바로 수정 (R10) */}
        <EventBlock
          memos={memos}
          date={dayDate}
          today={today}
          onDelete={onDeleteMemo}
          onConvert={onConvertToTask}
        />
        {/* 하루 기록 (F04) — 계획/실제, ◀▶로 지난 날도 열람 */}
        <DayView tasks={tasks} date={dayDate} onDateChange={onDayChange}>
          {/* 오늘 마감·밀린 할 일 — 다른 날을 보는 중엔 그 날짜의 할 일 (F04 R9) */}
          <h2 className="group-title today-tasks-title">
            <Icon name="task" /> {viewingToday ? "오늘 할 일" : `${dayLabel} 할 일`}{" "}
            <span className="group-count">{list.length}</span>
          </h2>
          <TaskList
            tasks={list}
            onToggle={onToggle}
            onDelete={onDelete}
            onConvert={onConvertToNote}
            emptyHint={
              viewingToday
                ? "오늘 마감인 할 일이 없어요."
                : "이 날짜의 할 일이 없어요."
            }
          />
          {/* ⚡ 빨리 하면 좋은 일 (F03 R13): "~빨리"로 넣은, 날짜 없는 할 일.
              오늘을 볼 때만, 하나라도 있을 때만. 체크할 때까지 계속 여기 있음 */}
          {viewingToday && soonList.length > 0 && (
            <>
              <h2 className="group-title">
                <Icon name="bolt" /> 빨리 하면 좋은 일{" "}
                <span className="group-count">{soonList.length}</span>
              </h2>
              <TaskList
                tasks={soonList}
                onToggle={onToggle}
                onDelete={onDelete}
                onConvert={onConvertToNote}
              />
            </>
          )}
          {/* 🗓 이번 주에 할 일 (F03 R10): "~이번주"로 넣은, 요일을 정하지 않은 할 일.
              오늘을 볼 때만, 하나라도 있을 때만. 최신 입력이 위 */}
          {viewingToday && weekList.length > 0 && (
            <>
              <h2 className="group-title">
                <Icon name="calendar" /> 이번 주에 할 일{" "}
                <span className="group-count">{weekList.length}</span>
              </h2>
              <TaskList
                tasks={weekList}
                onToggle={onToggle}
                onDelete={onDelete}
                onConvert={onConvertToNote}
                onPostpone={onPostponeWeek}
              />
            </>
          )}
          {/* 🗓 이번 달에 할 일 (F03 R14): 날짜가 이번 달 안에 걸린 할 일 (위 묶음에 나온 것은 빼고).
              오늘을 볼 때만, 하나라도 있을 때만. 가까운 날부터 */}
          {viewingToday && monthList.length > 0 && (
            <>
              <h2 className="group-title">
                <Icon name="calendar" /> 이번 달에 할 일{" "}
                <span className="group-count">{monthList.length}</span>
              </h2>
              <TaskList
                tasks={monthList}
                onToggle={onToggle}
                onDelete={onDelete}
                onConvert={onConvertToNote}
              />
            </>
          )}
        </DayView>
      </div>
    );
  }

  return null; // TABS에 없는 탭은 없음
}

// ------------------------------------------------------------
// 오늘 탭 맨 위 "📢 일정" 블록 (F11 R5, 2026-09-28 개편 3단계)
//  · 보고 있는 날짜의 일정 (◀▶로 날짜를 옮기면 그 날 것)
//    기간 일정은 시작~끝 사이의 모든 날에, 같은 날은 시간 순 (R8)
//  · 오늘을 볼 때는 "다가오는 일정"(내일~7일 뒤에 시작)도 — 내일 일정을 오늘 놓치지 않게
//  · 줄마다 마우스를 올리면 수정/삭제 — 달력과 같은 방식 (R10)
// 보여줄 일정이 하나도 없으면 블록 자체를 그리지 않음
// ------------------------------------------------------------
function EventBlock({ memos, date, today, onDelete, onConvert }) {
  const viewingToday = date === today;
  const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`; // "10/6"

  const dayEvents = notesOnDate(memos, date).sort(byNoteTime);
  const until = addDays(today, 7);
  // 다가오는 일정: 오늘은 안 걸리지만 7일 안에 "다음으로 걸리는 날"이 있는 것.
  // 기간에서 오늘을 제외했거나, 기간이 끝난 뒤 추가한 날이 남은 일정도 여기 나옴 (F03 R9)
  const upcoming = viewingToday
    ? memos
        .map((m) => {
          const span = spanOfNote(m);
          if (!span || isActiveOn(span, today)) return null; // 오늘 걸린 건 위 목록에
          const next = nextActiveAfter(span, today);
          return next && next <= until ? { m, next } : null;
        })
        .filter(Boolean)
        // 가까운 날부터, 같은 날은 시간 순
        .sort((a, b) => a.next.localeCompare(b.next) || byNoteTime(a.m, b.m))
    : [];
  if (dayEvents.length === 0 && upcoming.length === 0) return null;

  // 오늘부터 며칠 뒤인지: "내일" / "3일 뒤"
  const daysAway = (ds) => {
    const n = Math.round(
      (new Date(ds + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000
    );
    return n === 1 ? "내일" : `${n}일 뒤`;
  };

  return (
    <section className="event-block">
      <h2 className="event-block-title">
        <Icon name="calendar" /> {viewingToday ? "오늘 일정" : `${md(date)} 일정`}{" "}
        <span className="event-count">{dayEvents.length}</span>
      </h2>
      {dayEvents.length === 0 ? (
        <p className="event-none">오늘은 일정이 없어요.</p>
      ) : (
        <ul className="event-list">
          {dayEvents.map((m) => (
            <EventItem
              key={m.id}
              note={m}
              compact
              onDelete={onDelete}
              onConvert={onConvert}
            />
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <>
          <h3 className="event-sub">다가오는 일정 (7일 이내)</h3>
          <ul className="event-list">
            {upcoming.map(({ m, next }) => (
              <EventItem
                key={m.id}
                note={m}
                compact
                // 앞머리: "9/29 (화) · 내일" — 다음으로 걸리는 날 기준
                when={`${md(next)} (${
                  WEEKDAY_LABEL[new Date(next + "T00:00:00").getDay()]
                }) · ${daysAway(next)}`}
                onDelete={onDelete}
                onConvert={onConvert}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
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
          <Icon name="left" /> 뒤로
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
function TaskList({ tasks, onToggle, onDelete, onConvert, onPostpone, emptyHint }) {
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
          onConvert={onConvert}
          onPostpone={onPostpone}
        />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// 그룹핑 함수들 — 할 일 배열을 [{ title, tasks }] 모양으로 묶는다
// ------------------------------------------------------------

