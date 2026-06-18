const STORAGE_KEY = 'reddit-ai-audit-engine-v1';
const ACCESS_TOKEN_KEY = 'reddit-ai-dashboard-access-token';
const SERVER_MODE = window.location.protocol !== 'file:';

const keywords = [
  'too many support tickets',
  'customer support overwhelming',
  'answering same questions',
  'slow follow up',
  'leads not converting',
  'manual data entry',
  'screening candidates takes too long',
  'market research takes forever',
  'repetitive task',
  'how do I automate',
  'workflow bottleneck',
  'small business overwhelmed'
];

const subreddits = [
  'smallbusiness',
  'Entrepreneur',
  'startups',
  'SaaS',
  'sales',
  'CustomerSuccess',
  'recruiting',
  'humanresources',
  'shopify',
  'ecommerce',
  'agency',
  'nocode',
  'Automation'
];

const painRules = [
  {
    type: 'Support',
    employee: 'AI Support Agent',
    keywords: ['support', 'ticket', 'tickets', 'customer', 'faq', 'email', 'reply', 'inbox', 'questions', 'chat'],
    workflow: ['Intake customer message', 'Classify intent and urgency', 'Draft answer from approved knowledge', 'Score confidence', 'Send to human approval', 'Escalate edge cases'],
    benefit: 'faster first response and fewer repetitive manual replies'
  },
  {
    type: 'Sales',
    employee: 'AI SDR',
    keywords: ['lead', 'leads', 'follow up', 'sales', 'crm', 'prospect', 'demo', 'pipeline', 'qualification', 'outreach'],
    workflow: ['Capture inbound lead', 'Score fit and urgency', 'Draft personalized reply', 'Create CRM note', 'Schedule follow-up', 'Alert salesperson for hot leads'],
    benefit: 'faster lead response and cleaner CRM hygiene'
  },
  {
    type: 'Recruiting',
    employee: 'AI Recruiter',
    keywords: ['hiring', 'recruit', 'candidate', 'resume', 'interview', 'screening', 'shortlist', 'applicants', 'job'],
    workflow: ['Parse applications', 'Match against role criteria', 'Summarize candidate strengths', 'Create shortlist', 'Draft interview notes', 'Schedule human review'],
    benefit: 'less manual screening and a faster shortlist'
  },
  {
    type: 'Research',
    employee: 'AI Research Assistant',
    keywords: ['research', 'competitor', 'market', 'analysis', 'scrape', 'data', 'report', 'manual research', 'find information'],
    workflow: ['Collect target sources', 'Extract useful facts', 'Summarize findings', 'Cite source links', 'Create decision brief', 'Refresh weekly'],
    benefit: 'faster research cycles with repeatable briefs'
  },
  {
    type: 'Operations',
    employee: 'AI Workflow Automator',
    keywords: ['admin', 'manual', 'spreadsheet', 'data entry', 'operations', 'process', 'workflow', 'automate', 'repetitive', 'zapier'],
    workflow: ['Receive task trigger', 'Normalize input', 'Route to correct system', 'Draft/update records', 'Check for missing fields', 'Send exception queue to human'],
    benefit: 'less low-value admin work and fewer dropped tasks'
  }
];

let records = [];
let selectedRecordId = null;
let toastTimer = null;
let serverStatus = {
  online: false,
  aiConfigured: false,
  ragDocuments: 0,
  model: '',
  memoryPath: ''
};

const $ = (id) => document.getElementById(id);

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function normalizeSubreddit(value) {
  return String(value || '').replace(/^r\//i, '').replace(/[^a-z0-9_]/gi, '').trim();
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    records,
    checklist: getChecklist()
  }));
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    records = Array.isArray(data.records) ? data.records : [];
    Object.entries(data.checklist || {}).forEach(([key, checked]) => {
      const box = document.querySelector(`[data-check="${key}"]`);
      if (box) box.checked = Boolean(checked);
    });
  } catch {
    records = [];
  }
}

function getChecklist() {
  const result = {};
  document.querySelectorAll('[data-check]').forEach((box) => {
    result[box.dataset.check] = box.checked;
  });
  return result;
}

function detectPain(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  const scored = painRules.map((rule) => {
    const matches = rule.keywords.filter((keyword) => text.includes(keyword));
    return { ...rule, score: matches.length, matches };
  }).sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0] : painRules[4];
}

