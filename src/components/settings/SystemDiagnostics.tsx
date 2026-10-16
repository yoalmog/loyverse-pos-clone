import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
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
  WifiOff
} from 'lucide-react';
import { useAuraNetwork } from '../../hooks/useAuraNetwork.ts';
import { MenuScannerApi } from '../../services/api/menuScannerApi.ts';

export const SystemDiagnostics: React.FC = () => {
  const { settings, updateSettings, showToast } = usePOS();

  // Network Hook: Centralized request lifecycle, pre-flight health checks, diagnostic logging
  const auraNetwork = useAuraNetwork({ timeoutMs: 15000, checkHealthOnMount: true });

  // Configured URL state
  const [configuredUrl, setConfiguredUrl] = useState<string>(
    settings.apiServerUrl || MenuScannerApi.getEffectiveBackendUrl()
  );

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  const handleTestConnection = async (targetUrl?: string) => {
    const url = (targetUrl || configuredUrl).trim();
    if (!url) {
      showToast({
        type: 'warning',
        title: 'Empty URL',
        message: 'Please provide a valid backend server URL.'
      });
      return;
    }

    const success = await auraNetwork.checkBackendHealth(url);
    setLastTestedAt(new Date().toLocaleTimeString());

    if (success) {
      showToast({
        type: 'success',
        title: 'Backend Reachable',
        message: `Connected successfully (${auraNetwork.health.latencyMs}ms)`
      });
    } else {
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message: auraNetwork.health.error || `Server responded with status ${auraNetwork.health.status}`
      });
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
    handleTestConnection(clean);
  };

  const handlePresetSelect = (presetUrl: string) => {
    setConfiguredUrl(presetUrl);
    handleTestConnection(presetUrl);
  };

  const isHealthy = auraNetwork.health.isHealthy;
  const isTesting = auraNetwork.health.isChecking;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/30">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              System Diagnostics & Network Health
            </div>
            <h3 className="text-xl font-black tracking-tight">System & AI Backend Diagnostics</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Verify end-to-end connectivity between this terminal (Android APK or Web) and the AuraPOS AI Backend and Gemini Vision service.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Backend Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">AI Backend Configuration</h4>
              <p className="text-xs text-slate-500">Target host for menu OCR, catalog extraction, and health checks</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                isHealthy === true
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : isHealthy === false
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isTesting
                    ? 'bg-amber-400 animate-pulse'
                    : isHealthy === true
                    ? 'bg-emerald-500'
                    : isHealthy === false
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                {isTesting
                  ? 'Checking...'
                  : isHealthy === true
                  ? 'Connected'
                  : isHealthy === false
                  ? 'Not Connected'
                  : 'Unchecked'}
              </span>
            </span>
          </div>
        </div>

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
            Quick Deployment Presets:
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

      {/* Live Diagnostic Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Connectivity Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Connectivity</span>
            {isHealthy === true ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : isHealthy === false ? (
              <XCircle className="w-5 h-5 text-rose-500" />
            ) : (
              <Activity className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isHealthy === true ? 'bg-emerald-500 animate-pulse' : isHealthy === false ? 'bg-rose-500' : 'bg-slate-400'
                }`}
              />
              <span>{isHealthy === true ? 'Connected' : isHealthy === false ? 'Not Connected' : 'Checking...'}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {auraNetwork.health.service || 'AuraPOS AI Backend Service'}
            </p>
          </div>
        </div>

        {/* Latency */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Roundtrip Latency</span>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {auraNetwork.health.latencyMs ? `${auraNetwork.health.latencyMs} ms` : '—'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {auraNetwork.health.latencyMs && auraNetwork.health.latencyMs < 300
                ? 'Excellent (Fast POS response)'
                : auraNetwork.health.latencyMs && auraNetwork.health.latencyMs < 800
                ? 'Good'
                : 'Direct HTTPS network response'}
            </p>
          </div>
        </div>

        {/* HTTP Status Code */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">HTTP Status</span>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {auraNetwork.health.status ? `HTTP ${auraNetwork.health.status}` : isTesting ? 'Testing...' : 'No Response (0)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {auraNetwork.health.status === 200
                ? '200 OK — Ready for OCR analysis'
                : auraNetwork.health.error || 'Awaiting connection test'}
            </p>
          </div>
        </div>

        {/* AI Service Availability */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Service (Gemini)</span>
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  auraNetwork.health.aiServiceAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{auraNetwork.health.aiServiceAvailable ? 'Available' : 'Checking / Disabled'}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Active Model: gemini-3.1-flash-lite
            </p>
          </div>
        </div>

        {/* DNS & TLS Security */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Security & TLS</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {configuredUrl.startsWith('https://') ? 'TLS Encrypted (HTTPS)' : 'Standard (HTTP)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              DNS Resolution: {isHealthy ? 'Verified OK' : 'Pending'}
            </p>
          </div>
        </div>

        {/* Last Successful Check */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Verified</span>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {auraNetwork.health.checkedAt || lastTestedAt || 'Never'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Updated via background poll or manual test
            </p>
          </div>
        </div>
      </div>

      {/* Error Details Card if Unhealthy */}
      {auraNetwork.health.isHealthy === false && auraNetwork.health.error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-5 text-rose-900 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-sm">Last Diagnostic Error</h5>
              <p className="text-xs mt-1 font-mono">{auraNetwork.health.error}</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection Check</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
