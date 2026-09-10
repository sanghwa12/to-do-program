// ============================================================
// F12 · 구글 캘린더로 보내기 — 구글 연결 부분 (R2)
// ------------------------------------------------------------
// 브라우저가 구글에서 "1시간짜리 임시 출입증"(액세스 토큰)을 팝업으로 받아 옵니다.
// 우리 서버는 없습니다. 구글의 로그인 라이브러리(GIS)는 버튼을 누를 때 불러옵니다
// (정적 <script> 태그 ❌ — 오프라인 설치형 앱에서 페이지가 깨지지 않게).
// 출입증은 저장하지 않고 메모리에만 둡니다 (앱을 끄면 사라짐 → 다시 "구글 연결").
// ============================================================

// 권한 범위: "앱이 만든 달력만" — 기본 달력엔 손댈 수 없음 (기획서 핵심 결정)
const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const GIS_URL = "https://accounts.google.com/gsi/client";

// 메모리에만 두는 출입증: { accessToken, expiresAt(ms) } — 없으면 null
let token = null;

/** 지금 유효한 출입증 (만료 1분 전부터는 없는 것으로 침). 없으면 null */
export function currentToken() {
  if (token && Date.now() < token.expiresAt - 60_000) return token;
  return null;
}

/** 구글 로그인 라이브러리를 그때 불러옴 — 이미 있으면 바로 완료 */
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_URL;
    s.async = true;
    s.onload = resolve;
    s.onerror = () =>
      reject(new Error("구글 로그인 라이브러리를 불러오지 못했어요 (인터넷 연결 확인)"));
    document.head.append(s);
  });
}

/** "구글 연결": 팝업으로 출입증을 받아 메모리에 보관하고 돌려줌 */
export async function connectGoogle(clientId) {
  await loadGis();
  const resp = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.error ? reject(new Error(describe(r))) : resolve(r)),
      error_callback: (e) => reject(new Error(describe(e))),
    });
    client.requestAccessToken();
  });
  // 만료 시각은 응답의 expires_in(초)으로 계산 — 3600 고정 ❌ (R2)
  token = {
    accessToken: resp.access_token,
    expiresAt: Date.now() + Number(resp.expires_in) * 1000,
  };
  return token;
}

/** 구글이 주는 오류 코드를 사람 말로 */
function describe(e) {
  const code = e?.type ?? e?.error ?? "";
  if (code === "popup_closed") return "팝업을 닫았어요 — 다시 시도하세요";
  if (code === "popup_failed_to_open")
    return "팝업이 열리지 않았어요 (설치형 앱 창의 제한일 수 있음 — 브라우저 탭에서 시도해 보세요)";
  if (code === "access_denied") return "권한을 허용하지 않았어요";
  return `구글 오류: ${code || e?.message || "알 수 없음"}`;
}
