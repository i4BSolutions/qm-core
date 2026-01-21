/**
 * Database Types
 *
 * This file contains TypeScript types for the Supabase database.
 * These types match the schema defined in /supabase/migrations/
 *
 * To regenerate from database:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.generated.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_persons: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          department_id: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_persons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_persons_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_persons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          head_id: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          head_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          head_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_id_fkey"
            columns: ["head_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"] | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          default_unit: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          sku: string | null
          updated_at: string | null
          updated_by: string | null
          wac_amount: number | null
          wac_amount_eusd: number | null
          wac_currency: string | null
          wac_exchange_rate: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"] | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          sku?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wac_amount?: number | null
          wac_amount_eusd?: number | null
          wac_currency?: string | null
          wac_exchange_rate?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"] | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          sku?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wac_amount?: number | null
          wac_amount_eusd?: number | null
          wac_currency?: string | null
          wac_exchange_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      status_config: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          status_group: Database["public"]["Enums"]["status_group"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          status_group: Database["public"]["Enums"]["status_group"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          status_group?: Database["public"]["Enums"]["status_group"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          position: string | null
          tax_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          position?: string | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          position?: string | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          capacity_notes: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          capacity_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          capacity_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qmrl: {
        Row: {
          id: string
          request_id: string
          request_letter_no: string | null
          title: string
          status_id: string | null
          category_id: string | null
          department_id: string
          contact_person_id: string | null
          assigned_to: string | null
          requester_id: string
          request_date: string | null
          description: string | null
          priority: string | null
          notes: string | null
          is_active: boolean | null
          created_by: string | null
          updated_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          request_id?: string // Auto-generated by trigger
          request_letter_no?: string | null
          title: string
          status_id?: string | null
          category_id?: string | null
          department_id: string
          contact_person_id?: string | null
          assigned_to?: string | null
          requester_id: string
          request_date?: string | null
          description?: string | null
          priority?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          request_id?: string
          request_letter_no?: string | null
          title?: string
          status_id?: string | null
          category_id?: string | null
          department_id?: string
          contact_person_id?: string | null
          assigned_to?: string | null
          requester_id?: string
          request_date?: string | null
          description?: string | null
          priority?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qmrl_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmrl_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qmhq: {
        Row: {
          id: string
          request_id: string
          qmrl_id: string
          line_name: string
          description: string | null
          notes: string | null
          route_type: Database["public"]["Enums"]["route_type"]
          status_id: string | null
          category_id: string | null
          contact_person_id: string | null
          assigned_to: string | null
          item_id: string | null
          quantity: number | null
          warehouse_id: string | null
          amount: number | null
          currency: string | null
          exchange_rate: number | null
          amount_eusd: number | null
          total_money_in: number | null
          total_po_committed: number | null
          balance_in_hand: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          request_id?: string // Auto-generated by trigger
          qmrl_id: string
          line_name: string
          description?: string | null
          notes?: string | null
          route_type: Database["public"]["Enums"]["route_type"]
          status_id?: string | null
          category_id?: string | null
          contact_person_id?: string | null
          assigned_to?: string | null
          item_id?: string | null
          quantity?: number | null
          warehouse_id?: string | null
          amount?: number | null
          currency?: string | null
          exchange_rate?: number | null
          total_money_in?: number | null
          total_po_committed?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          request_id?: string
          qmrl_id?: string
          line_name?: string
          description?: string | null
          notes?: string | null
          route_type?: Database["public"]["Enums"]["route_type"]
          status_id?: string | null
          category_id?: string | null
          contact_person_id?: string | null
          assigned_to?: string | null
          item_id?: string | null
          quantity?: number | null
          warehouse_id?: string | null
          amount?: number | null
          currency?: string | null
          exchange_rate?: number | null
          total_money_in?: number | null
          total_po_committed?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qmhq_qmrl_id_fkey"
            columns: ["qmrl_id"]
            isOneToOne: false
            referencedRelation: "qmrl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qmhq_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          id: string
          transaction_id: string | null
          qmhq_id: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          amount: number
          currency: string
          exchange_rate: number
          amount_eusd: number | null
          description: string | null
          reference_no: string | null
          transaction_date: string | null
          notes: string | null
          attachment_url: string | null
          is_active: boolean | null
          is_voided: boolean | null
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          transaction_id?: string | null
          qmhq_id: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          amount: number
          currency?: string
          exchange_rate?: number
          description?: string | null
          reference_no?: string | null
          transaction_date?: string | null
          notes?: string | null
          attachment_url?: string | null
          is_active?: boolean | null
          is_voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          transaction_id?: string | null
          qmhq_id?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          amount?: number
          currency?: string
          exchange_rate?: number
          description?: string | null
          reference_no?: string | null
          transaction_date?: string | null
          notes?: string | null
          attachment_url?: string | null
          is_active?: boolean | null
          is_voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_qmhq_id_fkey"
            columns: ["qmhq_id"]
            isOneToOne: false
            referencedRelation: "qmhq"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string | null
          qmhq_id: string
          supplier_id: string | null
          po_date: string | null
          expected_delivery_date: string | null
          currency: string | null
          exchange_rate: number | null
          contact_person_name: string | null
          sign_person_name: string | null
          authorized_signer_name: string | null
          total_amount: number | null
          total_amount_eusd: number | null
          status: Database["public"]["Enums"]["po_status_enum"] | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          notes: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          po_number?: string | null
          qmhq_id: string
          supplier_id?: string | null
          po_date?: string | null
          expected_delivery_date?: string | null
          currency?: string | null
          exchange_rate?: number | null
          contact_person_name?: string | null
          sign_person_name?: string | null
          authorized_signer_name?: string | null
          total_amount?: number | null
          status?: Database["public"]["Enums"]["po_status_enum"] | null
          approval_status?: Database["public"]["Enums"]["approval_status"] | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          po_number?: string | null
          qmhq_id?: string
          supplier_id?: string | null
          po_date?: string | null
          expected_delivery_date?: string | null
          currency?: string | null
          exchange_rate?: number | null
          contact_person_name?: string | null
          sign_person_name?: string | null
          authorized_signer_name?: string | null
          total_amount?: number | null
          status?: Database["public"]["Enums"]["po_status_enum"] | null
          approval_status?: Database["public"]["Enums"]["approval_status"] | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_qmhq_id_fkey"
            columns: ["qmhq_id"]
            isOneToOne: false
            referencedRelation: "qmhq"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          id: string
          po_id: string
          item_id: string | null
          quantity: number
          unit_price: number
          total_price: number | null
          invoiced_quantity: number | null
          received_quantity: number | null
          item_name: string | null
          item_sku: string | null
          item_unit: string | null
          notes: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          po_id: string
          item_id?: string | null
          quantity?: number
          unit_price?: number
          invoiced_quantity?: number | null
          received_quantity?: number | null
          item_name?: string | null
          item_sku?: string | null
          item_unit?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          po_id?: string
          item_id?: string | null
          quantity?: number
          unit_price?: number
          invoiced_quantity?: number | null
          received_quantity?: number | null
          item_name?: string | null
          item_sku?: string | null
          item_unit?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_categories: {
        Args: { p_entity_type: Database["public"]["Enums"]["entity_type"] }
        Returns: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }[]
      }
      get_default_status_id: {
        Args: { p_entity_type: Database["public"]["Enums"]["entity_type"] }
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
    }
    Enums: {
      entity_type: "qmrl" | "qmhq" | "item"
      item_category: "equipment" | "consumable" | "uniform" | "other"
      status_group: "to_do" | "in_progress" | "done"
      user_role:
        | "admin"
        | "quartermaster"
        | "finance"
        | "inventory"
        | "proposal"
        | "frontline"
        | "requester"
      // Future enums (will be added when tables are created)
      priority_level: "low" | "medium" | "high" | "critical"
      route_type: "item" | "expense" | "po"
      po_status:
        | "not_started"
        | "partially_invoiced"
        | "awaiting_delivery"
        | "partially_received"
        | "closed"
        | "cancelled"
      po_status_enum:
        | "not_started"
        | "partially_invoiced"
        | "awaiting_delivery"
        | "partially_received"
        | "closed"
        | "cancelled"
      approval_status: "draft" | "approved" | "rejected"
      invoice_status:
        | "draft"
        | "received"
        | "partially_received"
        | "completed"
        | "voided"
      movement_type: "inventory_in" | "inventory_out"
      stock_out_reason:
        | "request"
        | "consumption"
        | "damage"
        | "lost"
        | "transfer"
        | "adjustment"
      transaction_type: "money_in" | "money_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type helper utilities
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

// Convenience type aliases for table rows
export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

// Simple convenience type aliases for table row types
export type Department = Tables<"departments">
export type User = Tables<"users">
export type StatusConfig = Tables<"status_config">
export type Category = Tables<"categories">
export type ContactPerson = Tables<"contact_persons">
export type Supplier = Tables<"suppliers">
export type Item = Tables<"items">
export type Warehouse = Tables<"warehouses">
export type QMRL = Tables<"qmrl">
export type QMHQ = Tables<"qmhq">
export type FinancialTransaction = Tables<"financial_transactions">
export type PurchaseOrder = Tables<"purchase_orders">
export type POLineItem = Tables<"po_line_items">

// Enum types
export type UserRole = Enums<"user_role">
export type StatusGroup = Enums<"status_group">
export type EntityType = Enums<"entity_type">
export type ItemCategory = Enums<"item_category">
export type PriorityLevel = Enums<"priority_level">
export type RouteType = Enums<"route_type">
export type POStatus = Enums<"po_status">
export type POStatusEnum = Enums<"po_status_enum">
export type ApprovalStatus = Enums<"approval_status">
export type InvoiceStatus = Enums<"invoice_status">
export type MovementType = Enums<"movement_type">
export type StockOutReason = Enums<"stock_out_reason">
export type TransactionType = Enums<"transaction_type">
