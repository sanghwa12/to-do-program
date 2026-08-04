// ------------------------------------------------------------
// 노트 (F11 통합, 2026-08-03): 기록 + 일정 공지가 하나로
//  · 노트 = 자유 글 + 선택적 날짜
//  · 날짜 있음 → "📅 일정" 구역 (임박순, 지나면 흐림, 달력에도 📢)
//  · 날짜 없음 → "📝 노트" 구역 (카드, 최신 수정순)
// ------------------------------------------------------------
import { useState } from "react";
import { addMemo, updateMemo } from "../db.js";
import { parseQuickInput } from "../parse.js";
import { todayStr, dateOnly } from "../date.js";

/** 첫 줄 = 제목 역할 */
function firstLineOf(text) {
  return text.split("\n")[0];
}

export default function MemoView({ memos, onDelete }) {
  // null = 목록, "new" = 새 노트, 그 외 = 그 id 편집
  const [openId, setOpenId] = useState(null);
  const [quickText, setQuickText] = useState("");

  const today = todayStr();
  const all = memos ?? [];

  // 📅 일정 구역: 임박한 순 → 지난 것(흐림) 맨 아래
  const upcoming = all
    .filter((m) => m.date && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = all
    .filter((m) => m.date && m.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  // 📝 노트 구역: 최신 수정순
  const plain = all
    .filter((m) => !m.date)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // 빠른 입력: 날짜 자동 인식 (지난 날짜 그대로, 반복 인식 없음 — F11 R2)
  const parsed = parseQuickInput(quickText, { allowPast: true, repeatable: false });
  const quickDate = parsed.startDate || parsed.dueDate;

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (parsed.title === "") return;
    await addMemo(parsed.title, quickDate);
    setQuickText("");
  }

  // 에디터 열림
  if (openId !== null) {
    const memo = openId === "new" ? null : all.find((m) => m.id === openId);
    return (
      <MemoEditor
        key={openId}
        memo={memo}
        onClose={() => setOpenId(null)}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div className="memo-view">
      {/* 통합 입력줄 (R2): 날짜 쓰면 일정, 아니면 노트 */}
      <form onSubmit={handleQuickAdd}>
        <input
          className="notice-input"
          type="text"
          placeholder="알아둘 것·기록 + Enter (예: 정전 8/12 · 외부 강연 등록은 윤리센터)"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
        />
        {quickDate && (
          <p className="parse-hint">
            "{parsed.title}" — 📅 {quickDate} 일정으로 저장됩니다
          </p>
        )}
      </form>
      <button className="memo-new" onClick={() => setOpenId("new")}>
        + 새 노트 (긴 글)
      </button>

      {/* 📅 일정 구역 (R3) */}
      {(upcoming.length > 0 || past.length > 0) && (
        <>
          <h3 className="notice-section">📅 일정</h3>
          <ul className="notice-list">
            {[...upcoming, ...past].map((m) => (
              <li
                key={m.id}
                className={"notice-item" + (m.date < today ? " past" : "")}
              >
                <div className="notice-line">
                  <button
                    className="memo-line-btn"
                    onClick={() => setOpenId(m.id)}
                  >
                    {firstLineOf(m.text)}
                  </button>
                  <span className="badge">
                    📅 {m.date}
                    {m.date < today && " · 지남"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 📝 노트 구역 (R3) */}
      {plain.length > 0 && <h3 className="notice-section">📝 노트</h3>}
      {all.length === 0 && (
        <p className="hint">
          아직 없어요. 위에 한 줄 쓰거나 "+ 새 노트"로 시작하세요.
        </p>
      )}
      <ul className="memo-list">
        {plain.map((m) => {
          const [first, ...rest] = m.text.split("\n");
          const preview = rest.join(" ").trim();
          return (
            <li key={m.id}>
              <button className="memo-card" onClick={() => setOpenId(m.id)}>
                <span className="memo-title">{first || "(빈 노트)"}</span>
                {preview && <span className="memo-preview">{preview}</span>}
                <span className="memo-date">{dateOnly(m.updatedAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 노트 에디터 (R4): 여러 줄 + 날짜(선택) — 날짜를 붙이면 일정이 됨
function MemoEditor({ memo, onClose, onDelete }) {
  const [text, setText] = useState(memo?.text ?? "");
  const [date, setDate] = useState(memo?.date ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const trimmed = text.trim();
    if (trimmed === "") {
      onClose(); // 빈 노트는 저장하지 않음
      return;
    }
    if (memo) await updateMemo(memo.id, trimmed, date);
    else await addMemo(trimmed, date);
    onClose();
  }

  return (
    <div className="memo-editor">
      <textarea
        className="memo-textarea"
        placeholder={"자유롭게 쓰세요.\n첫 줄이 목록에서 제목처럼 보여요."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        autoFocus
      />
      <div className="memo-editor-date">
        <label>
          날짜 (선택 — 붙이면 일정·달력에 표시)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {date && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setDate("")}
          >
            날짜 지우기
          </button>
        )}
      </div>
      <div className="edit-buttons">
        {memo &&
          (confirmDelete ? (
            <span className="danger-confirm">
              삭제할까요?
              <button
                className="delete"
                onClick={() => {
                  onDelete(memo);
                  onClose();
                }}
              >
                삭제
              </button>
              <button onClick={() => setConfirmDelete(false)}>취소</button>
            </span>
          ) : (
            <button
              className="delete memo-delete"
              onClick={() => setConfirmDelete(true)}
            >
              삭제
            </button>
          ))}
        <button onClick={handleSave}>저장</button>
        <button onClick={onClose}>취소</button>
      </div>
    </div>
  );
}
