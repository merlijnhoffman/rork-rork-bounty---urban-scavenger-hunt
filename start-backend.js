#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting backend server...');

// Start the backend server
const backend = spawn('bun', ['run', 'backend/hono.ts'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

backend.on('error', (error) => {
  console.error('❌ Failed to start backend server:', error.message);
  console.log('\n💡 Try running manually:');
  console.log('   bun run backend/hono.ts');
  process.exit(1);
});

backend.on('close', (code) => {
  console.log(`Backend server exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  backend.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill('SIGTERM');
  process.exit(0);
});