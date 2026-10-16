/**
 * AuraPOS Synchronization Error Classification
 * Conforming to Step 24 & Step 25:
 * Categorizes errors to distinguish retryable from non-retryable failures.
 * Never logs or exposes passwords, PINs, tokens, or private secrets.
 */

export type SyncErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONFLICT_ERROR'
  | 'SERVER_ERROR'
  | 'DATABASE_ERROR'
  | 'DUPLICATE_EVENT'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

export interface ClassifiedSyncError {
  type: SyncErrorType;
  retryable: boolean;
  message: string;
  statusCode?: number;
  originalCode?: string;
  timestamp: string;
}

export class SyncErrorClassifier {
  static classify(err: any): ClassifiedSyncError {
    const timestamp = new Date().toISOString();
    const rawMsg = err?.message || String(err || 'Unknown error');
    const code = err?.code || err?.error_code || '';
    const status = err?.status || err?.statusCode || 0;

    // 1. Network / connectivity issues (Retryable)
    if (
      rawMsg.includes('Failed to fetch') ||
      rawMsg.includes('NetworkError') ||
      rawMsg.includes('network') ||
      rawMsg.includes('offline') ||
      rawMsg.includes('timeout') ||
      rawMsg.includes('ETIMEDOUT') ||
      rawMsg.includes('ECONNREFUSED') ||
      rawMsg.includes('socket hang up') ||
      status === 503 ||
      status === 504 ||
      status === 408
    ) {
      return {
        type: 'NETWORK_ERROR',
        retryable: true,
        message: 'Network connection unavailable or timed out. Will retry automatically.',
        statusCode: status || 0,
        originalCode: code,
        timestamp
      };
    }

    // 2. Authentication failures (Non-retryable without re-auth)
    if (
      status === 401 ||
      rawMsg.includes('JWT') ||
      rawMsg.includes('invalid claim') ||
      rawMsg.includes('token expired') ||
      code === 'PGRST301' ||
      rawMsg.includes('unauthorized')
    ) {
      return {
        type: 'AUTH_ERROR',
        retryable: false,
        message: 'Authentication invalid or session expired. Cloud sign-in required.',
        statusCode: 401,
        originalCode: code,
        timestamp
      };
    }

    // 3. Permission / RLS denial (Non-retryable without role change)
    if (
      status === 403 ||
      rawMsg.includes('permission denied') ||
      rawMsg.includes('row-level security') ||
      rawMsg.includes('RLS') ||
      code === '42501'
    ) {
      return {
        type: 'PERMISSION_ERROR',
        retryable: false,
        message: 'Permission denied by Row Level Security for this store or terminal.',
        statusCode: 403,
        originalCode: code,
        timestamp
      };
    }

    // 4. Duplicate Event / Idempotent duplicate (Non-retryable, safe resolution)
    if (
      code === '23505' || // Postgres unique_violation
      rawMsg.includes('duplicate key') ||
      rawMsg.includes('already exists') ||
      rawMsg.includes('IDEMPOTENT_IGNORED') ||
      rawMsg.includes('uq_sync_events_client_id')
    ) {
      return {
        type: 'DUPLICATE_EVENT',
        retryable: false,
        message: 'Event was already recorded idempotently on server.',
        statusCode: 409,
        originalCode: code,
        timestamp
      };
    }

    // 5. Validation / Bad Request (Non-retryable: client payload must be fixed)
    if (
      status === 400 ||
      code === '22P02' || // invalid_text_representation
      code === '23502' || // not_null_violation
      code === '23514' || // check_violation
      rawMsg.includes('violates check constraint') ||
      rawMsg.includes('violates not-null constraint')
    ) {
      return {
        type: 'VALIDATION_ERROR',
        retryable: false,
        message: `Data validation constraint failure: ${rawMsg}`,
        statusCode: 400,
        originalCode: code,
        timestamp
      };
    }

    // 6. Conflict / concurrency (Requires merge or user resolution)
    if (status === 409 || rawMsg.includes('conflict')) {
      return {
        type: 'CONFLICT_ERROR',
        retryable: false,
        message: 'Concurrent modification conflict detected.',
        statusCode: 409,
        originalCode: code,
        timestamp
      };
    }

    // 7. Not Found (Non-retryable)
    if (status === 404 || rawMsg.includes('not found') || code === 'PGRST116') {
      return {
        type: 'NOT_FOUND',
        retryable: false,
        message: 'Target cloud resource not found.',
        statusCode: 404,
        originalCode: code,
        timestamp
      };
    }

    // 8. 500 Server error (Retryable with backoff)
    if (status >= 500) {
      return {
        type: 'SERVER_ERROR',
        retryable: true,
        message: 'Supabase Cloud internal error. Temporary; will retry.',
        statusCode: status,
        originalCode: code,
        timestamp
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      retryable: false,
      message: rawMsg,
      statusCode: status || 0,
      originalCode: code,
      timestamp
    };
  }
}
