' Todo app dev server - auto start at logon (hidden window)
' 이 파일을 윈도우 "시작 프로그램" 폴더에 복사하면 컴퓨터 켜질 때 서버가 자동 시작됩니다.
' (Win+R → shell:startup → Enter 로 열리는 폴더)
' 해제하려면 그 폴더에서 이 파일을 지우면 됩니다.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """c:\Users\USER\dev\to-do-program\scripts\start-server.cmd""", 0, False
