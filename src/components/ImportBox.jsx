// ------------------------------------------------------------
// 여러 줄 가져오기 (F02 R12)
// 텍스트를 붙여넣으면 줄마다 할 일로 변환해 한 번에 저장.
// 넣기 전에 "N개 추가됩니다" 미리보기를 보여줌.
// ------------------------------------------------------------
import { useState } from "react";
import { addManyTasks } from "../db.js";
import { parseImport } from "../parse.js";

export default function ImportBox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const drafts = parseImport(text); // 지금 붙여넣은 내용의 변환 결과 (미리보기)

  async function handleImport() {
    if (drafts.length === 0) return;
    const n = await addManyTasks(drafts);
    alert(`${n}개의 할 일을 추가했어요.`);
    setText("");
    setOpen(false);
  }

  // 닫혀 있을 때는 여는 버튼만
  if (!open) {
    return (
      <button className="import-toggle" onClick={() => setOpen(true)}>
        가져오기
      </button>
    );
  }

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
            setOpen(false);
            setText("");
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
