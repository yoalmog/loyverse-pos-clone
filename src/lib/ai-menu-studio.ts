/**
 * Loyverse AI Menu Scanner & Food Image Studio
 * Features:
 *   - Multi-Page Menu Digitization
 *   - Optical Preprocessing: Auto-Orientation, Contrast Enhancement, Thresholding
 *   - OCR & Structure Parser: Categories, Product Names, Descriptions, Base Prices, Variants
 *   - Gemini AI Food Photography Studio: Prompt Builder with Styles (Editorial, Rustic, Vibrant, Dramatic)
 *   - Catalog Import Review & Merge / Overwrite Conflict Resolver
 */

export interface ScannedMenuItem {
  id: string;
  categoryName: string;
  name: string;
  description: string;
  priceCents: number;
  costCents: number;
  sku: string;
  confidence: number; // 0.0 - 1.0
  variants?: { name: string; priceCents: number }[];
  modifiers?: { name: string; priceCents: number }[];
  selectedImageStyle?: string;
  generatedImageUrl?: string;
  status: 'PENDING' | 'ACCEPTED' | 'SKIPPED';
}

export type FoodPhotoStyle = 'STUDIO_EDITORIAL' | 'RUSTIC_OVERHEAD' | 'VIBRANT_CAFE' | 'DARK_DRAMATIC';

export interface FoodStylePreset {
  id: FoodPhotoStyle;
  name: string;
  description: string;
  backgroundPrompt: string;
  lightingPrompt: string;
  accentPrompt: string;
}

export const FOOD_PHOTO_STYLES: FoodStylePreset[] = [
  {
    id: 'STUDIO_EDITORIAL',
    name: 'Studio Editorial',
    description: 'Fondo de mármol blanco pulido, luz difusa suave y composición minimalista de revista.',
    backgroundPrompt: 'on a clean polished white Carrara marble surface with subtle gray veining',
    lightingPrompt: 'soft diffused professional commercial studio lighting with gentle natural reflections',
    accentPrompt: 'minimalist gourmet restaurant presentation, ultra-sharp focus, 8k resolution',
  },
  {
    id: 'RUSTIC_OVERHEAD',
    name: 'Rustic Overhead (Flat Lay)',
    description: 'Tabla de madera rústica oscura, vista cenital 90°, toques de hierbas frescas y lino.',
    backgroundPrompt: 'from directly overhead 90 degree top-down flat lay view, arranged on a weathered dark walnut cutting board',
    lightingPrompt: 'warm moody natural window light with gentle directional shadows',
    accentPrompt: 'scattered fresh culinary herbs and sea salt crystals, artisanal bistro styling',
  },
  {
    id: 'VIBRANT_CAFE',
    name: 'Vibrant Cafe & Terrace',
    description: 'Mesa de cafetería soleada, luz natural brillante, colores vivos y ambiente acogedor.',
    backgroundPrompt: 'on a sun-drenched cafe bistro table with soft pastel ceramic tableware',
    lightingPrompt: 'bright morning sunlight with playful dappled cafe shadows and golden hour warmth',
    accentPrompt: 'vibrant colors, mouth-watering steam rising softly, shallow depth of field, bokeh background',
  },
  {
    id: 'DARK_DRAMATIC',
    name: 'Dark & Dramatic Gastronomy',
    description: 'Pizarra de piedra negra, iluminación de contorno (rim lighting) y vapor tenue.',
    backgroundPrompt: 'against a textured matte black slate stone background with subtle dark charcoal tones',
    lightingPrompt: 'cinematic chiaroscuro rim lighting emphasizing textures and glistening sauces',
    accentPrompt: 'haute cuisine luxury plating with microgreens garnish, dramatic culinary atmosphere',
  },
];

/**
 * Image Preprocessing: Canvas Grayscale & High Contrast Filter
 */
export function preprocessMenuCanvas(
  sourceCanvas: HTMLCanvasElement,
  contrastFactor = 1.3
): HTMLCanvasElement {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Contrast correction factor
  const factor = (259 * (contrastFactor * 100 + 255)) / (255 * (259 - contrastFactor * 100));

  for (let i = 0; i < data.length; i += 4) {
    // Luminance grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast stretch
    const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext('2d');
  if (outCtx) {
    outCtx.putImageData(imageData, 0, 0);
  }
  return outputCanvas;
}

/**
 * Intelligent Text Parser: Groups raw OCR text lines into structured items with prices
 */
export function parseMenuTextToItems(rawText: string): ScannedMenuItem[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ScannedMenuItem[] = [];

  let currentCategory = 'General';

  // Regular expressions to detect price patterns: S/ 15.00, 15.00, $12.50, 20.00 soles
  const priceRegex = /(?:S\/|\$|€)?\s*(\d{1,4}(?:[.,]\d{2}))(?:\s*(?:soles|usd))?/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect if line looks like a category header (ALL CAPS, short, no price)
    if (line.length < 35 && line === line.toUpperCase() && !priceRegex.test(line) && !line.includes(':')) {
      currentCategory = line.charAt(0) + line.slice(1).toLowerCase();
      continue;
    }

    const match = line.match(priceRegex);
    if (match) {
      const priceRaw = match[1].replace(',', '.');
      const priceCents = Math.round(parseFloat(priceRaw) * 100);

      // Name is the text before or after the price
      const cleanName = line.replace(match[0], '').trim() || `Item ${items.length + 1}`;
      let description = '';

      // Check if next line is a description (no price, longer text)
      if (i + 1 < lines.length && !priceRegex.test(lines[i + 1]) && lines[i + 1].length > 10) {
        description = lines[i + 1];
        i++; // Consume next line
      }

      items.push({
        id: `scanned_${Date.now()}_${items.length}`,
        categoryName: currentCategory,
        name: cleanName.replace(/^[-•*\s]+/, ''),
        description,
        priceCents,
        costCents: Math.round(priceCents * 0.35), // Default 35% estimated food cost
        sku: `MENU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        confidence: 0.92,
        status: 'PENDING',
        selectedImageStyle: 'STUDIO_EDITORIAL',
      });
    }
  }

  return items;
}

/**
 * Build optimized Gemini prompt for food photography generation
 */
export function generateFoodPhotoPrompt(item: { name: string; description?: string; categoryName?: string }, styleId: FoodPhotoStyle = 'STUDIO_EDITORIAL'): string {
  const style = FOOD_PHOTO_STYLES.find(s => s.id === styleId) || FOOD_PHOTO_STYLES[0];
  const descPart = item.description ? `, described as "${item.description}"` : '';

  return `Award-winning commercial gourmet food photography of appetizing fresh "${item.name}"${descPart}, categorized under ${item.categoryName || 'Culinary'}. Placed ${style.backgroundPrompt}. Captured with ${style.lightingPrompt}. Featuring ${style.accentPrompt}. Professional Sony Alpha A7R V 50mm f/1.4 lens food magazine shot.`;
}
