import React, { useState, useEffect } from 'react';
import { usePOS } from '../../../context/POSContext.tsx';
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Clock,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  NativeBridgeService,
  BackendHealthCheckResult
} from '../../../services/native/NativeBridgeService.ts';
import { MenuScannerApi } from '../../../services/api/menuScannerApi.ts';

export const AiBackendDiagnosticsTab: React.FC = () => {
  const { settings, updateSettings, showToast } = usePOS();

  // Configured URL state
  const [configuredUrl, setConfiguredUrl] = useState<string>(
    settings.apiServerUrl || MenuScannerApi.getEffectiveBackendUrl()
  );

  // Gemini API Key state
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => MenuScannerApi.getStoredApiKey());
  const [isApiKeySaved, setIsApiKeySaved] = useState<boolean>(false);
  const [showKeySecret, setShowKeySecret] = useState<boolean>(false);

  // Diagnostic state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<BackendHealthCheckResult | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Run initial test on mount
  useEffect(() => {
    runConnectionTest(configuredUrl);
  }, []);

  const runConnectionTest = async (targetUrlToTest?: string) => {
    const url = (targetUrlToTest || configuredUrl).trim();
    if (!url) {
      showToast({
        type: 'warning',
        title: 'Empty URL',
        message: 'Please provide a valid backend server URL.'
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await NativeBridgeService.backendDiagnostics.testConnection(url);
      setLastResult(result);

      if (result.success) {
        setLastSuccessTime(new Date().toLocaleTimeString());
        setLastErrorMessage(null);
        showToast({
          type: 'success',
          title: 'Backend Connected',
          message: `${result.service || 'AuraPOS AI Backend'} is reachable (${result.latencyMs}ms).`
        });
      } else {
        setLastErrorMessage(result.error || `HTTP ${result.status} received.`);
        showToast({
          type: 'error',
          title: 'Connection Failed',
          message: result.error || `Server responded with status ${result.status}`
        });
      }
    } catch (err: any) {
      const msg = err.message || 'Connection test encountered an error.';
      setLastErrorMessage(msg);
      setLastResult({
        success: false,
        status: 0,
        latencyMs: 0,
        dnsOk: false,
        tlsOk: false,
        aiServiceAvailable: false,
        error: msg,
        errorType: 'BACKEND_UNREACHABLE',
        timestamp: new Date().toISOString()
      });
      showToast({
        type: 'error',
        title: 'Network Error',
        message: msg
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveUrl = () => {
    const clean = configuredUrl.trim().replace(/\/+$/, '');
    updateSettings({
      ...settings,
      apiServerUrl: clean
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    showToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'AuraPOS AI Backend URL updated successfully.'
    });
    runConnectionTest(clean);
  };

  const handlePresetSelect = (presetUrl: string) => {
    setConfiguredUrl(presetUrl);
    runConnectionTest(presetUrl);
  };

  const handleSaveApiKey = () => {
    const clean = apiKeyInput.trim();
    MenuScannerApi.setStoredApiKey(clean);
    updateSettings({
      ...settings,
      geminiApiKey: clean
    });
    setIsApiKeySaved(true);
    setTimeout(() => setIsApiKeySaved(false), 2500);
    showToast({
      type: 'success',
      title: clean ? 'Gemini API Key Saved' : 'API Key Cleared',
      message: clean
        ? 'Gemini Vision AI key configured for menu scanning.'
        : 'Gemini API Key removed.'
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/30">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              System Diagnostics & Network Health
            </div>
            <h3 className="text-xl font-black tracking-tight">AuraPOS AI Backend Diagnostics</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Verify end-to-end HTTPS reachability between this terminal (Android APK or Web) and the AuraPOS AI Backend and Gemini Vision service.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => runConnectionTest()}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backend Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
            Configured Backend Server URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={configuredUrl}
                onChange={e => setConfiguredUrl(e.target.value)}
                placeholder="https://api.aurapos.com or http://192.168.1.100:3000"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveUrl}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Saved!' : 'Save URL'}</span>
            </button>
          </div>
        </div>

        {/* Presets */}
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
            Quick Presets for Store Deployment:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePresetSelect('https://api.aurapos.com')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Cloud Production (https://api.aurapos.com)
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('http://192.168.1.100:3000')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Local Store Hub LAN (192.168.1.100:3000)
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('http://10.0.2.2:3000')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Android Emulator Host (10.0.2.2:3000)
            </button>
            {typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' && (
              <button
                type="button"
                onClick={() => handlePresetSelect(window.location.origin)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Current Host ({window.location.host})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Google Gemini API Key Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Google Gemini Vision API Key (For Menu OCR & AI Generation)
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
            >
              <span>Get Free Key at Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showKeySecret ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKeySecret(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showKeySecret ? 'Hide Key' : 'Show Key'}
              >
                {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isApiKeySaved ? 'Saved!' : 'Save Key'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            When configured, Menu Scanner calls Gemini Multimodal Vision directly from your terminal or passes through your local server.
          </p>
        </div>
      </div>

      {/* Requirement 4: Live Diagnostic Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Connectivity Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Connectivity</span>
            {lastResult?.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500" />
            )}
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  lastResult?.success ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{lastResult?.success ? 'Connected' : 'Not Connected'}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {lastResult?.service || 'AuraPOS AI Backend Service'}
            </p>
          </div>
        </div>

        {/* HTTP Status & Latency */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">HTTP & Latency</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {lastResult?.status ? `HTTP ${lastResult.status}` : 'No Response (0)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Latency: {lastResult?.latencyMs ? `${lastResult.latencyMs} ms` : '---'}
            </p>
          </div>
        </div>

        {/* AI Service Availability */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Service</span>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {lastResult?.aiServiceAvailable ? 'Available' : 'Unavailable'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gemini Vision Multimodal OCR Engine
            </p>
          </div>
        </div>

        {/* DNS Resolution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">DNS Resolution</span>
            {lastResult?.dnsOk !== false ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500" />
            )}
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {lastResult?.dnsOk !== false ? 'OK' : 'Failed'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Host IP address resolution
            </p>
          </div>
        </div>

        {/* TLS / HTTPS Security */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">TLS / Encryption</span>
            {configuredUrl.startsWith('https://') ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {configuredUrl.startsWith('https://') ? 'HTTPS (TLS OK)' : 'HTTP (Cleartext LAN)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {configuredUrl.startsWith('https://') ? 'Encrypted production transport' : 'Allowed for local store subnets'}
            </p>
          </div>
        </div>

        {/* Android Native Bridge Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Terminal Shell</span>
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {NativeBridgeService.isNativeAndroid() ? 'Android POS Native' : 'Browser / PWA Web'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Host execution environment
            </p>
          </div>
        </div>
      </div>

      {/* Activity Timestamps & Error Log */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Diagnostics Audit & Activity History
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase">Last Successful Connection</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
              {lastSuccessTime || 'No successful ping recorded this session'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase">Last Reported Error</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold text-sm truncate block" title={lastErrorMessage || 'None'}>
              {lastErrorMessage || 'None (System Healthy)'}
            </span>
          </div>
        </div>

        {/* Target Endpoint Info */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
          <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
            Endpoint Reachability Guidelines (Production Android POS):
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Production POS terminals connect over standard HTTPS to the AuraPOS AI backend.</li>
            <li>For local restaurant deployments, a master terminal or store server can run on the LAN (e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">http://192.168.1.100:3000</code>).</li>
            <li>Never use <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">localhost</code> on a physical Android terminal, as it refers to the mobile device itself.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
