import test from 'node:test';
import assert from 'node:assert/strict';
import { attachReasoning, buildReasoning } from '../server/threatReasoning.js';
import { ThreatRecord, ThreatRule } from '../server/types.js';

const ruleIds = [
  'RULE-01-BRUTE-FORCE',
  'RULE-02-CRED-STUFFING',
  'RULE-03-RATE-LIMIT',
  'RULE-04-SCRAPING',
  'RULE-05-IDOR-BOLA',
  'RULE-06-SQL-INJECTION',
  'RULE-07-XSS',
  'RULE-08-PATH-TRAVERSAL',
  'RULE-09-BAD-BOTS',
  'RULE-10-ADMIN-ACCESS',
  'RULE-11-ERROR-SPIKE',
  'RULE-12-FAKE-SIGNUPS',
  'RULE-13-COUPON-ABUSE',
] as const;

const rules: ThreatRule[] = ruleIds.map((id, index) => ({
  id,
  name: `Rule ${index + 1}`,
  severity: 'medium',
  window_seconds: 60,
  threshold: 5,
  enabled: true,
  owasp_tag: 'API Security',
  description: '',
}));

function threat(rule_id: string, overrides: Partial<ThreatRecord> = {}): ThreatRecord {
  return {
    id: 'thr_reasoning',
    app_id: 'app_test',
    app_name: 'Test Store',
    rule_id,
    rule_name: 'Rule',
    severity: 'medium',
    client_ip: '198.51.100.2',
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    hit_count: 1,
    status: 'open',
    evidence: '5 requests in 60s window',
    owasp_tag: 'API Security',
    ...overrides,
  };
}

test('Threat reasoning covers all rule IDs with complete fields', () => {
  const attached = attachReasoning(rules.map((rule) => threat(rule.id)), rules);
  assert.equal(attached.length, rules.length);
  for (const item of attached) {
    assert.ok(item.reasoning.headline);
    assert.ok(item.reasoning.what_happened);
    assert.ok(item.reasoning.why_flagged.length > 0);
    assert.ok(item.reasoning.risk);
    assert.ok(['low', 'medium', 'high'].includes(item.reasoning.confidence));
    assert.ok(item.reasoning.likely_false_positive);
    assert.ok(item.reasoning.recommended_actions.every((action) => action.priority >= 1 && action.priority <= 3));
    assert.ok(item.reasoning.owasp.tag);
    assert.ok(item.reasoning.owasp.plain);
  }
});

test('Threat reasoning uses evidence counts and live rule thresholds', () => {
  const rule = { ...rules[0], id: 'RULE-03-RATE-LIMIT', threshold: 99, window_seconds: 300 };
  const result = buildReasoning(rule, threat(rule.id, { evidence: 'High request rate: 12 requests in 300s window' }));
  assert.equal(result.why_flagged[0].observed, 12);
  assert.equal(result.why_flagged[0].limit, 99);
  assert.match(result.what_happened, /5 minutes/);
});

test('Threat reasoning does not leak payloads and confidence rises at ten hits', () => {
  const rule = { ...rules[0], id: 'RULE-06-SQL-INJECTION', threshold: 1 };
  const payload = "UNION SELECT password FROM users secret_token=do-not-leak";
  const low = buildReasoning(rule, threat(rule.id, { evidence: 'SQL injection pattern matched in request URI parameters', hit_count: 1 }));
  const high = buildReasoning(rule, threat(rule.id, { evidence: 'SQL injection pattern matched in request URI parameters (Hit count: 10)', hit_count: 10 }));
  assert.equal(low.confidence, 'high');
  assert.equal(high.confidence, 'high');
  assert.equal(JSON.stringify(high).includes(payload), false);
  assert.equal(JSON.stringify(high).includes('password'), false);
});
