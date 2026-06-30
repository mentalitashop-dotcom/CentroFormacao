const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Lê windows utilizador variable.
function readWindowsUserVariable(name) {
  if (process.platform !== 'win32') return '';
  try {
    const output = execFileSync('reg.exe', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    return output.match(new RegExp(`${name}\\s+REG_\\w+\\s+(.+)`))?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

module.exports = {
  port: Number(process.env.PORT || 2002),
  mongoUri: process.env.MONGODB_URI || readWindowsUserVariable('MONGODB_URI') || 'mongodb://127.0.0.1:27017',
  mongoDbName: process.env.MONGODB_DB_NAME || readWindowsUserVariable('MONGODB_DB_NAME') || 'clube_formacao',
  frontendOrigins: String(process.env.FRONTEND_ORIGINS || 'http://localhost:1312,http://localhost:1313')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};