function leadScore({ website, teamSize, hours, urgency, title, body }) {
  let score = 0;
  const text = `${title} ${body}`.toLowerCase();
  if (website) score += 2;
  if (Number(teamSize) >= 3) score += 2;
  if (Number(hours) >= 5) score += 3;
  if (Number(hours) >= 12) score += 1;
  if (urgency === 'now') score += 4;
  if (urgency === 'soon') score += 2;
  if (/hubspot|salesforce|zendesk|intercom|shopify|notion|airtable|slack|crm|helpdesk/.test(text)) score += 2;
  if (/urgent|asap|drowning|overwhelmed|too much|can't keep up|losing|late|slow/.test(text)) score += 3;
  return Math.min(score, 16);
}

function scoreLabel(score) {
  if (score >= 13) return 'High intent';
  if (score >= 9) return 'Qualified';
  if (score >= 5) return 'Warm';
  return 'Low';
}

function statusClass(score) {
  if (score >= 13) return 'hot';
  if (score >= 9) return '';
  if (score >= 5) return 'warn';
  return 'warn';
}

function estimateHours(hours) {
  const weekly = Number(hours) || 6;
  const low = Math.max(1, Math.round(weekly * 0.35));
  const high = Math.max(low + 1, Math.round(weekly * 0.6));
  return `${low}-${high} hours/week`;
}

function compactText(value, limit = 150) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trim()}...`;
}

function demandLevel(record) {
  if (record.demandAnalysis?.level) return record.demandAnalysis.level;
  if (record.score >= 13) return 'High';
  if (record.score >= 9) return 'Qualified';
  if (record.score >= 5) return 'Emerging';
  return 'Low';
}

function demandSignals(record) {
  if (Array.isArray(record.demandAnalysis?.signals) && record.demandAnalysis.signals.length) {
    return record.demandAnalysis.signals.slice(0, 3);
  }
  const text = `${record.title || ''} ${record.body || ''}`.toLowerCase();
  const signals = [];
  if (/urgent|asap|drowning|overwhelmed|can't keep up|late|slow/.test(text)) signals.push('urgent language');
  if (/hubspot|salesforce|zendesk|intercom|shopify|notion|airtable|slack|crm|helpdesk/.test(text)) signals.push('existing business tools');
  if (Number(record.hours) >= 5) signals.push(`${record.hours} manual hours/week`);
  if (Number(record.teamSize) >= 3) signals.push(`team size ${record.teamSize}`);
  return signals.length ? signals : ['manual repetitive work'];
}

function specificObservation(record) {
  if (record.demandAnalysis?.specificObservation) return record.demandAnalysis.specificObservation;
  const title = compactText(record.title || '', 90);
  const body = compactText(record.body || '', 160);
  if (title && body) return `${title} - ${body}`;
  return title || body || `${record.painType} problem`;
}

function demandSummary(record) {
  const analysis = record.demandAnalysis;
  if (analysis && typeof analysis === 'object') {
    return [
      `Demand level: ${analysis.level || demandLevel(record)}`,
      analysis.painIntensity ? `Pain intensity: ${analysis.painIntensity}` : '',
      analysis.buyerIntent ? `Buyer intent: ${analysis.buyerIntent}` : '',
      analysis.likelyBuyer ? `Likely buyer: ${analysis.likelyBuyer}` : '',
      analysis.whyItMatters ? `Why it matters: ${analysis.whyItMatters}` : '',
      Array.isArray(analysis.signals) && analysis.signals.length ? `Signals: ${analysis.signals.join(', ')}` : ''
    ].filter(Boolean).join('\n');
  }
  return [
    `Demand level: ${demandLevel(record)}`,
    `Specific observation: ${specificObservation(record)}`,
    `Signals: ${demandSignals(record).join(', ')}`
  ].join('\n');
}

function buildAudit(record) {
  if (record.aiAudit) return record.aiAudit;
  const firstLine = record.title || 'Observed Reddit pain conversation';
  return [
    `AI Employee Audit`,
    ``,
    `Source: r/${record.subreddit || 'unknown'}${record.url ? ` (${record.url})` : ''}`,
    `Pain detected: ${record.painType}`,
    `Recommended AI employee: ${record.employee}`,
    `Lead score: ${record.score}/16 (${scoreLabel(record.score)})`,
    ``,
    `Problem summary`,
    `${firstLine}`,
    ``,
    `Demand analysis`,
    demandSummary(record),
    ``,
    `Workflow map`,
    record.workflow.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    ``,
    `Expected business value`,
    `This should create ${record.benefit}. Estimated recoverable time: ${estimateHours(record.hours)}.`,
    ``,
    `First safe version`,
    `Do not fully automate final decisions on day one. Start with draft mode, human approval, confidence scoring, and an exception queue.`,
    ``,
    `Suggested stack under $100`,
    `Reddit Search / Reddit Pro Trends, Google Sheets, ChatGPT/Claude, Tally, Carrd or Notion, Loom. Optional: Apify for collection and n8n/Make for workflow proof.`,
    ``,
    `Conversion CTA`,
    `Get your custom AI Employee blueprint: [prototype link]`
  ].join('\n');
}

function buildReply(record) {
  if (record.aiReply) return record.aiReply;
  const workflow = record.workflow.slice(0, 5).join(' -> ');
  const observation = specificObservation(record);
  const signals = demandSignals(record).join(', ');
  const offerAngle = record.demandAnalysis?.offerAngle || `test an ${record.employee} on the narrow repetitive part before changing the whole process`;
  return [
    `The demand signal I see here is specific: ${compactText(observation, 180)}`,
    ``,
    `I would map the first version as: ${workflow}.`,
    ``,
    `Because the signals are ${signals}, I would avoid a broad automation project at first. The safer test is to ${offerAngle}.`,
    ``,
    `For this case, I would test an ${record.employee} because the pain looks like ${record.painType.toLowerCase()} demand. I made a small AI Employee audit template for this kind of workflow here: [prototype link]`
  ].join('\n');
}

function createRecord(input) {
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  const url = String(input.url || '').trim();
  const website = String(input.website || '').trim();
  const teamSize = Number(input.teamSize) || 0;
  const hours = Number(input.hours) || 0;
  const urgency = input.urgency || 'soon';
  const pain = detectPain(title, body);
  const subreddit = normalizeSubreddit(input.subreddit || inferSubreddit(url));
  const score = leadScore({
    website,
    teamSize,
    hours,
    urgency,
    title,
    body
  });
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    url,
    subreddit,
    title,
    body,
    website,
    teamSize,
    hours,
    urgency,
    painType: pain.type,
    employee: pain.employee,
    workflow: pain.workflow,
    benefit: pain.benefit,
    matches: pain.matches || [],
    score
  };
}

function currentFormData() {
  return createRecord({
    url: $('urlInput').value,
    subreddit: $('subredditInput').value,
    title: $('titleInput').value,
    body: $('bodyInput').value,
    website: $('websiteInput').value,
    teamSize: $('teamInput').value,
    hours: $('hoursInput').value,
    urgency: $('urgencyInput').value
  });
}

function inferSubreddit(url) {
  const match = String(url || '').match(/reddit\.com\/r\/([^/]+)/i);
  return match ? match[1] : '';
}

async function analyze() {
  const record = currentFormData();
  if (!record.title && !record.body) {
    toast('Add a post title or body first');
    return;
  }
  records.unshift(record);
  selectedRecordId = record.id;
  render();
  clearForm();
  save();
  syncRecordsToRag([record]);
  toast('Audit generated and added to dataset');
  await enhanceRecordsWithAi([record], { source: 'single' });
}

function splitLines(id) {
  return $(id).value.split(/\r?\n/).map((line) => line.trim());
}

function clearBatch() {
  ['batchUrls','batchSubreddits','batchTitles','batchBodies'].forEach((id) => $(id).value = '');
}

async function analyzeBatch() {
  const urls = splitLines('batchUrls');
  const subs = splitLines('batchSubreddits');
  const titles = splitLines('batchTitles');
  const bodies = splitLines('batchBodies');
  const count = Math.max(urls.length, subs.length, titles.length, bodies.length);
  const batch = [];

  for (let i = 0; i < count; i += 1) {
    const url = urls[i] || '';
    const title = titles[i] || '';
    const body = bodies[i] || '';
    const subreddit = subs[i] || inferSubreddit(url);
    if (!url && !title && !body && !subreddit) continue;
    batch.push(createRecord({
      url,
      subreddit,
      title: title || body || `Reddit pain conversation ${i + 1}`,
      body,
      urgency: 'soon'
    }));
  }

  if (!batch.length) {
    toast('Add at least one batch URL, subreddit, heading, or comment');
    return;
  }

  records = [...batch, ...records];
  selectedRecordId = batch[0].id;
  clearBatch();
  render();
  save();
  syncRecordsToRag(batch);
  document.querySelector('.comment-feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(`${batch.length} tailored draft${batch.length === 1 ? '' : 's'} generated`);
  await enhanceRecordsWithAi(batch, { source: 'batch' });
}

function renderOutputs(record) {
  const audit = $('auditOutput');
  const reply = $('replyOutput');
  if (!record) {
    audit.className = 'output empty';
    reply.className = 'output empty';
    audit.textContent = 'Add a Reddit pain conversation to generate a personalized audit.';
    reply.textContent = 'The reply will be help-first and manually reviewable.';
    return;
  }
  audit.className = 'output';
  reply.className = 'output';
  audit.textContent = buildAudit(record);
  reply.textContent = buildReply(record);
}

function renderTable() {
  const body = $('recordsBody');
  if (!records.length) {
    body.innerHTML = `<tr><td colspan="6">No records yet. Add one pain conversation or seed examples.</td></tr>`;
    return;
  }
  body.innerHTML = records.map((record) => `
    <tr class="${record.id === selectedRecordId ? 'selected-row' : ''}">
      <td>
        <strong>${escapeText(record.title || 'Untitled pain post')}</strong>
        <div class="note">${escapeText(record.body || '').slice(0, 130)}${record.body && record.body.length > 130 ? '...' : ''}</div>
      </td>
      <td>r/${escapeText(record.subreddit || 'unknown')}</td>
      <td>${escapeText(record.employee)}</td>
      <td><strong>${record.score}/16</strong></td>
      <td><span class="pill ${statusClass(record.score)}">${scoreLabel(record.score)}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-btn" data-view="${record.id}" type="button">View</button>
          <button class="mini-btn open" data-open="${record.id}" type="button">Open</button>
          <button class="mini-btn" data-delete="${record.id}" type="button">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCommentFeed() {
  const feed = $('commentFeed');
  if (!records.length) {
    feed.innerHTML = `<div class="feed-empty">Generate batch drafts to see tailored Reddit replies here.</div>`;
    return;
  }

  feed.innerHTML = records.map((record, index) => `
    <article class="feed-card ${record.id === selectedRecordId ? 'active' : ''}">
      <div class="feed-card-head">
        <div>
          <span class="feed-kicker">Draft ${index + 1} - r/${escapeText(record.subreddit || 'unknown')} - ${escapeText(record.employee)}</span>
          <h3>${escapeText(record.title || 'Untitled pain post')}</h3>
          <div class="feed-demand">Demand: ${escapeText(demandLevel(record))} - ${escapeText(demandSignals(record).slice(0, 2).join(', '))}</div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-copy-reply="${record.id}" type="button">Copy</button>
          <button class="mini-btn open" data-open-feed="${record.id}" type="button">Open</button>
          <button class="mini-btn" data-view-feed="${record.id}" type="button">View</button>
        </div>
      </div>
      <pre>${escapeText(buildReply(record))}</pre>
    </article>
  `).join('');
}

