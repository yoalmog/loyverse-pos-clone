import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Product, ProductVariant } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Copy,
  Trash2,
  X,
  Layers,
  Coffee,
  Check,
  Image as ImageIcon,
  Upload,
  Sparkles,
  FolderTree
} from 'lucide-react';
import { PRODUCT_IMAGE_PRESETS } from '../../utils/productImages.ts';

export const ProductsView: React.FC = () => {
  const {
    products,
    categories,
    refreshData,
    showToast,
    settings,
    isOwner,
    requireOwnerAuth,
    setActiveRoute,
    translateProductName,
    translateCategoryName,
    t
  } = usePOS();

  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formSku, setFormSku] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>(() => {
    return categories.find(c => c.active)?.id || '';
  });
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formCost, setFormCost] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('item');
  const [formStock, setFormStock] = useState<string>('25');
  const [formThreshold, setFormThreshold] = useState<string>('5');
  const [formTrackInventory, setFormTrackInventory] = useState<boolean>(true);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formIsFavorite, setFormIsFavorite] = useState<boolean>(false);
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [showPresetPicker, setShowPresetPicker] = useState<boolean>(false);

  // File upload handler converting image to data URL
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: 'warning', title: 'Image too large', message: 'Please select an image smaller than 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImageUrl(reader.result);
        showToast({ type: 'success', title: 'Image uploaded' });
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, search]);

  const handleOpenAdd = () => {
    requireOwnerAuth(() => {
      setEditingProduct(null);
      setFormName('');
      setFormSku('');
      setFormBarcode('');
      setFormCategoryId(categories[0]?.id || '');
      setFormDescription('');
      setFormPrice('');
      setFormCost('');
      setFormUnit('item');
      setFormStock('0');
      setFormThreshold('5');
      setFormTrackInventory(true);
      setFormActive(true);
      setFormIsFavorite(false);
      setFormImageUrl('');
      setShowPresetPicker(false);
      setIsModalOpen(true);
    }, t('products.addOwnerAuth', 'Add New Catalog Product'));
  };

  const handleOpenEdit = (p: Product) => {
    requireOwnerAuth(() => {
      setEditingProduct(p);
      setFormName(p.name);
      setFormSku(p.sku);
      setFormBarcode(p.barcode);
      setFormCategoryId(p.categoryId);
      setFormDescription(p.description || '');
      setFormPrice(p.price.toString());
      setFormCost(p.cost.toString());
      setFormUnit(p.unit);
      setFormStock(p.stock.toString());
      setFormThreshold(p.lowStockThreshold.toString());
      setFormTrackInventory(p.trackInventory);
      setFormActive(p.active);
      setFormIsFavorite(!!p.isFavorite);
      setFormImageUrl(p.imageUrl || '');
      setShowPresetPicker(false);
      setIsModalOpen(true);
    }, t('products.editOwnerAuth', 'Edit Catalog Product'));
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim()) {
      showToast({ type: 'warning', title: 'Missing required fields' });
      return;
    }

    requireOwnerAuth(() => {
      const price = parseFloat(formPrice) || 0;
      const cost = parseFloat(formCost) || 0;
      const stock = parseInt(formStock, 10) || 0;
      const threshold = parseInt(formThreshold, 10) || 5;

      const all = StorageService.getProducts();
      const nowIso = new Date().toISOString();

      if (editingProduct) {
        // Edit existing
        const idx = all.findIndex(p => p.id === editingProduct.id);
        if (idx !== -1) {
          all[idx] = {
            ...editingProduct,
            name: formName.trim(),
            sku: formSku.trim(),
            barcode: formBarcode.trim(),
            categoryId: formCategoryId,
            description: formDescription.trim(),
            price,
            cost,
            unit: formUnit,
            stock,
            lowStockThreshold: threshold,
            trackInventory: formTrackInventory,
            active: formActive,
            isFavorite: formIsFavorite,
            imageUrl: formImageUrl.trim() || undefined,
            updatedAt: nowIso
          };
          StorageService.saveProducts(all);
          refreshData();
          showToast({ type: 'success', title: 'Product Updated', message: formName });
        }
      } else {
        // Create new
        const newProd: Product = {
          id: `prod_${Date.now()}`,
          storeId: settings.id,
          categoryId: formCategoryId,
          name: formName.trim(),
          sku: formSku.trim(),
          barcode: formBarcode.trim(),
          description: formDescription.trim(),
          price,
          cost,
          unit: formUnit,
          trackInventory: formTrackInventory,
          stock,
          lowStockThreshold: threshold,
          active: formActive,
          isFavorite: formIsFavorite,
          color: '#2563EB',
          imageUrl: formImageUrl.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        all.unshift(newProd);
        StorageService.saveProducts(all);
        refreshData();
        showToast({ type: 'success', title: 'Product Created', message: formName });
      }

      setIsModalOpen(false);
    }, 'Save Product');
  };

  const handleDuplicate = (p: Product) => {
    requireOwnerAuth(() => {
      const all = StorageService.getProducts();
      const duplicate: Product = {
        ...p,
        id: `prod_${Date.now()}`,
        name: `${p.name} (Copy)`,
        sku: `${p.sku}-CPY`,
        barcode: `${p.barcode}9`,
        stock: p.stock,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      all.unshift(duplicate);
      StorageService.saveProducts(all);
      refreshData();
      showToast({ type: 'info', title: 'Product Duplicated', message: duplicate.name });
    }, 'Duplicate Product');
  };

  const handleDelete = (productId: string) => {
    requireOwnerAuth(() => {
      if (confirm('Are you sure you want to delete this product?')) {
        const all = StorageService.getProducts().filter(p => p.id !== productId);
        StorageService.saveProducts(all);
        refreshData();
        showToast({ type: 'info', title: 'Product Deleted' });
      }
    }, 'Delete Product');
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'SKU', 'Barcode', 'Category', 'Price', 'Cost', 'Stock', 'Unit', 'Active'];
    const rows = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId)?.name || 'Unknown';
      return [p.id, `"${p.name}"`, p.sku, p.barcode, `"${cat}"`, p.price, p.cost, p.stock, p.unit, p.active];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_catalog_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'Products Exported to CSV' });
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Navigation Tabs (Products vs Categories vs AI Menu Scanner) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-blue-600 shadow-2xs border border-slate-200/80 transition-all"
          >
            <Package className="w-4 h-4 text-blue-600" />
            <span>Products</span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoute('categories')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
          >
            <FolderTree className="w-4 h-4 text-slate-500" />
            <span>Categories</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono font-bold">
              {categories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoute('menu-scanner')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>AI Menu Scanner</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold tracking-wider">
              NEW
            </span>
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t('nav.products', 'Products Catalog')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage items, prices, SKUs, inventory tracking, and variants
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveRoute('menu-scanner')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Import from Menu</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('products.addProduct', 'Add Product')}</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, or barcode..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option value="all">All Categories ({products.length})</option>
              {categories
                .filter(c => c.id !== 'cat_all')
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">SKU / Barcode</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Price</th>
                  <th className="py-3.5 px-4 text-right">Cost</th>
                  <th className="py-3.5 px-4 text-center">Stock</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {t('products.noProductsFound', 'No products found')}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                  const cat = categories.find(c => c.id === p.categoryId);
                  const isLow = p.trackInventory && p.stock <= p.lowStockThreshold && p.stock > 0;
                  const isOut = p.trackInventory && p.stock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-200 bg-slate-100">
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={e => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                              style={{
                                backgroundColor: p.color ? `${p.color}18` : '#EFF6FF',
                                color: p.color || '#2563EB'
                              }}
                            >
                              <Coffee className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{p.name}</p>
                            {p.variants && p.variants.length > 0 && (
                              <span className="text-[10px] text-blue-600 flex items-center gap-1 font-medium">
                                <Layers className="w-3 h-3" />
                                {p.variants.length} variants
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <p className="text-slate-800 font-semibold">{p.sku}</p>
                        <p className="text-[10px] text-slate-400">{p.barcode}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-medium">{cat?.name || 'General'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                        ${p.cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.trackInventory ? (
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                              isOut
                                ? 'bg-rose-100 text-rose-700'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.stock} {p.unit}s
                          </span>
                        ) : (
                          <span className="text-slate-400">Untracked</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Duplicate Product"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProduct ? t('products.editProduct', 'Edit Product') : t('products.addProduct', 'Add Product')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure catalog details, pricing, and stock controls
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4">
              {/* Product Image Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>{t('products.productImage', 'Product Image & Visual Thumbnail')}</span>
                  </label>
                  {formImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      {t('settings.removeLogo', 'Remove Image')}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Thumbnail Preview */}
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                    {formImageUrl ? (
                      <img
                        src={formImageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                        onError={() => setFormImageUrl('')}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>

                  {/* Actions & Inputs */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t('products.uploadImage', 'Upload Image')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileUpload}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowPresetPicker(prev => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{showPresetPicker ? 'Hide Presets' : t('products.choosePreset', 'Choose Preset')}</span>
                      </button>
                    </div>

                    <input
                      type="url"
                      value={formImageUrl}
                      onChange={e => setFormImageUrl(e.target.value)}
                      placeholder={t('products.imageUrl', 'Or enter image URL (https://...)')}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Preset Gallery Grid */}
                {showPresetPicker && (
                  <div className="pt-2 border-t border-slate-200 animate-fadeIn">
                    <p className="text-[11px] text-slate-500 mb-2 font-medium">
                      Select a curated high-res photo for quick touch identification:
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                      {PRODUCT_IMAGE_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setFormImageUrl(preset.url);
                            setShowPresetPicker(false);
                          }}
                          className={`group relative rounded-lg overflow-hidden border transition-all aspect-square cursor-pointer ${
                            formImageUrl === preset.url
                              ? 'ring-2 ring-blue-600 border-transparent shadow-xs'
                              : 'border-slate-200 hover:border-blue-400'
                          }`}
                          title={preset.name}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-[9px] text-white font-medium p-0.5 truncate text-center">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Lavender Iced Matcha"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Category *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setActiveRoute('categories');
                      }}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      + Manage Categories
                    </button>
                  </div>
                  {categories.filter(c => c.active).length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                      <span>No active categories found.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setActiveRoute('categories');
                        }}
                        className="font-bold underline"
                      >
                        Create one now
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formCategoryId}
                      onChange={e => setFormCategoryId(e.target.value)}
                      required
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    >
                      <option value="">-- Select Category ▼ --</option>
                      {categories
                        .filter(c => c.active)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    placeholder="e.g. COF-LAT-09"
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode / UPC</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={e => setFormBarcode(e.target.value)}
                    placeholder="e.g. 891000991"
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost of Goods ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCost}
                    onChange={e => setFormCost(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="item">item (pcs)</option>
                    <option value="cup">cup</option>
                    <option value="bag">bag</option>
                    <option value="box">box</option>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={e => setFormStock(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Warning Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={formThreshold}
                    onChange={e => setFormThreshold(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Ingredients, brewing notes, tasting profile..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formTrackInventory}
                    onChange={e => setFormTrackInventory(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">Track Inventory</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={e => setFormActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">Active in POS</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsFavorite}
                    onChange={e => setFormIsFavorite(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">Favorite (Quick Tap)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
