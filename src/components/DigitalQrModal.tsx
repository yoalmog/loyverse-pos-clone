'use client';

import React, { useState } from 'react';
import { X, QrCode, CheckCircle, Copy, Check, Smartphone, Printer } from 'lucide-react';
import { soundFeedback } from '@/lib/accessibility';

interface DigitalQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCents: number;
  currencySymbol: string;
  walletType: 'YAPE' | 'PLIN';
  onConfirmPayment: (referenceNumber: string) => void;
}

export function DigitalQrModal({
  isOpen,
  onClose,
  totalCents,
  currencySymbol,
  walletType,
  onConfirmPayment,
}: DigitalQrModalProps) {
  const [copied, setCopied] = useState(false);
  const [verificationState, setVerificationState] = useState<'IDLE' | 'VERIFYING' | 'CONFIRMED'>('IDLE');
  const [referenceInput, setReferenceInput] = useState('');

  if (!isOpen) return null;

  const phone = '987 654 321';
  const accountHolder = 'Café del Parque S.A.C.';
  const amountFormatted = (totalCents / 100).toFixed(2);
  const brandColor = walletType === 'YAPE' ? '#742384' : '#00a9e0'; // Yape Purple vs Plin Cyan

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(phone.replace(/\s+/g, ''));
    setCopied(true);
    soundFeedback.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    setVerificationState('VERIFYING');
    soundFeedback.playClick();
    setTimeout(() => {
      setVerificationState('CONFIRMED');
      soundFeedback.playCheckoutChime();
      setTimeout(() => {
        onConfirmPayment(referenceInput || `${walletType}-${Date.now().toString().slice(-6)}`);
      }, 700);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        {/* Top Header */}
        <div className="flex w-full items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {walletType === 'YAPE' ? 'Y' : 'P'}
            </span>
            <span className="text-sm font-bold text-white">
              Pago con {walletType === 'YAPE' ? 'Yape' : 'Plin'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code Presentation */}
        <div className="relative my-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-white p-5 shadow-lg">
          {/* Simulated High-Res SVG QR Code */}
          <svg className="h-44 w-44" viewBox="0 0 100 100">
            {/* Corner Markers */}
            <rect x="5" y="5" width="25" height="25" fill="#1e293b" rx="2" />
            <rect x="9" y="9" width="17" height="17" fill="#ffffff" />
            <rect x="13" y="13" width="9" height="9" fill={brandColor} />

            <rect x="70" y="5" width="25" height="25" fill="#1e293b" rx="2" />
            <rect x="74" y="9" width="17" height="17" fill="#ffffff" />
            <rect x="78" y="13" width="9" height="9" fill={brandColor} />

            <rect x="5" y="70" width="25" height="25" fill="#1e293b" rx="2" />
            <rect x="9" y="74" width="17" height="17" fill="#ffffff" />
            <rect x="13" y="78" width="9" height="9" fill={brandColor} />

            {/* Pattern Dots */}
            <circle cx="45" cy="15" r="3" fill="#1e293b" />
            <circle cx="55" cy="15" r="3" fill="#1e293b" />
            <circle cx="40" cy="25" r="2.5" fill="#1e293b" />
            <circle cx="50" cy="25" r="3" fill="#1e293b" />
            <circle cx="60" cy="25" r="2" fill="#1e293b" />
            <circle cx="15" cy="45" r="3" fill="#1e293b" />
            <circle cx="25" cy="45" r="2.5" fill="#1e293b" />
            <circle cx="35" cy="45" r="3" fill="#1e293b" />
            <circle cx="45" cy="45" r="4" fill={brandColor} />
            <circle cx="55" cy="45" r="4" fill={brandColor} />
            <circle cx="65" cy="45" r="3" fill="#1e293b" />
            <circle cx="75" cy="45" r="3" fill="#1e293b" />
            <circle cx="85" cy="45" r="2.5" fill="#1e293b" />
            <circle cx="40" cy="65" r="3" fill="#1e293b" />
            <circle cx="50" cy="65" r="2.5" fill="#1e293b" />
            <circle cx="60" cy="65" r="3" fill="#1e293b" />
            <circle cx="70" cy="65" r="3" fill="#1e293b" />
            <circle cx="45" cy="75" r="2.5" fill="#1e293b" />
            <circle cx="55" cy="75" r="3" fill="#1e293b" />
            <circle cx="65" cy="75" r="2.5" fill="#1e293b" />
            <circle cx="85" cy="75" r="3" fill="#1e293b" />
            <circle cx="50" cy="85" r="3" fill="#1e293b" />
            <circle cx="75" cy="85" r="3" fill="#1e293b" />
          </svg>

          <div
            className="mt-2 text-xs font-black uppercase tracking-wider"
            style={{ color: brandColor }}
          >
            {walletType} OFICIAL
          </div>
        </div>

        {/* Amount to pay */}
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-400">Total a Pagar</div>
          <div className="text-3xl font-black text-white">
            {currencySymbol} {amountFormatted}
          </div>
        </div>

        {/* Account Details Box */}
        <div className="w-full space-y-2 rounded-2xl border border-slate-800 bg-slate-800/40 p-3.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Titular de la cuenta:</span>
            <span className="font-bold text-white">{accountHolder}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Número de celular:</span>
            <button
              onClick={handleCopyPhone}
              className="flex items-center gap-1.5 font-bold text-emerald-400 hover:underline"
            >
              {phone}
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Reference number input */}
        <div className="mt-4 w-full">
          <input
            type="text"
            placeholder="N° de operación (Opcional)"
            value={referenceInput}
            onChange={(e) => setReferenceInput(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Confirm Payment Action Button */}
        <div className="mt-5 w-full">
          <button
            onClick={handleVerify}
            disabled={verificationState !== 'IDLE'}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-75"
            style={{
              backgroundColor:
                verificationState === 'CONFIRMED'
                  ? '#10b981'
                  : brandColor,
            }}
          >
            {verificationState === 'VERIFYING' ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verificando abono...</span>
              </>
            ) : verificationState === 'CONFIRMED' ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>¡Pago Confirmado!</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>Confirmar Pago Recibido</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
