import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { ShieldCheck, Lock, X, KeyRound, AlertCircle, UserCheck } from 'lucide-react';

export const OwnerAuthModal: React.FC = () => {
  const {
    isOwnerAuthModalOpen,
    ownerAuthTitle,
    closeOwnerAuthModal,
    submitOwnerPin,
    ownerEmployee,
    switchEmployee,
    t
  } = usePOS();

  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOwnerAuthModalOpen) {
      setPin('');
      setError('');
    }
  }, [isOwnerAuthModalOpen]);

  if (!isOwnerAuthModalOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        // Auto-validate on 4 digits
        setTimeout(async () => {
          const result = await submitOwnerPin(nextPin);
          if (!result.ok) {
            setError(
              result.lockedForMs
                ? `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)}s.`
                : t('auth.invalidOwnerPin', 'Incorrect Owner PIN. Please try again.')
            );
            setPin('');
          }
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleQuickSwitchOwner = () => {
    if (ownerEmployee) {
      switchEmployee(ownerEmployee.id);
      closeOwnerAuthModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {t('auth.ownerRequired', 'Owner Authorization Required')}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {ownerAuthTitle || t('auth.onlyOwnerCanChange', 'Only the owner can make changes')}
              </p>
            </div>
          </div>
          <button
            onClick={closeOwnerAuthModal}
            className="p-1.5 text-blue-200 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Owner Details Card */}
          <div className="flex items-center justify-between p-3 bg-blue-50/80 rounded-2xl border border-blue-100 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {ownerEmployee ? ownerEmployee.name.split(' ').map(n => n[0]).join('') : 'ER'}
              </div>
              <div>
                <p className="font-bold text-slate-900">{ownerEmployee?.name || 'Elena Rostova'}</p>
                <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">
                  {t('auth.storeOwner', 'Store Owner')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickSwitchOwner}
              className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 font-bold rounded-lg border border-blue-200 transition-colors text-[11px] flex items-center gap-1 shadow-2xs"
            >
              <UserCheck className="w-3 h-3" />
              <span>{t('auth.switchUser', 'Switch User')}</span>
            </button>
          </div>

          {/* PIN Indicators */}
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              {t('auth.enterOwnerPin', 'Enter 4-digit Owner PIN to authorize')}
            </p>
            <div className="flex justify-center items-center gap-3 py-2">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    pin.length > idx
                      ? 'bg-blue-600 scale-110 shadow-xs'
                      : 'border-2 border-slate-300 bg-slate-100'
                  }`}
                />
              ))}
            </div>
            {error && (
              <p className="text-xs text-rose-600 font-semibold flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-12 rounded-2xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 active:scale-95 text-slate-800 text-lg font-bold transition-all flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-200 active:scale-95 text-slate-500 text-xs font-bold transition-all flex items-center justify-center uppercase"
            >
              {t('auth.clear', 'C')}
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-12 rounded-2xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 active:scale-95 text-slate-800 text-lg font-bold transition-all flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-slate-200 active:scale-95 text-slate-600 text-xs font-bold transition-all flex items-center justify-center"
            >
              ⌫
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            {t('auth.ownerProtected', 'Protected by Store Owner Security')}
          </span>
          <button
            type="button"
            onClick={closeOwnerAuthModal}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold transition-colors"
          >
            {t('auth.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
