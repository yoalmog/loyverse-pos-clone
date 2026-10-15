'use client';

import React, { useState } from 'react';
import { 
  X, Camera, Sparkles, Upload, Check, Copy, AlertCircle, 
  ArrowRight, Image as ImageIcon, Sliders, RefreshCw 
} from 'lucide-react';
import { 
  ScannedMenuItem, 
  FoodPhotoStyle, 
  FOOD_PHOTO_STYLES, 
  parseMenuTextToItems, 
  generateFoodPhotoPrompt 
} from '@/lib/ai-menu-studio';
import { soundFeedback } from '@/lib/accessibility';

interface AiMenuScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: ScannedMenuItem[]) => Promise<void>;
}

const DEMO_MENU_TEXT = `CAFETERÍA Y BEBIDAS
Espresso Doble        S/ 8.00
Café Americano        S/ 9.50
Café con agua caliente y notas tostadas intensas
Capuccino Italiano    S/ 12.00
Espresso con espuma de leche cremosa y canela
Latte Vainilla        S/ 13.50
Mocaccino Especial    S/ 14.00
Té Verde con Jazmín   S/ 7.50

PASTELERÍA ARTESANAL
Croissant de Mantequilla S/ 9.00
Masa hojaldrada tradicional francesa horneada hoy
Tarta de Manzana Caliente S/ 15.00
Con canela y nueces crujientes
Muffin de Arándanos   S/ 8.50
Cookie con Chispas de Chocolate S/ 6.00

SÁNDWICHES GOURMET
Club Sándwich Clásico S/ 24.00
Pollo, jamón, queso, huevo, tocino y papas
Panini Caprese        S/ 18.50
Mozzarella, tomate confitado, albahaca y pesto`;

