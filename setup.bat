@echo off
echo Setting up Distributed Enrollment System...

echo Directory structure created

cd node1-frontend
call npm init -y
call npm install express ejs axios cookie-parser

cd ..\node2-auth
call npm init -y
call npm install express jsonwebtoken bcryptjs sqlite3 cors

cd ..\node3-courses
call npm init -y
call npm install express sqlite3 cors

cd ..\node4-grades
call npm init -y
call npm install express sqlite3 cors

cd ..

echo Setup complete!
pause