function renderStats() {
  const qualified = records.filter((record) => record.score >= 9).length;
  const replyTarget = Math.max(records.length, 150);
  const visitors = Math.round((replyTarget * 50 * 0.08) + 400);
  const leads = Math.round(visitors * 0.02);
  $('postCount').textContent = records.length;
  $('qualifiedCount').textContent = qualified;
  $('visitorProjection').textContent = visitors.toLocaleString();
  $('leadProjection').textContent = leads.toLocaleString();
}

function renderAnalytics() {
  const qualified = records.filter((record) => record.score >= 9).length;
  const replyTarget = Math.max(records.length, 150);
  const visitors = Math.round((replyTarget * 50 * 0.08) + 400);
  const leads = Math.round(visitors * 0.02);
  const forecast = [
    { label: 'Pain posts', value: records.length, target: 150 },
    { label: 'Visitors', value: visitors, target: 1000 },
    { label: 'Leads', value: leads, target: 20 },
    { label: 'Qualified', value: qualified, target: 15 }
  ];

  $('forecastBars').innerHTML = forecast.map((item) => {
    const width = Math.min(100, Math.round((item.value / item.target) * 100));
    return `
      <div class="bar-row">
        <span>${escapeText(item.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <span class="bar-value">${item.value.toLocaleString()}</span>
      </div>
    `;
  }).join('');

  const counts = records.reduce((acc, record) => {
    acc[record.painType] = (acc[record.painType] || 0) + 1;
    return acc;
  }, {});
  const mix = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  $('painMix').innerHTML = mix.length ? mix.map(([pain, count]) => `
    <div class="mix-row">
      <span><span class="mix-dot"></span>${escapeText(pain)}</span>
      <strong>${count}</strong>
    </div>
  `).join('') : '<div class="mix-row"><span>No records yet</span><strong>0</strong></div>';

  const queue = [...records].sort((a, b) => b.score - a.score).slice(0, 5);
  $('leadQueue').innerHTML = queue.length ? queue.map((record) => `
    <div class="queue-row">
      <span class="queue-title">${escapeText(record.title || 'Untitled pain post')}</span>
      <strong>${record.score}/16</strong>
    </div>
  `).join('') : '<div class="queue-row"><span class="queue-title">Add Reddit posts</span><strong>0/16</strong></div>';
}

