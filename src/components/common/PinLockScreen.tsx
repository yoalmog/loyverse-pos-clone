import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Lock, Delete, Store, UserCheck, ShieldAlert } from 'lucide-react';

export const PinLockScreen: React.FC = () => {
  const { employees, unlockWithPin, settings } = usePOS();
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[2]?.id || employees[0]?.id || '');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const selectedEmp = employees.find(e => e.id === selectedEmpId) || employees[0];

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        // Auto-check on 4 digits
        setTimeout(async () => {
          const result = await unlockWithPin(nextPin, selectedEmp?.id);
          if (!result.ok) {
            setErrorMsg(
              result.lockedForMs
                ? `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)}s.`
                : 'Invalid PIN code. Please try again.'
            );
            setPin('');
          }
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-3 shadow-md">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{settings.name}</h2>
          <p className="text-xs text-slate-400 mt-1">Point of Sale Register Lock · Enter Employee PIN</p>
        </div>

        {/* Employee Switcher */}
        <div className="p-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Select Cashier / Staff
          </label>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {employees.map(emp => {
              const isSelected = emp.id === selectedEmpId;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmpId(emp.id);
                    setPin('');
                    setErrorMsg('');
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-semibold ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium truncate">{emp.name}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{emp.role}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* PIN Input Dots */}
          <div className="flex justify-center items-center gap-4 mb-4">
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  pin.length > idx
                    ? 'bg-blue-600 scale-110 shadow-sm'
                    : 'bg-slate-200 border border-slate-300'
                }`}
              />
            ))}
          </div>

          {errorMsg && (
            <div className="mb-4 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs text-center font-medium flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Numeric Touch Keypad */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="h-13 bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:text-blue-600 text-slate-800 text-xl font-semibold rounded-xl border border-slate-200 transition-colors shadow-xs flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 transition-colors flex items-center justify-center"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-13 bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:text-blue-600 text-slate-800 text-xl font-semibold rounded-xl border border-slate-200 transition-colors shadow-xs flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl border border-slate-200 transition-colors flex items-center justify-center"
              aria-label="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
