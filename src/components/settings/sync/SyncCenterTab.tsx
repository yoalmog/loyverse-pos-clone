import React, { useState, useEffect } from 'react';
import { usePOS } from '../../../context/POSContext.tsx';
import { SyncEngine, FailedSyncEvent } from '../../../services/sync/SyncEngine.ts';
import { NativeBridgeService } from '../../../services/native/NativeBridgeService.ts';
import { BackupRecoveryService } from '../../../services/backupRecoveryService.ts';
import { SystemHealthService, SystemHealthReport, SystemAuditService, SystemAuditEntry } from '../../../services/systemHealthService.ts';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
  RotateCcw,
  Terminal,
  Database,
  Info,
  Download,
  Upload,
  Activity,
  FileText
} from 'lucide-react';

export const SyncCenterTab: React.FC = () => {
  const {
    isOffline,
    isSyncing,
    pendingSyncCount,
    triggerSync,
    retryFailedSync,
    syncEngineStatus,
    settings,
    isOwner,
    showToast,
    refreshData,
    t
  } = usePOS();

  const [failedEvents, setFailedEvents] = useState<FailedSyncEvent[]>([]);
  const [terminalInfo, setTerminalInfo] = useState<any>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemAuditEntry[]>([]);

  useEffect(() => {
    loadSyncData();
    evaluateHealth();
  }, [syncEngineStatus, isSyncing]);

  const evaluateHealth = async () => {
    try {
      const report = await SystemHealthService.evaluateSystemHealth();
      setHealthReport(report);
      setSystemLogs(SystemAuditService.getAuditLogs().slice(0, 10));
    } catch (e) {
      console.warn('Unable to evaluate system health:', e);
    }
  };

  const loadSyncData = async () => {
    setIsLoadingEvents(true);
    try {
      const failed = await SyncEngine.getFailedEvents();
      setFailedEvents(failed);

      if (NativeBridgeService.isNativeAndroid()) {
        const idInfo = NativeBridgeService.localDb.getTerminalIdentity();
        setTerminalInfo(idInfo);
      }
    } catch (_) {
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleManualSync = () => {
    triggerSync();
  };

  const handleRetryFailed = async () => {
    await retryFailedSync();
    await loadSyncData();
  };

  const handleExportBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const envelope = await BackupRecoveryService.createStoreBackup();
      const jsonStr = JSON.stringify(envelope, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AuraPOS_Backup_${envelope.storeId}_${new Date().toISOString().substring(0, 10)}.aurabackup`;
      a.click();
      URL.revokeObjectURL(url);

      SystemAuditService.log(
        'BACKUP_RESTORE',
        'INFO',
        'STORE_BACKUP_EXPORTED',
        `Full backup envelope created (Checksum: ${envelope.checksum.substring(0, 12)}...)`
      );

      showToast({
        type: 'success',
        title: 'Backup Created',
        message: 'Store backup downloaded with SHA-256 integrity signature.'
      });
      evaluateHealth();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Backup Failed',
        message: err.message || 'Unable to create store backup.'
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const validation = await BackupRecoveryService.validateBackup(payload);
      if (!validation.valid) {
        showToast({
          type: 'error',
          title: 'Backup Verification Failed',
          message: validation.errors.join('; ')
        });
        return;
      }

      if (
        !window.confirm(
          `Restore backup from ${validation.createdAt}?\n\nContains: ${validation.entityCounts.products || 0} products, ${validation.entityCounts.sales || 0} sales.\n\nActive store data will be replaced atomically with automatic rollback protection.`
        )
      ) {
        return;
      }

      const res = await BackupRecoveryService.restoreBackup(payload);
      if (res.success) {
        SystemAuditService.log(
          'BACKUP_RESTORE',
          'WARNING',
          'STORE_BACKUP_RESTORED',
          `Restored backup successfully. Entities: ${JSON.stringify(res.restoredEntities)}`
        );

        showToast({
          type: 'success',
          title: 'Store Restored Successfully',
          message: 'All collections verified and restored from backup.'
        });
        await refreshData();
        evaluateHealth();
      } else {
        showToast({
          type: 'error',
          title: 'Restore Failed (Rolled Back)',
          message: res.error || 'Restore could not be applied.'
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Restore Error',
        message: err.message || 'Invalid backup file format.'
      });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return t('sync.never', 'Never');
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isSyncing
                ? 'bg-blue-500/10 text-blue-600'
                : syncEngineStatus?.state === 'SYNC_ERROR'
                ? 'bg-rose-500/10 text-rose-600'
                : isOffline
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : syncEngineStatus?.state === 'SYNC_ERROR' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : isOffline ? (
              <WifiOff className="w-6 h-6" />
            ) : (
              <Wifi className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
                {t('sync.syncCenter', 'Cloud Sync & Disaster Recovery Center')}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isOffline
                    ? 'bg-amber-100 text-amber-800'
                    : isSyncing
                    ? 'bg-blue-100 text-blue-800'
                    : syncEngineStatus?.state === 'SYNC_ERROR'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isOffline
                  ? t('sync.offline', 'Offline Mode')
                  : isSyncing
                  ? t('sync.syncing', 'Synchronizing')
                  : syncEngineStatus?.state === 'SYNC_ERROR'
                  ? t('sync.error', 'Sync Issue')
                  : t('sync.connected', 'Cloud Connected')}
              </span>
            </div>

            <p className="text-xs text-[var(--theme-text-secondary)] mt-0.5">
              {t('sync.lastSynced', 'Last synchronized')}:{' '}
              <span className="font-semibold text-[var(--theme-text-primary)]">
                {formatTimestamp(syncEngineStatus?.lastSuccessfulSync || null)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {failedEvents.length > 0 && isOwner && (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isSyncing || isOffline}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('sync.retryFailed', 'Retry Failed Queue')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isOffline}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            style={{ backgroundColor: 'var(--theme-button)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? t('sync.syncing', 'Syncing...') : t('sync.syncNow', 'Sync Now')}</span>
          </button>
        </div>
      </div>

      {/* Production System Health & Diagnostics */}
      {healthReport && (
        <div className="p-4 rounded-2xl theme-surface border border-[var(--theme-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Production System Health & Diagnostics
              </h4>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                healthReport.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800'
                  : healthReport.overallStatus === 'DEGRADED'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {healthReport.overallStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {healthReport.components.map((c, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--theme-text-primary)]">{c.name}</span>
                  <span
                    className={`text-[10px] font-bold ${
                      c.status === 'HEALTHY'
                        ? 'text-emerald-600'
                        : c.status === 'DEGRADED'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-secondary)] mt-0.5">{c.message}</p>
                {c.remediation && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">Tip: {c.remediation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disaster Recovery & Store Backup */}
      <div className="p-4 rounded-2xl theme-surface border border-[var(--theme-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
              Disaster Recovery & Store Snapshot Backups
            </h4>
          </div>
          <span className="text-[11px] text-[var(--theme-text-secondary)]">
            SHA-256 Authenticated
          </span>
        </div>

        <p className="text-xs text-[var(--theme-text-secondary)]">
          Export complete authenticated snapshots of your catalog, transaction history, inventory movements, and configuration. Restore points feature automatic fail-safe rollbacks if an import encounters an error.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={isCreatingBackup}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isCreatingBackup ? 'Generating Snapshot...' : 'Export Store Backup (.aurabackup)'}</span>
          </button>

          <label className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>{isRestoring ? 'Restoring Snapshot...' : 'Restore from Backup File'}</span>
            <input
              type="file"
              accept=".aurabackup,.json"
              onChange={handleImportBackup}
              disabled={isRestoring}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Terminal Identity & Database Engine */}
      <div className="p-4 rounded-2xl theme-surface border border-[var(--theme-border)] space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--theme-text-secondary)]" />
          <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
            {t('sync.terminalIdentity', 'Terminal Environment & Database Engine')}
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
            <span className="text-[10px] text-[var(--theme-text-secondary)] uppercase block font-sans font-bold">
              {t('sync.storeId', 'Store ID')}
            </span>
            <span className="font-bold text-[var(--theme-text-primary)] truncate block mt-0.5">
              {terminalInfo?.storeId || settings.id || 'store_aura_main'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
            <span className="text-[10px] text-[var(--theme-text-secondary)] uppercase block font-sans font-bold">
              {t('sync.terminalId', 'Persistent Terminal ID')}
            </span>
            <span className="font-bold text-[var(--theme-text-primary)] truncate block mt-0.5">
              {terminalInfo?.terminalId || 'term_aura_pos_01'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
            <span className="text-[10px] text-[var(--theme-text-secondary)] uppercase block font-sans font-bold">
              {t('sync.databaseEngine', 'Local Database Engine')}
            </span>
            <span className="font-bold text-emerald-600 truncate block mt-0.5">
              {NativeBridgeService.isNativeAndroid() ? 'Android Room + SQLite (v2)' : 'IndexedDB (Offline Engine v4)'}
            </span>
          </div>
        </div>
      </div>

      {/* System Audit Trail (Last 10 Events) */}
      {systemLogs.length > 0 && (
        <div className="p-4 rounded-2xl theme-surface border border-[var(--theme-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
                System Security & Incident Audit Trail
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[var(--theme-text-secondary)]">
              Capped Ring Buffer
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {systemLogs.map(log => (
              <div
                key={log.id}
                className="p-2 rounded-lg bg-[var(--theme-surface-variant)] border border-[var(--theme-border)] flex items-start justify-between gap-2 text-[11px]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                      {log.category}
                    </span>
                    <span className="font-semibold text-[var(--theme-text-primary)]">{log.action}</span>
                  </div>
                  <p className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5">{log.details}</p>
                </div>
                <span className="font-mono text-[9px] text-[var(--theme-text-secondary)] whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Sync Events (For Administrators - Section 33) */}
      <div className="p-4 rounded-2xl theme-surface border border-[var(--theme-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
              {t('sync.failedEventsTitle', 'Failed Sync Events (Administrator Inspection)')}
            </h4>
          </div>
          <span className="text-xs text-[var(--theme-text-secondary)]">
            {failedEvents.length} {t('sync.issuesReported', 'issue(s)')}
          </span>
        </div>

        {failedEvents.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-[var(--theme-surface-variant)] border border-[var(--theme-border)]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-[var(--theme-text-primary)]">
              {t('sync.noFailedEvents', 'Zero Failed Synchronization Events')}
            </p>
            <p className="text-[11px] text-[var(--theme-text-secondary)] mt-0.5">
              {t('sync.cleanPipeline', 'All transactional and catalog events are processed or queued safely.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--theme-text-secondary)]">
              <thead className="bg-[var(--theme-surface-variant)] border-b border-[var(--theme-border)] text-[var(--theme-text-primary)] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Client Event ID</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Error Cause</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {failedEvents.map(ev => (
                  <tr key={ev.id} className="hover:bg-[var(--theme-surface-variant)] transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] text-[var(--theme-text-primary)]">
                      {ev.clientEventId}
                    </td>
                    <td className="py-2 px-3 uppercase text-[10px] font-bold">
                      {ev.entityType}
                    </td>
                    <td className="py-2 px-3 uppercase font-semibold">
                      {ev.operation}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {ev.attempts}
                    </td>
                    <td className="py-2 px-3 text-rose-600 max-w-xs truncate">
                      {ev.errorMessage || 'Server unreachable'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11px]">
                      {new Date(ev.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
