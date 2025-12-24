@echo off
title Maestro MIDI Bridge Server
color 0b
echo ========================================
echo   Maestro MIDI Bridge Server 启动中...
echo ========================================
echo.

:: 检查是否存在 exe
if not exist "Maestro-Bridge.exe" (
    echo [错误] 找不到 Maestro-Bridge.exe 文件！
    echo 请确保该 .bat 文件与 .exe 放在同一个文件夹下。
    pause
    exit /b
)

:: 启动程序
Maestro-Bridge.exe

echo.
echo ========================================
echo   服务已停止。
echo ========================================
pause
