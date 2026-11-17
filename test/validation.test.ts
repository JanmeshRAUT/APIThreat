import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRulePatch, validateSettingsPatch, validateWebhookUrl } from '../server/threatsApi.js';

test('Rule and settings patches reject unknown fields and invalid values', () => {
  assert.match(validateRulePatch({ enabled: true, unexpected: 1 }).error || '', /Unknown rule fields/);
  assert.match(validateRulePatch({ threshold: 0 }).error || '', /threshold/);
  assert.match(validateRulePatch({ window_seconds: 9 }).error || '', /window_seconds/);
  assert.match(validateRulePatch({ severity: 'extreme' }).error || '', /severity/);
  assert.match(validateSettingsPatch({ notify_on_high_critical: true, unexpected: 1 }).error || '', /Unknown settings fields/);
  assert.match(validateSettingsPatch({ alert_min_severity: 'extreme' }).error || '', /alert_min_severity/);
});

test('Webhook validation blocks private targets and accepts public HTTPS', () => {
  assert.match(validateWebhookUrl('http://127.0.0.1:8080/hook') || '', /private IP/);
  assert.match(validateWebhookUrl('https://localhost/hook') || '', /private IP/);
  assert.equal(validateWebhookUrl('https://hooks.example.com/notify'), null);
});
