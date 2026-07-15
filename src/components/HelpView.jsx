// ------------------------------------------------------------
// 도움말 (F10): 앱 안에서 보는 간단 매뉴얼
// ⚠️ 기능이 바뀌면 이 내용도 같이 고칠 것 (spec-check 대상, R2)
// ------------------------------------------------------------

export default function HelpView({ onBack }) {
  return (
    <div className="help">
      <div className="trash-head">
        <button className="link-btn" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="trash-title">도움말</h2>
      </div>

      <section className="help-section">
        <h3>⚡ 빠른 입력 — 한 줄 쓰고 Enter</h3>
        <p>제목만 쳐도 등록돼요. 날짜·분류는 나중에 붙여도 됩니다.</p>
        <ul>
          <li>
            <b>날짜 표기</b>: <code>~7/2</code> 그날까지 마감 ·{" "}
            <code>7/7</code> 그날 당일(문장 끝에) · <code>11/11~11/23</code>{" "}
            기간 · <code>~내일</code> <code>~모레</code> <code>~금요일</code>
          </li>
          <li>
            <b>반복</b>: <code>매일</code> · <code>매주 월요일</code> ·{" "}
            <code>매달 25일</code> · <code>매년 7/21</code> ·{" "}
            <code>매월 첫째주 월요일</code> · <code>주중</code>(월~금)
          </li>
          <li>
            <b>📅 버튼</b>: 표기 없이 달력에서 날짜 고르기 (마감으로 등록)
          </li>
          <li>입력 아래 미리보기로 어떻게 저장될지 미리 확인돼요</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>📋 목록에서</h3>
        <ul>
          <li>
            <b>제목 앞 ○ 클릭</b> = 중요도 순환: 🔴높음 → 🟠중간 → 🟢낮음 →
            없음
          </li>
          <li>
            <b>체크</b> = 완료 — 아래 알림에서 <b>실행취소</b> 가능
          </li>
          <li>
            <b>반복 할 일 체크</b> = 완료 기록이 남고 날짜가 다음 회차로 넘어감
            (체크 표시가 안 남는 게 정상)
          </li>
          <li>
            항목에 <b>마우스를 올리면</b> 수정/삭제 버튼 — 삭제는 휴지통으로
            (⋯ 메뉴에서 복원)
          </li>
          <li>
            수정 화면의 <b>반복</b> 메뉴는 그 할 일 날짜 기준의 선택지
            (매주 ○요일, 매월 ○일...) — 다른 규칙은 "사용자화…"
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>🗂 탭</h3>
        <ul>
          <li>
            <b>오늘</b>: 위 📌알아둘 것 → 오늘 마감·밀린 할 일 → 아래 노란
            메모판(날짜 없는 할 일 전부)
          </li>
          <li>
            <b>하루</b>: 오늘의 계획(자유 작성·달성 체크) vs 실제 한 일(완료
            자동 수집 + 수기) + 한 줄 회고
          </li>
          <li>
            <b>달력</b>: 월간 보기 — 날짜 칸 클릭하면 그날 할 일·공지가 아래에
          </li>
          <li>
            <b>전체</b>: 급한 순 (밀림 → 마감 가까운 순 → 중요도), 완료는 맨
            아래
          </li>
          <li>
            <b>카테고리</b>: 칩(#업무 등)으로 골라 보기 · "N개 모두 삭제"도
            여기서
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>📌 알아둘 것 (오늘 탭 맨 위)</h3>
        <ul>
          <li>
            <b>날짜를 쓰면</b> 📢 일정 공지 (지나면 흐려짐 · 달력에도 표시),{" "}
            <b>안 쓰면</b> 📎 참고 (낡지 않는 지식)
          </li>
          <li>
            참고에는 수정에서 <b>내용(설명)</b>을 붙일 수 있어요 — 예: 제목
            "외부 강연 등록" + 내용 "윤리센터 사이트에서"
          </li>
        </ul>
      </section>

      <section className="help-section">
        <h3>💾 백업과 데이터 (⋯ 메뉴)</h3>
        <ul>
          <li>
            <b>내보내기</b>: 전체를 .md 파일로 다운로드 (Obsidian 호환) —{" "}
            <b>가끔 눌러서 백업해두세요!</b>
          </li>
          <li>
            <b>가져오기</b>: 여러 줄 붙여넣기 — 줄마다 할 일이 되고,{" "}
            <code>- [x]</code>는 완료로, <code>#태그</code>는 카테고리로. 이미
            있는 항목은 건너뜀
          </li>
          <li>
            데이터는 <b>이 컴퓨터의 브라우저 안</b>(IndexedDB)에만 저장돼요 —
            서버 없음, 인터넷 불필요. 대신 브라우저 데이터를 지우면 사라지니
            백업이 안전장치예요
          </li>
        </ul>
      </section>
    </div>
  );
}
