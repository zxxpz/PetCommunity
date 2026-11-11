const { execSync } = require('child_process');
const out = execSync('netstat -ano', { encoding: 'utf8' });
const lines = out.split(/\r?\n/);
const line = lines.find((item) => item.includes(':3000') && item.includes('LISTENING'));
if (!line) {
  console.log('no listener');
  process.exit(0);
}
const parts = line.trim().split(/\s+/);
const pid = parts[parts.length - 1];
execSync(`taskkill /PID ${pid} /F`);
console.log(`stopped ${pid}`);
