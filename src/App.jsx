// ============================================================
// 앱 메인 화면
// - 쏟아붓기 입력창 (F02)
// - 정리 뷰 탭 (F03): 오늘 / 전체 / 날짜 / 우선순위 / 카테고리
//   "계획을 세우는 건 앱, 사용자는 붓기만 한다"
// ============================================================
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  trashTasks,
  restoreTasks,
  permanentDeleteTasks,
  emptyTrash,
} from "./db.js";
import QuickInput from "./components/QuickInput.jsx";
import ImportBox from "./components/ImportBox.jsx";
import TaskItem from "./components/TaskItem.jsx";
import { todayStr } from "./date.js";
import { PRIORITY_LABEL } from "./labels.js";
import { exportBackup } from "./export.js";

const TABS = ["오늘", "전체", "날짜", "우선순위", "카테고리"];

export default function App() {
  const [tab, setTab] = useState("오늘"); // 처음 열면 "오늘" 탭
  const [undo, setUndo] = useState(null); // 방금 휴지통에 넣은 것 (실행취소용)
  const [confirmClear, setConfirmClear] = useState(false); // 모두 지우기 확인 중?
  const [catFilter, setCatFilter] = useState(null); // 카테고리 필터 (null=전체)
  const [showTrash, setShowTrash] = useState(false); // 휴지통 화면 보는 중?
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

  // 이미 써 본 카테고리 목록 (편집 화면의 자동완성 후보로 씀)
  const categories = [
    ...new Set((tasks ?? []).map((t) => t.category).filter(Boolean)),
  ];

  // 휴지통에 넣은 항목(들)의 id를 기억해 "실행취소" 알림을 띄움
  function showUndo(ids, label) {
    setUndo({ ids, label });
  }

  // 한 개 → 휴지통
  async function handleDelete(task) {
    await trashTasks([task.id]);
    showUndo([task.id], `"${task.title}"`);
  }

  // 카테고리별 → 휴지통
  async function handleDeleteCategory(list, label) {
    await trashTasks(list.map((t) => t.id));
    showUndo(list.map((t) => t.id), label);
  }

  // 전체 → 휴지통
  async function handleClearAll() {
    const all = tasks ?? [];
    await trashTasks(all.map((t) => t.id));
    setConfirmClear(false);
    showUndo(all.map((t) => t.id), `전체 ${all.length}개`);
  }

  // 실행취소: 방금 휴지통에 넣은 것들을 목록으로 복원
  async function handleUndo() {
    if (undo) await restoreTasks(undo.ids);
    setUndo(null);
  }

  return (
    <div className="app">
      <header className="top">
        <h1>할 일</h1>
        {/* 자주 안 쓰는 액션은 ⋯ 메뉴 하나로 모음 (D00: 액션 정리) */}
        {!showTrash && (
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

      {showTrash ? (
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
              categories={categories}
              onDelete={handleDelete}
              onDeleteCategory={handleDeleteCategory}
              catFilter={catFilter}
              setCatFilter={setCatFilter}
            />
          )}

        </>
      )}

      {/* 실행취소 알림 (실행취소 또는 닫기를 누를 때까지 계속 떠 있음) */}
      {undo && (
        <div className="toast">
          <span>{undo.label} 휴지통으로 이동</span>
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
  categories,
  onDelete,
  onDeleteCategory,
  catFilter,
  setCatFilter,
}) {
  // [전체] 최신순 그대로
  if (tab === "전체") {
    return (
      <TaskList
        tasks={tasks}
        categories={categories}
        onDelete={onDelete}
        emptyHint="할 일이 없어요. 위에 입력하고 Enter를 누르세요!"
      />
    );
  }

  // [오늘] 날짜가 오늘이거나 이미 지난(밀린) 미완료 할 일 (F03 R2)
  // 기간(range)은 시작일이 됐으면 표시 (진행 중인 일이니까)
  if (tab === "오늘") {
    const today = todayStr();
    const list = tasks
      .filter(
        (t) =>
          !t.done &&
          t.dueDate &&
          (t.dateKind === "range" && t.startDate
            ? t.startDate <= today
            : t.dueDate <= today)
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)); // 밀린 것부터 위로
    return (
      <TaskList
        tasks={list}
        categories={categories}
        onDelete={onDelete}
        emptyHint="오늘 할 일이 없어요. 다른 탭에서 할 일에 날짜를 붙여보세요."
      />
    );
  }

  // [카테고리] 상단 필터(칩)로 특정 카테고리만 골라 보기 (F03 R4b)
  if (tab === "카테고리") {
    const names = [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "ko")
    );
    const uncatCount = tasks.filter((t) => !t.category).length;
    const countOf = (n) => tasks.filter((t) => t.category === n).length;

    const chips = (
      <div className="cat-filter">
        <button
          className={"chip" + (catFilter === null ? " active" : "")}
          onClick={() => setCatFilter(null)}
        >
          전체
        </button>
        {names.map((n) => (
          <button
            key={n}
            className={"chip" + (catFilter === n ? " active" : "")}
            onClick={() => setCatFilter(n)}
          >
            #{n} <span className="chip-count">{countOf(n)}</span>
          </button>
        ))}
        {uncatCount > 0 && (
          <button
            className={"chip" + (catFilter === "__none__" ? " active" : "")}
            onClick={() => setCatFilter("__none__")}
          >
            미지정 <span className="chip-count">{uncatCount}</span>
          </button>
        )}
      </div>
    );

    // 특정 카테고리를 골랐으면 그것만 목록으로 + 카테고리 통째 삭제 버튼
    if (catFilter !== null) {
      const isUncat = catFilter === "__none__";
      const list = isUncat
        ? tasks.filter((t) => !t.category)
        : tasks.filter((t) => t.category === catFilter);
      const label = isUncat ? "미지정" : `#${catFilter}`;
      return (
        <div>
          {chips}
          {list.length > 0 && (
            <DeleteCategoryButton
              key={catFilter}
              count={list.length}
              label={label}
              onConfirm={() => onDeleteCategory(list, `${label} ${list.length}개`)}
            />
          )}
          <TaskList
            tasks={list}
            categories={categories}
            onDelete={onDelete}
            emptyHint="이 카테고리에 할 일이 없어요."
          />
        </div>
      );
    }

    // "전체"면 카테고리별로 묶어서
    const catGroups = groupByCategory(tasks);
    return (
      <div>
        {chips}
        {catGroups.map(
          (group) =>
            group.tasks.length > 0 && (
              <section key={group.title}>
                <h2 className="group-title">
                  {group.title}{" "}
                  <span className="group-count">{group.tasks.length}</span>
                </h2>
                <TaskList
                  tasks={group.tasks}
                  categories={categories}
                  onDelete={onDelete}
                />
              </section>
            )
        )}
      </div>
    );
  }

  // [날짜 / 우선순위] 그룹으로 묶어서 표시
  const groups =
    tab === "날짜" ? groupByDate(tasks) : groupByPriority(tasks);

  if (groups.every((g) => g.tasks.length === 0)) {
    return <p className="hint">할 일이 없어요. 위에 입력하고 Enter를 누르세요!</p>;
  }

  return (
    <div>
      {groups.map(
        (group) =>
          group.tasks.length > 0 && (
            <section key={group.title}>
              <h2 className="group-title">
                {group.title}{" "}
                <span className="group-count">{group.tasks.length}</span>
              </h2>
              <TaskList
                tasks={group.tasks}
                categories={categories}
                onDelete={onDelete}
              />
            </section>
          )
      )}
    </div>
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
              {t.category && <span className="badge cat">#{t.category}</span>}
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

/** 카테고리 통째 삭제 버튼 (누르면 그 자리에서 한 번 더 확인) */
function DeleteCategoryButton({ count, label, onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <div className="cat-delete">
        <button className="reset-btn" onClick={() => setConfirm(true)}>
          {label} {count}개 모두 삭제
        </button>
      </div>
    );
  }
  return (
    <div className="cat-delete">
      <span className="danger-confirm">
        {label} {count}개를 삭제할까요? (되돌리기 가능)
        <button className="delete" onClick={onConfirm}>
          삭제
        </button>
        <button onClick={() => setConfirm(false)}>취소</button>
      </span>
    </div>
  );
}

/** 할 일 목록 하나를 그리는 공통 부품 */
function TaskList({ tasks, categories, onDelete, emptyHint }) {
  if (tasks.length === 0) {
    return emptyHint ? <p className="hint">{emptyHint}</p> : null;
  }
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          categories={categories}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// 그룹핑 함수들 — 할 일 배열을 [{ title, tasks }] 모양으로 묶는다
// ------------------------------------------------------------

/** 날짜별로 묶기: 빠른 날짜부터, 날짜 없는 건 맨 뒤 "날짜 미정" (F03 R5) */
function groupByDate(tasks) {
  const dated = tasks.filter((t) => t.dueDate);
  const undated = tasks.filter((t) => !t.dueDate);
  const dates = [...new Set(dated.map((t) => t.dueDate))].sort();
  const groups = dates.map((date) => ({
    title: date === todayStr() ? `${date} (오늘)` : date,
    tasks: dated.filter((t) => t.dueDate === date),
  }));
  groups.push({ title: "날짜 미정", tasks: undated });
  return groups;
}

/** 우선순위별로 묶기: 높음 → 중간 → 낮음 → 미지정 (F03 R3) */
function groupByPriority(tasks) {
  const order = ["high", "med", "low"];
  const groups = order.map((p) => ({
    title: PRIORITY_LABEL[p],
    tasks: tasks.filter((t) => t.priority === p),
  }));
  groups.push({
    title: "미지정",
    tasks: tasks.filter((t) => !t.priority),
  });
  return groups;
}

/** 카테고리별로 묶기: 이름순, 카테고리 없는 건 맨 뒤 "미지정" (F03 R4) */
function groupByCategory(tasks) {
  const names = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ko"));
  const groups = names.map((name) => ({
    title: `#${name}`,
    tasks: tasks.filter((t) => t.category === name),
  }));
  groups.push({
    title: "미지정",
    tasks: tasks.filter((t) => !t.category),
  });
  return groups;
}
