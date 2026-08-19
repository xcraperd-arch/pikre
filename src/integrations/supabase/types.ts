export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pikr_api_keys: {
        Row: {
          calls: number
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          calls?: number
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          calls?: number
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: []
      }
      pikr_bookmarks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          twin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          twin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          twin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pikr_bookmarks_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      pikr_endpoints: {
        Row: {
          calls: number
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_public: boolean
          name: string
          slug: string
          source_id: string | null
          twin_id: string | null
          user_id: string | null
        }
        Insert: {
          calls?: number
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_public?: boolean
          name: string
          slug: string
          source_id?: string | null
          twin_id?: string | null
          user_id?: string | null
        }
        Update: {
          calls?: number
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
          source_id?: string | null
          twin_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pikr_endpoints_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pikr_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pikr_endpoints_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      pikr_logs: {
        Row: {
          created_at: string
          data: Json
          event: string
          id: string
          level: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          event: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          event?: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pikr_preferences: {
        Row: {
          default_lenses: Json
          industry: string | null
          interests: Json
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          default_lenses?: Json
          industry?: string | null
          interests?: Json
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          default_lenses?: Json
          industry?: string | null
          interests?: Json
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pikr_source_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pikr_source_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "pikr_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      pikr_sources: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          key_points: Json
          kind: string
          mime: string | null
          name: string
          size_bytes: number
          summary: string | null
          user_id: string | null
          word_count: number
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          key_points?: Json
          kind?: string
          mime?: string | null
          name: string
          size_bytes?: number
          summary?: string | null
          user_id?: string | null
          word_count?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          key_points?: Json
          kind?: string
          mime?: string | null
          name?: string
          size_bytes?: number
          summary?: string | null
          user_id?: string | null
          word_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          analyses_this_month: number
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          plan: Database["public"]["Enums"]["pikr_plan"]
          updated_at: string
          usage_reset_at: string
        }
        Insert: {
          analyses_this_month?: number
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          plan?: Database["public"]["Enums"]["pikr_plan"]
          updated_at?: string
          usage_reset_at?: string
        }
        Update: {
          analyses_this_month?: number
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["pikr_plan"]
          updated_at?: string
          usage_reset_at?: string
        }
        Relationships: []
      }
      twin_agent_reports: {
        Row: {
          agent: string
          created_at: string
          id: string
          model: string | null
          payload: Json
          twin_id: string
        }
        Insert: {
          agent: string
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json
          twin_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json
          twin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_agent_reports_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_alerts: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          read_at: string | null
          severity: string
          title: string
          twin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          read_at?: string | null
          severity?: string
          title: string
          twin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          read_at?: string | null
          severity?: string
          title?: string
          twin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_alerts_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_comparisons: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          owner_id: string | null
          report: Json
          title: string | null
          twin_ids: string[]
          urls: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string | null
          report?: Json
          title?: string | null
          twin_ids: string[]
          urls: string[]
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string | null
          report?: Json
          title?: string | null
          twin_ids?: string[]
          urls?: string[]
        }
        Relationships: []
      }
      twin_debates: {
        Row: {
          consensus_score: number | null
          created_at: string
          id: string
          is_public: boolean
          owner_id: string | null
          side_a: Json
          side_b: Json
          topic: string
          twin_id: string
          verdict: Json
        }
        Insert: {
          consensus_score?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string | null
          side_a?: Json
          side_b?: Json
          topic: string
          twin_id: string
          verdict?: Json
        }
        Update: {
          consensus_score?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string | null
          side_a?: Json
          side_b?: Json
          topic?: string
          twin_id?: string
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "twin_debates_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_documents: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          tokens: number | null
          twin_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          tokens?: number | null
          twin_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          tokens?: number | null
          twin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_documents_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_entities: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          kind: string
          name: string
          twin_id: string
          value: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          kind: string
          name: string
          twin_id: string
          value?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          twin_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twin_entities_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_reviews: {
        Row: {
          author: string | null
          body: string | null
          created_at: string
          id: string
          posted_at: string | null
          rating: number | null
          raw: Json
          red_flag_tags: string[]
          sentiment: string | null
          source: string
          source_url: string | null
          title: string | null
          twin_id: string
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at?: string
          id?: string
          posted_at?: string | null
          rating?: number | null
          raw?: Json
          red_flag_tags?: string[]
          sentiment?: string | null
          source: string
          source_url?: string | null
          title?: string | null
          twin_id: string
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at?: string
          id?: string
          posted_at?: string | null
          rating?: number | null
          raw?: Json
          red_flag_tags?: string[]
          sentiment?: string | null
          source?: string
          source_url?: string | null
          title?: string | null
          twin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_reviews_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_snapshots: {
        Row: {
          captured_at: string
          diff_summary: string | null
          id: string
          markdown: string | null
          structural_hash: string | null
          summary: string | null
          twin_id: string
          word_count: number
        }
        Insert: {
          captured_at?: string
          diff_summary?: string | null
          id?: string
          markdown?: string | null
          structural_hash?: string | null
          summary?: string | null
          twin_id: string
          word_count?: number
        }
        Update: {
          captured_at?: string
          diff_summary?: string | null
          id?: string
          markdown?: string | null
          structural_hash?: string | null
          summary?: string | null
          twin_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "twin_snapshots_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_watchlist: {
        Row: {
          cadence: string
          created_at: string
          id: string
          last_checked_at: string | null
          twin_id: string
          user_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          twin_id: string
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          twin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_watchlist_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "website_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_twins: {
        Row: {
          analyses_count: number
          canonical_url: string
          category: string | null
          created_at: string
          description: string | null
          entities: Json
          first_seen: string
          host: string
          id: string
          is_public: boolean
          key_points: Json
          last_seen: string
          links: Json
          markdown: string | null
          mobile_screenshot_url: string | null
          owner_id: string | null
          products: Json
          scores: Json
          screenshot_url: string | null
          summary: string | null
          tech_stack: Json
          title: string | null
          trust: Json
          updated_at: string
          word_count: number
          xray: Json
        }
        Insert: {
          analyses_count?: number
          canonical_url: string
          category?: string | null
          created_at?: string
          description?: string | null
          entities?: Json
          first_seen?: string
          host: string
          id?: string
          is_public?: boolean
          key_points?: Json
          last_seen?: string
          links?: Json
          markdown?: string | null
          mobile_screenshot_url?: string | null
          owner_id?: string | null
          products?: Json
          scores?: Json
          screenshot_url?: string | null
          summary?: string | null
          tech_stack?: Json
          title?: string | null
          trust?: Json
          updated_at?: string
          word_count?: number
          xray?: Json
        }
        Update: {
          analyses_count?: number
          canonical_url?: string
          category?: string | null
          created_at?: string
          description?: string | null
          entities?: Json
          first_seen?: string
          host?: string
          id?: string
          is_public?: boolean
          key_points?: Json
          last_seen?: string
          links?: Json
          markdown?: string | null
          mobile_screenshot_url?: string | null
          owner_id?: string | null
          products?: Json
          scores?: Json
          screenshot_url?: string | null
          summary?: string | null
          tech_stack?: Json
          title?: string | null
          trust?: Json
          updated_at?: string
          word_count?: number
          xray?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_source_chunks: {
        Args: { p_match_count?: number; p_query: string; p_source_id: string }
        Returns: {
          content: string
          similarity: number
        }[]
      }
      match_twin_documents: {
        Args: { p_embedding: string; p_match_count?: number; p_twin_id: string }
        Returns: {
          chunk_index: number
          content: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      pikr_plan: "free" | "pro" | "business"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      pikr_plan: ["free", "pro", "business"],
    },
  },
} as const
