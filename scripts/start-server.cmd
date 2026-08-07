@echo off
rem ============================================================
rem Todo app server + supervisor (2026-08-06)
rem - Launched hidden at logon by todo-server-start.vbs
rem - If the server dies for any reason, restarts it 10s later, forever
rem - Exits immediately if another supervisor is already running (port busy)
rem ============================================================
set LOG=c:\Users\USER\dev\to-do-program\scripts\server.log

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [%date% %time%] already running - this instance exits >> "%LOG%"
  exit /b
)

cd /d c:\Users\USER\dev\to-do-program

:loop
echo [%date% %time%] starting server >> "%LOG%"
call npm run preview >> "%LOG%" 2>&1
echo [%date% %time%] server exited (code %errorlevel%) - restarting in 10s >> "%LOG%"
timeout /t 10 /nobreak >nul
goto loop
