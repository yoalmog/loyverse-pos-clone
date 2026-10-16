/**
-- AuraPOS Supabase Database Definitions & Strongly-Typed Schema
-- Auto-generated TypeScript definitions for PostgreSQL tables, views, and relations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          address: Json;
          phone: string | null;
          email: string | null;
          currency: string;
          timezone: string;
          default_locale: string;
          tax_number: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          address?: Json;
          phone?: string | null;
          email?: string | null;
          currency?: string;
          timezone?: string;
          default_locale?: string;
          tax_number?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          legal_name?: string | null;
          address?: Json;
          phone?: string | null;
          email?: string | null;
          currency?: string;
          timezone?: string;
          default_locale?: string;
          tax_number?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      terminals: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          device_identifier: string;
          status: 'active' | 'inactive' | 'maintenance';
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          device_identifier: string;
          status?: 'active' | 'inactive' | 'maintenance';
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          device_identifier?: string;
          status?: 'active' | 'inactive' | 'maintenance';
          last_seen_at?: string | null;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          store_id: string;
          display_name: string;
          phone: string | null;
          pin_hash: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          store_id: string;
          display_name: string;
          phone?: string | null;
          pin_hash?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          display_name?: string;
          phone?: string | null;
          pin_hash?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
        };
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          module: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          module: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          module?: string;
          description?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          store_id: string;
          default_locale: string;
          icon: string;
          image_url: string | null;
          color: string;
          sort_order: number;
          parent_id: string | null;
          printer_id: string | null;
          auto_print_kitchen: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          default_locale?: string;
          icon?: string;
          image_url?: string | null;
          color?: string;
          sort_order?: number;
          parent_id?: string | null;
          printer_id?: string | null;
          auto_print_kitchen?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          default_locale?: string;
          icon?: string;
          image_url?: string | null;
          color?: string;
          sort_order?: number;
          parent_id?: string | null;
          printer_id?: string | null;
          auto_print_kitchen?: boolean;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      category_translations: {
        Row: {
          id: string;
          category_id: string;
          locale: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          locale: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          locale?: string;
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          tax_id: string | null;
          name: string;
          sku: string | null;
          barcode: string | null;
          description: string | null;
          price: number;
          cost: number;
          unit: string;
          track_inventory: boolean;
          stock_minimum: number;
          is_favorite: boolean;
          is_active: boolean;
          image_url: string | null;
          image_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          tax_id?: string | null;
          name: string;
          sku?: string | null;
          barcode?: string | null;
          description?: string | null;
          price: number;
          cost?: number;
          unit?: string;
          track_inventory?: boolean;
          stock_minimum?: number;
          is_favorite?: boolean;
          is_active?: boolean;
          image_url?: string | null;
          image_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          category_id?: string | null;
          tax_id?: string | null;
          name?: string;
          sku?: string | null;
          barcode?: string | null;
          description?: string | null;
          price?: number;
          cost?: number;
          unit?: string;
          track_inventory?: boolean;
          stock_minimum?: number;
          is_favorite?: boolean;
          is_active?: boolean;
          image_url?: string | null;
          image_metadata?: Json;
          updated_at?: string;
        };
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string | null;
          barcode: string | null;
          price: number;
          cost: number;
          attributes: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          sku?: string | null;
          barcode?: string | null;
          price: number;
          cost?: number;
          attributes?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          sku?: string | null;
          barcode?: string | null;
          price?: number;
          cost?: number;
          attributes?: Json;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          loyalty_points: number;
          lifetime_points: number;
          total_spent: number;
          total_orders: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          loyalty_points?: number;
          lifetime_points?: number;
          total_spent?: number;
          total_orders?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          loyalty_points?: number;
          lifetime_points?: number;
          total_spent?: number;
          total_orders?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          store_id: string;
          terminal_id: string | null;
          cashier_id: string | null;
          customer_id: string | null;
          receipt_number: string;
          order_type: string;
          status: 'completed' | 'refunded' | 'partially_refunded' | 'cancelled';
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          currency: string;
          is_offline: boolean;
          client_created_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          terminal_id?: string | null;
          cashier_id?: string | null;
          customer_id?: string | null;
          receipt_number: string;
          order_type?: string;
          status: 'completed' | 'refunded' | 'partially_refunded' | 'cancelled';
          subtotal: number;
          discount_total?: number;
          tax_total?: number;
          total: number;
          currency?: string;
          is_offline?: boolean;
          client_created_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          terminal_id?: string | null;
          cashier_id?: string | null;
          customer_id?: string | null;
          receipt_number?: string;
          order_type?: string;
          status?: 'completed' | 'refunded' | 'partially_refunded' | 'cancelled';
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          currency?: string;
          is_offline?: boolean;
          updated_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name_snapshot: string;
          sku_snapshot: string | null;
          quantity: number;
          unit_price: number;
          discount: number;
          tax: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          product_name_snapshot: string;
          sku_snapshot?: string | null;
          quantity: number;
          unit_price: number;
          discount?: number;
          tax?: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          product_name_snapshot?: string;
          sku_snapshot?: string | null;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          tax?: number;
          total?: number;
        };
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          method: 'cash' | 'card' | 'mobile' | 'bank' | 'loyalty' | 'yape' | 'plin' | 'other';
          amount: number;
          tendered: number | null;
          change: number | null;
          status: string;
          provider_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          method: 'cash' | 'card' | 'mobile' | 'bank' | 'loyalty' | 'yape' | 'plin' | 'other';
          amount: number;
          tendered?: number | null;
          change?: number | null;
          status?: string;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          method?: 'cash' | 'card' | 'mobile' | 'bank' | 'loyalty' | 'yape' | 'plin' | 'other';
          amount?: number;
          tendered?: number | null;
          change?: number | null;
          status?: string;
          provider_reference?: string | null;
          updated_at?: string;
        };
      };
      inventory: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          quantity: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
      };
      inventory_movements: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          type: 'sale' | 'refund' | 'adjustment' | 'purchase' | 'transfer' | 'damaged' | 'count';
          quantity: number;
          reference_type: string | null;
          reference_id: string | null;
          user_id: string | null;
          terminal_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          type: 'sale' | 'refund' | 'adjustment' | 'purchase' | 'transfer' | 'damaged' | 'count';
          quantity: number;
          reference_type?: string | null;
          reference_id?: string | null;
          user_id?: string | null;
          terminal_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          type?: 'sale' | 'refund' | 'adjustment' | 'purchase' | 'transfer' | 'damaged' | 'count';
          quantity?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          user_id?: string | null;
          terminal_id?: string | null;
          notes?: string | null;
        };
      };
      printers: {
        Row: {
          id: string;
          store_id: string;
          terminal_id: string | null;
          name: string;
          connection_type: 'BLUETOOTH' | 'USB' | 'NETWORK' | 'BUILTIN' | 'BROWSER';
          device_identifier: string | null;
          address: string | null;
          port: number | null;
          protocol: string;
          paper_width: number;
          capabilities: Json;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_seen_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          terminal_id?: string | null;
          name: string;
          connection_type: 'BLUETOOTH' | 'USB' | 'NETWORK' | 'BUILTIN' | 'BROWSER';
          device_identifier?: string | null;
          address?: string | null;
          port?: number | null;
          protocol?: string;
          paper_width?: number;
          capabilities?: Json;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          terminal_id?: string | null;
          name?: string;
          connection_type?: 'BLUETOOTH' | 'USB' | 'NETWORK' | 'BUILTIN' | 'BROWSER';
          device_identifier?: string | null;
          address?: string | null;
          port?: number | null;
          protocol?: string;
          paper_width?: number;
          capabilities?: Json;
          is_default?: boolean;
          is_active?: boolean;
          updated_at?: string;
          last_seen_at?: string | null;
        };
      };
      print_jobs: {
        Row: {
          id: string;
          store_id: string;
          terminal_id: string | null;
          printer_id: string;
          sale_id: string | null;
          job_type: string;
          payload: string;
          status: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED';
          attempt_count: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          printed_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          terminal_id?: string | null;
          printer_id: string;
          sale_id?: string | null;
          job_type: string;
          payload: string;
          status?: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED';
          attempt_count?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
          printed_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          terminal_id?: string | null;
          printer_id?: string;
          sale_id?: string | null;
          job_type?: string;
          payload?: string;
          status?: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED';
          attempt_count?: number;
          last_error?: string | null;
          updated_at?: string;
          printed_at?: string | null;
        };
      };
      store_settings: {
        Row: {
          id: string;
          store_id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          store_id: string;
          user_id: string | null;
          terminal_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id?: string | null;
          terminal_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string | null;
          terminal_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          metadata?: Json;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      sync_process_sale: {
        Args: {
          p_sale: Json;
          p_items: Json;
          p_payments: Json;
          p_movements: Json;
          p_client_event_id?: string | null;
        };
        Returns: Json;
      };
      sync_process_cash_shift: {
        Args: {
          p_shift: Json;
          p_movements?: Json | null;
          p_client_event_id?: string | null;
        };
        Returns: Json;
      };
      sync_pull_changes: {
        Args: {
          p_store_id: string;
          p_entity_type: string;
          p_cursor?: string | null;
        };
        Returns: { data: Json }[];
      };
      sync_backend_health: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
