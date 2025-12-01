@echo off
echo Starting all services...

start cmd /k "cd node2-auth && node server.js"
timeout /t 2 /nobreak >nul

start cmd /k "cd node3-courses && node server.js"
timeout /t 2 /nobreak >nul

start cmd /k "cd node4-grades && node server.js"
timeout /t 2 /nobreak >nul

start cmd /k "cd node1-frontend && node server.js"

echo All services started!
echo Access the application at: http://localhost:3000
pause