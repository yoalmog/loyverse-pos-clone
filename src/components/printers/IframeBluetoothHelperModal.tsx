import React, { useState } from 'react';
import { ExternalLink, Copy, Check, ShieldAlert, Wifi, X, Smartphone, ArrowRight } from 'lucide-react';
import { usePOS } from '../../context/POSContext.tsx';

interface IframeBluetoothHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLan?: () => void;
}

export const IframeBluetoothHelperModal: React.FC<IframeBluetoothHelperModalProps> = ({
  isOpen,
  onClose,
  onSelectLan
}) => {
  const { t } = usePOS();
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-scaleUp">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {t('printers.iframeNoticeTitle', 'Bluetooth Restricted by Preview Container')}
                </h3>
              </div>
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                {t('printers.browserPolicy', 'Browser Security Policy Notice')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed space-y-2">
            <p className="font-semibold text-slate-800">
              {t(
                'printers.whyBlockedTitle',
                'Why did the Bluetooth scan not open?'
              )}
            </p>
            <p>
              {t(
                'printers.whyBlockedDesc',
                'Chrome and Android security policies strictly block the Web Bluetooth hardware scanner inside embedded iframe preview drawers (like AI Studio). To pair with physical Bluetooth printers (X18 Mini, POS-58, etc.), the application must run as a top-level browser tab.'
              )}
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('printers.howToPair', 'How to Connect Your Printer in 2 Steps')}
            </h4>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-950">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <p className="font-bold">
                  {t('printers.step1OpenTab', 'Open AuraPOS in a dedicated tab')}
                </p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  {t('printers.step1OpenTabDesc', 'Tap the button below. It will open this exact POS register outside the preview iframe.')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
              <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="font-bold">
                  {t('printers.step2ScanBt', 'Tap "Scan Bluetooth Printers"')}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('printers.step2ScanBtDesc', 'Android Chrome will open the native Bluetooth pairing dialog showing your nearby printer.')}
                </p>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2 space-y-2.5">
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t('printers.openFullTab', 'Open in Dedicated Tab (Enables Bluetooth)')}</span>
              <ArrowRight className="w-4 h-4 opacity-70 ml-1" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t('common.copied', 'URL Copied!') : t('printers.copyUrl', 'Copy Direct URL')}</span>
              </button>

              {onSelectLan && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectLan();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Wifi className="w-4 h-4 text-slate-500" />
                  <span>{t('printers.useLanInstead', 'Use LAN Printer')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Works on Chrome for Android, Windows, Mac & Linux</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            {t('common.close', 'Dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
};
