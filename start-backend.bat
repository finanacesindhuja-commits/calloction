@echo off
echo Starting Sindhuja Finance Backend...
cd /d "d:\full system sindhuja fin\calloction cantroll\backend"
pm2 delete sindhuja-fin-backend 2>nul
pm2 start index.js --name sindhuja-fin-backend --instances 1
pm2 save
echo Backend started on port 5007
