/**
 * Unit tests for pure helper functions in src/lib.js.
 *
 * These functions have no side-effects and require no DOM or network — they are
 * the easiest and highest-value things to keep covered.
 */
import { describe, it, expect } from 'vitest';
import {
  validateApiKey,
  parseDigestResponse,
  clampStoryIndex,
  buildQAContext,
  formatStoryNumber,
} from '../src/lib.js';

// ── validateApiKey ─────────────────────────────────────────────────────────────
describe('validateApiKey', () => {
  it('accepts a well-formed Anthropic key', () => {
    expect(validateApiKey('sk-ant-api03-abc123XYZ')).toBe(true);
  });

  it('rejects a key missing the sk-ant- prefix', () => {
    expect(validateApiKey('sk-openai-abc123')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateApiKey('')).toBe(false);
  });

  it('rejects null', () => {
    expect(validateApiKey(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateApiKey(undefined)).toBe(false);
  });

  it('rejects a numeric value', () => {
    expect(validateApiKey(42)).toBe(false);
  });

  it('rejects a key that is exactly the prefix with no suffix (too short)', () => {
    expect(validateApiKey('sk-ant-')).toBe(false);
  });
});

// ── parseDigestResponse ────────────────────────────────────────────────────────
describe('parseDigestResponse', () => {
  /** Wraps raw text in the shape the Anthropic API returns. */
  const makeResp = (text) => ({ content: [{ type: 'text', text }] });

  const validStory = { headline: 'GPT-5 Released', tag: 'Model', summary: 'OpenAI released GPT-5 today.' };

  it('parses a valid JSON array from a clean response', () => {
    const stories = parseDigestResponse(makeResp(JSON.stringify([validStory])));
    expect(stories).toHaveLength(1);
    expect(stories[0].headline).toBe('GPT-5 Released');
    expect(stories[0].tag).toBe('Model');
  });

  it('extracts JSON when surrounded by preamble prose', () => {
    const stories = parseDigestResponse(
      makeResp(`Here is your digest:\n${JSON.stringify([validStory])}\nEnd.`)
    );
    expect(stories).toHaveLength(1);
  });

  it('joins multiple text content blocks before parsing', () => {
    const data = {
      content: [
        { type: 'tool_use', input: {} },
        { type: 'text', text: '[{"headline":"Test",' },
        { type: 'text', text: '"tag":"Policy","summary":"Test summary."}]' },
      ],
    };
    const stories = parseDigestResponse(data);
    expect(stories[0].headline).toBe('Test');
  });

  it('ignores non-text content blocks (tool_use, tool_result)', () => {
    const data = {
      content: [
        { type: 'tool_use', input: { query: 'AI news' } },
        { type: 'tool_result', content: 'some search results' },
        { type: 'text', text: JSON.stringify([validStory]) },
      ],
    };
    expect(parseDigestResponse(data)).toHaveLength(1);
  });

  it('throws when no JSON array is present', () => {
    expect(() => parseDigestResponse(makeResp('Sorry, no news found today.'))).toThrow(
      'Could not parse news response.'
    );
  });

  it('throws when the JSON array is empty', () => {
    expect(() => parseDigestResponse(makeResp('[]'))).toThrow('No stories returned.');
  });

  it('throws when response contains an object instead of an array', () => {
    expect(() =>
      parseDigestResponse(makeResp('{"headline":"Test","tag":"Model","summary":"Test."}'))
    ).toThrow('Could not parse news response.');
  });

  it('throws when the JSON is malformed', () => {
    expect(() => parseDigestResponse(makeResp('[{broken json]'))).toThrow();
  });

  it('returns multiple stories in order', () => {
    const stories = [validStory, { ...validStory, headline: 'Second Story', tag: 'Research' }];
    const result = parseDigestResponse(makeResp(JSON.stringify(stories)));
    expect(result).toHaveLength(2);
    expect(result[1].headline).toBe('Second Story');
  });
});

// ── clampStoryIndex ────────────────────────────────────────────────────────────
describe('clampStoryIndex', () => {
  it('moves forward within bounds', () => {
    expect(clampStoryIndex(2, 1, 5)).toBe(3);
  });

  it('moves backward within bounds', () => {
    expect(clampStoryIndex(2, -1, 5)).toBe(1);
  });

  it('clamps at the last index when going past the end', () => {
    expect(clampStoryIndex(4, 1, 5)).toBe(4);
  });

  it('clamps at 0 when going before the first story', () => {
    expect(clampStoryIndex(0, -1, 5)).toBe(0);
  });

  it('handles a single-story list (always returns 0)', () => {
    expect(clampStoryIndex(0, 1, 1)).toBe(0);
    expect(clampStoryIndex(0, -1, 1)).toBe(0);
  });

  it('handles a large skip forward', () => {
    expect(clampStoryIndex(0, 100, 10)).toBe(9);
  });

  it('handles a large skip backward', () => {
    expect(clampStoryIndex(5, -100, 10)).toBe(0);
  });
});

// ── buildQAContext ─────────────────────────────────────────────────────────────
describe('buildQAContext', () => {
  const story = { headline: 'AI Milestone Reached', summary: 'Scientists set a new record.' };

  it('builds a context string with no prior Q&A', () => {
    const ctx = buildQAContext(story, []);
    expect(ctx).toBe('Story: "AI Milestone Reached"\nScientists set a new record.');
    expect(ctx).not.toContain('Prior Q&A');
  });

  it('includes prior Q&A when present', () => {
    const ctx = buildQAContext(story, [{ q: 'What happened?', a: 'A record was set.' }]);
    expect(ctx).toContain('Prior Q&A:');
    expect(ctx).toContain('Q: What happened?');
    expect(ctx).toContain('A: A record was set.');
  });

  it('includes multiple prior Q&A pairs separated by a blank line', () => {
    const ctx = buildQAContext(story, [
      { q: 'Q1?', a: 'A1.' },
      { q: 'Q2?', a: 'A2.' },
    ]);
    expect(ctx).toContain('Q: Q1?');
    expect(ctx).toContain('Q: Q2?');
    // Each pair should be double-newline separated
    expect(ctx).toMatch(/A: A1\.\n\nQ: Q2\?/);
  });

  it('handles null priorQA gracefully (treats as empty)', () => {
    expect(() => buildQAContext(story, null)).not.toThrow();
    const ctx = buildQAContext(story, null);
    expect(ctx).not.toContain('Prior Q&A');
  });

  it('handles undefined priorQA gracefully', () => {
    expect(() => buildQAContext(story, undefined)).not.toThrow();
  });

  it('includes the headline in quotes', () => {
    const ctx = buildQAContext(story, []);
    expect(ctx).toMatch(/^Story: "AI Milestone Reached"/);
  });
});

// ── formatStoryNumber ──────────────────────────────────────────────────────────
describe('formatStoryNumber', () => {
  it('formats index 0 as "01"', () => {
    expect(formatStoryNumber(0)).toBe('01');
  });

  it('formats index 8 as "09"', () => {
    expect(formatStoryNumber(8)).toBe('09');
  });

  it('formats index 9 as "10" (two digits, no padding)', () => {
    expect(formatStoryNumber(9)).toBe('10');
  });

  it('formats index 11 as "12"', () => {
    expect(formatStoryNumber(11)).toBe('12');
  });
});
