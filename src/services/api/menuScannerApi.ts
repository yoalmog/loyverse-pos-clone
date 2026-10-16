import { ScannedMenuPage } from '../../types/menuScanner.ts';
import { getApiAuthHeaders } from './authHeaders.ts';
import { optimizeImageForOCR, validateMenuPageImage } from '../../utils/imageOptimizer.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { StorageService } from '../storageService.ts';

export interface AnalyzeMenuRequest {
  requestId?: string;
  endpointUrl?: string;
  apiKey?: string;
  pages: Array<{
    dataUrl: string;
    mimeType: string;
    rotation?: number;
  }>;
}

export interface AnalyzeMenuResponse {
  success: boolean;
  data?: {
    menuTitle?: string;
    detectedCurrency?: string;
    notes?: string;
    categories: Array<{
      name: string;
      description?: string;
      color?: string;
      iconName?: string;
      autoPrintKitchen?: boolean;
    }>;
    products: Array<{
      name: string;
      categoryName: string;
      description?: string;
      price: number;
      cost?: number;
      unit?: string;
      sku?: string;
      isSpicy?: boolean;
      isVegetarian?: boolean;
      isGlutenFree?: boolean;
      isAlcoholic?: boolean;
      variants?: Array<{
        name: string;
        price: number;
        sku?: string;
      }>;
      modifiers?: Array<{
        name: string;
        required?: boolean;
        options: Array<{
          name: string;
          priceDelta: number;
        }>;
      }>;
    }>;
  };
  error?: string;
  errorType?: ExtractionErrorType;
  status?: number;
  requestId?: string;
  timingMs?: number;
  modelUsed?: string;
}

// Requirement 17: Granular, structured network and runtime failure states
export type ExtractionErrorType =
  | 'NO_INTERNET'
  | 'BACKEND_UNREACHABLE'
  | 'BACKEND_TIMEOUT'
  | 'TLS_ERROR'
  | 'DNS_ERROR'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_429'
  | 'HTTP_500'
  | 'HTTP_502'
  | 'HTTP_503'
  | 'INVALID_RESPONSE'
  | 'AI_PROVIDER_ERROR'
  | 'AI_HIGH_DEMAND'
  | 'AI_RATE_LIMIT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_IMAGE'
  | 'EMPTY_IMAGE'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ERROR';

export class ExtractionDiagnosticError extends Error {
  stage: string;
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  errorType: ExtractionErrorType;
  requestId: string;
  timestamp: string;

