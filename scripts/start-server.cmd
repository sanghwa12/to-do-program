@echo off
rem ============================================================
rem Todo app dev server auto-start (Windows startup)
rem - If the server is already running on port 5173, do nothing
rem - Otherwise start it in this window (launched hidden by the
rem   .vbs wrapper in the Startup folder)
rem ============================================================
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel%==0 exit /b

cd /d c:\Users\USER\dev\to-do-program
rem 정식 빌드본 서비스 (PWA 완성 모드, 2026-08-03) — 개발할 때만 npm run dev로 교체
npm run preview
