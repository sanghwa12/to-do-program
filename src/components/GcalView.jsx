// ------------------------------------------------------------
// 구글 달력 설정 화면 (F12 R1): ⋯ 메뉴 → 📆 구글 달력
// ① 클라이언트 ID 입력·저장 ② 구글 연결 ③ 지금 보내기(다음 단계) ④ 상태 한 줄
// 클라이언트 ID는 이 브라우저의 IndexedDB(settings)에만 저장 — 코드·깃에 남지 않음
// ------------------------------------------------------------
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, setSetting } from "../db.js";
import { connectGoogle, currentToken } from "../gcal.js";

export default function GcalView({ onBack }) {
  // 저장된 클라이언트 ID (DB가 바뀌면 자동 갱신)
  const saved = useLiveQuery(() => db.settings.get("clientId"));
  const savedId = saved?.value ?? "";
  // 입력칸: null이면 저장값을 그대로 보여주고, 타이핑하면 그 내용을 보여줌
  const [draft, setDraft] = useState(null);
  const shownId = draft ?? savedId;

  // 연결 상태 — 출입증은 gcal.js가 메모리에 기억하므로 화면을 나갔다 와도 유지
  const [token, setToken] = useState(currentToken());
  const [message, setMessage] = useState(""); // 진행·오류 한 줄
  const [busy, setBusy] = useState(false); // 팝업 진행 중 (버튼 잠금)

  // 오프라인 감지 (R2): 인터넷이 없으면 연결 버튼 대신 안내
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function handleSave() {
    await setSetting("clientId", shownId.trim());
    setDraft(null);
    setMessage("클라이언트 ID를 저장했어요");
  }

  async function handleConnect() {
    setBusy(true);
    setMessage("구글 팝업을 여는 중…");
    try {
      setToken(await connectGoogle(savedId));
      setMessage("");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 출입증 만료 시각 "HH:MM"
  const until = token ? new Date(token.expiresAt).toTimeString().slice(0, 5) : "";

  return (
    <div className="gcal">
      <div className="trash-head">
        <button className="link-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="trash-title">📆 구글 달력</h2>
      </div>

      <section className="help-section">
        <h3>1. 클라이언트 ID</h3>
        <p className="gcal-desc">
          구글 클라우드에서 만든 ID (…apps.googleusercontent.com). 이 컴퓨터의
          브라우저 안에만 저장돼요.
        </p>
        <div className="gcal-row">
          <input
            className="notice-input"
            type="text"
            placeholder="클라이언트 ID 붙여넣기"
            value={shownId}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button onClick={handleSave} disabled={shownId.trim() === ""}>
            저장
          </button>
        </div>
      </section>

      <section className="help-section">
        <h3>2. 구글 연결</h3>
        {online ? (
          <div className="gcal-row">
            <button onClick={handleConnect} disabled={busy || !savedId}>
              {token ? "다시 연결" : "구글 연결"}
            </button>
            <span className="gcal-status">
              {token
                ? `연결됨 · ${until}까지 유효 (1시간짜리 출입증)`
                : savedId
                  ? "연결 안 됨"
                  : "먼저 클라이언트 ID를 저장하세요"}
            </span>
          </div>
        ) : (
          <p className="gcal-desc">오프라인 — 인터넷 연결 후 다시 시도하세요.</p>
        )}
        {message && <p className="gcal-msg">{message}</p>}
      </section>

      <section className="help-section">
        <h3>3. 보내기</h3>
        <div className="gcal-row">
          <button disabled title="다음 단계에서 만들 예정">
            지금 보내기
          </button>
          <span className="gcal-status">아직 보낸 적 없음 (다음 단계)</span>
        </div>
      </section>
    </div>
  );
}
