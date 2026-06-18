const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const LOCAL_RAG_ROOT = path.resolve(ROOT, '..', 'rag-knowledge-system');
const PACKAGED_RAG_ROOT = path.resolve(ROOT, 'rag-knowledge-system');
const RAG_ROOT = fs.existsSync(LOCAL_RAG_ROOT) ? LOCAL_RAG_ROOT : PACKAGED_RAG_ROOT;
const SOURCES_DIR = path.join(RAG_ROOT, 'data', 'sources');
const MEMORY_FILE = path.join(SOURCES_DIR, 'dashboard-memory.jsonl');
const { loadDocuments, searchDocuments } = require(path.join(RAG_ROOT, 'src', 'retrieval', 'local-search'));
const { appendMemory, recordToMemoryText } = require(path.join(RAG_ROOT, 'src', 'memory', 'store'));
const MAX_JSON_BYTES = 260 * 1024;
const AI_RATE_LIMIT = { windowMs: 60_000, max: 20 };
const rateBuckets = new Map();

loadEnv(path.resolve(ROOT, '.env'));
loadEnv(path.resolve(ROOT, '..', '.env'), {
  allowedKeys: ['GOOGLE_AI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_STUDIO_API_KEY', 'GEMINI_MODEL']
});

const PORT = Number(process.env.REDDIT_DASHBOARD_PORT || process.env.PORT || 5178);
const HOST = process.env.HOST || '127.0.0.1';

function loadEnv(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const allowedKeys = options.allowedKeys ? new Set(options.allowedKeys) : null;
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index < 1) return;
    const key = trimmed.slice(0, index).trim();
    if (allowedKeys && !allowedKeys.has(key)) return;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (options.override || !process.env[key]) process.env[key] = value;
  });
}

function aiKey() {
  return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_STUDIO_API_KEY || '';
}

function modelName() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
}

function modelCandidates() {
  return [...new Set([
    modelName(),
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
  ].filter(Boolean))];
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(text);
}

function isLocalHost(hostHeader) {
  const host = String(hostHeader || '').split(':')[0].toLowerCase();
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
}

function dashboardToken() {
  return process.env.DASHBOARD_ACCESS_TOKEN || process.env.ADMIN_TOKEN || '';
}

function requestToken(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(req.headers['x-dashboard-token'] || '').trim();
}

function requireApiAccess(req, res) {
  const token = dashboardToken();
  if (!token && isLocalHost(req.headers.host)) return true;
  if (!token) {
    sendJson(res, 503, { error: 'Dashboard access token is not configured.' });
    return false;
  }
  if (requestToken(req) === token) return true;
  sendJson(res, 401, { error: 'Dashboard access token required.' });
  return false;
}

function clientIp(req) {
  return req.socket.remoteAddress || 'local';
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = clientIp(req);
  const bucket = rateBuckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt > AI_RATE_LIMIT.windowMs) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= AI_RATE_LIMIT.max;
}

async function readJson(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (req.method !== 'GET' && contentType && !contentType.includes('application/json')) {
    const error = new Error('Content-Type must be application/json.');
    error.status = 415;
    throw error;
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function ragSearch(query, limit = 6) {
  const docs = await loadDocuments({
    sourcesDir: SOURCES_DIR,
    extraFiles: [
      path.join(ROOT, 'README.md'),
      path.join(ROOT, 'app.js'),
      path.join(ROOT, 'index.html')
    ]
  });
  return {
    documents: docs.length,
    results: searchDocuments(query, docs, limit)
  };
}

function sourcesText(results) {
  return results.map((item, index) => [
    `[${index + 1}] ${item.title}`,
    item.snippet
  ].join('\n')).join('\n\n');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function stringifyAiField(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.comment === 'string') return value.comment;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.markdown === 'string') return value.markdown;
  return JSON.stringify(value, null, 2);
}

function normalizeAiPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return {
    audit: stringifyAiField(data.audit),
    reply: stringifyAiField(data.reply),
    strategyNotes: stringifyAiField(data.strategyNotes),
    nextAction: stringifyAiField(data.nextAction),
    demandAnalysis: data.demandAnalysis && typeof data.demandAnalysis === 'object'
      ? data.demandAnalysis
      : { level: '', specificObservation: stringifyAiField(data.demandAnalysis) }
  };
}

async function callGemini(prompt, responseMimeType = 'text/plain') {
  const key = aiKey();
  if (!key) {
    const error = new Error('Google AI Studio API key is not configured.');
    error.status = 503;
    throw error;
  }

  let lastError = null;
  for (const candidate of modelCandidates()) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(key)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 1800,
            responseMimeType
          }
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error?.message || 'Gemini request failed.';
        const error = new Error(message);
        error.status = response.status;
        lastError = error;
        if ([404, 429, 500, 503].includes(response.status)) continue;
        throw error;
      }

      return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Gemini request failed.');
}

