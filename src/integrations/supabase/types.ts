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
      twin_comparisons: {
        Row: {
          created_at: string
          id: string
          report: Json
          title: string | null
          twin_ids: string[]
          urls: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          report?: Json
          title?: string | null
          twin_ids: string[]
          urls: string[]
        }
        Update: {
          created_at?: string
          id?: string
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
          key_points: Json
          last_seen: string
          links: Json
          markdown: string | null
          mobile_screenshot_url: string | null
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
          key_points?: Json
          last_seen?: string
          links?: Json
          markdown?: string | null
          mobile_screenshot_url?: string | null
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
          key_points?: Json
          last_seen?: string
          links?: Json
          markdown?: string | null
          mobile_screenshot_url?: string | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
