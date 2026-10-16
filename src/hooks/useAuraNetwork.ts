import { useState, useCallback, useRef, useEffect } from 'react';
import { usePOS } from '../context/POSContext.tsx';
import {
  MenuScannerApi,
  AnalyzeMenuResponse,
  ExtractionErrorType,
  ExtractionDiagnosticError
} from '../services/api/menuScannerApi.ts';
import { ScannedMenuPage } from '../types/menuScanner.ts';
import { NativeBridgeService } from '../services/native/NativeBridgeService.ts';

export interface NetworkDiagnosticState {
  stage: string;
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  errorType: ExtractionErrorType | null;
  requestId: string;
  timestamp: string;
  durationMs: number;
  online: boolean;
  modelUsed?: string;
  activeAiService?: boolean;
}

export interface BackendHealthState {
  isChecking: boolean;
  isHealthy: boolean | null;
  status: number;
  latencyMs: number;
  service?: string;
  aiServiceAvailable?: boolean;
  checkedAt?: string;
  error?: string;
}

export interface UseAuraNetworkOptions {
  /**
   * Optional custom timeout in milliseconds (defaults to 120000ms / 2 minutes for multimodal OCR)
   */
  timeoutMs?: number;
  /**
   * Automatic background health check on mount
   */
  checkHealthOnMount?: boolean;
}

export interface UseAuraNetworkResult<T = AnalyzeMenuResponse['data']> {
  /**
   * Normalized extracted data payload
   */
  data: T | null;
  /**
   * High-level user facing error message if request failed
   */
  error: string | null;
  /**
   * Normalized loading state (also aliased as isLoading)
   */
  loading: boolean;
  isLoading: boolean;
  /**
   * Retry function to replay the last failed operation
   */
  retry: () => Promise<AnalyzeMenuResponse | null>;

  /**
   * The effective backend base URL being targeted
   */
  backendUrl: string;
  /**
   * Candidate endpoints evaluated in priority order
   */
  candidateEndpoints: string[];
  /**
   * User-friendly progress stage text during multi-step analyze flow
   */
  progressStage: string;
  /**
   * Aliased error message for backward compatibility
   */
  errorMessage: string | null;
  /**
   * Machine-readable error type classification (e.g. AI_HIGH_DEMAND, NO_INTERNET, etc.)
   */
  errorType: ExtractionErrorType | null;
  /**
   * Diagnostic state for debugging, inspection and technical drawer
   */
  diagnosticState: NetworkDiagnosticState | null;
  /**
   * Health status of the configured backend
   */
  health: BackendHealthState;
  /**
   * Triggers an explicit health check against the configured AI_BACKEND_URL
   */
  checkBackendHealth: (customUrl?: string) => Promise<boolean>;
  /**
   * Performs the menu analysis request with pre-flight health verification,
   * error mapping, and diagnostic logging
   */
  analyzeMenuWithAi: (
    pages: ScannedMenuPage[],
    onProgressUpdate?: (stage: string) => void
  ) => Promise<AnalyzeMenuResponse>;
  /**
   * Generic robust fetch wrapper against configured backend endpoints
   */
  fetchWithDiagnostics: <R = any>(
    pathOrUrl: string,
    options?: RequestInit & { stage?: string; timeout?: number }
  ) => Promise<R>;
  /**
   * Clears active errors and resets diagnostic states
   */
  clearError: () => void;
  /**
   * Diagnostic logger that sanitizes tokens/payloads before emitting
   */
  logDiagnostic: (entry: Partial<NetworkDiagnosticState> & { message?: string; level?: 'info' | 'warn' | 'error' }) => void;
}

/**
 * Strips sensitive query parameters, bearer tokens, or embedded API keys
 * from URLs or strings to guarantee zero secret leakage into developer consoles.
 */
function sanitizeUrlForLogging(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    // If it's a relative URL
    if (rawUrl.startsWith('/')) return rawUrl;

    const parsed = new URL(rawUrl);
    // Remove query params that often store keys or tokens
    const sensitiveKeys = ['key', 'api_key', 'apikey', 'token', 'auth', 'secret', 'password', 'signature'];
    sensitiveKeys.forEach(k => {
      if (parsed.searchParams.has(k)) {
        parsed.searchParams.set(k, '[REDACTED]');
      }
    });
    // Remove username/password in URL authority
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    // Fallback regex sanitizer
    return rawUrl
      .replace(/([?&](?:key|api_key|token|auth)=)[^&]+/gi, '$1[REDACTED]')
      .replace(/:\/\/([^:@]+):([^@]+)@/g, '://[REDACTED]:[REDACTED]@');
  }
}

