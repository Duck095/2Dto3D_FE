import { readFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) process.exit(0);

let lines;
try {
  lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
} catch {
  process.exit(0);
}

const relevant = lines.filter(line => /\b(ERROR|Exception|FAILED|failure|Caused by)\b/i.test(line)).slice(-25);
for (const line of relevant) {
  if (/password|secret|token|authorization|cookie|api[_-]?key/i.test(line)) {
    console.error('[redacted sensitive backend log line]');
    continue;
  }
  const safeLine = line
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
  console.error(safeLine.slice(0, 500));
}
