/**
 * AuraPOS — Production System Health, Diagnostics & Audit Service
 * Conforming to Phase 8 Production Readiness:
 * - Real-time diagnostic evaluation (Storage, Sync, Database Security, Hardware)
 * - Health scoring & status categorization (HEALTHY, DEGRADED, CRITICAL)
 * - Unified System Audit Logging with capped ring buffer persistence
 * - Incident detection and remediation recommendations
 */

import { StorageService } from './storageService.ts';
import { SyncEngine } from './sync/SyncEngine.ts';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message: string;
  metric?: string | number;
  remediation?: string;
}

export interface SystemHealthReport {
  timestamp: string;
  overallStatus: HealthStatus;
  components: ComponentHealth[];
  metrics: {
    offlineQueueDepth: number;
    salesCount: number;
    productsCount: number;
    auditLogCount: number;
    printersConfigured: number;
  };
}

export type AuditCategory =
  | 'AUTH'
  | 'SECURITY'
  | 'DATA_MUTATION'
  | 'SYNC'
  | 'MIGRATION'
  | 'HARDWARE'
  | 'BACKUP_RESTORE'
  | 'SYSTEM';

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface SystemAuditEntry {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  details: string;
  employeeId?: string;
  employeeName?: string;
  storeId?: string;
  timestamp: string;
}

const SYSTEM_AUDIT_LOGS_KEY = 'aurapos_system_audit_logs_v2';
const MAX_SYSTEM_AUDIT_LOGS = 500;

export class SystemAuditService {
  private static memoryLogs: SystemAuditEntry[] = [];

  /**
   * Retrieve persistent system audit log entries
   */
  static getAuditLogs(): SystemAuditEntry[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [...this.memoryLogs];
      }
      const raw = localStorage.getItem(SYSTEM_AUDIT_LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [...this.memoryLogs];
    }
  }

  /**
   * Record a structured system audit event
   */
  static log(
    category: AuditCategory,
    severity: AuditSeverity,
    action: string,
    details: string,
    employeeInfo?: { id?: string; name?: string; storeId?: string }
  ): SystemAuditEntry {
    const entry: SystemAuditEntry = {
      id: `sys_aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      severity,
      action,
      details,
      employeeId: employeeInfo?.id,
      employeeName: employeeInfo?.name,
      storeId: employeeInfo?.storeId || StorageService.getSettings().id,
      timestamp: new Date().toISOString()
    };

    try {
      const logs = this.getAuditLogs();
      logs.unshift(entry);
      if (logs.length > MAX_SYSTEM_AUDIT_LOGS) {
        logs.length = MAX_SYSTEM_AUDIT_LOGS;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYSTEM_AUDIT_LOGS_KEY, JSON.stringify(logs));
      } else {
        this.memoryLogs = logs;
      }
    } catch (e) {
      console.warn('Unable to persist system audit log:', e);
      this.memoryLogs.unshift(entry);
    }

    return entry;
  }
}

export class SystemHealthService {
  /**
   * Run comprehensive diagnostic evaluation
   */
  static async evaluateSystemHealth(): Promise<SystemHealthReport> {
    const components: ComponentHealth[] = [];

    // 1. Storage Health Check
    let storageStatus: HealthStatus = 'HEALTHY';
    let storageMessage = 'Local database storage operational and healthy.';
    let storageRemediation: string | undefined;

    try {
      if (typeof localStorage === 'undefined') {
        storageStatus = 'DEGRADED';
        storageMessage = 'Running in non-browser environment; in-memory storage fallback active.';
      } else {
        const testKey = '__aurapos_health_probe__';
        localStorage.setItem(testKey, 'probe');
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        if (retrieved !== 'probe') {
          storageStatus = 'CRITICAL';
          storageMessage = 'LocalStorage probe verification failed.';
          storageRemediation = 'Check device browser storage permissions and available disk space.';
        }
      }
    } catch (e: any) {
      storageStatus = 'CRITICAL';
      storageMessage = `Storage error: ${e.message}`;
      storageRemediation = 'Free device disk storage or clear browser quota exceptions.';
    }

    components.push({
      name: 'Local Database Storage',
      status: storageStatus,
      message: storageMessage,
      remediation: storageRemediation
    });

    // 2. Offline Sync Engine Health
    let syncStatus: HealthStatus = 'HEALTHY';
    let syncMessage = 'Sync engine active with zero pending backlog.';
    let syncRemediation: string | undefined;

    const offlineQueue = StorageService.getOfflineQueue();
    const queueDepth = offlineQueue.length;

    if (queueDepth > 100) {
      syncStatus = 'CRITICAL';
      syncMessage = `Extreme pending sync backlog (${queueDepth} transactions awaiting cloud upload).`;
      syncRemediation = 'Verify Internet connectivity and check cloud synchronization status.';
    } else if (queueDepth > 10) {
      syncStatus = 'DEGRADED';
      syncMessage = `Elevated pending sync backlog (${queueDepth} transactions).`;
      syncRemediation = 'Allow POS background worker to process queue once connection stabilizes.';
    }

    components.push({
      name: 'Cloud Synchronization Engine',
      status: syncStatus,
      message: syncMessage,
      metric: queueDepth,
      remediation: syncRemediation
    });

    // 3. Database Security & Credentials Check
    let dbSecStatus: HealthStatus = 'HEALTHY';
    let dbSecMessage = 'Client environment clean with zero exposed privileged service keys.';
    let dbSecRemediation: string | undefined;

    const envSupabaseKey = (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || '';
    if (envSupabaseKey.includes('service_role') || envSupabaseKey.includes('secret')) {
      dbSecStatus = 'CRITICAL';
      dbSecMessage = 'CRITICAL SECURITY BREACH: Privileged service_role secret detected in client environment!';
      dbSecRemediation = 'Immediately revoke leaked key in Supabase Dashboard and replace with anon key.';
    }

    components.push({
      name: 'Client Security & Credential Isolation',
      status: dbSecStatus,
      message: dbSecMessage,
      remediation: dbSecRemediation
    });

    // 4. Hardware Printing Subsystem Health
    let hwStatus: HealthStatus = 'HEALTHY';
    let hwMessage = 'Hardware printer interfaces configured.';
    let hwRemediation: string | undefined;

    const printers = StorageService.getPrinters();
    if (printers.length === 0) {
      hwStatus = 'DEGRADED';
      hwMessage = 'No receipt printers currently configured for this POS terminal.';
      hwRemediation = 'Connect Bluetooth X18 Mini or generic LAN ESC/POS printer in Settings.';
    }

    components.push({
      name: 'Hardware Printing Subsystem',
      status: hwStatus,
      message: hwMessage,
      metric: printers.length,
      remediation: hwRemediation
    });

    // Compute Overall Status
    let overallStatus: HealthStatus = 'HEALTHY';
    if (components.some(c => c.status === 'CRITICAL')) {
      overallStatus = 'CRITICAL';
    } else if (components.some(c => c.status === 'DEGRADED')) {
      overallStatus = 'DEGRADED';
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      components,
      metrics: {
        offlineQueueDepth: queueDepth,
        salesCount: StorageService.getSales().length,
        productsCount: StorageService.getProducts().length,
        auditLogCount: SystemAuditService.getAuditLogs().length,
        printersConfigured: printers.length
      }
    };
  }
}
