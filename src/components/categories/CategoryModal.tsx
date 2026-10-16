import React, { useState, useEffect } from 'react';
import { Category } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import { CategoryService } from '../../services/categoryService.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { SUPPORTED_LOCALES, SupportedLanguage } from '../../i18n/index.ts';
import { CATEGORY_ICON_MAP } from '../pos/CategoryPanel.tsx';
import {
  X,
  Upload,
  Trash2,
  Printer as PrinterIcon,
  Globe,
  Palette,
  Layers,
  Sparkles,
  Info,
  Check,
  AlertCircle
} from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null; // null = Add, object = Edit
  onSuccess: () => void;
}

const COLOR_PRESETS = [
  '#2563EB', // Blue
  '#16A34A', // Green
  '#D97706', // Amber
  '#DC2626', // Red
  '#9333EA', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#14B8A6', // Teal
  '#64748B', // Slate
  '#8B5CF6'  // Violet
];

const AVAILABLE_ICONS = [
  { id: 'Utensils', label: 'Food', emoji: '🍔' },
  { id: 'GlassWater', label: 'Drinks', emoji: '🥤' },
  { id: 'Cake', label: 'Desserts', emoji: '🍰' },
  { id: 'Coffee', label: 'Coffee', emoji: '☕' },
  { id: 'Pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'Croissant', label: 'Bakery', emoji: '🥐' },
  { id: 'Salad', label: 'Salad', emoji: '🥗' },
  { id: 'IceCream', label: 'Ice Cream', emoji: '🍦' },
  { id: 'CupSoda', label: 'Beverage', emoji: '🧃' },
  { id: 'Beer', label: 'Bar & Beer', emoji: '🍺' },
  { id: 'Wine', label: 'Wine', emoji: '🍷' },
  { id: 'Apple', label: 'Grocery', emoji: '🍎' },
  { id: 'ShoppingBag', label: 'Retail', emoji: '🛍️' },
  { id: 'Package', label: 'Package / Other', emoji: '📦' },
  { id: 'Tag', label: 'Specials', emoji: '🏷️' },
  { id: 'Flame', label: 'Hot Items', emoji: '🔥' }
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  onSuccess
}) => {
  const { categories, refreshData, showToast, currentEmployee, language, t } = usePOS();

  // Basic Form State
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [iconName, setIconName] = useState<string>('Utensils');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [color, setColor] = useState<string>('#2563EB');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [active, setActive] = useState<boolean>(true);
  const [parentId, setParentId] = useState<string>('');

  // Print Routing State
  const [printerId, setPrinterId] = useState<string>('');
  const [autoPrintKitchen, setAutoPrintKitchen] = useState<boolean>(true);

  // Multilingual State: Record<locale, { name, description }>
  const [activeTranslationLocale, setActiveTranslationLocale] = useState<SupportedLanguage>('en');
  const [translations, setTranslations] = useState<Record<string, { name: string; description: string }>>({});

  // UI Tabs inside modal
  const [activeTab, setActiveTab] = useState<'general' | 'translations' | 'printing'>('general');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available real printers from storage
  const configuredPrinters = StorageService.getPrinters();

  // Parent category options (exclude current category)
  const parentCategoryOptions = categories.filter(c => !category || c.id !== category.id);

  // Populate form on open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setActiveTab('general');

    if (category) {
      setName(category.name);
      setDescription(category.description || '');
      setIconName(category.iconName || 'Package');
      setImageUrl(category.imageUrl || '');
      setColor(category.color || '#2563EB');
      setSortOrder(category.sortOrder || 1);
      setActive(category.active);
      setParentId(category.parentId || '');
      setPrinterId(category.printerId || '');
      setAutoPrintKitchen(category.autoPrintKitchen !== undefined ? category.autoPrintKitchen : true);

      // Load translations from service
      CategoryService.getCategoryTranslationsMap(category.id).then(map => {
        const transObj: Record<string, { name: string; description: string }> = {};
        SUPPORTED_LOCALES.forEach(loc => {
          transObj[loc.code] = {
            name: map[loc.code]?.name || (loc.code === 'en' ? category.name : ''),
            description: map[loc.code]?.description || (loc.code === 'en' ? (category.description || '') : '')
          };
        });
        setTranslations(transObj);
      });
    } else {
      // New category defaults
      setName('');
      setDescription('');
      setIconName('Utensils');
      setImageUrl('');
      setColor('#2563EB');
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
      setSortOrder(maxOrder + 1);
      setActive(true);
      setParentId('');
      setPrinterId('');
      setAutoPrintKitchen(true);

      const transObj: Record<string, { name: string; description: string }> = {};
      SUPPORTED_LOCALES.forEach(loc => {
        transObj[loc.code] = { name: '', description: '' };
      });
      setTranslations(transObj);
    }
  }, [isOpen, category, categories]);

  if (!isOpen) return null;

  // Handle image upload converting to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast({
        type: 'warning',
        title: 'Image Too Large',
        message: 'Category image must be smaller than 2MB.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        showToast({ type: 'success', title: 'Image Uploaded' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTranslationChange = (locale: string, field: 'name' | 'description', value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validation (Requirement 4)
    const validation = CategoryService.validateCategory({ name }, category?.id);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Category name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure primary language translation is synced with name & description
      const updatedTranslations = { ...translations };
      if (!updatedTranslations.en) {
        updatedTranslations.en = { name: name.trim(), description: description.trim() };
      } else {
        if (!updatedTranslations.en.name) updatedTranslations.en.name = name.trim();
        if (!updatedTranslations.en.description) updatedTranslations.en.description = description.trim();
      }

      if (category) {
        // Edit category
        await CategoryService.updateCategory(
          category.id,
          {
            name: name.trim(),
            description: description.trim() || undefined,
            iconName,
            imageUrl: imageUrl.trim() || undefined,
            color,
            sortOrder: Number(sortOrder) || 1,
            active,
            parentId: parentId || undefined,
            printerId: printerId || undefined,
            autoPrintKitchen,
            translations: updatedTranslations
          },
          currentEmployee?.id,
          currentEmployee?.name
        );
        showToast({
          type: 'success',
          title: 'Category Updated',
          message: `Category "${name}" updated successfully.`
        });
      } else {
        // Create new category
        await CategoryService.createCategory(
          {
            name: name.trim(),
            description: description.trim() || undefined,
            iconName,
            imageUrl: imageUrl.trim() || undefined,
            color,
            sortOrder: Number(sortOrder) || 1,
            active,
            parentId: parentId || undefined,
            printerId: printerId || undefined,
            autoPrintKitchen,
            translations: updatedTranslations
          },
          currentEmployee?.id,
          currentEmployee?.name
        );
        showToast({
          type: 'success',
          title: 'Category Created',
          message: `Category "${name}" created successfully.`
        });
      }

      refreshData();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIconComponent = CATEGORY_ICON_MAP[iconName] || CATEGORY_ICON_MAP.Package;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="preview" className="w-10 h-10 rounded-2xl object-cover" />
              ) : (
                <SelectedIconComponent className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {category ? t('categories.editCategory', 'Edit Category') : t('categories.addCategory', 'Add Category')}
              </h3>
              <p className="text-xs text-slate-500">
                {category ? `ID: ${category.id}` : t('categories.createDesc', 'Configure category name, appearance, routing and translations')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>General & Appearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('translations')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'translations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Multilingual Names ({SUPPORTED_LOCALES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('printing')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'printing'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PrinterIcon className="w-4 h-4" />
            <span>Kitchen & Print Routing</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[68vh] overflow-y-auto space-y-5">
            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* TAB 1: General & Appearance */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Category Name (Required - Section 4) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      setErrorMsg(null);
                      // sync with active translation
                      handleTranslationChange('en', 'name', e.target.value);
                    }}
                    placeholder="e.g. Food, Drinks, Desserts, Coffee"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Unique name for this category. Required and must not be duplicate.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={e => {
                      setDescription(e.target.value);
                      handleTranslationChange('en', 'description', e.target.value);
                    }}
                    placeholder="Brief description of items included in this category..."
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Icon Selection (Section 6) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category Icon
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVAILABLE_ICONS.map(item => {
                      const IconComp = CATEGORY_ICON_MAP[item.id] || CATEGORY_ICON_MAP.Package;
                      const isSelected = iconName === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setIconName(item.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-2 ring-blue-500/20'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span className="text-lg leading-none mb-1">{item.emoji}</span>
                          <span className="text-[10px] font-semibold truncate w-full">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Image (Section 7) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category Image <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {imageUrl ? (
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shrink-0 shadow-2xs">
                        <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute inset-0 bg-slate-950/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <SelectedIconComponent className="w-6 h-6 text-slate-400" />
                        <span className="text-[9px] mt-0.5 font-medium">Icon Mode</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Upload Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-left text-[11px] text-red-600 hover:underline font-semibold"
                        >
                          Remove Image (Display configured icon instead)
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400">
                        PNG or JPG under 2MB. If no image exists, configured icon is displayed.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Color Picker (Section 8) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-xl transition-transform ${
                          color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-2 border border-slate-200 rounded-xl px-2 py-1 bg-white">
                      <span className="text-xs text-slate-400 font-mono">#</span>
                      <input
                        type="text"
                        value={color.replace('#', '')}
                        onChange={e => setColor(`#${e.target.value.replace('#', '')}`)}
                        maxLength={7}
                        className="w-16 text-xs font-mono font-bold focus:outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Parent Category & Display Order & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Parent Category
                    </label>
                    <select
                      value={parentId}
                      onChange={e => setParentId(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None (Top-level)</option>
                      {parentCategoryOptions.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Display Order (Sort)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={sortOrder}
                      onChange={e => setSortOrder(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Category Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setActive(!active)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{active ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Multilingual Translations (Section 5 & 19) */}
            {activeTab === 'translations' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed">
                    AuraPOS supports multilingual category display. Enter localized names below.
                    When a customer or cashier changes the interface language, the category name automatically
                    switches without breaking database integrity. Missing translations fall back to default name.
                  </p>
                </div>

                {/* Language Picker Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {SUPPORTED_LOCALES.map(loc => {
                    const isSelected = activeTranslationLocale === loc.code;
                    const hasTranslation = !!translations[loc.code]?.name;
                    return (
                      <button
                        key={loc.code}
                        type="button"
                        onClick={() => setActiveTranslationLocale(loc.code)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{loc.flag}</span>
                        <span>{loc.name}</span>
                        {hasTranslation && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active Language Editor */}
                {(() => {
                  const currentLocMeta = SUPPORTED_LOCALES.find(l => l.code === activeTranslationLocale) || SUPPORTED_LOCALES[0];
                  const currentTrans = translations[activeTranslationLocale] || { name: '', description: '' };

                  return (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span className="text-base">{currentLocMeta.flag}</span>
                          <span>{currentLocMeta.name} ({currentLocMeta.nativeName})</span>
                        </span>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">
                          Locale: {currentLocMeta.localeCode} | {currentLocMeta.direction.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Localized Category Name
                        </label>
                        <input
                          type="text"
                          dir={currentLocMeta.direction}
                          value={currentTrans.name}
                          onChange={e => handleTranslationChange(activeTranslationLocale, 'name', e.target.value)}
                          placeholder={`Enter name in ${currentLocMeta.name}...`}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Localized Description <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                          rows={2}
                          dir={currentLocMeta.direction}
                          value={currentTrans.description}
                          onChange={e => handleTranslationChange(activeTranslationLocale, 'description', e.target.value)}
                          placeholder={`Enter description in ${currentLocMeta.name}...`}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 3: Kitchen & Print Routing (Section 21, 22, 23) */}
            {activeTab === 'printing' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                  <PrinterIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <strong>Print Routing Priority:</strong> Product printer &rarr; Category printer &rarr; Default printer.
                    Orders containing items in this category will automatically dispatch to the selected printer.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Assigned Printer
                  </label>
                  <select
                    value={printerId}
                    onChange={e => setPrinterId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default POS Printer Routing</option>
                    {configuredPrinters.map(pr => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.connectionType.toUpperCase()} - {pr.printerPurpose.toUpperCase()})
                        {pr.isDefault ? ' [Default]' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Only real configured hardware printers are displayed.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoPrintKitchen}
                      onChange={e => setAutoPrintKitchen(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Auto-Print Kitchen Order
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Automatically create and dispatch an order ticket when sale completes
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{category ? 'Save Changes' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
