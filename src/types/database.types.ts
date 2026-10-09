/**
 * Hand-maintained mirror of the SQL schema in `supabase/migrations/`.
 *
 * Both `src/lib/supabase/client.ts` and `server.ts` import `Database` so every
 * query is checked against the real tables: a mistyped column name fails at
 * build time instead of returning a silent runtime error.
 *
 * REGENERATE after editing a migration (requires the Supabase CLI):
 *   npx supabase gen types typescript --project-id <project-ref> --schema public
 * then paste the output over this file.
 *
 * Source of truth: `supabase/migrations/20260925000000_init_schema_and_functions.sql`
 *
 * Postgres NUMERIC columns are typed as `number`. supabase-js parses them to
 * JS numbers; the values here are far below Number.MAX_SAFE_INTEGER, so this is
 * safe. Do the cent-exact maths in SQL or with a decimal library, not with
 * plain float arithmetic in the browser.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -----------------------------------------------------------------------------
// Row shapes
// -----------------------------------------------------------------------------

export interface PortfoliosRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  base_currency: string;
  cash_balance: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** `id`/timestamps default in Postgres, `user_id` is required. */
export interface PortfoliosInsert {
  id?: string;
  user_id: string;
  name: string;
  description?: string | null;
  base_currency?: string;
  cash_balance?: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PortfoliosUpdate = Partial<PortfoliosInsert>;

export interface AssetsRow {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  name: string;
  asset_type: string;
  exchange: string | null;
  sector: string | null;
  currency: string;
  quantity: number;
  average_cost: number;
  current_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** `user_id` is re-derived from the parent portfolio by a trigger. */
export interface AssetsInsert {
  id?: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  name: string;
  asset_type?: string;
  exchange?: string | null;
  sector?: string | null;
  currency?: string;
  quantity?: number;
  average_cost?: number;
  current_price?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type AssetsUpdate = Partial<AssetsInsert>;

export interface TransactionsRow {
  id: string;
  portfolio_id: string;
  asset_id: string | null;
  user_id: string;
  transaction_type: string;
  quantity: number | null;
  price: number | null;
  total_amount: number;
  fees: number;
  trade_date: string;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** The ledger is append only: `user_id` and `created_at` are trigger-guarded. */
export interface TransactionsInsert {
  id?: string;
  portfolio_id: string;
  asset_id?: string | null;
  user_id: string;
  transaction_type: string;
  quantity?: number | null;
  price?: number | null;
  total_amount?: number;
  fees?: number;
  trade_date?: string;
  settled_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type TransactionsUpdate = Partial<TransactionsInsert>;

export interface AiAnalysisCacheRow {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  analysis_type: string;
  content_hash: string;
  request_payload: Json;
  response_payload: Json;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  disclaimer: string;
  expires_at: string | null;
  created_at: string;
}

export interface AiAnalysisCacheInsert {
  id?: string;
  user_id: string;
  portfolio_id?: string | null;
  analysis_type: string;
  content_hash: string;
  request_payload?: Json;
  response_payload: Json;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  disclaimer?: string;
  expires_at?: string | null;
  created_at?: string;
}

export type AiAnalysisCacheUpdate = Partial<AiAnalysisCacheInsert>;

export interface Database {
  public: {
    Tables: {
      portfolios: {
        Row: PortfoliosRow;
        Insert: PortfoliosInsert;
        Update: PortfoliosUpdate;
        Relationships: [
          {
            foreignKeyName: 'portfolios_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      assets: {
        Row: AssetsRow;
        Insert: AssetsInsert;
        Update: AssetsUpdate;
        Relationships: [
          {
            foreignKeyName: 'assets_portfolio_id_fkey';
            columns: ['portfolio_id'];
            isOneToOne: false;
            referencedRelation: 'portfolios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      transactions: {
        Row: TransactionsRow;
        Insert: TransactionsInsert;
        Update: TransactionsUpdate;
        Relationships: [
          {
            foreignKeyName: 'transactions_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_portfolio_id_fkey';
            columns: ['portfolio_id'];
            isOneToOne: false;
            referencedRelation: 'portfolios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      ai_analysis_cache: {
        Row: AiAnalysisCacheRow;
        Insert: AiAnalysisCacheInsert;
        Update: AiAnalysisCacheUpdate;
        Relationships: [
          {
            foreignKeyName: 'ai_analysis_cache_portfolio_id_fkey';
            columns: ['portfolio_id'];
            isOneToOne: false;
            referencedRelation: 'portfolios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_analysis_cache_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };

    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;

    Functions: {
      /** Appends a BUY/SELL and re-derives quantity, average_cost and cash. */
      record_trade: {
        Args: {
          p_portfolio_id: string;
          p_asset_id: string;
          p_transaction_type: string;
          p_quantity: number;
          p_price: number;
          p_fees?: number;
          p_trade_date?: string;
          p_notes?: string;
        };
        Returns: string;
      };
      /** Moves the is_default flag, honouring the partial unique index. */
      set_default_portfolio: {
        Args: { p_portfolio_id: string };
        Returns: boolean;
      };
    };
  };
}
