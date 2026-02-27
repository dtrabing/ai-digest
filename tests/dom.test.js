/**
 * DOM interaction tests for show(), setStatus(), and renderStories().
 *
 * Vitest's jsdom environment provides a real DOM. Each test starts with a fresh
 * minimal HTML scaffold that mirrors the elements the lib functions expect.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { show, setStatus, renderStories } from '../src/lib.js';

/** Minimal HTML scaffold that replicates the elements lib.js targets. */
function setupDOM() {
  document.body.innerHTML = `
    <div id="apikey-screen"  style="display:none"></div>
    <div id="loading-screen" style="display:flex"></div>
    <div id="error-screen"   style="display:none"></div>
    <div id="stories-container" style="display:none"></div>

    <div id="status-badge" class="status-badge loading">
      <div class="dot pulse"></div>
      <span id="status-text">Fetching news</span>
    </div>

    <div id="story-count"></div>
    <div id="np-title"></div>
    <button id="btn-play"></button>
  `;
}

// ── show() ────────────────────────────────────────────────────────────────────
describe('show', () => {
  beforeEach(setupDOM);

  it('shows the loading screen and hides all others', () => {
    show('loading');
    expect(document.getElementById('loading-screen').style.display).toBe('flex');
    expect(document.getElementById('error-screen').style.display).toBe('none');
    expect(document.getElementById('stories-container').style.display).toBe('none');
    expect(document.getElementById('apikey-screen').style.display).toBe('none');
  });

  it('shows the error screen and hides all others', () => {
    show('error');
    expect(document.getElementById('error-screen').style.display).toBe('block');
    expect(document.getElementById('loading-screen').style.display).toBe('none');
    expect(document.getElementById('stories-container').style.display).toBe('none');
    expect(document.getElementById('apikey-screen').style.display).toBe('none');
  });

  it('shows the stories container and hides all others', () => {
    show('stories');
    expect(document.getElementById('stories-container').style.display).toBe('block');
    expect(document.getElementById('loading-screen').style.display).toBe('none');
    expect(document.getElementById('error-screen').style.display).toBe('none');
    expect(document.getElementById('apikey-screen').style.display).toBe('none');
  });

  it('shows the API key screen and hides all others', () => {
    show('apikey');
    expect(document.getElementById('apikey-screen').style.display).toBe('flex');
    expect(document.getElementById('loading-screen').style.display).toBe('none');
    expect(document.getElementById('error-screen').style.display).toBe('none');
    expect(document.getElementById('stories-container').style.display).toBe('none');
  });

  it('hides all screens for an unknown name', () => {
    show('unknown');
    expect(document.getElementById('loading-screen').style.display).toBe('none');
    expect(document.getElementById('error-screen').style.display).toBe('none');
    expect(document.getElementById('stories-container').style.display).toBe('none');
    expect(document.getElementById('apikey-screen').style.display).toBe('none');
  });
});

// ── setStatus() ───────────────────────────────────────────────────────────────
describe('setStatus', () => {
  beforeEach(setupDOM);

  it('sets the loading class and pulses the dot', () => {
    setStatus('loading', 'Fetching news');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge loading');
    expect(badge.querySelector('.dot').className).toContain('pulse');
    expect(document.getElementById('status-text').textContent).toBe('Fetching news');
  });

  it('sets the playing class and pulses the dot', () => {
    setStatus('playing', 'Playing');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge playing');
    expect(badge.querySelector('.dot').className).toContain('pulse');
  });

  it('sets the answering class and pulses the dot', () => {
    setStatus('answering', 'Answering');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge answering');
    expect(badge.querySelector('.dot').className).toContain('pulse');
  });

  it('sets the done class WITHOUT pulsing the dot', () => {
    setStatus('done', 'Done');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge done');
    expect(badge.querySelector('.dot').className).toBe('dot');
    expect(badge.querySelector('.dot').className).not.toContain('pulse');
  });

  it('sets the paused class WITHOUT pulsing the dot', () => {
    setStatus('paused', 'Paused');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge paused');
    expect(badge.querySelector('.dot').className).not.toContain('pulse');
  });

  it('updates the status text correctly', () => {
    setStatus('loading', 'Custom message');
    expect(document.getElementById('status-text').textContent).toBe('Custom message');
  });

  it('replaces an earlier status class when called again', () => {
    setStatus('loading', 'Loading…');
    setStatus('done', 'Done');
    const badge = document.getElementById('status-badge');
    expect(badge.className).toBe('status-badge done');
    expect(badge.className).not.toContain('loading');
  });
});

// ── renderStories() ───────────────────────────────────────────────────────────
describe('renderStories', () => {
  beforeEach(setupDOM);

  const MOCK_STORIES = [
    { headline: 'AI Breakthrough', tag: 'Research', summary: 'Scientists discovered something amazing.' },
    { headline: 'New Policy', tag: 'Policy', summary: 'Governments react to AI developments.' },
  ];

  it('renders the correct number of story items', () => {
    renderStories(MOCK_STORIES);
    expect(document.querySelectorAll('.story-item')).toHaveLength(2);
  });

  it('renders story headlines correctly', () => {
    renderStories(MOCK_STORIES);
    const headlines = document.querySelectorAll('.story-headline');
    expect(headlines[0].textContent).toBe('AI Breakthrough');
    expect(headlines[1].textContent).toBe('New Policy');
  });

  it('renders story summaries correctly', () => {
    renderStories(MOCK_STORIES);
    const summaries = document.querySelectorAll('.story-summary');
    expect(summaries[0].textContent).toBe('Scientists discovered something amazing.');
  });

  it('renders story tags correctly', () => {
    renderStories(MOCK_STORIES);
    const tags = document.querySelectorAll('.story-tag');
    expect(tags[0].textContent).toBe('Research');
    expect(tags[1].textContent).toBe('Policy');
  });

  it('renders zero-padded story numbers', () => {
    renderStories(MOCK_STORIES);
    const nums = document.querySelectorAll('.story-num');
    expect(nums[0].textContent).toBe('01');
    expect(nums[1].textContent).toBe('02');
  });

  it('assigns unique IDs and data-idx attributes to each item', () => {
    renderStories(MOCK_STORIES);
    expect(document.getElementById('story-0')).not.toBeNull();
    expect(document.getElementById('story-1')).not.toBeNull();
    expect(document.getElementById('story-0').dataset.idx).toBe('0');
    expect(document.getElementById('story-1').dataset.idx).toBe('1');
  });

  it('creates a Q&A thread container for each story', () => {
    renderStories(MOCK_STORIES);
    expect(document.getElementById('qa-0')).not.toBeNull();
    expect(document.getElementById('qa-1')).not.toBeNull();
  });

  it('clears and re-renders on a second call', () => {
    renderStories(MOCK_STORIES);
    renderStories([{ headline: 'Only Story', tag: 'Model', summary: 'Just one.' }]);
    expect(document.querySelectorAll('.story-item')).toHaveLength(1);
    expect(document.querySelector('.story-headline').textContent).toBe('Only Story');
  });

  it('renders an empty container when given no stories', () => {
    renderStories([]);
    expect(document.querySelectorAll('.story-item')).toHaveLength(0);
    expect(document.getElementById('stories-container').innerHTML).toBe('');
  });

  it('adds the story-item class to every rendered element', () => {
    renderStories(MOCK_STORIES);
    document.querySelectorAll('.story-item').forEach(el => {
      expect(el.classList.contains('story-item')).toBe(true);
    });
  });
});