function render() {
  renderStats();
  renderAnalytics();
  renderTable();
  const selected = records.find((record) => record.id === selectedRecordId) || records[0];
  selectedRecordId = selected ? selected.id : null;
  renderOutputs(selected);
  renderCommentFeed();
  if (window.lucide) window.lucide.createIcons();
}

function clearForm() {
  ['urlInput','subredditInput','titleInput','bodyInput','websiteInput','teamInput','hoursInput'].forEach((id) => $(id).value = '');
  $('urgencyInput').value = 'soon';
}

function redditSearchUrl() {
  const keyword = $('keywordSelect').value;
  const subreddit = $('subredditSelect').value;
  const query = encodeURIComponent(`"${keyword}"`);
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search/?q=${query}&restrict_sr=1&sort=new`;
}

function copy(text, label) {
  navigator.clipboard.writeText(text).then(() => toast(`${label} copied`)).catch(() => {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast(`${label} copied`);
  });
}

function selectedRecord() {
  return records.find((item) => item.id === selectedRecordId) || records[0] || null;
}

async function apiRequest(path, options = {}) {
  if (!SERVER_MODE) {
    throw new Error('Open the local server link to use Gemini and RAG.');
  }
  const makeRequest = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    return fetch(path, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Dashboard-Token': token } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  };

  let response = await makeRequest();
  if (response.status === 401) {
    const token = window.prompt('Enter dashboard access token');
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token.trim());
      response = await makeRequest();
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Local API request failed.');
  }
  return data;
}

async function refreshStatus() {
  if (!SERVER_MODE) {
    serverStatus = {
      online: false,
      aiConfigured: false,
      ragDocuments: 0,
      model: '',
      memoryPath: 'browser localStorage only'
    };
    renderStatus();
    return;
  }

  try {
    const data = await apiRequest('/api/status');
    serverStatus = {
      online: true,
      aiConfigured: Boolean(data.aiConfigured),
      ragDocuments: data.ragDocuments || 0,
      model: data.model || '',
      memoryPath: data.memoryPath || 'local'
    };
    renderStatus();
  } catch (error) {
    serverStatus = {
      online: false,
      aiConfigured: false,
      ragDocuments: 0,
      model: '',
      memoryPath: 'server offline'
    };
    renderStatus();
  }
}

function renderStatus() {
  if (!$('serverModeTag')) return;
  $('serverModeTag').textContent = serverStatus.online ? 'local server' : 'static';
  $('aiStatus').textContent = serverStatus.aiConfigured ? `Ready (${serverStatus.model})` : (serverStatus.online ? 'API key needed' : 'Server offline');
  $('ragStatus').textContent = serverStatus.online ? String(serverStatus.ragDocuments) : 'Offline';
  $('memoryPath').textContent = serverStatus.memoryPath || 'Local';
}

async function syncRecordsToRag(recordsToSync) {
  if (!SERVER_MODE || !recordsToSync.length) return;
  try {
    await apiRequest('/api/rag/upsert', {
      method: 'POST',
      body: { records: recordsToSync }
    });
    refreshStatus();
  } catch {
    // RAG sync should never interrupt the local dashboard workflow.
  }
}

function renderSources(containerId, sources = []) {
  const container = $(containerId);
  if (!container) return;
  if (!sources.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = sources.map((source) => `
    <div class="source-item">
      <strong>${escapeText(source.title || 'Memory source')}</strong>
      <code>${escapeText(String(source.source || '').replace(/\\/g, '/'))}</code>
      <div>${escapeText(source.snippet || '')}</div>
    </div>
  `).join('');
}

function applyAiResult(record, result) {
  Object.assign(record, {
    aiAudit: result.audit || record.aiAudit,
    aiReply: result.reply || record.aiReply,
    aiStrategy: result.strategyNotes || record.aiStrategy,
    aiNextAction: result.nextAction || record.aiNextAction,
    demandAnalysis: result.demandAnalysis || record.demandAnalysis,
    aiSources: result.sources || record.aiSources || [],
    aiUpdatedAt: new Date().toISOString()
  });
}

async function enhanceRecordWithAi(record) {
  const result = await apiRequest('/api/ai/audit', {
    method: 'POST',
    body: { record }
  });
  applyAiResult(record, result);
  return result;
}

async function enhanceRecordsWithAi(recordsToEnhance, options = {}) {
  if (!SERVER_MODE || !recordsToEnhance.length) return;
  if (!serverStatus.online) await refreshStatus();
  if (!serverStatus.aiConfigured) {
    toast('Local drafts created. Add a Google AI Studio key to enable AI-specific replies.');
    return;
  }

  const targets = recordsToEnhance.slice(0, 12);
  const workerCount = Math.min(2, targets.length);
  const label = options.source === 'batch' ? 'batch posts' : 'selected post';
  toast(`Gemini analyzing demand for ${targets.length} ${label}...`);

  let completed = 0;
  let failed = 0;
  const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
    for (let i = workerIndex; i < targets.length; i += workerCount) {
      try {
        await enhanceRecordWithAi(targets[i]);
        completed += 1;
        save();
        render();
      } catch {
        failed += 1;
      }
    }
  });

  await Promise.all(workers);
  syncRecordsToRag(targets);
  if (recordsToEnhance.length > targets.length) {
    toast(`AI refined first ${targets.length}; remaining records kept as local drafts`);
    return;
  }
  toast(failed ? `AI refined ${completed}; ${failed} kept as local drafts` : `AI demand analysis finished for ${completed}`);
}

async function polishSelectedWithAi() {
  const record = selectedRecord();
  if (!record) {
    toast('Add or select a record first');
    return;
  }
  const button = $('aiPolishBtn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i data-lucide="loader"></i>Refining...';
  if (window.lucide) window.lucide.createIcons();

  try {
    await enhanceRecordWithAi(record);
    save();
    render();
    renderSources('coachSources', record.aiSources);
    $('coachOutput').className = 'output';
    $('coachOutput').textContent = [
      record.aiStrategy ? `Strategy notes\n${record.aiStrategy}` : '',
      record.aiNextAction ? `\nNext action\n${record.aiNextAction}` : ''
    ].filter(Boolean).join('\n') || 'Gemini refined the selected audit and reply.';
    syncRecordsToRag([record]);
    toast('Gemini refined the selected record');
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
    if (window.lucide) window.lucide.createIcons();
  }
}

async function askCoach() {
  const message = $('coachInput').value.trim();
  if (!message) {
    toast('Ask a question first');
    return;
  }
  const output = $('coachOutput');
  output.className = 'output';
  output.textContent = 'Thinking...';

  try {
    const result = await apiRequest('/api/ai/chat', {
      method: 'POST',
      body: {
        message,
        selectedRecord: selectedRecord(),
        records
      }
    });
    output.textContent = result.answer || 'No answer returned.';
    renderSources('coachSources', result.sources || []);
    refreshStatus();
  } catch (error) {
    output.textContent = error.message;
    toast(error.message);
  }
}

function formatList(title, value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    return `${title}\n${value.map((item, index) => {
      if (typeof item === 'string') return `${index + 1}. ${item}`;
      return `${index + 1}. ${item.factor || item.title || item.name || 'Factor'} - ${item.reason || item.detail || item.score || JSON.stringify(item)}`;
    }).join('\n')}`;
  }
  if (typeof value === 'object') return `${title}\n${JSON.stringify(value, null, 2)}`;
  return `${title}\n${value}`;
}

function formatFactorAnalysis(analysis) {
  return [
    formatList('Summary', analysis.summary),
    formatList('\nRanked factors', analysis.rankedFactors),
    formatList('\nBest opportunities', analysis.bestOpportunities),
    formatList('\nRed flags', analysis.redFlags),
    formatList('\nReply guidance', analysis.replyGuidance),
    formatList('\nNext actions', analysis.nextActions)
  ].filter(Boolean).join('\n');
}

async function analyzeFactors() {
  if (!records.length) {
    toast('Add Reddit records before factor analysis');
    return;
  }
  const output = $('coachOutput');
  output.className = 'output';
  output.textContent = 'Analyzing demand factors with Gemini...';

  try {
    const result = await apiRequest('/api/ai/factors', {
      method: 'POST',
      body: {
        selectedRecord: selectedRecord(),
        records
      }
    });
    output.textContent = formatFactorAnalysis(result.analysis || {});
    renderSources('coachSources', result.sources || []);
    refreshStatus();
    toast('Factor analysis completed');
  } catch (error) {
    output.textContent = error.message;
    toast(error.message);
  }
}

async function searchRag() {
  const query = $('ragQuery').value.trim();
  if (!query) {
    toast('Enter a memory search query');
    return;
  }
  try {
    const result = await apiRequest(`/api/rag/search?q=${encodeURIComponent(query)}`);
    renderSources('ragResults', result.results || []);
    if (!result.results?.length) toast('No matching memory found');
  } catch (error) {
    $('ragResults').innerHTML = `<div class="source-item">${escapeText(error.message)}</div>`;
    toast(error.message);
  }
}

function csvEscape(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function exportCsv() {
  const header = ['createdAt','url','subreddit','title','painType','employee','score','status','website','teamSize','hours','urgency'];
  const rows = records.map((record) => header.map((key) => csvEscape(key === 'status' ? scoreLabel(record.score) : record[key])).join(','));
  download(`ai-employee-reddit-dataset.csv`, [header.join(','), ...rows].join('\n'), 'text/csv');
}

function exportProofPack() {
  const lines = [
    `# Reddit Pain-to-AI Employee Lead Finder Report`,
    ``,
    `Generated from the local lead-finding tool.`,
    ``,
    `## Tool Purpose`,
    `Find live business pain on Reddit -> classify the pain -> generate a useful AI employee audit -> manually reply with value -> send interested readers to an audit form or teardown page -> qualify leads.`,
    ``,
    `## Operating Flow`,
    `Reddit search -> collect pain posts -> classify pain -> generate audit -> draft helpful reply -> track lead score -> follow up with qualified prospects.`,
    ``,
    `## Platform Behavior`,
    `Reddit users post specific problems in searchable threads. Helpful, human-reviewed comments can win attention in the thread and continue receiving traffic from Reddit search and Google-indexed discussions.`,
    ``,
    `## Traffic Model`,
    `150 useful replies x 50 average views x 8% CTR = 600 visitors. Add 400 visitors from old/searchable threads = 1,000 visitors. At 2% conversion = 20 leads. At 75% qualification = 15 qualified leads.`,
    ``,
    `## Dataset Summary`,
    `Records collected: ${records.length}`,
    `Qualified records: ${records.filter((record) => record.score >= 9).length}`,
    ``,
    `## Lead Records And Generated Outputs`,
    ...records.slice(0, 5).flatMap((record, index) => [
      ``,
      `### Sample ${index + 1}: ${record.employee}`,
      buildAudit(record),
      ``,
      `Reddit reply draft:`,
      buildReply(record)
    ]),
    ``,
    `## Operating Risks`,
    `- What breaks first: Reddit self-promotion rules and moderator removals if replies look spammy.`,
    `- What gets saturated: repeated low-effort AI audit comments in the same subreddits.`,
    `- What gets banned: auto-posting, fake accounts, vote manipulation, and irrelevant links.`,
    `- How competitors copy it: they copy the reply style, but struggle to produce fast personalized audits at scale.`,
    `- How to evolve: add Quora, Hacker News, Discord communities, and no-link profile CTA variants when subreddits restrict links.`,
    ``,
    `## Sources To Cite`,
    `- Reddit audience insights: https://www.business.reddit.com/audience-insights`,
    `- Reddit Pro Trends: https://support.reddithelp.com/hc/en-us/articles/47619216411284-Reddit-Pro-Feature-Trends`,
    `- Reddit rules: https://redditinc.com/policies/reddit-rules`,
    `- Tally pricing: https://tally.so/pricing`,
    `- Loom pricing: https://www.loom.com/pricing`
  ];
  download('reddit-ai-employee-lead-report.md', lines.join('\n'), 'text/markdown');
}

