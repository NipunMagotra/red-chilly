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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          currency: string
          tax_rate: number
          timezone: string
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          currency?: string
          tax_rate?: number
          timezone?: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          currency?: string
          tax_rate?: number
          timezone?: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          property_id: string
          name: string
          qr_code_identifier: string
          location_type: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          access_pin: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          name: string
          qr_code_identifier: string
          location_type?: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          access_pin?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          name?: string
          qr_code_identifier?: string
          location_type?: 'room' | 'table' | 'cabana' | 'bar' | 'pickup'
          access_pin?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      property_staff: {
        Row: {
          id: string
          user_id: string
          property_id: string
          role: 'owner' | 'manager' | 'staff' | 'kitchen'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          role?: 'owner' | 'manager' | 'staff' | 'kitchen'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          role?: 'owner' | 'manager' | 'staff' | 'kitchen'
          created_at?: string
        }
      }
      guest_sessions: {
        Row: {
          id: string
          property_id: string
          location_id: string
          session_token: string
          guest_name: string | null
          guest_phone: string | null
          stay_pin: string
          status: 'active' | 'closed' | 'settled' | 'voided'
          subtotal: number
          tax: number
          total_amount: number
          total_items_count: number
          rounds_count: number
          created_at: string
          updated_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          property_id: string
          location_id: string
          session_token?: string
          guest_name?: string | null
          guest_phone?: string | null
          stay_pin: string
          status?: 'active' | 'closed' | 'settled' | 'voided'
          subtotal?: number
          tax?: number
          total_amount?: number
          total_items_count?: number
          rounds_count?: number
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          location_id?: string
          session_token?: string
          guest_name?: string | null
          guest_phone?: string | null
          stay_pin?: string
          status?: 'active' | 'closed' | 'settled' | 'voided'
          subtotal?: number
          tax?: number
          total_amount?: number
          total_items_count?: number
          rounds_count?: number
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
      menu_items: {
        Row: {
          id: string
          property_id: string
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
          property_id: string
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
          property_id?: string
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
          property_id: string
          location_id: string
          round_number: number
          status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
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
          property_id: string
          location_id: string
          round_number?: number
          status?: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
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
          property_id?: string
          location_id?: string
          round_number?: number
          status?: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
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
          status: 'pending' | 'cooking' | 'ready' | 'served'
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
          status?: 'pending' | 'cooking' | 'ready' | 'served'
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
          status?: 'pending' | 'cooking' | 'ready' | 'served'
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
        }
        Returns: {
          success: boolean
          order_id: string
          round_number: number
          round_total: number
          continuous_tab_total: number
          total_items_count: number
        }
      }
    }
  }
}
