/**
 * AuraPOS - ProductImagePromptBuilder
 * Conforming to Requirements 8, 9, 12:
 * Dynamically builds professional restaurant food photography prompts
 * from extracted product information (name, category, description).
 *
 * CRITICAL RULE:
 * DO NOT invent ingredients that were not provided.
 * If the menu only says "Pollo a la brasa", do not claim that the product
 * contains fries, salad, sauces, etc. The generated image represents a
 * plausible professional restaurant presentation of the named product
 * without falsely asserting unknown ingredients.
 */

export interface PromptBuilderInput {
  name: string;
  categoryName?: string;
  description?: string;
  detectedLanguage?: string;
}

export class ProductImagePromptBuilder {
  /**
   * Builds a high-fidelity image prompt for the Gemini image generation model.
   */
  static buildPrompt(input: PromptBuilderInput): string {
    const cleanName = (input.name || '').trim();
    const cleanCategory = (input.categoryName || '').trim();
    const cleanDesc = (input.description || '').trim();

    // Contextual culinary descriptor (preserving authentic culinary identity)
    const culinaryContext = this.getCulinaryContext(cleanName, cleanCategory);

    // Build the core subject clause
    let subjectClause = cleanName;
    if (culinaryContext) {
      subjectClause = `${cleanName} (${culinaryContext})`;
    }

    // Add description ONLY if genuinely present in the menu text, without hallucinating extra items
    let detailClause = '';
    if (cleanDesc && cleanDesc.length > 3) {
      // Clean up punctuation and prices from description if any
      const sanitizedDesc = cleanDesc.replace(/[$€£S\/0-9.,]+$/, '').trim();
      if (sanitizedDesc) {
        detailClause = `, prepared with ${sanitizedDesc}`;
      }
    }

    // Professional food photography studio aesthetics
    const photographicStyle =
      'Professional restaurant menu food photography, appetizing plated presentation, realistic natural food texture, clean restaurant presentation, neutral soft background, soft diffused warm studio lighting, 50mm food styling lens, high resolution commercial culinary photography';

    // Strict negative constraints to prevent text, fake menus, prices, watermarks
    const negativeConstraints =
      'no text, no letters, no words, no logo, no watermark, no price tag, no menu paper, no human hands, no utensils clutter';

    return `Commercial food photography of ${subjectClause}${detailClause}. ${photographicStyle}. Strictly ${negativeConstraints}.`;
  }

  /**
   * Provides authentic culinary genre context without asserting unstated side dishes or extra ingredients.
   */
  private static getCulinaryContext(name: string, category: string): string {
    const q = `${name} ${category}`.toLowerCase();

    // Peruvian & Latin American Specialties
    if (q.includes('pollo a la brasa')) return 'traditional Peruvian-style rotisserie roast chicken, golden crisp skin';
    if (q.includes('lomo saltado')) return 'classic Peruvian stir-fried beef tenderloin strips with red onions and tomatoes';
    if (q.includes('ceviche') || q.includes('cebiche')) return 'fresh cured fish ceviche in citrus leche de tigre';
    if (q.includes('causa')) return 'layered seasoned yellow potato dish';
    if (q.includes('anticucho')) return 'grilled marinated skewers';
    if (q.includes('chicha morada')) return 'purple corn refreshment beverage in a glass';
    if (q.includes('pisco sour')) return 'Peruvian pisco sour cocktail with foam and bitters drop';

    // Spanish / Tapas
    if (q.includes('tortilla española') || q.includes('tortilla de patata')) return 'traditional Spanish potato omelette';
    if (q.includes('croquetas')) return 'crisp golden Spanish croquettes';
    if (q.includes('patatas bravas')) return 'crispy potato bites with brava sauce';
    if (q.includes('paella')) return 'traditional Spanish saffron rice dish';

    // Italian
    if (q.includes('pizza')) return 'artisan baked pizza with melted cheese crust';
    if (q.includes('lasagna')) return 'baked layered pasta with rich meat sauce and melted cheese';
    if (q.includes('spaghetti') || q.includes('fettuccine') || q.includes('ravioli') || q.includes('pasta')) return 'plated fresh artisan pasta dish';
    if (q.includes('bruschetta')) return 'toasted crusty bread with diced tomatoes and herbs';
    if (q.includes('tiramisu') || q.includes('tiramisú')) return 'layered espresso mascarpone Italian dessert';

    // Grill / Burgers
    if (q.includes('hamburguesa') || q.includes('burger')) return 'gourmet grilled burger in a toasted bun';
    if (q.includes('bife') || q.includes('asado') || q.includes('carne') || q.includes('steak') || q.includes('parrilla')) return 'seared grilled steak cut cooked to perfection';

    // Salads & Starters
    if (q.includes('ensalada') || q.includes('salad')) return 'fresh crisp garden salad';
    if (q.includes('sopa') || q.includes('caldo') || q.includes('soup')) return 'warm restaurant soup bowl';

    // Bakery / Desserts
    if (q.includes('postre') || q.includes('torta') || q.includes('cake') || q.includes('helado')) return 'plated restaurant dessert';
    if (q.includes('cafe') || q.includes('café') || q.includes('cappuccino') || q.includes('espresso')) return 'freshly brewed artisan coffee cup with latte art';

    // Drinks
    if (q.includes('coctel') || q.includes('cocktail') || q.includes('trago') || q.includes('mojito')) return 'crafted cocktail in chilled glassware with garnish';
    if (q.includes('jugo') || q.includes('licuado') || q.includes('smoothie')) return 'freshly pressed chilled fruit juice in a tall glass';

    if (category) {
      return `plated dish from ${category} menu`;
    }

    return '';
  }
}
