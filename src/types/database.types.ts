export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      invoice_sequences: {
        Row: {
          id: number
          last_sequence_number: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_sequence_number?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_sequence_number?: number
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          name: string
          qr_code_identifier: string
          location_type: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          pin_salt: string
          pin_hash: string
          token_version: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          qr_code_identifier: string
          location_type?: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          pin_salt?: string
          pin_hash?: string
          token_version?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          qr_code_identifier?: string
          location_type?: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          pin_salt?: string
          pin_hash?: string
          token_version?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      guest_sessions: {
        Row: {
          id: string
          location_id: string
          session_token: string
          guest_name: string
          guest_phone: string | null
          token_version: number
          status: 'active' | 'closed' | 'settled' | 'voided'
          subtotal: number
          tax: number
          total_amount: number
          total_items_count: number
          rounds_count: number
          payment_method: 'room_folio' | 'credit_card' | 'cash' | null
          invoice_number: string | null
          invoice_checksum: string | null
          invoice_sequence_number: number | null
          staff_note: string | null
          created_at: string
          updated_at: string
          settled_at: string | null
          closed_at: string | null
        }
        Insert: {
          id?: string
          location_id: string
          session_token?: string
          guest_name?: string
          guest_phone?: string | null
          token_version?: number
          status?: 'active' | 'closed' | 'settled' | 'voided'
          subtotal?: number
          tax?: number
          total_amount?: number
          total_items_count?: number
          rounds_count?: number
          payment_method?: 'room_folio' | 'credit_card' | 'cash' | null
          invoice_number?: string | null
          invoice_checksum?: string | null
          invoice_sequence_number?: number | null
          staff_note?: string | null
          created_at?: string
          updated_at?: string
          settled_at?: string | null
          closed_at?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          session_token?: string
          guest_name?: string
          guest_phone?: string | null
          token_version?: number
          status?: 'active' | 'closed' | 'settled' | 'voided'
          subtotal?: number
          tax?: number
          total_amount?: number
          total_items_count?: number
          rounds_count?: number
          payment_method?: 'room_folio' | 'credit_card' | 'cash' | null
          invoice_number?: string | null
          invoice_checksum?: string | null
          invoice_sequence_number?: number | null
          staff_note?: string | null
          created_at?: string
          updated_at?: string
          settled_at?: string | null
          closed_at?: string | null
        }
      }
      menu_items: {
        Row: {
          id: string
          category: string
          name: string
          description: string | null
          price: number
          image_url: string | null
          is_available: boolean
          dietary_tags: string[]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category: string
          name: string
          description?: string | null
          price: number
          image_url?: string | null
          is_available?: boolean
          dietary_tags?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category?: string
          name?: string
          description?: string | null
          price?: number
          image_url?: string | null
          is_available?: boolean
          dietary_tags?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          guest_session_id: string
          location_id: string
          round_number: number
          idempotency_key: string | null
          status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
          tax_rate_snapshot: number
          subtotal: number
          tax: number
          total: number
          special_instructions: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          guest_session_id: string
          location_id: string
          round_number?: number
          idempotency_key?: string | null
          status?: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
          tax_rate_snapshot?: number
          subtotal?: number
          tax?: number
          total?: number
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          guest_session_id?: string
          location_id?: string
          round_number?: number
          idempotency_key?: string | null
          status?: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
          tax_rate_snapshot?: number
          subtotal?: number
          tax?: number
          total?: number
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string | null
          item_name: string
          unit_price: number
          quantity: number
          subtotal: number
          notes: string | null
          is_voided: boolean
          void_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id?: string | null
          item_name: string
          unit_price: number
          quantity: number
          subtotal: number
          notes?: string | null
          is_voided?: boolean
          void_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string | null
          item_name?: string
          unit_price?: number
          quantity?: number
          subtotal?: number
          notes?: string | null
          is_voided?: boolean
          void_reason?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string
          actor_name: string
          actor_role: string
          action: string
          target_resource: string
          target_resource_type: string
          previous_state: Json | null
          new_state: Json | null
          reason: string | null
          idempotency_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          actor_name: string
          actor_role: string
          action: string
          target_resource: string
          target_resource_type: string
          previous_state?: Json | null
          new_state?: Json | null
          reason?: string | null
          idempotency_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string
          actor_name?: string
          actor_role?: string
          action?: string
          target_resource?: string
          target_resource_type?: string
          previous_state?: Json | null
          new_state?: Json | null
          reason?: string | null
          idempotency_key?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      append_items_to_guest_tab: {
        Args: {
          p_session_id: string
          p_location_id: string
          p_items: Json
          p_special_instructions?: string
          p_idempotency_key?: string
        }
        Returns: {
          success: boolean
          order_id: string
          round_number: number
          round_total: number
          continuous_tab_total: number
          total_items_count: number
          is_idempotent_replay: boolean
        }
      }
      settle_guest_tab: {
        Args: {
          p_session_id: string
          p_payment_method?: string
          p_staff_note?: string
        }
        Returns: {
          success: boolean
          session_id: string
          status: string
          invoice_number: string
          invoice_checksum: string
          total_amount: number
          already_settled?: boolean
        }
      }
    }
  }
}
