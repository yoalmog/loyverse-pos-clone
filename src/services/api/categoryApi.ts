import { Category, CategoryTranslation, Product } from '../../types/pos.ts';

const BASE_URL = '/api/v1/categories';

export class CategoryApi {
  static async getAll(): Promise<Category[]> {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`Failed to fetch categories: ${res.statusText}`);
    return res.json();
  }

  static async create(data: { category: Partial<Category>; translations?: Record<string, any> }): Promise<Category> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create category');
    }
    return res.json();
  }

  static async getById(id: string): Promise<Category> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Category not found: ${id}`);
    return res.json();
  }

  static async update(
    id: string,
    data: { category: Partial<Category>; translations?: Record<string, any> }
  ): Promise<Category> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update category');
    }
    return res.json();
  }

  static async delete(id: string, destinationCategoryId?: string): Promise<{ success: boolean }> {
    const query = destinationCategoryId ? `?destinationCategoryId=${encodeURIComponent(destinationCategoryId)}` : '';
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete category');
    return res.json();
  }

  static async updateStatus(id: string, active: boolean): Promise<Category> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    if (!res.ok) throw new Error('Failed to update category status');
    return res.json();
  }

  static async reorder(orderedIds: string[]): Promise<{ success: boolean; categories: Category[] }> {
    const res = await fetch(`${BASE_URL}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
    if (!res.ok) throw new Error('Failed to reorder categories');
    return res.json();
  }

  static async getProducts(id: string): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/products`);
    if (!res.ok) throw new Error('Failed to fetch category products');
    return res.json();
  }

  static async createTranslation(
    id: string,
    translation: { locale: string; name: string; description?: string }
  ): Promise<CategoryTranslation> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translation)
    });
    if (!res.ok) throw new Error('Failed to create translation');
    return res.json();
  }

  static async updateTranslation(
    id: string,
    locale: string,
    translation: { name: string; description?: string }
  ): Promise<CategoryTranslation> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/translations/${encodeURIComponent(locale)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translation)
    });
    if (!res.ok) throw new Error('Failed to update translation');
    return res.json();
  }
}
