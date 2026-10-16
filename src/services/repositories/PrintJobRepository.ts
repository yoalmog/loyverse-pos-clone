import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { PrintJob } from '../../types/printer.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';

export class PrintJobRepository {
  static async enqueue(job: PrintJob): Promise<PrintJob> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('print_jobs').insert({
          id: job.id.length === 36 ? job.id : undefined,
          store_id: job.storeId || 'store_aura_main',
          printer_id: job.printerId,
          sale_id: job.saleId && job.saleId.length === 36 ? job.saleId : null,
          job_type: job.jobType,
          payload: job.rawCommands || job.content,
          status: 'PENDING',
          attempt_count: job.attemptCount || 0
        });
      } catch (e: any) {
        console.warn('[PrintJobRepository] Exception enqueueing print job to Supabase:', e?.message);
      }
    }

    const current = StorageService.getPrintJobs();
    StorageService.savePrintJobs([job, ...current]);
    await LocalDB.put('print_jobs', job);
    return job;
  }

  static async updateStatus(id: string, status: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED', error?: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('print_jobs').update({
          status,
          last_error: error || null,
          printed_at: status === 'PRINTED' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq('id', id);
      } catch (e: any) {
        console.warn('[PrintJobRepository] Exception updating job status:', e?.message);
      }
    }

    const current = StorageService.getPrintJobs();
    const idx = current.findIndex(j => j.id === id);
    if (idx !== -1) {
      current[idx].status = status.toLowerCase() as any;
      if (error) current[idx].errorMessage = error;
      StorageService.savePrintJobs(current);
    }
  }
}
