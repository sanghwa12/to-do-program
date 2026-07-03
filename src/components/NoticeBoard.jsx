// ------------------------------------------------------------
// "알아둘 것" 판 (F08): 할 일이 아닌 정보 — 오늘 탭 맨 위
//  📢 일정 공지 (날짜 있음): 지나면 흐려짐
//  📎 참고 정보 (날짜 없음): "이 상황엔 이렇게 한다"는 지식 — 낡지 않음
// 입력할 때 날짜를 쓰면 공지, 안 쓰면 참고로 자동 분류.
// ------------------------------------------------------------
import { useState } from "react";
import { addNote, updateNote } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { todayStr } from "../date.js";

/** 날짜 유무로 두 구역으로 나누고 각각 정렬 (R3·R4) */
export function splitNotices(notes, today) {
  const upcoming = notes
    .filter((n) => n.date && n.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)); // 임박한 순
  const past = notes
    .filter((n) => n.date && n.date < today)
    .sort((a, b) => b.date.localeCompare(a.date)); // 최근에 지난 것부터
  const refs = notes
    .filter((n) => !n.date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 최신순
  return { schedule: [...upcoming, ...past], refs };
}

// open/onToggleOpen은 App이 관리 — 탭을 오가도 접힘 상태가 유지되게 (R3)
export default function NoticeBoard({ notes, onDelete, open, onToggleOpen }) {
  const [text, setText] = useState("");

  const today = todayStr();
  const { schedule, refs } = splitNotices(notes, today);

  // 입력에서 날짜 인식 (할 일과 같은 인식기 재사용, R2)
  // 알아둘 것의 날짜는 "그 일이 있는 날"이라 지난 날짜도 그대로 둠 (연도 올림 없음)
  // 기간 표기면 시작일 사용
  const parsed = parseQuickInput(text, { allowPast: true });
  const noteDate = parsed.startDate || parsed.dueDate;

  async function handleAdd(e) {
    e.preventDefault();
    if (parsed.title === "") return;
    await addNote(parsed.title, noteDate);
    setText("");
  }

  // 접힌 상태: 한 줄 요약만
  if (!open) {
    return (
      <button className="notice-collapsed" onClick={onToggleOpen}>
        📌 알아둘 것 {notes.length}개 — 펼치기
      </button>
    );
  }

  return (
    <section className="notice-board">
      <div className="notice-head">
        <h2 className="notice-title">📌 알아둘 것</h2>
        <button className="link-btn" onClick={onToggleOpen}>
          접기
        </button>
      </div>

      {/* 전용 입력줄 — 날짜를 쓰면 일정 공지, 안 쓰면 참고 */}
      <form onSubmit={handleAdd}>
        <input
          className="notice-input"
          type="text"
          placeholder="알아둘 것 + Enter (예: 정전 6/27 · 외부 강연 등록은 윤리센터)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {noteDate && (
          <p className="parse-hint">
            "{parsed.title}" — 📅 {noteDate} 일정 공지로 저장됩니다
          </p>
        )}
      </form>

      {notes.length === 0 && <p className="notice-empty">아직 없어요.</p>}

      {/* 📢 일정 공지 (날짜 있음) */}
      {schedule.length > 0 && (
        <>
          <h3 className="notice-section">📢 일정·공지</h3>
          <ul className="notice-list">
            {schedule.map((n) => (
              <NoticeItem
                key={n.id}
                note={n}
                past={n.date < today}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </>
      )}

      {/* 📎 참고 정보 (날짜 없음) — 흐려지지 않음 */}
      {refs.length > 0 && (
        <>
          <h3 className="notice-section">📎 참고</h3>
          <ul className="notice-list">
            {refs.map((n) => (
              <NoticeItem key={n.id} note={n} past={false} onDelete={onDelete} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// 알아둘 것 한 줄: 제목 + (내용) + 날짜, 마우스 올리면 수정/삭제
function NoticeItem({ note, past, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [text, setText] = useState(note.text);
  const [memo, setMemo] = useState(note.memo || "");
  const [date, setDate] = useState(note.date || "");

  async function handleSave(e) {
    e.preventDefault();
    const newText = text.trim();
    if (newText === "") return;
    await updateNote(note.id, {
      text: newText,
      memo: memo.trim() || undefined,
      date: date || undefined,
    });
    setEditing(false);
  }

  function startEditing() {
    // 최신 값으로 폼을 채우고 시작 (할 일 편집과 같은 원칙)
    setText(note.text);
    setMemo(note.memo || "");
    setDate(note.date || "");
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="notice-item editing">
        <form onSubmit={handleSave} className="notice-edit-form">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            className="notice-memo-input"
            placeholder="내용 (선택 — 예: 윤리센터 사이트에서 등록)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="submit">저장</button>
          <button type="button" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className={"notice-item" + (past ? " past" : "")}>
      <div className="notice-line">
        <span className="notice-text">{note.text}</span>
        {note.date && (
          <span className="badge">
            📅 {note.date}
            {past && " · 지남"}
          </span>
        )}
        {confirmDelete ? (
          <span className="danger-confirm">
            삭제할까요?
            <button
              className="delete"
              onClick={() => {
                onDelete(note);
                setConfirmDelete(false);
              }}
            >
              삭제
            </button>
            <button onClick={() => setConfirmDelete(false)}>취소</button>
          </span>
        ) : (
          <span className="notice-buttons">
            <button onClick={startEditing}>수정</button>
            <button className="delete" onClick={() => setConfirmDelete(true)}>
              삭제
            </button>
          </span>
        )}
      </div>
      {note.memo && <p className="notice-memo">{note.memo}</p>}
    </li>
  );
}
