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
      activity_log: {
        Row: {
          action: string
          actor_id: string
          amount_cents: number | null
          created_at: string
          entity_id: string
          entity_type: string
          group_id: string
          id: number
          summary: string | null
        }
        Insert: {
          action: string
          actor_id: string
          amount_cents?: number | null
          created_at?: string
          entity_id: string
          entity_type: string
          group_id: string
          id?: never
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          amount_cents?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          group_id?: string
          id?: never
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          expense_id: string
          owed_cents: number
          percent: number | null
          user_id: string
        }
        Insert: {
          expense_id: string
          owed_cents: number
          percent?: number | null
          user_id: string
        }
        Update: {
          expense_id?: string
          owed_cents?: number
          percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string
          expense_date: string
          group_id: string
          id: string
          paid_by: string
          receipt_path: string | null
          split_method: Database["public"]["Enums"]["split_method"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description: string
          expense_date?: string
          group_id: string
          id?: string
          paid_by: string
          receipt_path?: string | null
          split_method: Database["public"]["Enums"]["split_method"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string
          expense_date?: string
          group_id?: string
          id?: string
          paid_by?: string
          receipt_path?: string | null
          split_method?: Database["public"]["Enums"]["split_method"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          revoked_at: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id: string
          revoked_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_image_path: string | null
          created_at: string
          created_by: string
          end_date: string | null
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["group_kind"]
          name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          deleted_at: string | null
          group_id: string
          id: string
          paid_by: string
          paid_to: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_method_note: string | null
          settled_on: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          group_id: string
          id?: string
          paid_by: string
          paid_to: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_method_note?: string | null
          settled_on?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          paid_by?: string
          paid_to?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_method_note?: string | null
          settled_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      group_net_balances: {
        Row: {
          group_id: string | null
          net_cents: number | null
          user_id: string | null
        }
        Relationships: []
      }
      overall_pairwise_balances: {
        Row: {
          cents: number | null
          creditor: string | null
          debtor: string | null
        }
        Relationships: []
      }
      pairwise_balances: {
        Row: {
          cents: number | null
          creditor: string | null
          debtor: string | null
          group_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_no_open_balance: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      can_write_receipt: { Args: { object_name: string }; Returns: boolean }
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined }
      delete_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      join_group_with_code: { Args: { p_code: string }; Returns: string }
      leave_group: { Args: { p_group: string }; Returns: undefined }
      record_settlement: {
        Args: {
          p_amount_cents: number
          p_group_id: string
          p_paid_by: string
          p_paid_to: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_payment_method_note?: string
          p_settled_on?: string
        }
        Returns: string
      }
      remove_group_member: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      save_expense: {
        Args: {
          p_amount_cents: number
          p_description: string
          p_expense_date: string
          p_expense_id?: string
          p_group_id: string
          p_paid_by: string
          p_receipt_path?: string
          p_split_method: Database["public"]["Enums"]["split_method"]
          p_splits: Json
        }
        Returns: string
      }
      shares_group_with: { Args: { uid: string }; Returns: boolean }
      storage_group_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      group_kind: "group" | "trip"
      member_role: "owner" | "member"
      payment_method:
        | "venmo"
        | "cash"
        | "paypal"
        | "zelle"
        | "bank_transfer"
        | "cash_app"
        | "other"
      split_method: "equal" | "exact" | "percent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      group_kind: ["group", "trip"],
      member_role: ["owner", "member"],
      payment_method: [
        "venmo",
        "cash",
        "paypal",
        "zelle",
        "bank_transfer",
        "cash_app",
        "other",
      ],
      split_method: ["equal", "exact", "percent"],
    },
  },
} as const
