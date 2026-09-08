@echo off
setlocal
cd /d C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

echo.
echo [1/4] Client typecheck
call npm.cmd run typecheck
if errorlevel 1 exit /b %errorlevel%

echo.
echo [2/4] Server typecheck
call npm.cmd --prefix server run typecheck
if errorlevel 1 exit /b %errorlevel%

echo.
echo [3/4] Pure logic smoke tests
call npm.cmd --prefix server run logic
if errorlevel 1 exit /b %errorlevel%

echo.
echo [4/4] Git whitespace/conflict check
git diff --check
if errorlevel 1 exit /b %errorlevel%

echo.
echo Final verification passed.
echo.
git status --short
endlocal
