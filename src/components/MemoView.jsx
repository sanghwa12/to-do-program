// ------------------------------------------------------------
// 메모장 (F11): 여러 줄 자유 글 — 회의 기록, 초안, 생각 정리
// 목록(첫 줄 = 제목) ↔ 편집기(textarea) 두 화면
// ------------------------------------------------------------
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addMemo, updateMemo } from "../db.js";
import { dateOnly } from "../date.js";

export default function MemoView({ onDelete }) {
  // null = 목록 보기, "new" = 새 메모 작성, 그 외 = 그 id의 메모 편집
  const [openId, setOpenId] = useState(null);

  // 최근 수정한 것이 위로 (R2)
  const memos = useLiveQuery(() =>
    db.memos.orderBy("updatedAt").reverse().toArray()
  );

  if (openId !== null) {
    const memo =
      openId === "new" ? null : (memos ?? []).find((m) => m.id === openId);
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
      <button className="memo-new" onClick={() => setOpenId("new")}>
        + 새 메모
      </button>
      {memos === undefined ? (
        <p className="hint">불러오는 중...</p>
      ) : memos.length === 0 ? (
        <p className="hint">메모가 없어요. "+ 새 메모"로 시작하세요.</p>
      ) : (
        <ul className="memo-list">
          {memos.map((m) => {
            const [first, ...rest] = m.text.split("\n");
            const preview = rest.join(" ").trim();
            return (
              <li key={m.id}>
                <button className="memo-card" onClick={() => setOpenId(m.id)}>
                  <span className="memo-title">{first || "(빈 메모)"}</span>
                  {preview && <span className="memo-preview">{preview}</span>}
                  <span className="memo-date">{dateOnly(m.updatedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// 메모 편집기: 새 메모(memo=null) 또는 기존 메모 수정
function MemoEditor({ memo, onClose, onDelete }) {
  const [text, setText] = useState(memo?.text ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const trimmed = text.trim();
    if (trimmed === "") {
      onClose(); // 빈 메모는 저장하지 않음
      return;
    }
    if (memo) await updateMemo(memo.id, trimmed);
    else await addMemo(trimmed);
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