  constructor(opts: {
    stage: string;
    endpoint: string;
    method?: string;
    status?: number;
    statusText?: string;
    errorType: ExtractionErrorType;
    message: string;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'ExtractionDiagnosticError';
    this.stage = opts.stage;
    this.endpoint = opts.endpoint;
    this.method = opts.method || 'POST';
    this.status = opts.status || 0;
    this.statusText = opts.statusText || '';
    this.errorType = opts.errorType;
    this.requestId = opts.requestId || `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.timestamp = new Date().toISOString();

    this.logDiagnostic();
  }

  logDiagnostic() {
    const isDev =
      typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
        ? true
        : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

    // Structured development diagnostic logger without secrets or credentials (Requirement 3 & 20)
    if (isDev || typeof window !== 'undefined') {
      console.error('[AI_MENU_EXTRACTION_ERROR]', {
        stage: this.stage,
        endpoint: this.endpoint,
        method: this.method,
        status: this.status,
        statusText: this.statusText,
        errorType: this.errorType,
        message: this.message,
        requestId: this.requestId,
        timestamp: this.timestamp
      });
    }
  }
}

export class MenuScannerApi {
  /**
   * Stored user API key helper (from localStorage, StoreSettings, or environment)
   */
  static getStoredApiKey(): string {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('aurapos_gemini_api_key') : null;
      if (local && local.trim()) return local.trim();
    } catch {}
    try {
      const settings = StorageService.getSettings() as any;
      if (settings?.geminiApiKey && typeof settings.geminiApiKey === 'string' && settings.geminiApiKey.trim()) {
        return settings.geminiApiKey.trim();
      }
    } catch {}
    const envKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GEMINI_API_KEY : '';
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
    return '';
  }

  static setStoredApiKey(key: string): void {
    const clean = (key || '').trim();
    try {
      if (typeof localStorage !== 'undefined') {
        if (clean) {
          localStorage.setItem('aurapos_gemini_api_key', clean);
        } else {
          localStorage.removeItem('aurapos_gemini_api_key');
        }
      }
    } catch {}
    try {
      const settings = StorageService.getSettings();
      if (settings) {
        StorageService.saveSettings({
          ...settings,
          geminiApiKey: clean
        });
      }
    } catch {}
  }

  /**
   * Returns the primary target backend base URL for display in diagnostics & settings
   */
  static getEffectiveBackendUrl(): string {
    try {
      const settings = StorageService.getSettings();
      if (settings?.apiServerUrl && typeof settings.apiServerUrl === 'string' && settings.apiServerUrl.trim()) {
        return settings.apiServerUrl.trim().replace(/\/+$/, '');
      }
    } catch {}

    const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : '';
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }

    const isBrowser = typeof window !== 'undefined';
    const isVirtualAndroid =
      isBrowser &&
      (window.location.host.includes('androidplatform.net') ||
        window.location.protocol === 'file:' ||
        window.location.origin === 'null');

    if (!isVirtualAndroid && isBrowser && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }

    return 'https://api.aurapos.com';
  }

  /**
   * Resolve valid, verified candidate endpoints for the current runtime (Web, PWA, or Android APK)
   * Note: NEVER defaults to ephemeral AI Studio development proxy URLs that require session cookies.
   */
  static getCandidateEndpoints(): string[] {
    const endpoints: string[] = [];

    // 1. User-configured custom server URL from Settings -> System Diagnostics -> AI Backend
    try {
      const settings = StorageService.getSettings();
      if (settings?.apiServerUrl && typeof settings.apiServerUrl === 'string' && settings.apiServerUrl.trim()) {
        const cleanBase = settings.apiServerUrl.trim().replace(/\/+$/, '');
        endpoints.push(`${cleanBase}/api/menu/analyze`);
      }
    } catch {}

    // 2. Build-time environment variable (e.g. VITE_API_URL)
    const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : '';
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      const cleanEnv = envUrl.trim().replace(/\/+$/, '');
      const fullUrl = `${cleanEnv}/api/menu/analyze`;
      if (!endpoints.includes(fullUrl)) {
        endpoints.push(fullUrl);
      }
    }

    // 3. Same-Origin Relative Endpoint (Best for Web, PWA, and Dev Server — zero CORS, direct proxy)
    const isBrowser = typeof window !== 'undefined';
    const isVirtualAndroid =
      isBrowser &&
      (window.location.host.includes('androidplatform.net') ||
        window.location.protocol === 'file:' ||
        window.location.origin === 'null');

    if (!isVirtualAndroid) {
      endpoints.push('/api/menu/analyze');
    }

    // 4. Default production cloud backend if running in standalone Android APK
    if (endpoints.length === 0) {
      endpoints.push('https://api.aurapos.com/api/menu/analyze');
    }

    return endpoints;
  }

  /**
   * Analyze multiple menu pages using Gemini Multimodal Vision AI
   */
  static async analyzeMenu(
    pages: ScannedMenuPage[],
    onProgress?: (stage: string) => void
  ): Promise<AnalyzeMenuResponse> {
    const requestId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Requirement 23: Offline check - scanned menu pages remain preserved locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ExtractionDiagnosticError({
        stage: 'OFFLINE_CHECK',
        endpoint: 'client_network',
        errorType: 'NO_INTERNET',
        message: 'Your device is currently offline. An active internet connection is required to analyze menus with AI. Scanned pages are preserved locally.',
        requestId
      });
    }

    // Step 1: Validate input pages
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      throw new ExtractionDiagnosticError({
        stage: 'VALIDATION',
        endpoint: 'client_validation',
        errorType: 'EMPTY_IMAGE',
        message: 'Please provide at least one menu page photo to analyze.',
        requestId
      });
    }

    // Requirement 18: Progressive status reporting
    onProgress?.('Connecting to AI...');

    // Step 2: Pre-process and optimize images to crisp, lean OCR resolution
    onProgress?.('Uploading menu...');

    const optimizedPages: Array<{ dataUrl: string; mimeType: string; rotation: number }> = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const validation = validateMenuPageImage(page.dataUrl, page.mimeType);
      if (!validation.isValid) {
        throw new ExtractionDiagnosticError({
          stage: 'IMAGE_VALIDATION',
          endpoint: 'client_preprocessing',
          errorType: 'INVALID_IMAGE',
          message: `Page ${i + 1} (${page.name || 'Untitled'}) has invalid data: ${validation.error}`,
          requestId
        });
      }

      try {
        const opt = await optimizeImageForOCR(page.dataUrl, page.rotation || 0, 2200, 0.88);
        optimizedPages.push({
          dataUrl: opt.dataUrl,
          mimeType: 'image/jpeg',
          rotation: 0
        });
      } catch (err: any) {
        console.warn(`[AI_MENU_SCAN] Compression failed for page ${i + 1}, using original:`, err);
        optimizedPages.push({
          dataUrl: page.dataUrl,
          mimeType: page.mimeType || 'image/jpeg',
          rotation: page.rotation || 0
        });
      }
    }

    const candidateUrls = this.getCandidateEndpoints();
    const primaryEndpoint = candidateUrls[0];
    const apiKey = this.getStoredApiKey();

    // Payload includes requestId and target endpointUrl for Android native forwarder (Requirement 19 & 22)
    const payload: AnalyzeMenuRequest = {
      requestId,
      endpointUrl: primaryEndpoint,
      apiKey: apiKey || undefined,
      pages: optimizedPages
    };

    const payloadJson = JSON.stringify(payload);
    const payloadSizeBytes = new Blob([payloadJson]).size;
    const payloadMb = (payloadSizeBytes / (1024 * 1024)).toFixed(2);

    if (payloadSizeBytes > 28 * 1024 * 1024) {
      throw new ExtractionDiagnosticError({
        stage: 'PAYLOAD_SIZE_CHECK',
        endpoint: 'client_preprocessing',
        errorType: 'PAYLOAD_TOO_LARGE',
        message: `Total menu images payload (${payloadMb} MB) exceeds maximum safe upload size (28 MB). Scanned pages are preserved locally.`,
        requestId
      });
    }

    onProgress?.('Analyzing menu...');

    // Step 3: If running inside Android Native Shell with native AI scanner capability
    if (
      NativeBridgeService.isNativeAndroid() &&
      typeof window !== 'undefined' &&
      window.AndroidPOSNative?.analyzeMenu
    ) {
      try {
        const authHeaders = await getApiAuthHeaders();
        if (apiKey) {
          authHeaders['X-Gemini-Api-Key'] = apiKey;
        }
        const nativeRes = await NativeBridgeService.menuScanner.analyzeMenuViaNative(
          JSON.stringify({ ...payload, authHeaders })
        );
        if (nativeRes && nativeRes.success && nativeRes.data) {
          onProgress?.('Processing results...');
          return nativeRes as AnalyzeMenuResponse;
        }

        // If native bridge returned an error, capture structured diagnostic without swallowing
        if (nativeRes && !nativeRes.success) {
          const errType = (nativeRes as any).errorType || 'BACKEND_UNREACHABLE';
          throw new ExtractionDiagnosticError({
            stage: 'ANDROID_NATIVE_BRIDGE',
            endpoint: primaryEndpoint,
            status: (nativeRes as any).status || 0,
            statusText: 'NATIVE_BRIDGE_ERROR',
            errorType: errType as ExtractionErrorType,
            message: nativeRes.error || 'Native bridge could not establish connection to the AuraPOS AI backend.',
            requestId
          });
        }
      } catch (err: any) {
        if (err instanceof ExtractionDiagnosticError) {
          throw err;
        }
        console.warn('Native bridge AI scan returned exception, falling back to web fetch:', err);
      }
    }

    // Step 4: Execute Web/HTTP Request with structured error handling & 120s timeout
    let lastDiagnosticError: ExtractionDiagnosticError | null = null;
    let serverRequestedClientFallback = false;

    for (let u = 0; u < candidateUrls.length; u++) {
      const endpointUrl = candidateUrls[u];
      const controller = new AbortController();
      // 120-second timeout for multi-page vision models
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        console.log(`[AI_MENU_SCAN] Sending request to endpoint: ${endpointUrl} (timeout 120s, RequestId: ${requestId})`);
        const authHeaders = await getApiAuthHeaders();
        if (apiKey) {
          authHeaders['X-Gemini-Api-Key'] = apiKey;
          authHeaders['x-gemini-api-key'] = apiKey;
        }

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Request-ID': requestId,
            ...authHeaders
          },
          body: payloadJson,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          onProgress?.('Processing results...');
          const result: AnalyzeMenuResponse = await response.json();
          if (result && (result.success || result.data)) {
            return result;
          }
          if (result && result.error) {
            throw new ExtractionDiagnosticError({
              stage: 'AI_PROVIDER_PROCESSING',
              endpoint: endpointUrl,
              status: response.status,
              statusText: response.statusText,
              errorType: (result.errorType as ExtractionErrorType) || 'AI_PROVIDER_ERROR',
              message: result.error,
              requestId
            });
          }
        } else {
          // Server returned an error HTTP status
          let serverErrorMsg = `Server responded with HTTP ${response.status}: ${response.statusText}`;
          let errorType: ExtractionErrorType = `HTTP_${response.status}` as ExtractionErrorType;

          try {
            const errJson = await response.json();
            if (errJson.error) {
              serverErrorMsg = errJson.error;
            }
            if (errJson.errorType) {
              errorType = errJson.errorType;
            }
          } catch {}

          if (errorType === 'CONFIG_ERROR' || response.status === 500) {
            // Server has no GEMINI_API_KEY or failed internally
            serverRequestedClientFallback = true;
          }

          if (response.status === 413) {
            errorType = 'PAYLOAD_TOO_LARGE';
            serverErrorMsg = 'Upload payload too large for the server. Scanned pages are preserved locally.';
          } else if (response.status === 503) {
            errorType = 'AI_HIGH_DEMAND';
            serverErrorMsg = 'Google AI is currently experiencing high demand spikes. Please wait a few moments and tap Retry Extraction.';
          } else if (response.status === 429) {
            errorType = 'AI_RATE_LIMIT';
            serverErrorMsg = 'Google AI rate limit reached. Please wait a few seconds and tap Retry Extraction.';
          } else if (response.status === 404) {
            errorType = 'HTTP_404';
            serverErrorMsg = `The API endpoint '${endpointUrl}' was not found (404). Please verify your backend server URL in Settings → AI Backend.`;
          } else if (response.status === 401 || response.status === 403) {
            errorType = response.status === 401 ? 'HTTP_401' : 'HTTP_403';
            serverErrorMsg = `Access to backend was denied (HTTP ${response.status}). Check authentication credentials or proxy gateway.`;
          } else if (response.status === 502) {
            errorType = 'HTTP_502';
            serverErrorMsg = 'Bad Gateway (502). The upstream server failed to respond.';
          }

          const diagErr = new ExtractionDiagnosticError({
            stage: 'SERVER_RESPONSE',
            endpoint: endpointUrl,
            status: response.status,
            statusText: response.statusText,
            errorType,
            message: serverErrorMsg,
            requestId
          });

          // If it's a fatal rate-limit or auth rejection specific to user credentials, throw immediately
          if (response.status === 429) {
            throw diagErr;
          }

          lastDiagnosticError = diagErr;
          // If server reported CONFIG_ERROR, break to client direct attempt
          if (errorType === 'CONFIG_ERROR') {
            break;
          }
        }
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err instanceof ExtractionDiagnosticError && err.status === 429) {
          throw err;
        }

        let errorType: ExtractionErrorType = 'BACKEND_UNREACHABLE';
        let userMessage = `Could not establish connection to the AuraPOS AI backend (${endpointUrl}).`;

        if (err.name === 'AbortError') {
          errorType = 'BACKEND_TIMEOUT';
          userMessage = 'AI analysis timed out. The menu pages are preserved locally. Please retry.';
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          errorType = 'NO_INTERNET';
          userMessage = 'Your device is offline. An active internet connection is required. Scanned pages are preserved locally.';
        } else if (err.message && (err.message.includes('SSL') || err.message.includes('certificate') || err.message.includes('CERT'))) {
          errorType = 'TLS_ERROR';
          userMessage = 'TLS/SSL certificate handshake failed. Verify server security configuration.';
        } else if (err.message && (err.message.includes('ENOTFOUND') || err.message.includes('DNS') || err.message.includes('getaddrinfo'))) {
          errorType = 'DNS_ERROR';
          userMessage = 'DNS lookup failed. The hostname could not be resolved.';
        } else if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
          errorType = 'BACKEND_UNREACHABLE';
          userMessage = `Could not establish connection to the AuraPOS AI backend at ${endpointUrl}.`;
        } else if (err.message) {
          userMessage = err.message;
        }

        lastDiagnosticError = new ExtractionDiagnosticError({
          stage: 'NETWORK_FETCH',
          endpoint: endpointUrl,
          status: 0,
          statusText: err.name || 'NETWORK_FAILURE',
          errorType,
          message: userMessage,
          requestId
        });

        console.warn(`[AI_MENU_SCAN] Candidate endpoint ${endpointUrl} failed:`, err);
      }
    }

    // Step 5: Direct Client-Side Gemini Vision Fallback
    // If backend is unreachable or not configured with a server key, try direct client call
    if (apiKey) {
      console.log('[AI_MENU_SCAN] Attempting direct Google Gemini Vision call from client...');
      try {
        return await this.analyzeMenuClientDirect(optimizedPages, apiKey, onProgress, requestId);
      } catch (directErr: any) {
        console.warn('[AI_MENU_SCAN] Direct client Gemini Vision call failed:', directErr);
        if (directErr instanceof ExtractionDiagnosticError) {
          throw directErr;
        }
      }
    } else if (serverRequestedClientFallback || (lastDiagnosticError && lastDiagnosticError.errorType === 'BACKEND_UNREACHABLE')) {
      throw new ExtractionDiagnosticError({
        stage: 'API_KEY_CHECK',
        endpoint: 'client_configuration',
        status: 0,
        statusText: 'KEY_NOT_CONFIGURED',
        errorType: 'CONFIG_ERROR',
        message: 'Google Gemini API key required for menu scanning. Please configure your free API key in the scanner or settings.',
        requestId
      });
    }

    if (lastDiagnosticError) {
      throw lastDiagnosticError;
    }

    throw new ExtractionDiagnosticError({
      stage: 'COMPLETION',
      endpoint: 'unknown',
      errorType: 'UNKNOWN_ERROR',
      message: 'Menu scanning could not be completed. The menu pages are preserved locally. Please retry.',
      requestId
    });
  }

  /**
   * Direct browser/client Google Gemini Multimodal Vision API call
   */
  static async analyzeMenuClientDirect(
    optimizedPages: Array<{ dataUrl: string; mimeType: string; rotation: number }>,
    apiKey: string,
    onProgress?: (stage: string) => void,
    requestId: string = `client_${Date.now()}`
  ): Promise<AnalyzeMenuResponse> {
    const startTime = performance.now();
    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.8-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash'
    ];
    let lastError: any = null;

    const imageParts = optimizedPages.map(p => {
      const base64Data = p.dataUrl.includes('base64,') ? p.dataUrl.split('base64,')[1] : p.dataUrl;
      return {
        inlineData: {
          mimeType: p.mimeType || 'image/jpeg',
          data: base64Data
        }
      };
    });

    const promptText = `
You are an expert Restaurant & Café Menu OCR Specialist and POS Catalog Engineer.
Analyze the provided restaurant/cafe menu page image(s) thoroughly (supports English, Spanish, Italian, and all languages).

CRITICAL EXTRACTION INSTRUCTIONS:
0. Read ONLY what is actually printed on the image(s). NEVER invent, guess or complete items, names or prices. If a page is blurry, rotated or unreadable, extract only what you can truly read. If nothing is readable, return empty "categories" and "products" arrays and explain why in "notes". Pages may be slightly tilted or rotated: read the text in whatever orientation it appears.
1. Extract ALL categories/sections, products, and prices. Section headings (e.g. "Starters", "Pizzas", "Drinks", "Desserts", "Cocktails") become categories. Keep the menu's own language and spelling.
2. For each category: identify the clear Category Name; assign an appropriate Lucide icon name (e.g. Pizza, Coffee, Utensils, Flame, Wine, Beer, Cake, Salad, Sandwich, Sparkles, CupSoda, GlassWater); assign a clean modern hex color.
3. For each product: extract the exact Item Name as printed; the description/ingredients only if printed under the item. If prices are in size columns (e.g. Small / Medium / Large), fill the 'variants' array with one entry per size and its price, and set 'price' to the lowest. If there is one price, set 'price' to it. Extract modifiers/extras only if printed on the menu. Detect dietary tags: isSpicy, isVegetarian, isGlutenFree, isAlcoholic.
4. Deduplicate products if the same item appears across multiple scanned pages.
5. Return ONLY pure valid JSON in the following exact format:
{
  "menuTitle": "Restaurant or Menu Title",
  "detectedCurrency": "$ or S/ or €",
  "notes": "Any special notes or promos",
  "categories": [
    {
      "name": "Category Name",
      "description": "Short description",
      "color": "#2563EB",
      "iconName": "Utensils",
      "autoPrintKitchen": true
    }
  ],
  "products": [
    {
      "name": "Item Name",
      "categoryName": "Category Name",
      "description": "Item ingredients and description",
      "price": 12.50,
      "cost": 6.00,
      "unit": "portion",
      "sku": "ITEM-101",
      "isSpicy": false,
      "isVegetarian": false,
      "isGlutenFree": false,
      "isAlcoholic": false,
      "variants": [
        { "name": "Regular", "price": 12.50, "sku": "ITEM-101-REG" }
      ],
      "modifiers": [
        {
          "name": "Options",
          "required": false,
          "options": [
            { "name": "Extra sauce", "priceDelta": 1.50 }
          ]
        }
      ]
    }
  ]
}
`;

    for (const model of modelsToTry) {
      try {
        onProgress?.(`Analyzing menu with Google ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  ...imageParts,
                  { text: promptText }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 16384
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

          if (response.status === 400 && (errMsg.includes('API key') || errMsg.includes('INVALID_ARGUMENT'))) {
            throw new ExtractionDiagnosticError({
              stage: 'CLIENT_GEMINI_AUTH',
              endpoint: 'generativelanguage.googleapis.com',
              status: response.status,
              statusText: 'INVALID_API_KEY',
              errorType: 'HTTP_401',
              message: 'The provided Google Gemini API Key is invalid. Please verify or re-enter your key in Settings.',
              requestId
            });
          }

          if (response.status === 429) {
            throw new ExtractionDiagnosticError({
              stage: 'CLIENT_GEMINI_RATE_LIMIT',
              endpoint: 'generativelanguage.googleapis.com',
              status: 429,
              statusText: 'RATE_LIMIT',
              errorType: 'AI_RATE_LIMIT',
              message: 'Google Gemini rate limit reached. Please wait a few moments and try again.',
              requestId
            });
          }

          lastError = new Error(`Model ${model} failed (${response.status}): ${errMsg}`);
          continue;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          lastError = new Error(`Model ${model} returned empty response`);
          continue;
        }

        const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsedData = JSON.parse(cleanJson);

        return {
          success: true,
          data: parsedData,
          modelUsed: model,
          requestId,
          timingMs: Math.round(performance.now() - startTime)
        };
      } catch (err: any) {
        if (err instanceof ExtractionDiagnosticError) {
          throw err;
        }
        lastError = err;
      }
    }

    throw new ExtractionDiagnosticError({
      stage: 'CLIENT_GEMINI_DIRECT',
      endpoint: 'generativelanguage.googleapis.com',
      status: 500,
      statusText: 'ALL_MODELS_FAILED',
      errorType: 'AI_PROVIDER_ERROR',
      message: lastError?.message || 'Direct Gemini AI extraction failed across all model fallbacks.',
      requestId
    });
  }
}
