@echo off
echo Starting Sindhuja Finance Backend with PM2...
cd /d "d:\full system sindhuja fin\calloction cantroll"
npx pm2 start ecosystem.config.js
npx pm2 save
echo Backend started successfully!
