// ------------------------------------------------------------
// 검색 화면 (F13): 단어 하나로 할 일·일정·노트·하루 기록을 한꺼번에 찾기
//  · 치는 즉시 결과가 바뀜 (Enter 불필요) — 찾는 계산은 search.js
//  · 결과 줄은 목록에서 쓰던 부품 그대로 (TaskItem·EventItem·노트 에디터)
//    → 찾은 자리에서 체크·수정·삭제
//  · 하루 기록 줄은 누르면 오늘 탭이 그 날짜로 열림 (onOpenDay)
// ------------------------------------------------------------
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db.js";
import { searchAll } from "../search.js";
import { dateOnly } from "../date.js";
import { WEEKDAY_LABEL } from "../labels.js";
import TaskItem from "./TaskItem.jsx";
import EventItem from "./EventItem.jsx";
import { MemoEditor } from "./MemoView.jsx";

export default function SearchView({
  tasks, // 휴지통에 없는 할 일 전부
  memos, // 노트 + 일정
  onBack,
  onToggle,
  onDelete,
  onConvertToNote,
  onDeleteMemo,
  onConvertToTask,
  onOpenDay, // 하루 기록 줄을 눌렀을 때 (날짜)
}) {
  const [query, setQuery] = useState("");
  // 하루 기록은 이 화면에서만 통째로 필요 — 여기서 읽음 (DB가 바뀌면 자동 갱신)
  const dayLogs = useLiveQuery(() => db.dayLogs.toArray());

  const found = searchAll(query, { tasks, memos, dayLogs: dayLogs ?? [] });
  const typed = query.trim() !== "";

  return (
    <div className="search">
      <div className="trash-head">
        <button className="link-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="trash-title">검색</h2>
        {typed && <span className="group-count">결과 {found.total}개</span>}
      </div>
      <input
        className="quick-input"
        type="text"
        placeholder="찾을 단어 (예: 세금계산서 · 띄어 쓰면 모두 들어간 것만)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onBack(); // Esc = 뒤로 (R1)
        }}
        autoFocus
      />

      {!typed ? (
        <p className="hint">
          할 일·끝낸 할 일·일정·노트·하루 기록에서 한꺼번에 찾아요.
        </p>
      ) : found.total === 0 ? (
        <p className="hint">"{query.trim()}"이(가) 들어간 것이 없어요.</p>
      ) : (
        <>
          <TaskGroup
            title="📋 할 일"
            tasks={found.open}
            onToggle={onToggle}
            onDelete={onDelete}
            onConvert={onConvertToNote}
          />
          <TaskGroup
            title="✅ 끝낸 할 일"
            tasks={found.done}
            onToggle={onToggle}
            onDelete={onDelete}
            onConvert={onConvertToNote}
          />
          {found.events.length > 0 && (
            <>
              <GroupTitle title="📢 일정" count={found.events.length} />
              <ul className="task-list">
                {found.events.map((m) => (
                  <EventItem
                    key={m.id}
                    note={m}
                    onDelete={onDeleteMemo}
                    onConvert={onConvertToTask}
                  />
                ))}
              </ul>
            </>
          )}
          {found.notes.length > 0 && (
            <>
              <GroupTitle title="📝 노트" count={found.notes.length} />
              <ul className="memo-list">
                {found.notes.map((m) => (
                  <NoteResult
                    key={m.id}
                    memo={m}
                    onDelete={onDeleteMemo}
                    onConvert={onConvertToTask}
                  />
                ))}
              </ul>
            </>
          )}
          {found.days.length > 0 && (
            <>
              <GroupTitle title="📓 하루 기록" count={found.days.length} />
              <ul className="task-list">
                {found.days.map((d) => (
                  <li
                    key={d.id}
                    className={"task-item search-day " + d.kind}
                  >
                    <button
                      onClick={() => onOpenDay(d.date)}
                      title="오늘 탭에서 이 날짜 열기"
                    >
                      <span className="search-day-when">
                        {d.date} ({WEEKDAY_LABEL[new Date(d.date + "T00:00:00").getDay()]})
                        {" · "}
                        {d.kind === "plan" ? "계획" : "한 일"}
                      </span>
                      <span>{d.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** 묶음 제목 + 개수 */
function GroupTitle({ title, count }) {
  return (
    <h2 className="group-title">
      {title} <span className="group-count">{count}</span>
    </h2>
  );
}

/** 할 일 묶음 — 결과가 없으면 통째로 숨김 (R4) */
function TaskGroup({ title, tasks, onToggle, onDelete, onConvert }) {
  if (tasks.length === 0) return null;
  return (
    <>
      <GroupTitle title={title} count={tasks.length} />
      <ul className="task-list">
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            onToggle={onToggle}
            onDelete={onDelete}
            onConvert={onConvert}
          />
        ))}
      </ul>
    </>
  );
}

/** 노트 한 장 — 메모 탭의 카드와 같은 모양. 누르면 그 자리에 에디터 (R5) */
function NoteResult({ memo, onDelete, onConvert }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <MemoEditor
          memo={memo}
          rows={6}
          onClose={() => setEditing(false)}
          onDelete={onDelete}
          onConvert={onConvert}
        />
      </li>
    );
  }
  const [first, ...rest] = memo.text.split("\n");
  const preview = rest.join(" ").trim();
  return (
    <li>
      <button className="memo-card" onClick={() => setEditing(true)}>
        <span className="memo-title">{first || "(빈 노트)"}</span>
        {preview && <span className="memo-preview">{preview}</span>}
        <span className="memo-date">{dateOnly(memo.updatedAt)}</span>
      </button>
    </li>
  );
}