function download(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast(`${filename} downloaded`);
}

function seedExamples() {
  const examples = [
    {
      title: 'How do I handle 100 customer emails per day without hiring another support rep?',
      body: 'We run a small ecommerce store and answer the same shipping, return, and product questions every day. Our inbox is overwhelming and we are late to replies.',
      subreddit: 'smallbusiness',
      website: 'https://example-store.com',
      teamSize: 6,
      hours: 15,
      urgency: 'now'
    },
    {
      title: 'Our sales team follows up too slowly and leads go cold',
      body: 'We use HubSpot but reps forget to update CRM and follow up after demo requests. I think we are losing deals because the first reply is too slow.',
      subreddit: 'sales',
      website: 'https://example-saas.com',
      teamSize: 12,
      hours: 10,
      urgency: 'now'
    },
    {
      title: 'Screening candidates is taking over my week',
      body: 'We received 400 applicants for two roles. Resume screening and interview notes are manual, and I need a better shortlist process.',
      subreddit: 'recruiting',
      website: 'https://example-agency.com',
      teamSize: 9,
      hours: 12,
      urgency: 'soon'
    },
    {
      title: 'Manual competitor research takes forever',
      body: 'Every week I collect pricing changes and feature updates from competitors into a spreadsheet. It is repetitive research work and I want to automate the report.',
      subreddit: 'SaaS',
      website: 'https://example-b2b.com',
      teamSize: 5,
      hours: 7,
      urgency: 'soon'
    },
    {
      title: 'Can I automate copying form submissions into multiple spreadsheets?',
      body: 'I run a small agency and manually move client intake data between Google Sheets, Notion, and Slack. It is boring data entry and mistakes happen.',
      subreddit: 'nocode',
      website: 'https://example-agency.io',
      teamSize: 4,
      hours: 6,
      urgency: 'later'
    }
  ];
  const generated = examples.map((item) => {
    $('titleInput').value = item.title;
    $('bodyInput').value = item.body;
    $('subredditInput').value = item.subreddit;
    $('websiteInput').value = item.website;
    $('teamInput').value = item.teamSize;
    $('hoursInput').value = item.hours;
    $('urgencyInput').value = item.urgency;
    return currentFormData();
  });
  records = [...generated, ...records];
  clearForm();
  selectedRecordId = generated[0].id;
  render();
  save();
  syncRecordsToRag(generated);
  toast('Seed examples added');
}

