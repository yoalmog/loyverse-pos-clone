import React, { useState } from 'react';
import { getApiAuthHeaders } from '../../services/api/authHeaders.ts';
import {
  Sparkles,
  Loader2,
  Check,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  History,
  Sliders,
  AlertCircle,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { ExtractedProduct, ProductAiImageVersion } from '../../types/menuScanner.ts';
import { ProductImagePromptBuilder } from '../../services/ai/productImagePromptBuilder.ts';
import { StorageService } from '../../services/storageService.ts';

interface ProductAiImageStudioProps {
  product: ExtractedProduct;
  currencySymbol: string;
  onUpdateProduct: (updated: ExtractedProduct) => void;
  onClose: () => void;
}

export const ProductAiImageStudio: React.FC<ProductAiImageStudioProps> = ({
  product,
  currencySymbol,
  onUpdateProduct,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Dynamic prompt preview & editing
  const defaultPrompt = ProductImagePromptBuilder.buildPrompt({
    name: product.name,
    categoryName: product.categoryName,
    description: product.description
  });
  const [customPrompt, setCustomPrompt] = useState<string>(product.aiImagePrompt || defaultPrompt);
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState<boolean>(false);

  // Candidate image preview before user clicks "Use This Image"
  const [previewCandidateUrl, setPreviewCandidateUrl] = useState<string | null>(product.imageUrl || null);
  const [candidateSource, setCandidateSource] = useState<'REAL_UPLOAD' | 'AI_GENERATED' | 'NO_IMAGE'>(
    product.imageSource || (product.imageUrl ? 'AI_GENERATED' : 'NO_IMAGE')
  );

  // History versions (Requirement 14)
  const historyVersions: ProductAiImageVersion[] = product.aiImageHistory || [];

  // Generate Image with AI handler (Requirement 8, 9, 10, 12)
  const handleGenerateAiImage = async () => {
    try {
      setIsGenerating(true);
      setGenerationError(null);

      const effectivePrompt = customPrompt.trim() || defaultPrompt;

      const response = await fetch('/api/products/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
        body: JSON.stringify({
          productName: product.name,
          categoryName: product.categoryName,
          description: product.description,
          prompt: effectivePrompt
        })
      });

      const resData = await response.json();

      if (resData.success && resData.imageUrl) {
        const newVersionNumber = historyVersions.length + 1;
        const newVersion: ProductAiImageVersion = {
          id: `ai_img_${Date.now()}_v${newVersionNumber}`,
          url: resData.imageUrl,
          prompt: effectivePrompt,
          version: newVersionNumber,
          createdAt: new Date().toISOString()
        };

        const updatedHistory = [newVersion, ...historyVersions];

        // Store candidate for preview (Requirement 10: User previews before accepting)
        setPreviewCandidateUrl(resData.imageUrl);
        setCandidateSource('AI_GENERATED');

        // Update product state with generated version in history
        onUpdateProduct({
          ...product,
          aiImagePrompt: effectivePrompt,
          aiImageHistory: updatedHistory,
          aiImageState: 'generated'
        });
      } else {
        setGenerationError(resData.error || 'No se pudo generar la imagen con IA.');
      }
    } catch (err: any) {
      console.error('Error generating AI product image:', err);
      setGenerationError(err?.message || 'Error de conexión al generar imagen.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Accept current preview candidate (Requirement 10: "Use This Image")
  const handleUseThisImage = () => {
    if (!previewCandidateUrl) return;

    const acceptedProduct: ExtractedProduct = {
      ...product,
      imageUrl: previewCandidateUrl,
      imageSource: candidateSource,
      aiImageState: 'accepted'
    };

    // Save metadata in storage architecture (Requirement 13)
    if (candidateSource === 'AI_GENERATED') {
      StorageService.saveProductImageMetadata({
        imageId: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id || product.tempId,
        source: 'AI_GENERATED',
        url: previewCandidateUrl,
        prompt: customPrompt,
        createdAt: new Date().toISOString(),
        isCurrent: true
      });
    }

    onUpdateProduct(acceptedProduct);
    onClose();
  };

  // Remove current image (Requirement 10: "Remove Image")
  const handleRemoveImage = () => {
    setPreviewCandidateUrl(null);
    setCandidateSource('NO_IMAGE');

    onUpdateProduct({
      ...product,
      imageUrl: '',
      imageSource: 'NO_IMAGE',
      aiImageState: 'idle'
    });
  };

  // Select historical version (Requirement 14)
  const handleSelectHistoryVersion = (version: ProductAiImageVersion) => {
    setPreviewCandidateUrl(version.url);
    setCandidateSource('AI_GENERATED');
    setCustomPrompt(version.prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Estudio de Imagen IA para Producto
              </h3>
              <p className="text-xs text-slate-500">
                Fotografía gastronómica comercial generada a partir de los datos del menú
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Product Summary Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-base">{product.name}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-semibold">
                  {product.categoryName}
                </span>
              </div>
              {product.description && (
                <p className="text-xs text-slate-600 mt-1 italic">
                  "{product.description}"
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-slate-400 block font-medium">Precio</span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {currencySymbol} {product.price.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Image Display & Preview Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                IMAGEN DEL PRODUCTO
              </label>
              {candidateSource === 'AI_GENERATED' && (
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  Generada con IA
                </span>
              )}
              {candidateSource === 'REAL_UPLOAD' && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Fotografía Real Aprobada
                </span>
              )}
            </div>

            <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-slate-900/5 h-64 overflow-hidden flex items-center justify-center group shadow-inner">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-3" />
                  <span className="text-sm font-semibold text-slate-800">
                    Generando fotografía gastronómica con IA...
                  </span>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Componiendo plato comercial realista con iluminación de restaurante
                  </p>
                </div>
              ) : previewCandidateUrl ? (
                <>
                  <img
                    src={previewCandidateUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>Vista previa del plato</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-sm font-semibold text-slate-700">Sin Imagen Asignada</span>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Haga clic en "Generar con IA" para crear una presentación gastronómica profesional
                  </p>
                </div>
              )}
            </div>

            {generationError && (
              <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{generationError}</span>
              </div>
            )}
          </div>

          {/* Action Buttons (Requirement 10: Generate with AI, Generate Again, Use This Image, Remove Image) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!previewCandidateUrl ? (
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateAiImage}
                className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generar con IA
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateAiImage}
                  className="py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Generar Otra Vez
                </button>

                <button
                  type="button"
                  onClick={handleUseThisImage}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Usar Esta Imagen
                </button>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="py-2.5 px-3 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  title="Eliminar Imagen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Image History Versions (Requirement 14: AI Generated v1, v2, v3) */}
          {historyVersions.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <History className="w-4 h-4 text-purple-600" />
                <span>Historial de Versiones Generadas ({historyVersions.length})</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {historyVersions.map(ver => {
                  const isCurrent = previewCandidateUrl === ver.url;
                  return (
                    <div
                      key={ver.id}
                      onClick={() => handleSelectHistoryVersion(ver)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-purple-600 ring-2 ring-purple-200 shadow-xs'
                          : 'border-slate-200 hover:border-purple-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={ver.url} alt={`v${ver.version}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[10px] text-center font-bold py-0.5">
                        v{ver.version}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advanced Prompt Inspector (Requirement 9) */}
          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
              className="text-xs font-semibold text-slate-600 hover:text-purple-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvancedPrompt ? 'Ocultar Prompt Detallado' : 'Ajustar Prompt de Fotografía IA (Opcional)'}</span>
            </button>

            {showAdvancedPrompt && (
              <div className="mt-2.5 space-y-2">
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Generado automáticamente según el nombre y la categoría</span>
                  <button
                    type="button"
                    onClick={() => setCustomPrompt(defaultPrompt)}
                    className="text-purple-600 hover:underline font-medium"
                  >
                    Restablecer al por defecto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
