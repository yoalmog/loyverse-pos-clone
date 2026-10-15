'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Check } from 'lucide-react';
import { soundFeedback } from '@/lib/accessibility';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onAuthorized: () => void;
}

export function OwnerAuthModal({
  isOpen,
  onClose,
  title = 'Autorización Requerida',
  description = 'Esta acción requiere confirmación con el PIN de Administrador / Propietario (9999).',
  onAuthorized,
}: OwnerAuthModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '9999') {
      soundFeedback.playCheckoutChime();
      setPin('');
      setError('');
      onAuthorized();
      onClose();
    } else {
      soundFeedback.playErrorBuzz();
      setError('PIN de Administrador incorrecto.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-400">{description}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="relative">
            <input
              type="password"
              autoFocus
              maxLength={6}
              placeholder="Ingrese PIN (9999)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-center text-sm font-bold tracking-widest text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>

          {error && (
            <p className="text-center text-xs font-medium text-rose-400">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white hover:bg-rose-400 active:scale-95"
            >
              <Check className="h-4 w-4" />
              Autorizar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
