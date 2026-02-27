/**
 * Pure and DOM-utility functions for AI Digest.
 * Exported for unit testing; imported by the main inline script.
 */

// ── Pure Functions ─────────────────────────────────────────────────────────────

/**
 * Returns true if the key looks like a valid Anthropic API key.
 * @param {unknown} key
 * @returns {boolean}
 */
export function validateApiKey(key) {
  return typeof key === 'string' && key.startsWith('sk-ant-') && key.length > 7;
}

/**
 * Extracts the JSON stories array from a raw Anthropic API response object.
 * Strips surrounding prose or markdown that the model may add.
 * @param {{ content: Array<{ type: string, text?: string }> }} data
 * @returns {Array<{ headline: string, tag: string, summary: string }>}
 * @throws {Error} if no JSON array is found or the array is empty.
 */
export function parseDigestResponse(data) {
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Could not parse news response.');
  const parsed = JSON.parse(m[0]);
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No stories returned.');
  return parsed;
}

/**
 * Returns the next story index clamped within [0, total-1].
 * @param {number} current - current story index
 * @param {number} dir     - direction (-1 or +1)
 * @param {number} total   - total number of stories
 * @returns {number}
 */
export function clampStoryIndex(current, dir, total) {
  return Math.max(0, Math.min(total - 1, current + dir));
}

/**
 * Builds the full context string sent to the API for a Q&A question.
 * @param {{ headline: string, summary: string }} story
 * @param {Array<{ q: string, a: string }> | null | undefined} priorQA
 * @returns {string}
 */
export function buildQAContext(story, priorQA) {
  const prev = (priorQA || []).map(p => `Q: ${p.q}\nA: ${p.a}`).join('\n\n');
  return `Story: "${story.headline}"\n${story.summary}${prev ? '\n\nPrior Q&A:\n' + prev : ''}`;
}

/**
 * Returns a 2-digit, 1-based story number string (e.g. "01", "10").
 * @param {number} idx - 0-based index
 * @returns {string}
 */
export function formatStoryNumber(idx) {
  return String(idx + 1).padStart(2, '0');
}

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Fetches and parses today's AI digest from the Anthropic API.
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Array<{ headline: string, tag: string, summary: string }>>}
 */
export async function fetchDigest(apiKey) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: `You are an AI news curator. Today is ${today}.
Search for the most important AI news from the last 48 hours. Cover: model releases, research breakthroughs, major company moves, policy/regulation, safety, infrastructure. Include ALL stories that are genuinely important — usually 6–12. Skip minor or redundant items.
Respond ONLY with a valid JSON array, no markdown, no preamble, no trailing text:
[{"headline":"Short punchy headline max 12 words","tag":"Model|Research|Policy|Business|Safety|Infrastructure","summary":"2-3 sentences. Conversational tone. Written for audio — no jargon, no bullet points. Explain it like you're telling a smart friend."}]`,
      messages: [{
        role: 'user',
        content: 'Give me the most important AI news from the last 48 hours as a JSON array.',
      }],
    }),
  });
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  const data = await resp.json();
  return parseDigestResponse(data);
}

// ── DOM Utilities ──────────────────────────────────────────────────────────────

/**
 * Shows exactly one named screen, hiding all others.
 * @param {'apikey'|'loading'|'error'|'stories'} name
 */
export function show(name) {
  document.getElementById('apikey-screen').style.display = name === 'apikey' ? 'flex' : 'none';
  document.getElementById('loading-screen').style.display = name === 'loading' ? 'flex' : 'none';
  document.getElementById('error-screen').style.display = name === 'error' ? 'block' : 'none';
  document.getElementById('stories-container').style.display = name === 'stories' ? 'block' : 'none';
}

/**
 * Updates the status badge CSS class and label text.
 * @param {'loading'|'playing'|'answering'|'done'|'paused'} type
 * @param {string} text
 */
export function setStatus(type, text) {
  const b = document.getElementById('status-badge');
  b.className = 'status-badge ' + type;
  document.getElementById('status-text').textContent = text;
  const dot = b.querySelector('.dot');
  dot.className = 'dot' + (['loading', 'playing', 'answering'].includes(type) ? ' pulse' : '');
}

/**
 * Renders story items into #stories-container, replacing any previous content.
 * Each item gets a data-idx attribute for click delegation.
 * @param {Array<{ headline: string, tag: string, summary: string }>} stories
 */
export function renderStories(stories) {
  const c = document.getElementById('stories-container');
  c.innerHTML = '';
  stories.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'story-item';
    d.id = `story-${i}`;
    d.dataset.idx = i;
    d.innerHTML = `
      <div class="story-meta">
        <span class="story-num">${formatStoryNumber(i)}</span>
        <span class="story-tag">${s.tag}</span>
        <div class="story-playing-indicator">
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
        </div>
      </div>
      <div class="story-headline">${s.headline}</div>
      <div class="story-summary">${s.summary}</div>
      <div class="qa-thread" id="qa-${i}"></div>
    `;
    c.appendChild(d);
  });
}
