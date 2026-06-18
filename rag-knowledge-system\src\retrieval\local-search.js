const fs = require('fs/promises');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.jsonl']);
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'you', 'your', 'are',
  'was', 'were', 'will', 'can', 'has', 'have', 'into', 'only', 'not', 'but',
  'all', 'any', 'one', 'two', 'how', 'why', 'what', 'when', 'where', 'then'
]);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  }));
  return nested.flat();
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{1,}/g)?.filter((token) => !STOP_WORDS.has(token)) || [];
}

function titleFromFile(filePath, content) {
  const heading = String(content || '').match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return path.basename(filePath);
}

function jsonLineToDocument(filePath, line, index) {
  try {
    const item = JSON.parse(line);
    const text = item.text || JSON.stringify(item.payload || item);
    return {
      id: item.id || `${filePath}:${index}`,
      title: item.title || item.kind || `Memory ${index + 1}`,
      source: filePath,
      createdAt: item.createdAt,
      text
    };
  } catch {
    return {
      id: `${filePath}:${index}`,
      title: `Memory ${index + 1}`,
      source: filePath,
      text: line
    };
  }
}

async function loadDocuments(options = {}) {
  const sourcesDir = options.sourcesDir;
  const extraFiles = options.extraFiles || [];
  const files = [...await listFiles(sourcesDir), ...extraFiles];
  const docs = [];

  for (const filePath of files) {
    if (!(await exists(filePath))) continue;
    const raw = await fs.readFile(filePath, 'utf8');
    if (path.extname(filePath).toLowerCase() === '.jsonl') {
      raw.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line, index) => docs.push(jsonLineToDocument(filePath, line, index)));
      continue;
    }
    docs.push({
      id: filePath,
      title: titleFromFile(filePath, raw),
      source: filePath,
      text: raw
    });
  }

  return docs.map((doc) => ({ ...doc, tokens: tokenize(`${doc.title} ${doc.text}`) }));
}

function makeSnippet(text, queryTokens) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (source.length <= 420) return source;
  const lower = source.toLowerCase();
  const firstHit = queryTokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0).sort((a, b) => a - b)[0] || 0;
  const start = Math.max(0, firstHit - 120);
  const end = Math.min(source.length, start + 420);
  return `${start > 0 ? '...' : ''}${source.slice(start, end)}${end < source.length ? '...' : ''}`;
}

function searchDocuments(query, docs, limit = 6) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];
  const querySet = new Set(queryTokens);

  return docs.map((doc) => {
    let score = 0;
    for (const token of doc.tokens) {
      if (querySet.has(token)) score += 1;
    }
    if (String(doc.title).toLowerCase().includes(String(query).toLowerCase())) score += 5;
    return { doc, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      score,
      snippet: makeSnippet(doc.text, queryTokens)
    }));
}

module.exports = {
  loadDocuments,
  searchDocuments,
  tokenize
};