export function AiMenuScannerModal({
  isOpen,
  onClose,
  onImportItems,
}: AiMenuScannerModalProps) {
  const [activeStep, setActiveStep] = useState<'UPLOAD' | 'REVIEW' | 'STUDIO'>('UPLOAD');
  const [menuText, setMenuText] = useState(DEMO_MENU_TEXT);
  const [scannedItems, setScannedItems] = useState<ScannedMenuItem[]>([]);
  const [selectedItemForStudio, setSelectedItemForStudio] = useState<ScannedMenuItem | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<FoodPhotoStyle>('STUDIO_EDITORIAL');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleStartOcr = () => {
    soundFeedback.playClick();
    const items = parseMenuTextToItems(menuText);
    setScannedItems(items);
    setActiveStep('REVIEW');
  };

  const handleToggleItem = (id: string) => {
    setScannedItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, status: it.status === 'ACCEPTED' ? 'SKIPPED' : 'ACCEPTED' } : it
      )
    );
    soundFeedback.playClick();
  };

  const handleOpenStudio = (item: ScannedMenuItem) => {
    setSelectedItemForStudio(item);
    setActiveStep('STUDIO');
    soundFeedback.playClick();
  };

  const handleCopyPrompt = () => {
    if (!selectedItemForStudio) return;
    const prompt = generateFoodPhotoPrompt(selectedItemForStudio, selectedStyle);
    navigator.clipboard?.writeText(prompt);
    setCopiedPrompt(true);
    soundFeedback.playClick();
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleFinalImport = async () => {
    setImporting(true);
    soundFeedback.playClick();
    try {
      const accepted = scannedItems.filter((it) => it.status !== 'SKIPPED');
      await onImportItems(accepted.length > 0 ? accepted : scannedItems);
      soundFeedback.playCheckoutChime();
      onClose();
    } catch (e: any) {
      alert(`Error al importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Escáner de Carta IA & Estudio Fotográfico de Alimentos
              </h3>
              <p className="text-[11px] text-slate-400">
                Digitalización óptica de cartas con Gemini AI Food Studio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveStep('UPLOAD')}
            className={`flex-1 py-3 text-center font-bold transition-colors ${
              activeStep === 'UPLOAD'
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            1. Captura / Texto de Menú
          </button>
          <button
            onClick={() => scannedItems.length > 0 && setActiveStep('REVIEW')}
            className={`flex-1 py-3 text-center font-bold transition-colors ${
              activeStep === 'REVIEW'
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            2. Revisión de Platos ({scannedItems.length})
          </button>
          <button
            onClick={() => selectedItemForStudio && setActiveStep('STUDIO')}
            className={`flex-1 py-3 text-center font-bold transition-colors ${
              activeStep === 'STUDIO'
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            3. Gemini AI Food Studio
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeStep === 'UPLOAD' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center">
                <Camera className="mx-auto h-10 w-10 text-emerald-400/80 mb-2" />
                <h4 className="text-sm font-bold text-white">Escanear Menú o Carta Física</h4>
                <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                  El motor OCR detecta automáticamente categorías, nombres de platos, descripciones y precios.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 border border-slate-700">
                    <Upload className="h-4 w-4" />
                    Subir Foto de Carta
                    <input type="file" accept="image/*" className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Texto Detectado por OCR (Editable para correcciones rápidas):
                </label>
                <textarea
                  rows={8}
                  value={menuText}
                  onChange={(e) => setMenuText(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-850 p-4 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStartOcr}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
                >
                  <span>Estructurar Menú Automáticamente</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {activeStep === 'REVIEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Platos Identificados ({scannedItems.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Haga clic en un plato para omitir o use el botón de cámara para generar su foto con IA
                  </p>
                </div>
                <button
                  onClick={() => setActiveStep('UPLOAD')}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Volver al texto
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-all ${
                      item.status === 'SKIPPED'
                        ? 'border-slate-800 bg-slate-900/40 opacity-40'
                        : 'border-slate-700 bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-slate-700/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                          {item.categoryName}
                        </span>
                        <span className="text-xs font-black text-white">
                          S/ {(item.priceCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <h5 className="mt-1.5 text-xs font-bold text-white">{item.name}</h5>
                      {item.description && (
                        <p className="mt-1 text-[11px] line-clamp-2 text-slate-400">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-2 text-[11px]">
                      <button
                        onClick={() => handleToggleItem(item.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        {item.status === 'SKIPPED' ? 'Incluir' : 'Omitir'}
                      </button>
                      <button
                        onClick={() => handleOpenStudio(item)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2.5 py-1 font-bold text-indigo-300 hover:bg-indigo-500/30"
                      >
                        <Sparkles className="h-3 w-3" />
                        Foto IA
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={handleFinalImport}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {importing ? 'Importando a la Base de Datos...' : 'Importar Todos al Catálogo'}
                </button>
              </div>
            </div>
          )}

          {activeStep === 'STUDIO' && selectedItemForStudio && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Generador de Fotografía Gastronómica para: {selectedItemForStudio.name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Elija un estilo visual para componer el prompt de imagen con IA
                  </p>
                </div>
                <button
                  onClick={() => setActiveStep('REVIEW')}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Volver a la lista
                </button>
              </div>

              {/* Style Presets */}
              <div className="grid grid-cols-2 gap-3">
                {FOOD_PHOTO_STYLES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setSelectedStyle(st.id);
                      soundFeedback.playClick();
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      selectedStyle === st.id
                        ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30'
                        : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{st.name}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{st.description}</div>
                  </button>
                ))}
              </div>

              {/* Generated Prompt Box */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Prompt Optimizado para Gemini Imagen / Midjourney:</span>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 text-emerald-400 hover:underline text-[11px]"
                  >
                    {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedPrompt ? '¡Copiado!' : 'Copiar Prompt'}
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 leading-relaxed">
                  {generateFoodPhotoPrompt(selectedItemForStudio, selectedStyle)}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActiveStep('REVIEW')}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Guardar y Volver a Revisión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
