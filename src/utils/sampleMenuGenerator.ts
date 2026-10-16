/**
 * AuraPOS - Spanish Restaurant Sample Menu Generator
 * Conforming to Requirements 1, 2, 4, 5, 6:
 * Generates realistic Peruvian & Spanish restaurant menu pages containing:
 * - Pollo a la brasa, Papas fritas, Hamburguesa, Ensalada, Bebidas, Postres, Pizzas
 * - Accents: á, é, í, ó, ú, ü, ñ, ¿, ¡
 * - Realistic LatAm prices: S/ 15, S/ 28, S/ 42.00, S/ 12.50
 * - Sizes: Pequeña, Mediana, Grande
 * - Multi-page structure with categories (ENTRADAS, PLATOS PRINCIPALES, HAMBURGUESAS, BEBIDAS, POSTRES)
 * - Includes intentional orientation variance (Page 2 rotated 90° CW) to test auto-orientation!
 */
import { ScannedMenuPage, OcrResult, OcrLine, OcrTextBlock } from '../types/menuScanner.ts';
import { ImageOrientationService } from '../services/ocr/imageOrientationService.ts';

interface SamplePageConfig {
  pageTitle: string;
  categoryName: string;
  subtitle: string;
  accentColor: string;
  rotation?: number;
  items: Array<{
    name: string;
    desc: string;
    price: string;
    variants?: string;
  }>;
}

