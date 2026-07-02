// Vite 설정 파일 — 개발 서버와 빌드를 담당하는 도구의 설정입니다.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()], // React 코드를 이해할 수 있게 해주는 플러그인
});
