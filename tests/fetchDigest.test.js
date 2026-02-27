/**
 * Tests for fetchDigest() — covers the fetch integration, header construction,
 * and every error path that the function can surface.
 *
 * `fetch` is stubbed globally so no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDigest } from '../src/lib.js';

const MOCK_KEY = 'sk-ant-test-key-abc123';

/** Builds a mock successful fetch response containing the given stories. */
function mockFetchOk(stories) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text: JSON.stringify(stories) }],
    }),
  }));
}

/** Builds a mock fetch response with a non-OK HTTP status. */
function mockFetchError(status) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
}

const ONE_STORY = [{ headline: 'Test Story', tag: 'Model', summary: 'A test summary.' }];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDigest — happy path', () => {
  it('returns an array of stories on a successful response', async () => {
    mockFetchOk(ONE_STORY);
    const result = await fetchDigest(MOCK_KEY);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe('Test Story');
  });

  it('returns multiple stories in order', async () => {
    const stories = [
      { headline: 'First', tag: 'Model', summary: 'Summary one.' },
      { headline: 'Second', tag: 'Research', summary: 'Summary two.' },
    ];
    mockFetchOk(stories);
    const result = await fetchDigest(MOCK_KEY);
    expect(result[0].headline).toBe('First');
    expect(result[1].headline).toBe('Second');
  });
});

describe('fetchDigest — request construction', () => {
  it('sends the API key in the x-api-key header', async () => {
    mockFetchOk(ONE_STORY);
    await fetchDigest(MOCK_KEY);
    const [, init] = fetch.mock.calls[0];
    expect(init.headers['x-api-key']).toBe(MOCK_KEY);
  });

  it('sends the correct anthropic-version header', async () => {
    mockFetchOk(ONE_STORY);
    await fetchDigest(MOCK_KEY);
    const [, init] = fetch.mock.calls[0];
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('posts to the Anthropic messages endpoint', async () => {
    mockFetchOk(ONE_STORY);
    await fetchDigest(MOCK_KEY);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
  });

  it('includes the web_search tool in the request body', async () => {
    mockFetchOk(ONE_STORY);
    await fetchDigest(MOCK_KEY);
    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'web_search' })])
    );
  });

  it('requests the claude-sonnet-4-20250514 model', async () => {
    mockFetchOk(ONE_STORY);
    await fetchDigest(MOCK_KEY);
    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
  });
});

describe('fetchDigest — HTTP error handling', () => {
  it('throws "API error 401" on an unauthorized response', async () => {
    mockFetchError(401);
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('API error 401');
  });

  it('throws "API error 429" on a rate-limit response', async () => {
    mockFetchError(429);
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('API error 429');
  });

  it('throws "API error 500" on a server error', async () => {
    mockFetchError(500);
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('API error 500');
  });
});

describe('fetchDigest — response parsing errors', () => {
  it('throws when the API returns prose with no JSON array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Sorry, I could not find any news today.' }],
      }),
    }));
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('Could not parse news response.');
  });

  it('throws when the API returns an empty JSON array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
    }));
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('No stories returned.');
  });

  it('throws when the network request rejects entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    await expect(fetchDigest(MOCK_KEY)).rejects.toThrow('Failed to fetch');
  });

  it('extracts stories even when surrounded by model preamble text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{
          type: 'text',
          text: `Here is the digest you requested:\n${JSON.stringify(ONE_STORY)}\n\nLet me know if you want more.`,
        }],
      }),
    }));
    const result = await fetchDigest(MOCK_KEY);
    expect(result).toHaveLength(1);
  });
});
