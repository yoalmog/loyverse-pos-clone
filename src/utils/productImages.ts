/**
 * Curated product image presets and store logo presets
 */

export interface ImagePreset {
  id: string;
  name: string;
  category: 'coffee' | 'bakery' | 'food' | 'tea' | 'dessert' | 'retail';
  url: string;
}

export const PRODUCT_IMAGE_PRESETS: ImagePreset[] = [
  // Coffee & Drinks
  {
    id: 'cappuccino',
    name: 'Artisan Cappuccino',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'latte',
    name: 'Oat Milk Latte',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'espresso',
    name: 'Double Espresso',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'coldbrew',
    name: 'Iced Cold Brew',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'cortado',
    name: 'Spanish Cortado',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'macchiato',
    name: 'Caramel Macchiato',
    category: 'coffee',
    url: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&auto=format&fit=crop&q=80'
  },

  // Bakery & Bread
  {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'painauchocolat',
    name: 'Pain au Chocolat',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'sourdough',
    name: 'Artisan Sourdough',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'bagel',
    name: 'Sesame Bagel',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400&auto=format&fit=crop&q=80'
  },

  // Food & Lunch
  {
    id: 'avocadotoast',
    name: 'Avocado Toast',
    category: 'food',
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'panini',
    name: 'Gourmet Panini',
    category: 'food',
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'salad',
    name: 'Mediterranean Salad',
    category: 'food',
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=80'
  },

  // Teas & Infusions
  {
    id: 'matcha',
    name: 'Ceremonial Matcha',
    category: 'tea',
    url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'earlgrey',
    name: 'Earl Grey Tea',
    category: 'tea',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'chai',
    name: 'Spiced Chai Latte',
    category: 'tea',
    url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=80'
  },

  // Sweets & Retail
  {
    id: 'cookie',
    name: 'Chocolate Chunk Cookie',
    category: 'dessert',
    url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'cheesecake',
    name: 'Berry Cheesecake',
    category: 'dessert',
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'coffeebag',
    name: 'Whole Bean Bag',
    category: 'retail',
    url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80'
  }
];

export interface LogoPreset {
  id: string;
  name: string;
  url: string;
}

export const STORE_LOGO_PRESETS: LogoPreset[] = [
  {
    id: 'cafe_cup',
    name: 'Artisan Cup Emblem',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'bakery_wheat',
    name: 'Artisan Bakery Wheat',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'market_botanical',
    name: 'Green Market Botanical',
    url: 'https://images.unsplash.com/photo-1492496913980-501348b61469?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'roastery_beans',
    name: 'Specialty Roastery',
    url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&auto=format&fit=crop&q=80'
  }
];