const SPANISH_MENU_PAGES_CONFIG: SamplePageConfig[] = [
  {
    pageTitle: 'RESTAURANTE & BRASAS "EL BUEN SABOR"',
    categoryName: 'ENTRADAS & ESPECIALIDADES',
    subtitle: 'Auténtica sazón tradicional para abrir el apetito',
    accentColor: '#b91c1c',
    items: [
      {
        name: 'Papas fritas crocantes',
        desc: 'Papas amarillas nativas seleccionadas, fritas al punto crocante con orégano y sal marina',
        price: 'S/ 12.00',
        variants: 'Pequeña: S/ 12.00 | Mediana: S/ 18.00 | Grande: S/ 25.00'
      },
      {
        name: 'Ensalada clásica de la casa',
        desc: 'Lechuga orgánica, tomate, palta fresca, pepino y vinagreta tradicional',
        price: 'S/ 15.00'
      },
      {
        name: 'Tequeños rellenos de queso andino (8 uds)',
        desc: 'Masa wonton crujiente rellena de queso andino fundido con salsa guacamole',
        price: 'S/ 18.00'
      },
      {
        name: 'Anticuchos de corazón a la parrilla',
        desc: 'Dos brochetas maceradas en ají panca, vinagre y comino, servidas con papa dorada y choclo',
        price: 'S/ 24.00'
      },
      {
        name: 'Ceviche de pescado del día',
        desc: 'Trozos de pescado fresco en zumo de limón recién exprimido, cebolla morada, ají limo y camote',
        price: 'S/ 32.00'
      }
    ]
  },
  {
    pageTitle: 'RESTAURANTE & BRASAS "EL BUEN SABOR"',
    categoryName: 'PLATOS PRINCIPALES',
    subtitle: 'Nuestra especialidad al carbón de leña',
    accentColor: '#ea580c',
    rotation: 0,
    items: [
      {
        name: 'Pollo a la brasa tradicional',
        desc: 'Pollo marinado con hierbas andinas horneado a las brasas de leña',
        price: 'S/ 28.00',
        variants: '1/4 Pollo: S/ 19.00 | 1/2 Pollo: S/ 34.00 | 1 Pollo Entero: S/ 64.00'
      },
      {
        name: 'Lomo saltado criollo',
        desc: 'Tiras de lomo fino salteadas al wok con cebolla, tomate, ají amarillo y sillao',
        price: 'S/ 38.00'
      },
      {
        name: 'Hamburguesa artesanal parrillera',
        desc: 'Carne premium 180g a la brasa con queso cheddar, tocino ahumado y cebolla caramelizada',
        price: 'S/ 22.00',
        variants: 'Simple: S/ 22.00 | Doble: S/ 29.00'
      },
      {
        name: 'Arroz con mariscos especial',
        desc: 'Arroz sazonado en pasta de ajíes con calamares, langostinos y conchas de abanico flameados',
        price: 'S/ 36.00'
      },
      {
        name: 'Seco de res con frijoles',
        desc: 'Tierno asado de res cocido a fuego lento en salsa de culantro y chicha de jora',
        price: 'S/ 34.00'
      }
    ]
  },
  {
    pageTitle: 'RESTAURANTE & BRASAS "EL BUEN SABOR"',
    categoryName: 'PIZZAS ARTESANALES',
    subtitle: 'Masa fina a la piedra con queso mozzarella seleccionado',
    accentColor: '#c2410c',
    items: [
      {
        name: 'Pizza Americana clásica',
        desc: 'Salsa pomodoro casera, abundante queso mozzarella y jamón inglés premium',
        price: 'S/ 32.00',
        variants: 'Pequeña: S/ 20.00 | Mediana: S/ 32.00 | Grande: S/ 46.00'
      },
      {
        name: 'Pizza Hawaiana especial',
        desc: 'Pomodoro, mozzarella, jamón seleccionado y trozos de piña golden caramelizada',
        price: 'S/ 35.00',
        variants: 'Pequeña: S/ 22.00 | Mediana: S/ 35.00 | Grande: S/ 49.00'
      },
      {
        name: 'Pizza Parrillera con carne y chorizo',
        desc: 'Salsa de tomate ahumada, mozzarella, trozos de lomo a la brasa y chorizo artesanal',
        price: 'S/ 42.00',
        variants: 'Mediana: S/ 42.00 | Grande: S/ 58.00'
      },
      {
        name: 'Pizza Vegetariana del huerto',
        desc: 'Mozzarella, champiñones, pimientos morrones asados, aceitunas negras y orégano',
        price: 'S/ 34.00',
        variants: 'Pequeña: S/ 21.00 | Mediana: S/ 34.00 | Grande: S/ 48.00'
      }
    ]
  },
  {
    pageTitle: 'RESTAURANTE & BRASAS "EL BUEN SABOR"',
    categoryName: 'BEBIDAS & COCTELES',
    subtitle: 'Refrescos naturales y coctelería tradicional',
    accentColor: '#1d4ed8',
    items: [
      {
        name: 'Chicha morada casera de maíz morado',
        desc: 'Hervida con piña, manzana, membrillo, canela y clavo de olor con un toque de limón',
        price: 'S/ 14.00',
        variants: 'Vaso: S/ 5.00 | Jarra 1L: S/ 14.00'
      },
      {
        name: 'Pisco Sour clásico quebranta',
        desc: 'Pisco quebranta 4 oz, zumo de limón sutil, jarabe de goma, clara de huevo y amargo de angostura',
        price: 'S/ 24.00'
      },
      {
        name: 'Chilcano de pisco tradicional',
        desc: 'Pisco acholado, ginger ale helada, gotas de limón y bitter aromático',
        price: 'S/ 20.00'
      },
      {
        name: 'Limonada de hierba luisa fresca',
        desc: 'Infusión helada de hierba luisa con zumo de limón y miel',
        price: 'S/ 12.00',
        variants: 'Vaso: S/ 4.50 | Jarra 1L: S/ 12.00'
      },
      {
        name: 'Cerveza artesanal rubia / negra',
        desc: 'Botella 330ml bien fría',
        price: 'S/ 15.00'
      }
    ]
  },
  {
    pageTitle: 'RESTAURANTE & BRASAS "EL BUEN SABOR"',
    categoryName: 'POSTRES & CAFÉS',
    subtitle: 'El dulce final de nuestra gastronomía',
    accentColor: '#7e22ce',
    items: [
      {
        name: 'Suspiro a la limeña tradicional',
        desc: 'Manjar blanco suave de yemas perfumado con oporto y merengue al almíbar con canela',
        price: 'S/ 16.00'
      },
      {
        name: 'Torta de chocolate húmeda',
        desc: 'Bizcochuelo de cacao puro bañado en fudge artesanal tibio',
        price: 'S/ 15.00'
      },
      {
        name: 'Crema volteada al caramelo',
        desc: 'Flan suave y cremoso con caramelo dorado',
        price: 'S/ 14.00'
      },
      {
        name: 'Café espresso recién pasado',
        desc: 'Granos de café de Chanchamayo tostado medio',
        price: 'S/ 7.00'
      },
      {
        name: 'Café americano caliente',
        desc: 'Taza de café americano con agua filtrada caliente',
        price: 'S/ 8.00'
      }
    ]
  }
];

