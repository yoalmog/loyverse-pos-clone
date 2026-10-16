import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { StoreSettings } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  Settings,
  Store,
  Receipt,
  Award,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  Palette,
  Globe,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Check,
  ShieldCheck,
  Lock,
  UserCheck,
  FolderTree,
  Accessibility,
  Server
} from 'lucide-react';
import { PrinterSettings } from './printers/PrinterSettings.tsx';
import { AccessibilitySettingsTab } from './accessibility/AccessibilitySettingsTab.tsx';
import { AppearanceSettingsTab } from './appearance/AppearanceSettingsTab.tsx';
import { SystemDiagnostics } from './SystemDiagnostics.tsx';
import { SyncCenterTab } from './sync/SyncCenterTab.tsx';
import { ReceiptConfigTab } from './receipt/ReceiptConfigTab.tsx';
import { THEME_PRESETS, ThemeColor, applyThemeVariables } from '../../utils/theme.ts';
import { STORE_LOGO_PRESETS } from '../../utils/productImages.ts';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n/translations.ts';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    refreshData,
    showToast,
    isOffline,
    pendingSyncCount,
    triggerSync,
    setLanguage,
    setThemeColor,
    isOwner,
    ownerEmployee,
    requireOwnerAuth,
    switchEmployee,
    setActiveRoute,
    t
  } = usePOS();

  const [activeTab, setActiveTab] = useState<'store' | 'appearance' | 'accessibility' | 'printers' | 'receipt' | 'loyalty' | 'data' | 'diagnostics'>('store');
  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    themeColor: settings.themeColor || 'blue',
    language: settings.language || 'en'
  });

  const handleChange = (field: keyof StoreSettings, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    if (field === 'themeColor') {
      applyThemeVariables(val as ThemeColor);
      setThemeColor(val as ThemeColor);
    }
    if (field === 'language') {
      setLanguage(val as SupportedLanguage);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: 'warning', title: 'Image too large', message: 'Logo must be smaller than 2MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleChange('logoUrl', reader.result);
        showToast({ type: 'success', title: 'Logo uploaded' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    requireOwnerAuth(() => {
      updateSettings(formData);
    }, t('settings.saveOwnerAuth', 'Save Store Configuration & Settings'));
  };

  const handleResetData = () => {
    requireOwnerAuth(() => {
      if (confirm(t('settings.confirmReset', 'Are you sure you want to restore the system to initial clean store data?'))) {
        StorageService.resetAllData();
        refreshData();
        setFormData(StorageService.getSettings());
        showToast({ type: 'success', title: t('settings.resetSuccess', 'Store Data Restored'), message: t('settings.resetSuccessDesc', 'Application restored to initial clean catalog state.') });
      }
    }, t('settings.resetOwnerAuth', 'Reset Store Database'));
  };

  return (
    <div className="flex-1 theme-app-bg p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {t('settings.title', 'Store & System Settings')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('settings.subtitle', 'Configure business profile, color themes, thermal receipt format, loyalty rules, and hardware')}
            </p>
          </div>

          {/* Owner Role Status Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isOwner ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('auth.ownerActive', 'Owner Mode Active')}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => requireOwnerAuth(() => {}, t('auth.authorizeOwner', 'Verify Store Owner Authorization'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Lock className="w-4 h-4 text-amber-600" />
                <span>{t('auth.ownerRequiredBadge', 'Owner Access Required')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Non-Owner Notice Banner */}
        {!isOwner && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('auth.ownerLockBannerTitle', 'Owner-Protected Settings')}</p>
                <p className="text-amber-800/90 mt-0.5 text-[11px]">
                  {t('auth.ownerLockBannerDesc', 'Only the store owner can modify business details, tax rates, themes, and receipts. Changes will require the 4-digit Owner PIN.')}
                </p>
              </div>
            </div>

            {ownerEmployee && (
              <button
                type="button"
                onClick={() => switchEmployee(ownerEmployee.id)}
                className="px-3 py-1.5 bg-white hover:bg-amber-600 hover:text-white text-amber-900 border border-amber-300 rounded-xl font-bold transition-colors text-xs whitespace-nowrap flex items-center gap-1 shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t('auth.switchOwnerBtn', 'Switch to Owner')}</span>
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto scrollbar-none">
          {[
            { id: 'store', label: t('settings.storeProfile', 'Store Information'), icon: Store },
            { id: 'appearance', label: t('settings.appearance', 'Appearance & Theme'), icon: Palette },
            { id: 'accessibility', label: t('settings.accessibility', 'Accessibility'), icon: Accessibility },
            { id: 'categories', label: 'Categories', icon: FolderTree, isRoute: true },
            { id: 'printers', label: t('settings.printers', 'Printers & Hardware'), icon: Printer },
            { id: 'diagnostics', label: 'AI Backend Diagnostics', icon: Server },
            { id: 'receipt', label: t('settings.receipt', 'Receipt Configuration'), icon: Receipt },
            { id: 'loyalty', label: t('settings.loyalty', 'Loyalty Program Rules'), icon: Award },
            { id: 'data', label: t('settings.data', 'Data & Offline Sync'), icon: Database }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if ((tab as any).isRoute) {
                    setActiveRoute('categories');
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`flex items-center gap-2 pb-3 transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Form or Printers / Accessibility / Appearance / Sync Center Management */}
        {activeTab === 'appearance' ? (
          <AppearanceSettingsTab />
        ) : activeTab === 'printers' ? (
          <PrinterSettings />
        ) : activeTab === 'accessibility' ? (
          <AccessibilitySettingsTab />
        ) : activeTab === 'diagnostics' ? (
          <SystemDiagnostics />
        ) : activeTab === 'data' ? (
          <SyncCenterTab />
        ) : activeTab === 'receipt' ? (
          <form onSubmit={handleSave} className="space-y-6">
            <ReceiptConfigTab formData={formData} onChange={handleChange} onSave={handleSave} />
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Save Receipt Configuration
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {activeTab === 'store' && (
            <div className="space-y-6">
              {/* Store Identity */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-600" />
                  <span>Store Profile & Business Details</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Business Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => handleChange('name', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tax ID / Business EIN</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={e => handleChange('taxId', e.target.value)}
                      className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Store Logo Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>Store Logo & Receipt Branding</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Displays on the navigation header, customer receipts, and lock screen
                    </p>
                  </div>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange('logoUrl', '')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Logo Preview */}
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs shrink-0 flex items-center justify-center p-1">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Store Logo"
                        className="w-full h-full object-contain rounded-xl"
                        onError={() => handleChange('logoUrl', '')}
                      />
                    ) : (
                      <Store className="w-8 h-8 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoFileUpload}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">PNG, JPG or SVG (Max 2MB)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={formData.logoUrl || ''}
                        onChange={e => handleChange('logoUrl', e.target.value)}
                        placeholder="Or enter logo URL (https://...)"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset Logos */}
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                    Or pick a preset emblem:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {STORE_LOGO_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleChange('logoUrl', preset.url)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                          formData.logoUrl === preset.url
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-4 h-4 rounded-full object-cover" />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Theme Selector */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-blue-600" />
                    <span>POS Color Theme & Accent Palette</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sets signature accent colors for cashier buttons, checkout CTAs, and active routes
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {THEME_PRESETS.map(preset => {
                    const isSelected = (formData.themeColor || 'blue') === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleChange('themeColor', preset.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white/70 hover:bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-5 h-5 rounded-full shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-tight">
                              {preset.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                              {preset.description}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Language Selector */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>Multi-Language POS Interface</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Instantly translates Point of Sale, tickets, checkout flows, and customer receipts
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isSelected = (formData.language || 'en') === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleChange('language', lang.code)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 text-blue-700 font-bold shadow-xs'
                            : 'bg-white/70 hover:bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <div>
                            <span className="block leading-tight">{lang.nativeName}</span>
                            <span className="text-[10px] text-slate-400 block leading-tight">{lang.name}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Store Address & Contact */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Location & Contact Details
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => handleChange('address', e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => handleChange('city', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State / Province</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => handleChange('state', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ZIP / Postal Code</label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={e => handleChange('zip', e.target.value)}
                      className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Customer Loyalty Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Points Earned per $1 Spent</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.pointsPerDollar}
                    onChange={e => handleChange('pointsPerDollar', parseInt(e.target.value, 10))}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default: 1 point per dollar</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Redemption Value ($ per Point)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.redemptionRate}
                    onChange={e => handleChange('redemptionRate', parseFloat(e.target.value))}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">e.g. 0.05 = 20 points redeem for $1.00 credit</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowNegativeStock}
                    onChange={e => handleChange('allowNegativeStock', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Allow Negative Inventory Backorders
                    </span>
                    <span className="text-[11px] text-slate-400">
                      When enabled, cashiers can sell items even if current stock is 0.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-colors"
              style={{ backgroundColor: 'var(--theme-button)', color: 'var(--theme-button-text)' }}
            >
              Save Settings
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
