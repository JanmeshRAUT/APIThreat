import { ThreatReasoning, ThreatRecord, ThreatRule } from './types.js';

type ReasoningCopy = {
  headline: string;
  risk: string;
  likely_false_positive: string;
  confidence: 'low' | 'medium' | 'high';
  why_label: string;
  action_labels: Array<{ label: string; detail: string; priority: 1 | 2 | 3; copy?: 'client_ip' }>;
  owasp_plain: string;
};

const COPY: Record<string, ReasoningCopy> = {
  'RULE-01-BRUTE-FORCE': {
    headline: 'Someone is repeatedly guessing a login password',
    risk: 'If a guess works, the attacker can take over a customer account and access orders or saved details.',
    likely_false_positive: 'A real customer who forgot a password, or a shared office or school network.',
    confidence: 'medium',
    why_label: 'failed logins',
    action_labels: [
      { label: 'Block or rate-limit this IP', detail: 'Apply a temporary block or stricter login rate limit.', priority: 1, copy: 'client_ip' },
      { label: 'Check for a successful login afterwards', detail: 'Review successful logins for the same account or IP.', priority: 2 },
      { label: 'Add account lockout or CAPTCHA', detail: 'Require an additional challenge after repeated failures.', priority: 3 },
    ],
    owasp_plain: 'Broken Authentication',
  },
  'RULE-02-CRED-STUFFING': {
    headline: 'Someone is trying stolen username and password lists',
    risk: 'Reused passwords from other breaches could let an attacker access customer accounts.',
    likely_false_positive: 'A shared network where many people mistype passwords at once.',
    confidence: 'high',
    why_label: 'distinct user accounts targeted',
    action_labels: [
      { label: 'Check which accounts were targeted', detail: 'Review the affected accounts and authentication outcomes.', priority: 1 },
      { label: 'Block or rate-limit this IP', detail: 'Apply a temporary block or stricter login rate limit.', priority: 2, copy: 'client_ip' },
      { label: 'Turn on multi-factor authentication', detail: 'Require an additional factor for account access.', priority: 3 },
    ],
    owasp_plain: 'Broken Authentication',
  },
  'RULE-03-RATE-LIMIT': {
    headline: 'One visitor is sending far too many requests',
    risk: 'Heavy traffic can slow the site for real customers and increase hosting costs.',
    likely_false_positive: 'A busy shared network, partner integration, monitoring tool, or load test.',
    confidence: 'medium',
    why_label: 'requests',
    action_labels: [
      { label: 'Find out who owns this IP', detail: 'Identify the source before applying a durable block.', priority: 1, copy: 'client_ip' },
      { label: 'Apply rate limiting and return 429', detail: 'Enforce a server-side request limit for this source.', priority: 2 },
      { label: 'Block this IP', detail: 'Block the source if the traffic is confirmed abusive.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Unrestricted Resource Consumption',
  },
  'RULE-04-SCRAPING': {
    headline: 'A bot appears to be copying the product catalog',
    risk: 'Competitors can copy prices and listings, while the extra load can slow the shop.',
    likely_false_positive: 'Search crawlers, price comparison partners, or a customer opening many tabs.',
    confidence: 'medium',
    why_label: 'product lookups',
    action_labels: [
      { label: 'Check the User-Agent and IP owner', detail: 'Confirm whether the source is an approved crawler or partner.', priority: 1, copy: 'client_ip' },
      { label: 'Rate-limit product pages', detail: 'Apply a lower request limit to catalog endpoints.', priority: 2 },
      { label: 'Add bot protection', detail: 'Challenge automated traffic before serving catalog data.', priority: 3 },
    ],
    owasp_plain: 'Unrestricted Resource Consumption',
  },
  'RULE-05-IDOR-BOLA': {
    headline: 'Someone is trying other customers’ order or user numbers',
    risk: 'If ownership checks fail, this activity can expose other customers’ orders and personal data.',
    likely_false_positive: 'A support agent or admin tool that legitimately views many records.',
    confidence: 'high',
    why_label: 'distinct resource identifiers',
    action_labels: [
      { label: 'Check whether responses returned data or were blocked', detail: 'Verify the authorization result for each requested object.', priority: 1 },
      { label: 'Confirm ownership checks on every lookup', detail: 'Enforce object-level authorization on every resource request.', priority: 2 },
      { label: 'Block this IP', detail: 'Block the source if access was unauthorized.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Broken Object Level Authorization',
  },
  'RULE-06-SQL-INJECTION': {
    headline: 'Someone is trying to break into the database through a URL',
    risk: 'If the application is vulnerable, an attacker could read, change, or delete customer data.',
    likely_false_positive: 'A shopper searching for unusual text, or a security test you started.',
    confidence: 'high',
    why_label: 'suspicious URI pattern matches',
    action_labels: [
      { label: 'Check whether the request returned data', detail: 'Review the response and application logs without exposing request content.', priority: 1 },
      { label: 'Block this IP', detail: 'Block the source if the activity is unauthorized.', priority: 2, copy: 'client_ip' },
      { label: 'Confirm queries are parameterized', detail: 'Use parameterized queries throughout the affected code paths.', priority: 3 },
    ],
    owasp_plain: 'Injection and Security Misconfiguration',
  },
  'RULE-07-XSS': {
    headline: 'Someone is trying to inject a malicious script into pages',
    risk: 'If input is rendered unsafely, it can run in customers’ browsers and steal sessions or data.',
    likely_false_positive: 'A developer or customer testing HTML in a search or comment field.',
    confidence: 'high',
    why_label: 'script injection pattern matches',
    action_labels: [
      { label: 'Check that user input is escaped', detail: 'Review output encoding at every rendering boundary.', priority: 1 },
      { label: 'Add a Content-Security-Policy header', detail: 'Restrict which scripts browsers may execute.', priority: 2 },
      { label: 'Block this IP', detail: 'Block the source if the activity is unauthorized.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Injection and Security Misconfiguration',
  },
  'RULE-08-PATH-TRAVERSAL': {
    headline: 'Someone is trying to read private files on the server',
    risk: 'A successful attack can expose configuration, keys, or enable commands on the server.',
    likely_false_positive: 'A broken link or a misconfigured client.',
    confidence: 'high',
    why_label: 'file traversal or shell pattern matches',
    action_labels: [
      { label: 'Check the response status', detail: 'Confirm whether the server returned protected content.', priority: 1 },
      { label: 'Block this IP', detail: 'Block the source if the activity is unauthorized.', priority: 2, copy: 'client_ip' },
      { label: 'Keep the server patched and files locked down', detail: 'Limit file access and apply current security updates.', priority: 3 },
    ],
    owasp_plain: 'Injection and Security Misconfiguration',
  },
  'RULE-09-BAD-BOTS': {
    headline: 'A hacking tool or anonymous bot is visiting the API',
    risk: 'Scanners map weak spots and are often followed by targeted attacks.',
    likely_false_positive: 'Your own security scans, uptime monitors, or simple scripts without a User-Agent.',
    confidence: 'medium',
    why_label: 'scanner or empty User-Agent matches',
    action_labels: [
      { label: 'Confirm it is not your own scan', detail: 'Compare the source with approved security and monitoring systems.', priority: 1 },
      { label: 'Block this IP', detail: 'Block the source if it is not approved.', priority: 2, copy: 'client_ip' },
      { label: 'Watch it for follow-up threats', detail: 'Review subsequent activity from this source.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Improper Inventory Management',
  },
  'RULE-10-ADMIN-ACCESS': {
    headline: 'Someone is looking for admin or hidden pages',
    risk: 'Exposed admin panels or configuration files can provide control of the application or its secrets.',
    likely_false_positive: 'Your own staff or developers opening admin tools from a new location.',
    confidence: 'high',
    why_label: 'sensitive endpoint probes',
    action_labels: [
      { label: 'Check the response status', detail: 'Confirm whether a protected endpoint was reachable.', priority: 1 },
      { label: 'Restrict admin paths to your office or VPN', detail: 'Require a trusted network or additional access control.', priority: 2 },
      { label: 'Block this IP', detail: 'Block the source if it is unauthorized.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Broken Function Level Authorization',
  },
  'RULE-11-ERROR-SPIKE': {
    headline: 'The application is suddenly returning many errors',
    risk: 'Customers may be unable to browse or check out, and the cause could be an attack or bad release.',
    likely_false_positive: 'A recent deployment, broken link, or downstream outage.',
    confidence: 'medium',
    why_label: 'HTTP errors',
    action_labels: [
      { label: 'Check recent deployments and roll back if needed', detail: 'Compare the spike with recent application changes.', priority: 1 },
      { label: 'Look at which endpoints fail', detail: 'Group failures by safe normalized endpoint metadata.', priority: 2 },
      { label: 'Look for a single noisy IP', detail: 'Identify whether one source is driving the errors.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Unsafe Consumption of APIs',
  },
  'RULE-12-FAKE-SIGNUPS': {
    headline: 'Someone is creating accounts in bulk',
    risk: 'Fake accounts can abuse promotions, spam users, and pollute customer data.',
    likely_false_positive: 'A school, office, or event where many real people sign up from one network.',
    confidence: 'medium',
    why_label: 'registration attempts',
    action_labels: [
      { label: 'Review newly created accounts', detail: 'Check the accounts and downstream activity created during the window.', priority: 1 },
      { label: 'Add CAPTCHA or email verification', detail: 'Require proof of control before account activation.', priority: 2 },
      { label: 'Block this IP', detail: 'Block the source if the registrations are abusive.', priority: 3, copy: 'client_ip' },
    ],
    owasp_plain: 'Unrestricted Access to Sensitive Business Flows',
  },
  'RULE-13-COUPON-ABUSE': {
    headline: 'Someone is guessing promotional codes',
    risk: 'A guessed code can grant discounts that were not intended and cost money.',
    likely_false_positive: 'A customer trying a few codes from a newsletter or friend.',
    confidence: 'medium',
    why_label: 'coupon validation attempts',
    action_labels: [
      { label: 'Check for redeemed codes from this IP', detail: 'Review successful redemptions associated with the source.', priority: 1, copy: 'client_ip' },
      { label: 'Limit coupon attempts per user and IP', detail: 'Apply a bounded retry policy to promotional validation.', priority: 2 },
      { label: 'Use longer random codes', detail: 'Increase code entropy and avoid predictable promotions.', priority: 3 },
    ],
    owasp_plain: 'Unrestricted Access to Sensitive Business Flows',
  },
};

function humanWindow(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} seconds`;
}

function observedCount(evidence: string, fallback: number): number {
  const match = evidence.match(/(\d+)\s+(?:requests|failed logins|distinct user accounts|product lookups|distinct resource identifiers|errors|registration attempts|coupon validation attempts)/i)
    || evidence.match(/Hit count:\s*(\d+)/i);
  return match ? Number(match[1]) : fallback;
}

function confidenceAtHits(confidence: 'low' | 'medium' | 'high', hitCount: number): 'low' | 'medium' | 'high' {
  if (hitCount < 10) return confidence;
  if (confidence === 'low') return 'medium';
  return 'high';
}

export function buildReasoning(rule: ThreatRule, threat: ThreatRecord): ThreatReasoning {
  const copy = COPY[rule.id] || {
    headline: 'Suspicious activity was detected',
    risk: 'This activity may indicate abuse of the application.',
    likely_false_positive: 'A legitimate integration, test, or unusual customer behavior.',
    confidence: 'low' as const,
    why_label: 'matching events',
    action_labels: [
      { label: 'Review the activity', detail: 'Check the safe request metadata and response outcome.', priority: 1 as const },
      { label: 'Check the source IP', detail: 'Identify whether the source is approved.', priority: 2 as const, copy: 'client_ip' as const },
      { label: 'Apply an appropriate rate limit', detail: 'Limit repeated activity if it is confirmed abusive.', priority: 3 as const },
    ],
    owasp_plain: 'API security control',
  };
  const observed = observedCount(threat.evidence, threat.hit_count);
  const window = humanWindow(rule.window_seconds);

  return {
    headline: copy.headline,
    what_happened: `${threat.app_name} observed ${observed} ${copy.why_label} from ${threat.client_ip} within ${window}.`,
    why_flagged: [{ label: copy.why_label, observed, limit: rule.threshold }],
    risk: copy.risk,
    confidence: confidenceAtHits(copy.confidence, threat.hit_count),
    likely_false_positive: copy.likely_false_positive,
    recommended_actions: [...copy.action_labels].sort((a, b) => a.priority - b.priority),
    owasp: { tag: rule.owasp_tag, plain: copy.owasp_plain },
  };
}

export function attachReasoning(threats: ThreatRecord[], rules: ThreatRule[]): Array<ThreatRecord & { reasoning: ThreatReasoning }> {
  return threats.map((threat) => {
    const rule = rules.find((candidate) => candidate.id === threat.rule_id);
    if (!rule) {
      return {
        ...threat,
        reasoning: buildReasoning({
          id: threat.rule_id,
          name: threat.rule_name,
          severity: threat.severity,
          window_seconds: 60,
          threshold: 1,
          enabled: true,
          owasp_tag: threat.owasp_tag,
          description: '',
        }, threat),
      };
    }
    return { ...threat, reasoning: buildReasoning(rule, threat) };
  });
}
