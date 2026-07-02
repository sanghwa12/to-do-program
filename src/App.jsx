// ============================================================
// 앱 메인 화면
// - 쏟아붓기 입력창 (F02)
// - 정리 뷰 탭 (F03): 오늘 / 전체 / 날짜 / 우선순위 / 카테고리
//   "계획을 세우는 건 앱, 사용자는 붓기만 한다"
// ============================================================
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db.js";
import QuickInput from "./components/QuickInput.jsx";
import TaskItem from "./components/TaskItem.jsx";
import { todayStr } from "./date.js";
import { PRIORITY_LABEL } from "./labels.js";
import { exportBackup } from "./export.js";

const TABS = ["오늘", "전체", "날짜", "우선순위", "카테고리"];

export default function App() {
  const [tab, setTab] = useState("오늘"); // 처음 열면 "오늘" 탭

  // DB의 할 일 목록을 실시간 구독 — DB가 바뀌면 화면도 자동 갱신
  const tasks = useLiveQuery(() =>
    db.tasks.orderBy("createdAt").reverse().toArray()
  );

  // 이미 써 본 카테고리 목록 (편집 화면의 자동완성 후보로 씀)
  const categories = [
    ...new Set((tasks ?? []).map((t) => t.category).filter(Boolean)),
  ];

  return (
    <div className="app">
      <header className="top">
        <h1>할 일</h1>
        {/* F06: 전체 할 일을 .md 파일로 백업 (Obsidian 호환) */}
        <button className="export-btn" onClick={exportBackup}>
          내보내기
        </button>
      </header>

      <QuickInput />

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
        <TaskView tab={tab} tasks={tasks} categories={categories} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 선택된 탭에 맞게 할 일을 정리해서 보여주는 부분
// ------------------------------------------------------------
function TaskView({ tab, tasks, categories }) {
  // [전체] 최신순 그대로
  if (tab === "전체") {
    return (
      <TaskList
        tasks={tasks}
        categories={categories}
        emptyHint="할 일이 없어요. 위에 입력하고 Enter를 누르세요!"
      />
    );
  }

  // [오늘] 마감이 오늘이거나 이미 지난(밀린) 미완료 할 일 (F03 R2)
  if (tab === "오늘") {
    const today = todayStr();
    const list = tasks
      .filter((t) => !t.done && t.dueDate && t.dueDate <= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)); // 밀린 것부터 위로
    return (
      <TaskList
        tasks={list}
        categories={categories}
        emptyHint="오늘 할 일이 없어요. 다른 탭에서 할 일에 날짜를 붙여보세요."
      />
    );
  }

  // [날짜 / 우선순위 / 카테고리] 그룹으로 묶어서 표시
  const groups =
    tab === "날짜"
      ? groupByDate(tasks)
      : tab === "우선순위"
        ? groupByPriority(tasks)
        : groupByCategory(tasks);

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
              <TaskList tasks={group.tasks} categories={categories} />
            </section>
          )
      )}
    </div>
  );
}

/** 할 일 목록 하나를 그리는 공통 부품 */
function TaskList({ tasks, categories, emptyHint }) {
  if (tasks.length === 0) {
    return emptyHint ? <p className="hint">{emptyHint}</p> : null;
  }
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} categories={categories} />
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
