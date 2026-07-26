import { describe, expect, it } from 'vitest';
import { evaluateAskBudget, percentile } from '../scripts/homebase-ask-budget.mjs';

describe('Homebase Ask budget', () => {
  it('computes nearest-rank percentiles', () => {
    expect(percentile([100, 200, 300, 400], 95)).toBe(400);
  });

  it('passes zero-token local answers and bounded Hermes answers', () => {
    const result = evaluateAskBudget([
      { route: 'local', source: 'local', action: 'status', totalTokens: 0, modelCalls: 0, latencyMs: 10 },
      { route: 'hermes', source: 'teddy', action: 'ask', totalTokens: 1200, latencyMs: 4200, toolCalls: 0, usageCaptured: true }
    ]);
    expect(result.status).toBe('ok');
    expect(result.observed.p95Tokens).toBe(1200);
  });

  it('fails missing usage and token regressions', () => {
    const result = evaluateAskBudget([
      { route: 'local', source: 'local', action: 'status', totalTokens: 100, modelCalls: 1 },
      { route: 'hermes', source: 'teddy', action: 'status', totalTokens: 2400, latencyMs: 9000, toolCalls: 1, usageCaptured: false }
    ]);
    expect(result.status).toBe('fail');
    expect(result.failures.join(' ')).toMatch(/zero model|usage|p95 tokens|p95 latency|must not use tools/);
  });
});
