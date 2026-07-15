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
npm run dev
