@echo off
echo 🚀 Starting backend server...
echo 📍 Server will be available at: http://localhost:3000
echo 🔗 API endpoint: http://localhost:3000/api/trpc
echo.
echo To stop the server, press Ctrl+C
echo.

REM Start the backend server
bun run backend/hono.ts