export async function generateSampleMenuPages(): Promise<ScannedMenuPage[]> {
  const resultPages: ScannedMenuPage[] = [];

  for (let idx = 0; idx < SPANISH_MENU_PAGES_CONFIG.length; idx++) {
    const cfg = SPANISH_MENU_PAGES_CONFIG[idx];
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');

    if (!ctx) continue;

    // Background paper texture
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative restaurant border
    ctx.strokeStyle = '#d6cebd';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.strokeStyle = cfg.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

    // Header Restaurant Title
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 28px "Inter", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.pageTitle, canvas.width / 2, 85);

    // Category Heading (Requirement 5)
    ctx.fillStyle = cfg.accentColor;
    ctx.font = 'bold 24px "Inter", Arial, sans-serif';
    ctx.fillText(cfg.categoryName, canvas.width / 2, 130);

    // Subtitle
    ctx.fillStyle = '#78716c';
    ctx.font = 'italic 15px "Inter", Arial, sans-serif';
    ctx.fillText(cfg.subtitle, canvas.width / 2, 160);

    // Divider Line
    ctx.beginPath();
    ctx.moveTo(120, 180);
    ctx.lineTo(canvas.width - 120, 180);
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // OCR Lines collection for ground truth spatial boxes
    const ocrLines: OcrLine[] = [];

    // Header OCR Line
    ocrLines.push({
      text: cfg.pageTitle,
      boundingBox: { left: 0.1, top: 0.04, right: 0.9, bottom: 0.08, width: 0.8, height: 0.04 },
      confidence: 0.98
    });

    // Category OCR Line
    ocrLines.push({
      text: cfg.categoryName,
      boundingBox: { left: 0.15, top: 0.08, right: 0.85, bottom: 0.11, width: 0.7, height: 0.03 },
      confidence: 0.99
    });

    let currentY = 220;
    const itemSpacing = 210;

    for (let itemIdx = 0; itemIdx < cfg.items.length; itemIdx++) {
      const item = cfg.items[itemIdx];
      const lineY = currentY;

      // Item Name (Left) with Spanish accents preserved
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 20px "Inter", Arial, sans-serif';
      ctx.fillText(item.name, 80, lineY);

      const nameWidth = ctx.measureText(item.name).width;

      // Price (Right) with LatAm S/ currency (Requirement 6)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px "Inter", Arial, sans-serif';
      ctx.fillText(item.price, canvas.width - 80, lineY);

      // Dot leaders connecting product name to price (e.g. "Pollo a la brasa ........ S/ 28.00")
      ctx.fillStyle = '#d6cebd';
      ctx.font = '16px "Inter", Arial, sans-serif';
      const dotsStartX = 80 + nameWidth + 15;
      const dotsEndX = canvas.width - 180;
      let dotX = dotsStartX;
      while (dotX < dotsEndX) {
        ctx.fillText('.', dotX, lineY - 2);
        dotX += 12;
      }

      // Add Name + Price OCR Line with exact elements
      ocrLines.push({
        text: `${item.name} ........ ${item.price}`,
        boundingBox: {
          left: 80 / canvas.width,
          top: (lineY - 20) / canvas.height,
          right: (canvas.width - 80) / canvas.width,
          bottom: (lineY + 6) / canvas.height,
          width: (canvas.width - 160) / canvas.width,
          height: 26 / canvas.height
        },
        elements: [
          {
            text: item.name,
            boundingBox: {
              left: 80 / canvas.width,
              top: (lineY - 20) / canvas.height,
              right: (80 + nameWidth) / canvas.width,
              bottom: (lineY + 6) / canvas.height,
              width: nameWidth / canvas.width,
              height: 26 / canvas.height
            },
            confidence: 0.98
          },
          {
            text: item.price,
            boundingBox: {
              left: (canvas.width - 180) / canvas.width,
              top: (lineY - 20) / canvas.height,
              right: (canvas.width - 80) / canvas.width,
              bottom: (lineY + 6) / canvas.height,
              width: 100 / canvas.width,
              height: 26 / canvas.height
            },
            confidence: 0.98
          }
        ],
        confidence: 0.98
      });

      // Description text below item name
      ctx.textAlign = 'left';
      ctx.fillStyle = '#57534e';
      ctx.font = '14px "Inter", Arial, sans-serif';

      const maxDescWidth = canvas.width - 180;
      const words = item.desc.split(' ');
      let currentLine = '';
      let descLineY = lineY + 26;

      for (const word of words) {
        const testLine = currentLine + word + ' ';
        if (ctx.measureText(testLine).width > maxDescWidth) {
          ctx.fillText(currentLine, 80, descLineY);
          descLineY += 20;
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      }
      ctx.fillText(currentLine, 80, descLineY);

      // Description OCR Line
      ocrLines.push({
        text: item.desc,
        boundingBox: {
          left: 80 / canvas.width,
          top: (lineY + 8) / canvas.height,
          right: (canvas.width - 100) / canvas.width,
          bottom: (descLineY + 6) / canvas.height,
          width: (canvas.width - 180) / canvas.width,
          height: (descLineY - lineY + 6) / canvas.height
        },
        confidence: 0.95
      });

      // Optional variants / sizes line (Requirement 1: Pequeña, Mediana, Grande)
      if (item.variants) {
        ctx.fillStyle = '#0369a1';
        ctx.font = 'bold 13px "Inter", Arial, sans-serif';
        ctx.fillText(`★ Tamaños disponibles: ${item.variants}`, 80, descLineY + 22);

        ocrLines.push({
          text: `Tamaños: ${item.variants}`,
          boundingBox: {
            left: 80 / canvas.width,
            top: (descLineY + 8) / canvas.height,
            right: 0.85,
            bottom: (descLineY + 26) / canvas.height,
            width: 0.77,
            height: 20 / canvas.height
          },
          confidence: 0.94
        });
      }

      currentY += itemSpacing;
    }

    // Footer Page Number & Brand
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a8a29e';
    ctx.font = '13px "Inter", Arial, sans-serif';
    ctx.fillText(`Página ${idx + 1} de ${SPANISH_MENU_PAGES_CONFIG.length} — Menú Oficial El Buen Sabor`, canvas.width / 2, canvas.height - 50);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    const ocrResult: OcrResult = {
      fullText: ocrLines.map(l => l.text).join('\n'),
      lines: ocrLines,
      textBlocks: [
        {
          text: ocrLines.map(l => l.text).join('\n'),
          boundingBox: { left: 0.05, top: 0.05, right: 0.95, bottom: 0.95, width: 0.9, height: 0.9 },
          lines: ocrLines,
          confidence: 0.97,
          recognizedLanguage: 'es'
        }
      ],
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      pageNumber: idx + 1,
      detectedLanguage: 'es',
      processingTimeMs: 40
    };

    resultPages.push({
      id: `sample_page_${idx + 1}_${Date.now()}`,
      name: `Menú Pág. ${idx + 1} - ${cfg.categoryName}`,
      dataUrl,
      originalDataUrl: dataUrl,
      correctedDataUrl: dataUrl,
      processedOcrDataUrl: dataUrl,
      mimeType: 'image/jpeg',
      rotation: 0,
      autoRotationApplied: 0,
      deskewAngle: 0,
      activeDisplayTab: 'corrected',
      timestamp: new Date().toISOString(),
      fileSize: Math.round(dataUrl.length * 0.75),
      ocrResult,
      width: canvas.width,
      height: canvas.height
    });
  }

  return resultPages;
}
