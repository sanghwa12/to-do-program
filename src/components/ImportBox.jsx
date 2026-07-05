// ------------------------------------------------------------
// 여러 줄 가져오기 (F02 R12)
// 텍스트를 붙여넣으면 줄마다 할 일로 변환해 한 번에 저장.
// 넣기 전에 "N개 추가됩니다" 미리보기를 보여줌.
// ------------------------------------------------------------
import { useState } from "react";
import { db, addManyTasks } from "../db.js";
import { parseImport } from "../parse.js";

// open / onClose를 부모(App)가 제어 — 상단 "⋯ 메뉴 > 가져오기"에서 엶
export default function ImportBox({ open, onClose }) {
  const [text, setText] = useState("");

  const drafts = parseImport(text); // 지금 붙여넣은 내용의 변환 결과 (미리보기)

  async function handleImport() {
    if (drafts.length === 0) return;
    // 같은 "제목+완료상태"가 이미 목록(휴지통 제외)에 있으면 건너뜀
    // — 같은 파일 이중 가져오기 사고 방지 (R12).
    // 완료상태까지 비교하는 이유: 반복 할 일은 같은 제목의 완료 기록이 정상적으로
    // 여러 개 생기므로, 제목만 비교하면 활성 할 일 복원까지 막혀버림 (F09)
    const existing = await db.tasks.filter((t) => !t.deletedAt).toArray();
    const keyOf = (t) => (t.done ? "1|" : "0|") + t.title;
    const titles = new Set(existing.map(keyOf));
    const fresh = drafts.filter((d) => !titles.has(keyOf(d)));
    const skipped = drafts.length - fresh.length;
    if (fresh.length > 0) await addManyTasks(fresh);
    alert(
      skipped > 0
        ? `${fresh.length}개 추가했어요. ${skipped}개는 같은 제목이 이미 있어 건너뛰었어요.`
        : `${fresh.length}개의 할 일을 추가했어요.`
    );
    setText("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="import-box">
      <textarea
        className="import-textarea"
        placeholder={
          "여러 줄을 붙여넣으세요. 줄마다 할 일이 됩니다.\n" +
          "예) 도서 반납 ~7/2 #개인\n" +
          "- [x] 등록금 납부 #학사   (완료로 넣기)"
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        autoFocus
      />
      <div className="import-actions">
        <span className="import-count">{drafts.length}개 추가됩니다</span>
        <button onClick={handleImport} disabled={drafts.length === 0}>
          가져오기
        </button>
        <button
          onClick={() => {
            setText("");
            onClose();
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
