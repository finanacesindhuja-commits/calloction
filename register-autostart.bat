@echo off
:: Run this once as Administrator to register auto-start
schtasks /create /tn "SindhujaFinanceBackend" /tr "\"d:\full system sindhuja fin\calloction cantroll\start-backend.bat\"" /sc onlogon /rl highest /f
echo Done! Backend will auto-start on login.
pause