function auditPrompt(record, context) {
  return [
    'You are improving a local Reddit lead-finding dashboard for a marketing assignment.',
    'Return strict JSON only. No markdown fences.',
    'Required JSON keys: audit, reply, strategyNotes, nextAction, demandAnalysis.',
    'demandAnalysis must be an object with: level, painIntensity, buyerIntent, manualWorkEstimate, likelyBuyer, specificObservation, whyItMatters, offerAngle, signals, objections.',
    'Rules: do not auto-post, do not suggest spam, do not invent facts, keep the reply helpful-first and manually reviewable, keep CTA soft as [prototype link].',
    'The reply must be specific to the post. Mention concrete details from the title/body, infer the demand behind the post, and avoid generic phrases like "workflow bottleneck" unless explained with the actual situation.',
    'The reply should feel like a useful Reddit comment: 120-180 words, plain language, no hype, no fake personal story, no claim that you built something for them unless framed as a template.',
    'The audit must include a Demand Analysis section before the workflow map.',
    'The assignment target is 1,000 targeted visitors and 15 qualified inbound leads in 30 days with $100 and no ads.',
    '',
    'Relevant project memory:',
    context || 'No extra context found.',
    '',
    'Selected Reddit prospect:',
    JSON.stringify(record, null, 2)
  ].join('\n');
}

function chatPrompt(message, context, selectedRecord, records) {
  return [
    'You are the AI Strategy Coach inside a local Reddit Pain-to-AI Employee Lead Finder dashboard.',
    'Answer using the project memory and current dashboard records. Be concrete, concise, and operator-focused.',
    'Do not recommend auto-posting to Reddit or spam tactics. If the user asks for unsafe automation, offer a manual-review workflow.',
    '',
    'Project memory:',
    context || 'No extra context found.',
    '',
    'Selected record:',
    selectedRecord ? JSON.stringify(selectedRecord, null, 2) : 'None',
    '',
    'Recent records summary:',
    JSON.stringify((records || []).slice(0, 12).map((record) => ({
      title: record.title,
      subreddit: record.subreddit,
      painType: record.painType,
      employee: record.employee,
      score: record.score
    })), null, 2),
    '',
    `User question: ${message}`
  ].join('\n');
}

function factorsPrompt(context, selectedRecord, records) {
  return [
    'You are analyzing Reddit demand for a custom AI Employee lead-generation dashboard.',
    'Return strict JSON only. Required keys: summary, rankedFactors, bestOpportunities, redFlags, replyGuidance, nextActions.',
    'Analyze every useful factor: pain intensity, urgency, repetitive manual work, existing tool stack, team size, buyer authority, budget hints, subreddit fit, post specificity, likely objections, reply angle, and conversion likelihood.',
    'Do not recommend auto-posting, spam, fake accounts, or bulk Reddit automation.',
    'Make the analysis practical for choosing which Reddit posts to reply to first.',
    '',
    'Project memory:',
    context || 'No extra context found.',
    '',
    'Selected record:',
    selectedRecord ? JSON.stringify(selectedRecord, null, 2) : 'None',
    '',
    'All current dashboard records:',
    JSON.stringify((records || []).slice(0, 50), null, 2)
  ].join('\n');
}

