@echo off
title WoW-Discord-Bot-Checker
set SERVER_INSTALL_LOCATION=%~dp0



:CheckStatus

tasklist | findstr -i node.exe
::echo %errorlevel%
if %errorlevel% EQU 0 goto end1
	CLS
	cd "%SERVER_INSTALL_LOCATION%"
	start Start-DiscordBot.bat
	echo WoW Discord Bot server starting.
	timeout /t 5
:end1
CLS
echo Running
echo Time to force restart.
timeout /t 3600

::taskkill /f /im node.exe

taskkill /FI "WINDOWTITLE eq npm start"

goto CheckStatus