@echo off
rem Executa o backup. Agende no "Agendador de Tarefas" do Windows (veja LEIAME.md).
cd /d "%~dp0"
node backup.mjs >> backup.log 2>&1