function fillSelects() {
  $('keywordSelect').innerHTML = keywords.map((item) => `<option value="${escapeText(item)}">${escapeText(item)}</option>`).join('');
  $('subredditSelect').innerHTML = subreddits.map((item) => `<option value="${escapeText(item)}">${escapeText(item)}</option>`).join('');
}

function bind() {
  $('openSearchBtn').addEventListener('click', () => window.open(redditSearchUrl(), '_blank', 'noopener,noreferrer'));
  $('copySearchBtn').addEventListener('click', () => copy(redditSearchUrl(), 'Search URL'));
  $('analyzeBtn').addEventListener('click', analyze);
  $('clearFormBtn').addEventListener('click', clearForm);
  $('batchAnalyzeBtn').addEventListener('click', analyzeBatch);
  $('clearBatchBtn').addEventListener('click', clearBatch);
  $('seedBtn').addEventListener('click', seedExamples);
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportProofBtn').addEventListener('click', exportProofPack);
  $('refreshStatusBtn').addEventListener('click', refreshStatus);
  $('aiPolishBtn').addEventListener('click', polishSelectedWithAi);
  $('askCoachBtn').addEventListener('click', askCoach);
  $('analyzeFactorsBtn').addEventListener('click', analyzeFactors);
  $('ragSearchBtn').addEventListener('click', searchRag);
  $('ragQuery').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchRag();
  });
  $('copyAllRepliesBtn').addEventListener('click', () => {
    if (!records.length) {
      toast('No drafts to copy yet');
      return;
    }
    const all = records.map((record, index) => [
      `Draft ${index + 1}: ${record.title || 'Untitled pain post'}`,
      record.url ? `URL: ${record.url}` : '',
      buildReply(record)
    ].filter(Boolean).join('\n')).join('\n\n---\n\n');
    copy(all, 'All drafts');
  });
  $('openAllUrlsBtn').addEventListener('click', () => {
    const urls = records.map((record) => record.url).filter(Boolean).slice(0, 10);
    if (!urls.length) {
      toast('No Reddit URLs saved yet');
      return;
    }
    urls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'));
    toast(`Opened ${urls.length} Reddit URL${urls.length === 1 ? '' : 's'}`);
  });
  $('copyAuditBtn').addEventListener('click', () => {
    const record = records.find((item) => item.id === selectedRecordId) || records[0];
    if (record) copy(buildAudit(record), 'Audit');
  });
  $('copyReplyBtn').addEventListener('click', () => {
    const record = records.find((item) => item.id === selectedRecordId) || records[0];
    if (record) copy(buildReply(record), 'Reply');
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all records in this tool?')) return;
    records = [];
    selectedRecordId = null;
    save();
    render();
  });
  $('recordsBody').addEventListener('click', (event) => {
    const view = event.target.closest('[data-view]');
    const open = event.target.closest('[data-open]');
    const del = event.target.closest('[data-delete]');
    if (view) {
      selectedRecordId = view.dataset.view;
      render();
      document.querySelector('.results-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Record loaded into audit and reply panes');
    }
    if (open) {
      const record = records.find((item) => item.id === open.dataset.open);
      if (record && record.url) {
        window.open(record.url, '_blank', 'noopener,noreferrer');
      } else {
        toast('No Reddit URL saved for this row');
      }
    }
    if (del) {
      records = records.filter((record) => record.id !== del.dataset.delete);
      if (selectedRecordId === del.dataset.delete) selectedRecordId = records[0]?.id || null;
      save();
      render();
    }
  });
  $('commentFeed').addEventListener('click', (event) => {
    const copyBtn = event.target.closest('[data-copy-reply]');
    const openBtn = event.target.closest('[data-open-feed]');
    const viewBtn = event.target.closest('[data-view-feed]');
    if (copyBtn) {
      const record = records.find((item) => item.id === copyBtn.dataset.copyReply);
      if (record) copy(buildReply(record), 'Reply draft');
    }
    if (openBtn) {
      const record = records.find((item) => item.id === openBtn.dataset.openFeed);
      if (record && record.url) {
        window.open(record.url, '_blank', 'noopener,noreferrer');
      } else {
        toast('No Reddit URL saved for this draft');
      }
    }
    if (viewBtn) {
      selectedRecordId = viewBtn.dataset.viewFeed;
      render();
      document.querySelector('.results-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Draft loaded into audit and reply panes');
    }
  });
  document.querySelectorAll('[data-check]').forEach((box) => box.addEventListener('change', save));
}

fillSelects();
load();
bind();
render();
refreshStatus();
if (SERVER_MODE) {
  setTimeout(() => syncRecordsToRag(records.slice(0, 50)), 500);
}
