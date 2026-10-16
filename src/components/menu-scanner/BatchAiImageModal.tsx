import React, { useState, useRef } from 'react';
import { getApiAuthHeaders } from '../../services/api/authHeaders.ts';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Play,
  Layers,
  Check
} from 'lucide-react';
import { ExtractedProduct, ProductAiImageVersion } from '../../types/menuScanner.ts';
import { ProductImagePromptBuilder } from '../../services/ai/productImagePromptBuilder.ts';
import { StorageService } from '../../services/storageService.ts';

interface BatchAiImageModalProps {
  products: ExtractedProduct[];
  onUpdateProductsBatch: (updatedProducts: ExtractedProduct[]) => void;
  onClose: () => void;
}

export const BatchAiImageModal: React.FC<BatchAiImageModalProps> = ({
  products,
  onUpdateProductsBatch,
  onClose
}) => {
  // Target Selection: 'all' | 'selected' | 'no_image'
  const [targetScope, setTargetScope] = useState<'all' | 'selected' | 'no_image'>('no_image');

  // Generation status
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentItemName, setCurrentItemName] = useState<string>('');
  const [generatedResults, setGeneratedResults] = useState<Array<{ id: string; name: string; url: string }>>([]);

  // Cancellation token ref
  const cancellationRef = useRef<boolean>(false);

  // Compute eligible products based on scope
  const eligibleProducts = products.filter(p => {
    if (targetScope === 'all') return true;
    if (targetScope === 'selected') return p.selected && p.resolution !== 'skip';
    if (targetScope === 'no_image') return !p.imageUrl || p.imageSource === 'NO_IMAGE';
    return true;
  });

  const handleStartBatch = async () => {
    if (eligibleProducts.length === 0) return;

    setIsProcessing(true);
    setIsCompleted(false);
    cancellationRef.current = false;
    setCurrentIndex(0);

    const updatedList = [...products];
    const generatedBuffer: Array<{ id: string; name: string; url: string }> = [];

    for (let i = 0; i < eligibleProducts.length; i++) {
      if (cancellationRef.current) {
        break; // Cancelled by user
      }

      const prod = eligibleProducts[i];
      setCurrentIndex(i + 1);
      setCurrentItemName(prod.name);

      const prompt = ProductImagePromptBuilder.buildPrompt({
        name: prod.name,
        categoryName: prod.categoryName,
        description: prod.description
      });

      try {
        const res = await fetch('/api/products/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
          body: JSON.stringify({
            productName: prod.name,
            categoryName: prod.categoryName,
            description: prod.description,
            prompt
          })
        });

        const data = await res.json();
        if (data.success && data.imageUrl) {
          const newVersion: ProductAiImageVersion = {
            id: `ai_img_${Date.now()}_v1`,
            url: data.imageUrl,
            prompt,
            version: 1,
            createdAt: new Date().toISOString()
          };

          // Update product in list
          const targetIndex = updatedList.findIndex(p => (p.id || p.tempId) === (prod.id || prod.tempId));
          if (targetIndex !== -1) {
            updatedList[targetIndex] = {
              ...updatedList[targetIndex],
              imageUrl: data.imageUrl,
              imageSource: 'AI_GENERATED',
              aiImagePrompt: prompt,
              aiImageHistory: [newVersion, ...(updatedList[targetIndex].aiImageHistory || [])],
              aiImageState: 'accepted'
            };
          }

          generatedBuffer.push({
            id: prod.id || prod.tempId,
            name: prod.name,
            url: data.imageUrl
          });
          setGeneratedResults([...generatedBuffer]);

          // Save metadata
          StorageService.saveProductImageMetadata({
            imageId: `img_${Date.now()}_${i}`,
            productId: prod.id || prod.tempId,
            source: 'AI_GENERATED',
            url: data.imageUrl,
            prompt,
            createdAt: new Date().toISOString(),
            isCurrent: true
          });
        }
      } catch (err) {
        console.warn(`Batch generation failed for ${prod.name}:`, err);
      }
    }

    onUpdateProductsBatch(updatedList);
    setIsProcessing(false);
    setIsCompleted(true);
  };

  const handleCancel = () => {
    cancellationRef.current = true;
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Generación Masiva de Imágenes con IA
              </h3>
              <p className="text-xs text-slate-500">
                Cree fotografías profesionales para múltiples platos simultáneamente
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {!isProcessing && !isCompleted ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Seleccionar Productos Destino (Requirement 11)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/30 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="no_image"
                      checked={targetScope === 'no_image'}
                      onChange={() => setTargetScope('no_image')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-900 block">
                        Productos Sin Imágenes Solamente ({products.filter(p => !p.imageUrl || p.imageSource === 'NO_IMAGE').length})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Recomendado: Genera para aquellos platos que aún no tienen foto
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/30 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="selected"
                      checked={targetScope === 'selected'}
                      onChange={() => setTargetScope('selected')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-900 block">
                        Productos Seleccionados ({products.filter(p => p.selected && p.resolution !== 'skip').length})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Genera para los platos marcados actualmente en la tabla
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/30 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="scope"
                      value="all"
                      checked={targetScope === 'all'}
                      onChange={() => setTargetScope('all')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-900 block">
                        Todos los Productos ({products.length})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Genera fotografías para todos los platos del menú escaneado
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
                <span className="font-semibold block mb-0.5">💡 Calidad de Fotografía Gastronómica:</span>
                Las imágenes son generadas de forma no bloqueante a partir del nombre y la categoría real sin inventar ingredientes adicionales. Puede cancelar el proceso en cualquier momento.
              </div>
            </>
          ) : isProcessing ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Generando {currentIndex} de {eligibleProducts.length}...</span>
                <span className="font-mono text-purple-600">
                  {Math.round((currentIndex / Math.max(1, eligibleProducts.length)) * 100)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(currentIndex / Math.max(1, eligibleProducts.length)) * 100}%` }}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 flex items-center gap-2.5 text-xs text-slate-700">
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                <span className="truncate">Plato actual: <strong>{currentItemName}</strong></span>
              </div>

              {/* Live Thumbnail Strip */}
              {generatedResults.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Imágenes generadas ({generatedResults.length}):
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {generatedResults.map(r => (
                      <img
                        key={r.id}
                        src={r.url}
                        alt={r.name}
                        title={r.name}
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                ¡Generación Masiva Completada!
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Se generaron {generatedResults.length} imágenes gastronómicas comerciales para los platos del menú.
              </p>

              {/* Thumbnail Strip */}
              {generatedResults.length > 0 && (
                <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
                  {generatedResults.slice(0, 8).map(r => (
                    <img
                      key={r.id}
                      src={r.url}
                      alt={r.name}
                      title={r.name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-2xs"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isProcessing ? 'Procesando sin bloquear la app...' : `${eligibleProducts.length} productos listos`}
          </span>

          <div className="flex items-center gap-2">
            {isProcessing ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            ) : isCompleted ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-xs transition-colors cursor-pointer"
              >
                Listo
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={eligibleProducts.length === 0}
                  onClick={handleStartBatch}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Iniciar Generación
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