async function handleApi(req, res, parsedUrl) {
  if (!requireApiAccess(req, res)) return;

  if (req.method === 'GET' && parsedUrl.pathname === '/api/status') {
    const docs = await loadDocuments({ sourcesDir: SOURCES_DIR });
    sendJson(res, 200, {
      localOnly: HOST === '127.0.0.1' || HOST === 'localhost',
      aiConfigured: Boolean(aiKey()),
      model: modelName(),
      fallbackModels: modelCandidates().slice(1),
      ragDocuments: docs.length,
      memoryPath: path.relative(path.resolve(ROOT, '..'), MEMORY_FILE).replace(/\\/g, '/')
    });
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/rag/search') {
    const query = parsedUrl.searchParams.get('q') || '';
    const result = await ragSearch(query);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/rag/upsert') {
    const body = await readJson(req);
    const records = Array.isArray(body.records) ? body.records : [body.record].filter(Boolean);
    const notes = Array.isArray(body.notes) ? body.notes : [];
    let saved = 0;

    for (const record of records) {
      const result = await appendMemory(MEMORY_FILE, {
        id: `record-${record.id || record.url || record.title}-${record.aiUpdatedAt || record.createdAt || ''}`,
        kind: 'dashboard_record',
        title: record.title || 'Dashboard record',
        text: recordToMemoryText(record)
      });
      if (result.saved) saved += 1;
    }

    for (const note of notes) {
      const result = await appendMemory(MEMORY_FILE, {
        kind: 'operator_note',
        title: note.title || 'Operator note',
        text: note.text || ''
      });
      if (result.saved) saved += 1;
    }

    sendJson(res, 200, { saved });
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/ai/audit') {
    if (!checkRateLimit(req)) {
      sendJson(res, 429, { error: 'AI rate limit reached. Try again in a minute.' });
      return;
    }
    const body = await readJson(req);
    const record = body.record || {};
    const query = `${record.title || ''} ${record.body || ''} ${record.painType || ''} ${record.employee || ''}`;
    const rag = await ragSearch(query);
    const text = await callGemini(auditPrompt(record, sourcesText(rag.results)), 'application/json');
    const parsed = normalizeAiPayload(safeJsonParse(text) || { audit: text });
    sendJson(res, 200, { ...parsed, sources: rag.results });
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/ai/chat') {
    if (!checkRateLimit(req)) {
      sendJson(res, 429, { error: 'AI rate limit reached. Try again in a minute.' });
      return;
    }
    const body = await readJson(req);
    const message = String(body.message || '').trim();
    if (!message) {
      sendJson(res, 400, { error: 'Message is required.' });
      return;
    }
    const rag = await ragSearch(`${message} ${body.selectedRecord?.title || ''} ${body.selectedRecord?.body || ''}`);
    const answer = await callGemini(chatPrompt(message, sourcesText(rag.results), body.selectedRecord, body.records), 'text/plain');
    await appendMemory(MEMORY_FILE, {
      kind: 'ai_coach_exchange',
      title: `AI coach: ${message.slice(0, 80)}`,
      text: `Question: ${message}\nAnswer: ${answer}`
    });
    sendJson(res, 200, { answer, sources: rag.results });
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/ai/factors') {
    if (!checkRateLimit(req)) {
      sendJson(res, 429, { error: 'AI rate limit reached. Try again in a minute.' });
      return;
    }
    const body = await readJson(req);
    const records = Array.isArray(body.records) ? body.records : [];
    const query = `${body.selectedRecord?.title || ''} ${records.map((record) => `${record.title || ''} ${record.body || ''}`).join(' ')}`;
    const rag = await ragSearch(query || 'Reddit demand analysis factors');
    const text = await callGemini(factorsPrompt(sourcesText(rag.results), body.selectedRecord, records), 'application/json');
    const parsed = safeJsonParse(text) || { summary: text };
    await appendMemory(MEMORY_FILE, {
      kind: 'factor_analysis',
      title: 'AI factor analysis',
      text: stringifyAiField(parsed.summary || text)
    });
    sendJson(res, 200, { analysis: parsed, sources: rag.results });
    return;
  }

  sendJson(res, 404, { error: 'API route not found.' });
}

async function serveStatic(req, res, parsedUrl) {
  const cleanPath = decodeURIComponent(parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname);
  const target = path.normalize(path.join(ROOT, cleanPath));
  const relativeTarget = path.relative(ROOT, target);
  const relativeParts = relativeTarget.split(path.sep).filter(Boolean);
  const blockedNames = new Set([
    '.env',
    '.env.example',
    '.gitignore',
    'server.js',
    'vercel.json',
    'package.json',
    'package-lock.json'
  ]);
  const blockedFolders = new Set(['.git', '.vercel', 'node_modules', 'rag-knowledge-system']);
  if (
    relativeTarget.startsWith('..') ||
    path.isAbsolute(relativeTarget) ||
    relativeParts.some((part) => part.startsWith('.')) ||
    relativeParts.some((part) => blockedFolders.has(part)) ||
    blockedNames.has(path.basename(target))
  ) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fsp.stat(target);
    const filePath = stat.isDirectory() ? path.join(target, 'index.html') : target;
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };
    const content = await fsp.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    });
    res.end(content);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

async function appHandler(req, res) {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname.startsWith('/api/')) {
      await handleApi(req, res, parsedUrl);
      return;
    }
    await serveStatic(req, res, parsedUrl);
  } catch (error) {
    const status = error.status && Number(error.status) >= 400 ? Number(error.status) : 500;
    sendJson(res, status, { error: status === 500 ? 'Local server error.' : error.message });
  }
}

const server = http.createServer(appHandler);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Reddit AI dashboard running at http://${HOST}:${PORT}`);
    console.log(`Gemini configured: ${aiKey() ? 'yes' : 'no'} (${modelName()})`);
  });
}

module.exports = appHandler;
module.exports.appHandler = appHandler;