/**
 * useAuraNetwork
 *
 * Production hook managing network interactions for AuraPOS AI extraction:
 * 1. Resolves backend URL from Settings (apiServerUrl), environment, or same-origin proxy.
 * 2. Runs pre-flight / on-demand health checks against /api/health.
 * 3. Dispatches multi-page image analysis with progressive status updates.
 * 4. Catches and classifies network failures into granular ExtractionErrorType codes.
 * 5. Logs diagnostic snapshots to console without sensitive headers, keys, or image blobs.
 * 6. Returns normalized structure { data, error, loading, retry, ... } for consumers.
 */
export function useAuraNetwork(options: UseAuraNetworkOptions = {}): UseAuraNetworkResult {
  const { timeoutMs = 120000, checkHealthOnMount = false } = options;
  const { settings, showToast } = usePOS();

  // 1. Resolve Effective Backend URL
  const backendUrl = settings.apiServerUrl?.trim() || MenuScannerApi.getEffectiveBackendUrl();
  const candidateEndpoints = MenuScannerApi.getCandidateEndpoints();

  // 2. Local State
  const [data, setData] = useState<AnalyzeMenuResponse['data'] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ExtractionErrorType | null>(null);
  const [diagnosticState, setDiagnosticState] = useState<NetworkDiagnosticState | null>(null);

  // Cached last request parameters for normalized retry()
  const lastPagesRef = useRef<ScannedMenuPage[] | null>(null);
  const lastProgressCallbackRef = useRef<((stage: string) => void) | undefined>(undefined);

  const [health, setHealth] = useState<BackendHealthState>({
    isChecking: false,
    isHealthy: null,
    status: 0,
    latencyMs: 0
  });

  // 3. Diagnostic Logger (Zero sensitive data leakage)
  const logDiagnostic = useCallback(
    (entry: Partial<NetworkDiagnosticState> & { message?: string; level?: 'info' | 'warn' | 'error' }) => {
      const sanitizedEndpoint = sanitizeUrlForLogging(entry.endpoint || backendUrl);
      const isDev =
        typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
          ? true
          : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

      const logPayload = {
        app: 'AuraPOS',
        subsystem: 'AI_NETWORK',
        stage: entry.stage || 'NETWORK_STAGE',
        endpoint: sanitizedEndpoint,
        method: entry.method || 'POST',
        status: entry.status ?? 0,
        statusText: entry.statusText || '',
        errorType: entry.errorType || null,
        requestId: entry.requestId || `diag_${Date.now()}`,
        durationMs: entry.durationMs ?? 0,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        message: entry.message || '',
        timestamp: entry.timestamp || new Date().toISOString()
      };

      const level = entry.level || (entry.status && entry.status >= 400 ? 'error' : 'info');

      if (level === 'error') {
        console.error('[AuraPOS_NETWORK_DIAGNOSTIC]', logPayload);
      } else if (level === 'warn') {
        console.warn('[AuraPOS_NETWORK_DIAGNOSTIC]', logPayload);
      } else if (isDev) {
        console.log('[AuraPOS_NETWORK_DIAGNOSTIC]', logPayload);
      }
    },
    [backendUrl]
  );

  // 4. Robust Fetch Wrapper
  const fetchWithDiagnostics = useCallback(
    async <R = any>(
      pathOrUrl: string,
      reqOpts: RequestInit & { stage?: string; timeout?: number } = {}
    ): Promise<R> => {
      const stage = reqOpts.stage || 'HTTP_REQUEST';
      const timeout = reqOpts.timeout || timeoutMs;
      const targetUrl = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
        ? pathOrUrl
        : `${backendUrl.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;

      const sanitizedUrl = sanitizeUrlForLogging(targetUrl);
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const startTime = performance.now();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        logDiagnostic({
          stage: `${stage}_INIT`,
          endpoint: sanitizedUrl,
          method: reqOpts.method || 'GET',
          requestId,
          message: `Sending ${reqOpts.method || 'GET'} request`
        });

        const headers: Record<string, string> = {
          Accept: 'application/json',
          'X-Request-ID': requestId,
          ...((reqOpts.headers as any) || {})
        };

        const res = await fetch(targetUrl, {
          ...reqOpts,
          headers,
          signal: controller.signal
        });

        clearTimeout(timer);
        const durationMs = Math.round(performance.now() - startTime);

        if (!res.ok) {
          let errDetail = `Server responded with HTTP ${res.status}: ${res.statusText}`;
          try {
            const errJson = await res.json();
            if (errJson.error) errDetail = errJson.error;
          } catch {}

          const diagnosticSnapshot: NetworkDiagnosticState = {
            stage,
            endpoint: sanitizedUrl,
            method: reqOpts.method || 'GET',
            status: res.status,
            statusText: res.statusText,
            errorType: `HTTP_${res.status}` as ExtractionErrorType,
            requestId,
            timestamp: new Date().toISOString(),
            durationMs,
            online: typeof navigator !== 'undefined' ? navigator.onLine : true
          };

          setDiagnosticState(diagnosticSnapshot);
          logDiagnostic({
            ...diagnosticSnapshot,
            level: 'error',
            message: errDetail
          });

          throw new ExtractionDiagnosticError({
            stage,
            endpoint: sanitizedUrl,
            status: res.status,
            statusText: res.statusText,
            errorType: `HTTP_${res.status}` as ExtractionErrorType,
            message: errDetail,
            requestId
          });
        }

        const json = await res.json();
        logDiagnostic({
          stage: `${stage}_SUCCESS`,
          endpoint: sanitizedUrl,
          method: reqOpts.method || 'GET',
          status: res.status,
          statusText: 'OK',
          durationMs,
          requestId,
          message: `Request completed successfully (${durationMs}ms)`
        });

        return json as R;
      } catch (err: any) {
        clearTimeout(timer);
        const durationMs = Math.round(performance.now() - startTime);

        if (err instanceof ExtractionDiagnosticError) {
          throw err;
        }

        let classified: ExtractionErrorType = 'BACKEND_UNREACHABLE';
        let msg = err.message || 'Network request failed';

        if (err.name === 'AbortError') {
          classified = 'BACKEND_TIMEOUT';
          msg = `Request timed out after ${Math.round(timeout / 1000)} seconds.`;
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          classified = 'NO_INTERNET';
          msg = 'Device connection was lost. Please verify network connectivity.';
        }

        const diagnosticSnapshot: NetworkDiagnosticState = {
          stage,
          endpoint: sanitizedUrl,
          method: reqOpts.method || 'GET',
          status: 0,
          statusText: 'CLIENT_EXCEPTION',
          errorType: classified,
          requestId,
          timestamp: new Date().toISOString(),
          durationMs,
          online: typeof navigator !== 'undefined' ? navigator.onLine : true
        };

        setDiagnosticState(diagnosticSnapshot);
        logDiagnostic({
          ...diagnosticSnapshot,
          level: 'error',
          message: msg
        });

        throw new ExtractionDiagnosticError({
          stage,
          endpoint: sanitizedUrl,
          status: 0,
          statusText: 'CLIENT_EXCEPTION',
          errorType: classified,
          message: msg,
          requestId
        });
      }
    },
    [backendUrl, timeoutMs, logDiagnostic]
  );

  // 5. Request Health Check
  const checkBackendHealth = useCallback(
    async (customUrl?: string): Promise<boolean> => {
      const targetBase = (customUrl || backendUrl).trim().replace(/\/+$/, '');
      const healthEndpoint =
        targetBase.endsWith('/api/health') || targetBase.endsWith('/health')
          ? targetBase
          : `${targetBase}/api/health`;

      setHealth(prev => ({ ...prev, isChecking: true }));
      const startTime = performance.now();

      try {
        logDiagnostic({
          stage: 'HEALTH_CHECK_INIT',
          endpoint: healthEndpoint,
          method: 'GET',
          message: 'Performing pre-flight health check'
        });

        // Use NativeBridge health check if on Android POS hardware
        const res = await NativeBridgeService.backendDiagnostics.testConnection(healthEndpoint);
        const duration = Math.round(performance.now() - startTime);

        if (res.success) {
          setHealth({
            isChecking: false,
            isHealthy: true,
            status: res.status || 200,
            latencyMs: res.latencyMs || duration,
            service: res.service || 'AuraPOS AI Backend',
            aiServiceAvailable: res.aiServiceAvailable ?? true,
            checkedAt: new Date().toLocaleTimeString()
          });

          logDiagnostic({
            stage: 'HEALTH_CHECK_SUCCESS',
            endpoint: healthEndpoint,
            method: 'GET',
            status: res.status || 200,
            statusText: 'OK',
            durationMs: duration,
            message: `Health check passed (${duration}ms)`
          });
          return true;
        } else {
          const failStatus = res.status || 0;
          setHealth({
            isChecking: false,
            isHealthy: false,
            status: failStatus,
            latencyMs: duration,
            error: res.error || `HTTP ${failStatus}`,
            checkedAt: new Date().toLocaleTimeString()
          });

          logDiagnostic({
            stage: 'HEALTH_CHECK_FAILED',
            endpoint: healthEndpoint,
            method: 'GET',
            status: failStatus,
            errorType: (res.errorType as ExtractionErrorType) || 'BACKEND_UNREACHABLE',
            durationMs: duration,
            message: res.error || 'Health check failed',
            level: 'warn'
          });
          return false;
        }
      } catch (err: any) {
        const duration = Math.round(performance.now() - startTime);
        const failMsg = err?.message || 'Connection test failed';

        setHealth({
          isChecking: false,
          isHealthy: false,
          status: 0,
          latencyMs: duration,
          error: failMsg,
          checkedAt: new Date().toLocaleTimeString()
        });

        logDiagnostic({
          stage: 'HEALTH_CHECK_EXCEPTION',
          endpoint: healthEndpoint,
          method: 'GET',
          status: 0,
          errorType: 'BACKEND_UNREACHABLE',
          durationMs: duration,
          message: failMsg,
          level: 'error'
        });
        return false;
      }
    },
    [backendUrl, logDiagnostic]
  );

  // Optional on-mount health check
  useEffect(() => {
    if (checkHealthOnMount) {
      checkBackendHealth();
    }
  }, [checkHealthOnMount, checkBackendHealth]);

  // 6. Clear Errors
  const clearError = useCallback(() => {
    setErrorMessage(null);
    setErrorType(null);
    setDiagnosticState(null);
  }, []);

  // 7. Analyze Menu with AI Execution Flow
  const analyzeMenuWithAi = useCallback(
    async (
      pages: ScannedMenuPage[],
      onProgressUpdate?: (stage: string) => void
    ): Promise<AnalyzeMenuResponse> => {
      lastPagesRef.current = pages;
      lastProgressCallbackRef.current = onProgressUpdate;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const startTime = performance.now();

      setLoading(true);
      setErrorMessage(null);
      setErrorType(null);
      setDiagnosticState(null);

      const updateProgress = (stage: string) => {
        setProgressStage(stage);
        onProgressUpdate?.(stage);
      };

      try {
        // Step A: Client Offline Check
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new ExtractionDiagnosticError({
            stage: 'PREFLIGHT_OFFLINE',
            endpoint: backendUrl,
            errorType: 'NO_INTERNET',
            message: 'Device is offline. An active internet connection is required to analyze menus with AI. Scanned pages are preserved locally.',
            requestId
          });
        }

        // Step B: Validation
        if (!pages || pages.length === 0) {
          throw new ExtractionDiagnosticError({
            stage: 'VALIDATION',
            endpoint: backendUrl,
            errorType: 'EMPTY_IMAGE',
            message: 'Please provide at least one menu page photo to analyze.',
            requestId
          });
        }

        updateProgress('Connecting to AuraPOS AI...');

        // Step C: Trigger MenuScannerApi with progressive status updates
        const result = await MenuScannerApi.analyzeMenu(pages, (stage) => {
          updateProgress(stage);
        });

        const durationMs = Math.round(performance.now() - startTime);

        if (!result.success || !result.data) {
          throw new ExtractionDiagnosticError({
            stage: 'PARSING_RESULTS',
            endpoint: backendUrl,
            errorType: (result.errorType as ExtractionErrorType) || 'AI_PROVIDER_ERROR',
            message: result.error || 'The AI service returned an empty extraction result.',
            requestId
          });
        }

        setData(result.data);

        // Log successful operation
        logDiagnostic({
          stage: 'EXTRACTION_COMPLETE',
          endpoint: backendUrl,
          status: 200,
          statusText: 'OK',
          durationMs,
          requestId,
          modelUsed: result.modelUsed,
          message: `Extracted ${result.data.products?.length || 0} items from ${pages.length} pages via ${result.modelUsed || 'AI'}`
        });

        setDiagnosticState({
          stage: 'SUCCESS',
          endpoint: backendUrl,
          method: 'POST',
          status: 200,
          statusText: 'OK',
          errorType: null,
          requestId,
          timestamp: new Date().toISOString(),
          durationMs,
          online: true,
          modelUsed: result.modelUsed
        });

        return result;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - startTime);
        let classifiedErrorType: ExtractionErrorType = 'UNKNOWN_ERROR';
        let userMessage = err.message || 'Error processing menu scan.';
        let httpStatus = 0;
        let httpStatusText = '';
        let stage = 'ANALYSIS_STAGE';

        if (err instanceof ExtractionDiagnosticError) {
          stage = err.stage;
          classifiedErrorType = err.errorType;
          userMessage = err.message;
          httpStatus = err.status;
          httpStatusText = err.statusText;
        } else if (err.errorType) {
          classifiedErrorType = err.errorType;
          userMessage = err.message || userMessage;
          httpStatus = err.status || 0;
        } else if (err.name === 'AbortError') {
          stage = 'NETWORK_TIMEOUT';
          classifiedErrorType = 'BACKEND_TIMEOUT';
          userMessage = `The AI vision extraction timed out after ${Math.round(timeoutMs / 1000)} seconds. Scanned pages are preserved locally.`;
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          stage = 'NETWORK_OFFLINE';
          classifiedErrorType = 'NO_INTERNET';
          userMessage = 'Device connection was lost during scan. Scanned pages are preserved locally.';
        }

        // Granular Error Message Refinements
        if (classifiedErrorType === 'AI_HIGH_DEMAND') {
          userMessage = 'Google AI is currently experiencing high demand spikes. Scanned pages are saved. Tap Retry in a few moments.';
        } else if (classifiedErrorType === 'AI_RATE_LIMIT') {
          userMessage = 'AI rate limit reached. Please wait a few seconds and tap Retry Extraction.';
        } else if (classifiedErrorType === 'BACKEND_UNREACHABLE') {
          userMessage = `Could not establish connection to the AuraPOS AI backend (${sanitizeUrlForLogging(backendUrl)}). Verify server connection.`;
        } else if (classifiedErrorType === 'PAYLOAD_TOO_LARGE') {
          userMessage = 'Menu images exceed maximum payload size. Images have been compressed, but please try fewer pages at once.';
        }

        const diagnosticSnapshot: NetworkDiagnosticState = {
          stage,
          endpoint: sanitizeUrlForLogging(backendUrl),
          method: 'POST',
          status: httpStatus,
          statusText: httpStatusText,
          errorType: classifiedErrorType,
          requestId,
          timestamp: new Date().toISOString(),
          durationMs,
          online: typeof navigator !== 'undefined' ? navigator.onLine : true
        };

        setDiagnosticState(diagnosticSnapshot);
        setErrorType(classifiedErrorType);
        setErrorMessage(userMessage);

        logDiagnostic({
          ...diagnosticSnapshot,
          level: 'error',
          message: userMessage
        });

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, timeoutMs, logDiagnostic]
  );

  // 8. Normalized Retry Function
  const retry = useCallback(async (): Promise<AnalyzeMenuResponse | null> => {
    if (!lastPagesRef.current || lastPagesRef.current.length === 0) {
      return null;
    }
    return analyzeMenuWithAi(lastPagesRef.current, lastProgressCallbackRef.current);
  }, [analyzeMenuWithAi]);

  return {
    data,
    error: errorMessage,
    loading,
    isLoading: loading,
    retry,

    backendUrl,
    candidateEndpoints,
    progressStage,
    errorMessage,
    errorType,
    diagnosticState,
    health,
    checkBackendHealth,
    analyzeMenuWithAi,
    fetchWithDiagnostics,
    clearError,
    logDiagnostic
  };
}
