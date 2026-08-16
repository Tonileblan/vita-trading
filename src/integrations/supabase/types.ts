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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          broker: string | null
          created_at: string
          currency: string
          current_balance: number
          drawdown_limit: number | null
          drawdown_type: string
          firm: string | null
          id: string
          initial_balance: number
          journal_id: string
          name: string
          phase: string
          profit_target: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          broker?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          drawdown_limit?: number | null
          drawdown_type?: string
          firm?: string | null
          id?: string
          initial_balance?: number
          journal_id: string
          name: string
          phase?: string
          profit_target?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          broker?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          drawdown_limit?: number | null
          drawdown_type?: string
          firm?: string | null
          id?: string
          initial_balance?: number
          journal_id?: string
          name?: string
          phase?: string
          profit_target?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          subject_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          subject_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          subject_user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          concept: string
          created_at: string
          currency: string
          date: string
          id: string
          journal_id: string | null
          notes: string | null
          paid: boolean
          recurrence: string
          recurrence_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          concept: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          paid?: boolean
          recurrence?: string
          recurrence_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          concept?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          journal_id?: string | null
          notes?: string | null
          paid?: boolean
          recurrence?: string
          recurrence_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          journal_id: string
          max_daily_loss: number | null
          max_loss_streak: number
          max_trades_day: number
          require_checkin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          journal_id: string
          max_daily_loss?: number | null
          max_loss_streak?: number
          max_trades_day?: number
          require_checkin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          journal_id?: string
          max_daily_loss?: number | null
          max_loss_streak?: number
          max_trades_day?: number
          require_checkin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_rules_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          base_currency: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          is_template: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_template?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_template?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mood_checkins: {
        Row: {
          created_at: string
          date: string
          energy: number
          focus: number
          id: string
          intention: string | null
          journal_id: string
          mood: number
          review_note: string | null
          sleep_hours: number | null
          stress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          energy?: number
          focus?: number
          id?: string
          intention?: string | null
          journal_id: string
          mood?: number
          review_note?: string | null
          sleep_hours?: number | null
          stress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number
          focus?: number
          id?: string
          intention?: string | null
          journal_id?: string
          mood?: number
          review_note?: string | null
          sleep_hours?: number | null
          stress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_checkins_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_private: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_private?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_private?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          chart: string | null
          color: string
          contracts: string | null
          created_at: string
          days: string | null
          execution: string | null
          id: string
          initial_capital: number
          journal_id: string
          main_symbol: string
          management: string | null
          market: string | null
          name: string
          risk_pct: number
          schedule: string | null
          setup: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chart?: string | null
          color?: string
          contracts?: string | null
          created_at?: string
          days?: string | null
          execution?: string | null
          id?: string
          initial_capital?: number
          journal_id: string
          main_symbol?: string
          management?: string | null
          market?: string | null
          name: string
          risk_pct?: number
          schedule?: string | null
          setup?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chart?: string | null
          color?: string
          contracts?: string | null
          created_at?: string
          days?: string | null
          execution?: string | null
          id?: string
          initial_capital?: number
          journal_id?: string
          main_symbol?: string
          management?: string | null
          market?: string | null
          name?: string
          risk_pct?: number
          schedule?: string | null
          setup?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategies_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          account_id: string | null
          closed_at: string
          created_at: string
          direction: string
          emotion_after: string | null
          emotion_before: string | null
          emotion_note: string | null
          entry_price: number
          exit_price: number
          followed_plan: string | null
          id: string
          import_batch_id: string | null
          journal_id: string
          mistakes: string[]
          notes: string | null
          opened_at: string
          pnl: number
          screenshots: string[]
          size: number
          source: string
          strategy_id: string | null
          symbol: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          closed_at?: string
          created_at?: string
          direction?: string
          emotion_after?: string | null
          emotion_before?: string | null
          emotion_note?: string | null
          entry_price?: number
          exit_price?: number
          followed_plan?: string | null
          id?: string
          import_batch_id?: string | null
          journal_id: string
          mistakes?: string[]
          notes?: string | null
          opened_at?: string
          pnl?: number
          screenshots?: string[]
          size?: number
          source?: string
          strategy_id?: string | null
          symbol: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          closed_at?: string
          created_at?: string
          direction?: string
          emotion_after?: string | null
          emotion_before?: string | null
          emotion_note?: string | null
          entry_price?: number
          exit_price?: number
          followed_plan?: string | null
          id?: string
          import_batch_id?: string | null
          journal_id?: string
          mistakes?: string[]
          notes?: string | null
          opened_at?: string
          pnl?: number
          screenshots?: string[]
          size?: number
          source?: string
          strategy_id?: string | null
          symbol?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
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
      withdrawals: {
        Row: {
          account_id: string | null
          amount: number
          approved_at: string | null
          created_at: string
          date: string
          id: string
          journal_id: string
          reason: string | null
          requested_at: string | null
          status: string
          strategy_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          approved_at?: string | null
          created_at?: string
          date?: string
          id?: string
          journal_id: string
          reason?: string | null
          requested_at?: string | null
          status?: string
          strategy_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          approved_at?: string | null
          created_at?: string
          date?: string
          id?: string
          journal_id?: string
          reason?: string | null
          requested_at?: string | null
          status?: string
          strategy_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
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
      is_private_user: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "supervisor"
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
      app_role: ["admin", "user", "supervisor"],
    },
  },
} as const
