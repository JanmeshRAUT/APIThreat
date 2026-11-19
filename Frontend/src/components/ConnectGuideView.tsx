import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { guideSetup, GuideLanguage, snippets } from '../data/connectGuideSnippets';

interface GuideApp {
  id: string;
  name: string;
  environment: 'dev' | 'prod';
  total_requests: number;
}

interface ConnectionTest {
  appId: string;
  status: 'testing' | 'connected' | 'not_connected';
  message?: string;
}

interface ConnectGuideViewProps {
  apps: GuideApp[];
  platformUrl: string;
  guideApiKeyPlaceholder: string;
  guideApiKey: string;
  guideSelectedAppId: string;
  setGuideSelectedAppId: (id: string) => void;
  guideApiKeys: Record<string, string>;
  connectionTestKey: string;
  setConnectionTestKey: (value: string) => void;
  connectionTest: ConnectionTest | null;
  handleTestConnection: () => void;
  guideLanguage: GuideLanguage;
  setGuideLanguage: (language: GuideLanguage) => void;
}

export function ConnectGuideView({
  apps, platformUrl, guideApiKeyPlaceholder, guideApiKey, guideSelectedAppId,
  setGuideSelectedAppId, guideApiKeys, connectionTestKey, setConnectionTestKey,
  connectionTest, handleTestConnection, guideLanguage, setGuideLanguage,
}: ConnectGuideViewProps) {
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isEnvCopied, setIsEnvCopied] = useState(false);
  const [isFullGuideCopied, setIsFullGuideCopied] = useState(false);
  const guideApp = apps.find((a) => a.id === guideSelectedAppId) || apps[0];
  const setup = guideSetup[guideLanguage];
  const currentGuideSetup = {
    ...setup,
    env: setup.env
      .replaceAll('{{platformUrl}}', platformUrl)
      .replaceAll('{{guideApiKeyPlaceholder}}', guideApiKeyPlaceholder),
  };
  const copyAllGuideContent = [
    `Connect ${guideApp?.name || 'this app'} to the API Security Gatekeeper`,
    '',
    'Steps:',
    '1. Copy your API key below.',
    '2. Open your app\'s project folder.',
    `3. Create or open ${currentGuideSetup.file}.`,
    '4. Paste the code and your key.',
    '5. Restart your app and click "Test connection" here.',
    '',
    `File: ${currentGuideSetup.file}`,
    `Install: ${currentGuideSetup.install}`,
    `Main server file: ${currentGuideSetup.main}`,
    '.env:',
    currentGuideSetup.env,
    currentGuideSetup.note,
    '',
    snippets[guideLanguage],
  ].join('\n');
  const copyContent = (content: string, setCopied: (value: boolean) => void) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="page-title text-slate-900">Connect Guide</h1>
              <p className="page-sub mt-0.5">
                Backend integration guide and code snippets for telemetry ingest.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Dashboard:{' '}
                <a className="text-blue-600 hover:underline" href="https://api-threat.vercel.app/" target="_blank" rel="noreferrer">
                  https://api-threat.vercel.app/
                </a>
                {' · '}API and monitoring endpoint:{' '}
                <a className="text-blue-600 hover:underline" href="https://apithreat.onrender.com" target="_blank" rel="noreferrer">
                  https://apithreat.onrender.com
                </a>
              </p>
            </div>

            {/* Application selector and setup steps */}
            <div className="panel p-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">App:</span>
                <select
                  value={guideSelectedAppId}
                  onChange={(e) => setGuideSelectedAppId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {apps.length === 0 && <option value="">No registered apps</option>}
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.environment})
                    </option>
                  ))}
                </select>
              </div>

              {guideApp && (
                <div className="flex items-center gap-2">
                  {!guideApiKeys[guideApp.id] && (
                    <input
                      type="password"
                      value={connectionTestKey}
                      onChange={(e) => setConnectionTestKey(e.target.value)}
                      placeholder="Paste key for this test only"
                      className="input w-48 py-1 text-xs"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTestConnection()}
                    disabled={connectionTest?.status === 'testing'}
                    className="btn btn-primary text-xs disabled:opacity-50"
                  >
                    {connectionTest?.appId === guideApp.id && connectionTest.status === 'testing' ? 'Testing...' : 'Test connection'}
                  </button>
                </div>
              )}
            </div>

            {!guideApp ? (
              <div className="panel p-8 text-center text-sm text-slate-600">
                Register an application first to get a real API key and connection instructions.
              </div>
            ) : (
            <>
            {guideApp.total_requests === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                This app hasn't sent any traffic yet. Follow the steps below to connect it.
              </div>
            )}

            {connectionTest?.appId === guideApp.id && connectionTest.status === 'connected' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded px-3.5 py-2.5 text-xs text-emerald-800 font-semibold">
                {connectionTest.message}
              </div>
            )}
            {connectionTest?.appId === guideApp.id && connectionTest.status === 'not_connected' && (
              <div className="bg-rose-50 border border-rose-200 rounded px-3.5 py-2.5 text-xs text-rose-800">
                <p className="font-semibold">{connectionTest.message}</p>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  <li>Is MONITOR_URL correct?</li>
                  <li>Did you restart your app after adding the .env values?</li>
                  <li>Is the key copied in full?</li>
                </ul>
              </div>
            )}

            <div className="panel p-4">
              <h3 className="text-xs font-semibold text-slate-900 mb-3">Setup steps</h3>
              <ol className="grid gap-1.5 text-xs text-slate-700">
                <li><strong>Step 1:</strong> Copy your API key below.</li>
                <li><strong>Step 2:</strong> Open your app's project folder.</li>
                <li><strong>Step 3:</strong> Create or open the file shown below for your language.</li>
                <li><strong>Step 4:</strong> Paste the code and your key.</li>
                <li><strong>Step 5:</strong> Restart your app and click "Test connection" here.</li>
              </ol>
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-xs font-semibold text-slate-700 mb-1">Your API key</div>
                <code className="text-xs font-mono text-blue-700 break-all">
                  {guideApiKey || 'Key unavailable in this browser — regenerate this app key to display it again.'}
                </code>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  For your safety, we only store a scrambled version of your key. We can never show it to you again after you close this box — if you lose it, regenerate instead.
                </p>
              </div>
            </div>

            {/* Language Tabs & Instructions */}
            <div className="panel overflow-hidden flex flex-col">
              <div className="panel-head flex items-center justify-between">
                {/* Language Switcher */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'node', label: 'Node.js / Express' },
                    { id: 'python', label: 'Python (FastAPI / Flask)' },
                    { id: 'java', label: 'Java (Spring Boot Filter)' },
                    { id: 'php', label: 'PHP' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setGuideLanguage(lang.id as any)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        guideLanguage === lang.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                {/* Copy Snippet Button */}
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => copyContent(copyAllGuideContent, setIsFullGuideCopied)}
                    className="btn btn-secondary text-xs"
                  >
                    {isFullGuideCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isFullGuideCopied ? 'Copied!' : 'Copy full guide'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 grid gap-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-800 mb-1">Create this file at the exact path</div>
                  <code className="font-mono text-blue-700">{currentGuideSetup.file}</code>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 mb-1">Install what it needs</div>
                  <p className="text-slate-600">{currentGuideSetup.install}</p>
                </div>
                <div>
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-amber-950 text-[10px] font-bold tracking-wide">
                        MAIN STEP
                      </span>
                      <div className="font-semibold text-amber-950">Turn it on in your main server file</div>
                    </div>
                    <p className="text-amber-900">{currentGuideSetup.main}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="font-semibold text-slate-800">Set these values in .env</div>
                    <button
                      type="button"
                      onClick={() => copyContent(currentGuideSetup.env, setIsEnvCopied)}
                      className="btn btn-secondary text-xs py-0.5"
                    >
                      {isEnvCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{isEnvCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-100 rounded font-mono text-slate-800 overflow-x-auto">{currentGuideSetup.env}</pre>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded text-blue-900">
                  {currentGuideSetup.note}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
                  <strong>Important:</strong> If your Node app runs on another computer, do not use <code className="font-mono">http://localhost:3000</code>. Set <code className="font-mono">MONITOR_URL</code> to this dashboard's reachable LAN or public URL, and allow inbound access to port 3000.
                </div>
              </div>

              {/* Code block */}
              <div className="p-4 bg-slate-950 overflow-x-auto">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold text-slate-400">Source code</span>
                  <button
                    type="button"
                    onClick={() => copyContent(snippets[guideLanguage], setIsCodeCopied)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer"
                  >
                    {isCodeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCodeCopied ? 'Copied!' : 'Copy code'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-100 leading-relaxed">
                  {snippets[guideLanguage]}
                </pre>
              </div>
            </div>
            </>
            )}
          </div>
  );
}
