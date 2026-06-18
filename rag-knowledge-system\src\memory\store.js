const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readKnownIds(memoryFile) {
  try {
    const raw = await fs.readFile(memoryFile, 'utf8');
    return new Set(raw.split(/\r?\n/).map((line) => {
      try {
        return JSON.parse(line).id;
      } catch {
        return null;
      }
    }).filter(Boolean));
  } catch {
    return new Set();
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function recordToMemoryText(record) {
  return [
    `Reddit prospect: ${record.title || 'Untitled'}`,
    `URL: ${record.url || 'none'}`,
    `Subreddit: ${record.subreddit || 'unknown'}`,
    `Pain: ${record.painType || 'unknown'}`,
    `AI employee: ${record.employee || 'unknown'}`,
    `Lead score: ${record.score ?? 'unknown'}`,
    `Body: ${record.body || ''}`,
    record.demandAnalysis ? `Demand analysis: ${typeof record.demandAnalysis === 'string' ? record.demandAnalysis : JSON.stringify(record.demandAnalysis)}` : '',
    record.aiStrategy ? `AI strategy: ${record.aiStrategy}` : '',
    record.aiAudit ? `AI audit: ${record.aiAudit}` : '',
    record.aiReply ? `AI reply: ${record.aiReply}` : ''
  ].filter(Boolean).join('\n');
}

async function appendMemory(memoryFile, item) {
  await ensureDir(path.dirname(memoryFile));
  const known = await readKnownIds(memoryFile);
  const id = item.id || hash(`${item.kind}:${item.text}:${item.createdAt || ''}`);
  if (known.has(id)) return { saved: false, id };
  const entry = {
    id,
    kind: item.kind || 'note',
    title: item.title || item.kind || 'Memory',
    createdAt: item.createdAt || new Date().toISOString(),
    text: item.text || ''
  };
  await fs.appendFile(memoryFile, `${JSON.stringify(entry)}\n`, 'utf8');
  return { saved: true, id };
}

module.exports = {
  appendMemory,
  recordToMemoryText
};
