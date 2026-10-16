import React, { useState } from 'react';
import { Category } from '../../types/pos.ts';
import { CategoryService } from '../../services/categoryService.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { AlertTriangle, Trash2, ArrowRight, X, AlertCircle } from 'lucide-react';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSuccess: () => void;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  onSuccess
}) => {
  const { categories, products, refreshData, showToast, currentEmployee, t } = usePOS();
  const [destinationCategoryId, setDestinationCategoryId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !category) return null;

  // Real assigned products
  const assignedProducts = products.filter(p => p.categoryId === category.id);
  const otherCategories = categories.filter(c => c.id !== category.id && c.active);

  const handleDelete = async () => {
    setErrorMsg(null);

    // If products exist, user MUST choose a destination category (Requirement 11)
    if (assignedProducts.length > 0 && !destinationCategoryId) {
      setErrorMsg('Please select a destination category to reassign the existing products.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await CategoryService.deleteCategory(
        category.id,
        destinationCategoryId || undefined,
        currentEmployee?.id,
        currentEmployee?.name
      );

      refreshData();
      showToast({
        type: 'info',
        title: 'Category Deleted',
        message: res.movedProductsCount > 0
          ? `Deleted "${category.name}" and moved ${res.movedProductsCount} product(s).`
          : `Category "${category.name}" deleted successfully.`
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {assignedProducts.length > 0 ? 'This category contains products.' : 'Delete category?'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {assignedProducts.length === 0 ? (
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete category <strong>"{category.name}"</strong>?
              This category currently has no products assigned. This action cannot be undone.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs text-amber-900 font-semibold mb-1">
                  Category "{category.name}" currently contains {assignedProducts.length} product(s).
                </p>
                <p className="text-[11px] text-amber-800">
                  Products cannot be left without a category. Choose where these products should be moved before deleting:
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Move Products to Another Category <span className="text-red-500">*</span>
                </label>
                {otherCategories.length === 0 ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    No other active categories found. Please create another category before deleting this one.
                  </div>
                ) : (
                  <select
                    value={destinationCategoryId}
                    onChange={e => setDestinationCategoryId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">-- Select Destination Category --</option>
                    {otherCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({products.filter(p => p.categoryId === c.id).length} existing products)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || (assignedProducts.length > 0 && !destinationCategoryId)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {assignedProducts.length > 0
                ? 'Move Products & Delete Category'
                : 'Delete Category'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
