@echo off
cd /d "%~dp0.."
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload
