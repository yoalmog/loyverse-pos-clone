import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Category } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import { CategoryService } from '../../services/categoryService.ts';
import { CategoryModal } from './CategoryModal.tsx';
import { DeleteCategoryModal } from './DeleteCategoryModal.tsx';
import { CategoryAuditModal } from './CategoryAuditModal.tsx';
import { CATEGORY_ICON_MAP } from '../pos/CategoryPanel.tsx';
import {
  FolderTree,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Edit2,
  Copy,
  Trash2,
  Power,
  Printer as PrinterIcon,
  Package,
  History,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';

export const CategoriesView: React.FC = () => {
  const {
    categories,
    products,
    refreshData,
    showToast,
    currentEmployee,
    isOwner,
    requireOwnerAuth,
    setActiveRoute,
    translateCategoryName,
    t
  } = usePOS();

  // Search & Filter State (Section 16 & 17)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Sample Categories Confirmation (Section 26)
  const [isSampleConfirmOpen, setIsSampleConfirmOpen] = useState<boolean>(false);
  const [isCreatingSamples, setIsCreatingSamples] = useState<boolean>(false);

  // Drag and drop state (Section 27)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Available real printers for badge lookup
  const configuredPrinters = StorageService.getPrinters();

  // Permission checks (Section 24)
  const canEdit = currentEmployee?.role === 'owner' || currentEmployee?.role === 'manager';
  const canDelete = currentEmployee?.role === 'owner';

  // Real product counts map
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      if (p.categoryId) {
        map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1);
      }
    });
    return map;
  }, [products]);

  // Filtered & sorted categories list
  const filteredCategories = useMemo(() => {
    let list = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter(c => c.active);
    } else if (statusFilter === 'inactive') {
      list = list.filter(c => !c.active);
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [categories, statusFilter, searchTerm]);

  // Move Up / Move Down handlers
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredCategories.length) return;

    const list = [...filteredCategories];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const orderedIds = list.map(c => c.id);
    await CategoryService.reorderCategories(orderedIds, currentEmployee?.id, currentEmployee?.name);
    refreshData();
    showToast({ type: 'success', title: 'Order Updated', message: 'Category display order saved.' });
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const list = [...filteredCategories];
    const [draggedItem] = list.splice(draggedIndex, 1);
    list.splice(dropIndex, 0, draggedItem);

    setDraggedIndex(null);
    const orderedIds = list.map(c => c.id);
    await CategoryService.reorderCategories(orderedIds, currentEmployee?.id, currentEmployee?.name);
    refreshData();
    showToast({ type: 'success', title: 'Order Updated', message: 'Category display order saved.' });
  };

  // Duplicate category handler
  const handleDuplicate = async (category: Category) => {
    try {
      await CategoryService.duplicateCategory(category.id, currentEmployee?.id, currentEmployee?.name);
      refreshData();
      showToast({
        type: 'info',
        title: 'Category Duplicated',
        message: `Created duplicate of "${category.name}".`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Duplicate Failed', message: err.message });
    }
  };

  // Toggle status handler
  const handleToggleStatus = async (category: Category) => {
    try {
      const updated = await CategoryService.setCategoryStatus(
        category.id,
        !category.active,
        currentEmployee?.id,
        currentEmployee?.name
      );
      refreshData();
      showToast({
        type: 'info',
        title: updated.active ? 'Category Activated' : 'Category Deactivated',
        message: `"${category.name}" is now ${updated.active ? 'active' : 'inactive'}.`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  // Create sample categories template handler (Section 26)
  const handleConfirmCreateSamples = async () => {
    setIsCreatingSamples(true);
    try {
      await CategoryService.createSampleCategories(currentEmployee?.id, currentEmployee?.name);
      refreshData();
      setIsSampleConfirmOpen(false);
      showToast({
        type: 'success',
        title: 'Sample Categories Created',
        message: 'Food, Drinks, Desserts and Coffee categories were added.'
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to create samples', message: err.message });
    } finally {
      setIsCreatingSamples(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Navigation Tabs (Products vs Categories) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveRoute('products')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
          >
            <Package className="w-4 h-4" />
            <span>Products</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-blue-600 shadow-2xs border border-slate-200/80 transition-all"
          >
            <FolderTree className="w-4 h-4 text-blue-600" />
            <span>Categories</span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
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

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Categories</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize your products into categories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Import from Menu */}
            <button
              type="button"
              onClick={() => setActiveRoute('menu-scanner')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Import from Menu</span>
            </button>

            {/* View Audit Trail */}
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
            >
              <History className="w-4 h-4 text-slate-500" />
              <span>Audit Trail</span>
            </button>

            {/* + Add Category Button (Section 1 & 3) */}
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  requireOwnerAuth(() => {
                    setEditingCategory(null);
                    setIsModalOpen(true);
                  }, 'Add Category');
                } else {
                  setEditingCategory(null);
                  setIsModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Category</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar (Section 16 & 17) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Search by Category Name / Description */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search categories by name or description..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({categories.filter(c => c.active).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({categories.filter(c => !c.active).length})
            </button>
          </div>
        </div>

        {/* Empty State (Section 25 & 26) */}
        {categories.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
              <FolderTree className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No categories yet.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Create a category to organize your products.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Category</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSampleConfirmOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Create Sample Categories</span>
              </button>
            </div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <p className="text-xs text-slate-500">
              No categories match your search "{searchTerm}".
            </p>
          </div>
        ) : (
          /* Category List Table (Section 2 & 9 & 27) */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">Order</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Assigned Printer</th>
                    <th className="py-3.5 px-4 text-center">Products</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat, idx) => {
                    const IconComp = CATEGORY_ICON_MAP[cat.iconName] || CATEGORY_ICON_MAP.Package;
                    const count = productCountMap.get(cat.id) || 0;
                    const parent = categories.find(c => c.id === cat.parentId);
                    const assignedPrinter = configuredPrinters.find(p => p.id === cat.printerId);

                    return (
                      <tr
                        key={cat.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          draggedIndex === idx ? 'opacity-40 bg-blue-50/50' : ''
                        }`}
                      >
                        {/* Order & Drag Handle / Up Down */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-1">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMove(idx, 'up')}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                title="Move Up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredCategories.length - 1}
                                onClick={() => handleMove(idx, 'down')}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                title="Move Down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Category Name & Icon / Image */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {cat.imageUrl ? (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                              >
                                <IconComp className="w-5 h-5" />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{cat.name}</span>
                                {parent && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                                    in {parent.name}
                                  </span>
                                )}
                              </div>
                              {cat.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1">{cat.description}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assigned Printer Routing (Section 21) */}
                        <td className="py-3.5 px-4">
                          {assignedPrinter ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                              <PrinterIcon className="w-3 h-3 text-slate-500" />
                              <span>{assignedPrinter.name}</span>
                              {cat.autoPrintKitchen && (
                                <span className="text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-bold">
                                  AUTO
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Default Printer</span>
                          )}
                        </td>

                        {/* Products Count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-700">
                            {count}
                          </span>
                        </td>

                        {/* Status (Active / Inactive) */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cat)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                              cat.active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cat.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{cat.active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Duplicate */}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(cat)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Duplicate Category"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Activate / Deactivate */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(cat)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                cat.active
                                  ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={cat.active ? 'Deactivate Category' : 'Activate Category'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!canDelete) {
                                  requireOwnerAuth(() => {
                                    setDeletingCategory(cat);
                                    setIsDeleteModalOpen(true);
                                  }, 'Delete Category');
                                } else {
                                  setDeletingCategory(cat);
                                  setIsDeleteModalOpen(true);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* Delete Category Modal with Product Migration Check (Section 11) */}
      <DeleteCategoryModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingCategory(null);
        }}
        category={deletingCategory}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* Category Audit Trail Modal */}
      <CategoryAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Explicit User Confirmation for Sample Categories (Section 26) */}
      {isSampleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">Create sample categories?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will create standard Food, Drinks, Desserts, and Coffee categories with icons, colors, and multilingual translations.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSampleConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateSamples}
                disabled={isCreatingSamples}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                {isCreatingSamples ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
