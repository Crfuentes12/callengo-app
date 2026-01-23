// types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          website: string | null
          description: string | null
          logo_url: string | null
          favicon_url: string | null
          industry: string | null
          context_data: Json | null
          context_summary: string | null
          context_extracted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          website?: string | null
          description?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          industry?: string | null
          context_data?: Json | null
          context_summary?: string | null
          context_extracted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          website?: string | null
          description?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          industry?: string | null
          context_data?: Json | null
          context_summary?: string | null
          context_extracted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          company_id: string
          email: string
          full_name: string | null
          role: string
          created_at: string
          updated_at: string
          currency: string
          country_code: string | null
          country_name: string | null
          city: string | null
          region: string | null
          timezone: string | null
          ip_address: string | null
          location_logs: Json
          location_updated_at: string | null
          notifications_enabled: boolean
        }
        Insert: {
          id: string
          company_id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
          currency?: string
          country_code?: string | null
          country_name?: string | null
          city?: string | null
          region?: string | null
          timezone?: string | null
          ip_address?: string | null
          location_logs?: Json
          location_updated_at?: string | null
          notifications_enabled?: boolean
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
          currency?: string
          country_code?: string | null
          country_name?: string | null
          city?: string | null
          region?: string | null
          timezone?: string | null
          ip_address?: string | null
          location_logs?: Json
          location_updated_at?: string | null
          notifications_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_lists: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      contacts: {
        Row: {
          id: string
          company_id: string
          company_name: string
          phone_number: string
          original_phone_number: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          contact_name: string | null
          email: string | null
          status: string
          call_outcome: string | null
          last_call_date: string | null
          call_attempts: number
          call_id: string | null
          call_status: string | null
          call_duration: number | null
          recording_url: string | null
          transcript_text: string | null
          transcripts: Json | null
          analysis: Json | null
          call_metadata: Json | null
          notes: string | null
          is_test_call: boolean
          tags: string[] | null
          list_id: string | null
          custom_fields: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          company_name: string
          phone_number: string
          original_phone_number?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          contact_name?: string | null
          email?: string | null
          status?: string
          call_outcome?: string | null
          last_call_date?: string | null
          call_attempts?: number
          call_id?: string | null
          call_status?: string | null
          call_duration?: number | null
          recording_url?: string | null
          transcript_text?: string | null
          transcripts?: Json | null
          analysis?: Json | null
          call_metadata?: Json | null
          notes?: string | null
          is_test_call?: boolean
          tags?: string[] | null
          list_id?: string | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          company_name?: string
          phone_number?: string
          original_phone_number?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          contact_name?: string | null
          email?: string | null
          status?: string
          call_outcome?: string | null
          last_call_date?: string | null
          call_attempts?: number
          call_id?: string | null
          call_status?: string | null
          call_duration?: number | null
          recording_url?: string | null
          transcript_text?: string | null
          transcripts?: Json | null
          analysis?: Json | null
          call_metadata?: Json | null
          notes?: string | null
          is_test_call?: boolean
          tags?: string[] | null
          list_id?: string | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          }
        ]
      }
      call_logs: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          agent_template_id: string | null
          agent_run_id: string | null
          call_id: string
          status: string | null
          completed: boolean
          call_length: number | null
          price: number | null // For internal use only, never show to users in frontend
          answered_by: string | null
          recording_url: string | null
          transcript: string | null
          summary: string | null
          analysis: Json | null
          error_message: string | null
          metadata: Json | null
          voicemail_detected: boolean
          voicemail_left: boolean
          voicemail_message_url: string | null
          voicemail_duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          agent_template_id?: string | null
          agent_run_id?: string | null
          call_id: string
          status?: string | null
          completed?: boolean
          call_length?: number | null
          price?: number | null // For internal use only, never show to users in frontend
          answered_by?: string | null
          recording_url?: string | null
          transcript?: string | null
          summary?: string | null
          analysis?: Json | null
          error_message?: string | null
          metadata?: Json | null
          voicemail_detected?: boolean
          voicemail_left?: boolean
          voicemail_message_url?: string | null
          voicemail_duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string | null
          agent_template_id?: string | null
          agent_run_id?: string | null
          call_id?: string
          status?: string | null
          completed?: boolean
          call_length?: number | null
          price?: number | null // For internal use only, never show to users in frontend
          answered_by?: string | null
          recording_url?: string | null
          transcript?: string | null
          summary?: string | null
          analysis?: Json | null
          error_message?: string | null
          metadata?: Json | null
          voicemail_detected?: boolean
          voicemail_left?: boolean
          voicemail_message_url?: string | null
          voicemail_duration?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_agent_template_id_fkey"
            columns: ["agent_template_id"]
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          }
        ]
      }
      agent_templates: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          icon: string | null
          category: string | null
          task_template: string
          first_sentence_template: string | null
          voicemail_template: string | null
          analysis_questions: Json | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          icon?: string | null
          category?: string | null
          task_template: string
          first_sentence_template?: string | null
          voicemail_template?: string | null
          analysis_questions?: Json | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          icon?: string | null
          category?: string | null
          task_template?: string
          first_sentence_template?: string | null
          voicemail_template?: string | null
          analysis_questions?: Json | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      company_agents: {
        Row: {
          id: string
          company_id: string
          agent_template_id: string
          name: string
          custom_task: string | null
          custom_settings: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          agent_template_id: string
          name: string
          custom_task?: string | null
          custom_settings?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          agent_template_id?: string
          name?: string
          custom_task?: string | null
          custom_settings?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_agents_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_agents_agent_template_id_fkey"
            columns: ["agent_template_id"]
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          }
        ]
      }
      agent_runs: {
        Row: {
          id: string
          company_id: string
          agent_template_id: string
          name: string
          status: string
          total_contacts: number
          completed_calls: number
          successful_calls: number
          failed_calls: number
          total_cost: number // For internal use only, never show to users in frontend
          settings: Json | null
          started_at: string | null
          completed_at: string | null
          follow_up_enabled: boolean
          follow_up_max_attempts: number
          follow_up_interval_hours: number
          follow_up_conditions: Json
          voicemail_enabled: boolean
          voicemail_detection_enabled: boolean
          voicemail_message: string | null
          voicemail_action: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          agent_template_id: string
          name: string
          status?: string
          total_contacts?: number
          completed_calls?: number
          successful_calls?: number
          failed_calls?: number
          total_cost?: number // For internal use only, never show to users in frontend
          settings?: Json | null
          started_at?: string | null
          completed_at?: string | null
          follow_up_enabled?: boolean
          follow_up_max_attempts?: number
          follow_up_interval_hours?: number
          follow_up_conditions?: Json
          voicemail_enabled?: boolean
          voicemail_detection_enabled?: boolean
          voicemail_message?: string | null
          voicemail_action?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          agent_template_id?: string
          name?: string
          status?: string
          total_contacts?: number
          completed_calls?: number
          successful_calls?: number
          failed_calls?: number
          total_cost?: number // For internal use only, never show to users in frontend
          settings?: Json | null
          started_at?: string | null
          completed_at?: string | null
          follow_up_enabled?: boolean
          follow_up_max_attempts?: number
          follow_up_interval_hours?: number
          follow_up_conditions?: Json
          voicemail_enabled?: boolean
          voicemail_detection_enabled?: boolean
          voicemail_message?: string | null
          voicemail_action?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_agent_template_id_fkey"
            columns: ["agent_template_id"]
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          }
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          bland_api_key: string | null
          openai_api_key: string | null
          default_voice: string
          default_max_duration: number
          default_interval_minutes: number
          test_phone_number: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          bland_api_key?: string | null
          openai_api_key?: string | null
          default_voice?: string
          default_max_duration?: number
          default_interval_minutes?: number
          test_phone_number?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          bland_api_key?: string | null
          openai_api_key?: string | null
          default_voice?: string
          default_max_duration?: number
          default_interval_minutes?: number
          test_phone_number?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          price_monthly: number
          price_annual: number
          minutes_included: number
          max_call_duration: number
          price_per_extra_minute: number
          max_users: number
          price_per_extra_user: number | null
          max_agents: number | null
          max_concurrent_calls: number
          max_calls_per_hour: number | null
          max_calls_per_day: number | null
          auto_overage_default: boolean
          features: Json
          is_active: boolean
          display_order: number
          stripe_product_id: string | null
          stripe_price_id_monthly: string | null
          stripe_price_id_annual: string | null
          stripe_metered_price_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          price_monthly: number
          price_annual: number
          minutes_included: number
          max_call_duration?: number
          price_per_extra_minute: number
          max_users?: number
          price_per_extra_user?: number | null
          max_agents?: number | null
          max_concurrent_calls?: number
          max_calls_per_hour?: number | null
          max_calls_per_day?: number | null
          auto_overage_default?: boolean
          features?: Json
          is_active?: boolean
          display_order?: number
          stripe_product_id?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_metered_price_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          price_monthly?: number
          price_annual?: number
          minutes_included?: number
          max_call_duration?: number
          price_per_extra_minute?: number
          max_users?: number
          price_per_extra_user?: number | null
          max_agents?: number | null
          max_concurrent_calls?: number
          max_calls_per_hour?: number | null
          max_calls_per_day?: number | null
          auto_overage_default?: boolean
          features?: Json
          is_active?: boolean
          display_order?: number
          stripe_product_id?: string | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_metered_price_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_subscriptions: {
        Row: {
          id: string
          company_id: string
          plan_id: string
          billing_cycle: string
          status: string
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          trial_end: string | null
          extra_users: number
          overage_enabled: boolean
          overage_budget: number
          overage_spent: number
          last_overage_alert_at: string | null
          overage_alert_level: number
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_item_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          plan_id: string
          billing_cycle: string
          status?: string
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          trial_end?: string | null
          extra_users?: number
          overage_enabled?: boolean
          overage_budget?: number
          overage_spent?: number
          last_overage_alert_at?: string | null
          overage_alert_level?: number
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_item_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          plan_id?: string
          billing_cycle?: string
          status?: string
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          trial_end?: string | null
          extra_users?: number
          overage_enabled?: boolean
          overage_budget?: number
          overage_spent?: number
          last_overage_alert_at?: string | null
          overage_alert_level?: number
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_item_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          }
        ]
      }
      usage_tracking: {
        Row: {
          id: string
          company_id: string
          subscription_id: string | null
          period_start: string
          period_end: string
          minutes_used: number
          minutes_included: number
          overage_minutes: number
          total_cost: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          subscription_id?: string | null
          period_start: string
          period_end: string
          minutes_used?: number
          minutes_included: number
          total_cost?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          subscription_id?: string | null
          period_start?: string
          period_end?: string
          minutes_used?: number
          minutes_included?: number
          total_cost?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_tracking_subscription_id_fkey"
            columns: ["subscription_id"]
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      billing_history: {
        Row: {
          id: string
          company_id: string
          subscription_id: string | null
          amount: number
          currency: string
          description: string | null
          status: string
          invoice_url: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          payment_method: string | null
          failure_reason: string | null
          billing_date: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          subscription_id?: string | null
          amount: number
          currency?: string
          description?: string | null
          status: string
          invoice_url?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          payment_method?: string | null
          failure_reason?: string | null
          billing_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          subscription_id?: string | null
          amount?: number
          currency?: string
          description?: string | null
          status?: string
          invoice_url?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          payment_method?: string | null
          failure_reason?: string | null
          billing_date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_history_subscription_id_fkey"
            columns: ["subscription_id"]
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      call_queue: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          agent_id: string
          agent_run_id: string
          status: string
          priority: number
          queued_at: string
          started_at: string | null
          completed_at: string | null
          call_id: string | null
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          agent_id: string
          agent_run_id: string
          status?: string
          priority?: number
          queued_at?: string
          started_at?: string | null
          completed_at?: string | null
          call_id?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string | null
          agent_id?: string
          agent_run_id?: string
          status?: string
          priority?: number
          queued_at?: string
          started_at?: string | null
          completed_at?: string | null
          call_id?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_agent_id_fkey"
            columns: ["agent_id"]
            referencedRelation: "company_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_agent_run_id_fkey"
            columns: ["agent_run_id"]
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          }
        ]
      }
      billing_events: {
        Row: {
          id: string
          company_id: string
          subscription_id: string | null
          event_type: string
          event_data: Json
          minutes_consumed: number | null
          cost_usd: number | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          subscription_id?: string | null
          event_type: string
          event_data?: Json
          minutes_consumed?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          subscription_id?: string | null
          event_type?: string
          event_data?: Json
          minutes_consumed?: number | null
          cost_usd?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      admin_finances: {
        Row: {
          id: string
          period_start: string
          period_end: string
          bland_plan: string | null
          bland_plan_cost: number | null
          bland_talk_rate: number | null
          bland_transfer_rate: number | null
          bland_concurrent_limit: number | null
          bland_hourly_limit: number | null
          bland_daily_limit: number | null
          openai_cost: number | null
          openai_tokens_used: number | null
          supabase_cost: number | null
          total_minutes_used: number | null
          total_calls_made: number | null
          total_companies_active: number | null
          total_users_active: number | null
          revenue_subscriptions: number | null
          revenue_overages: number | null
          revenue_extras: number | null
          revenue_total: number | null
          cost_bland: number | null
          cost_openai: number | null
          cost_supabase: number | null
          cost_total: number | null
          gross_margin: number | null
          gross_margin_percent: number | null
          avg_revenue_per_company: number | null
          avg_minutes_per_call: number | null
          overage_revenue_percent: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          period_start: string
          period_end: string
          bland_plan?: string | null
          bland_plan_cost?: number | null
          bland_talk_rate?: number | null
          bland_transfer_rate?: number | null
          bland_concurrent_limit?: number | null
          bland_hourly_limit?: number | null
          bland_daily_limit?: number | null
          openai_cost?: number | null
          openai_tokens_used?: number | null
          supabase_cost?: number | null
          total_minutes_used?: number | null
          total_calls_made?: number | null
          total_companies_active?: number | null
          total_users_active?: number | null
          revenue_subscriptions?: number | null
          revenue_overages?: number | null
          revenue_extras?: number | null
          revenue_total?: number | null
          cost_bland?: number | null
          cost_openai?: number | null
          cost_supabase?: number | null
          cost_total?: number | null
          gross_margin?: number | null
          gross_margin_percent?: number | null
          avg_revenue_per_company?: number | null
          avg_minutes_per_call?: number | null
          overage_revenue_percent?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          period_start?: string
          period_end?: string
          bland_plan?: string | null
          bland_plan_cost?: number | null
          bland_talk_rate?: number | null
          bland_transfer_rate?: number | null
          bland_concurrent_limit?: number | null
          bland_hourly_limit?: number | null
          bland_daily_limit?: number | null
          openai_cost?: number | null
          openai_tokens_used?: number | null
          supabase_cost?: number | null
          total_minutes_used?: number | null
          total_calls_made?: number | null
          total_companies_active?: number | null
          total_users_active?: number | null
          revenue_subscriptions?: number | null
          revenue_overages?: number | null
          revenue_extras?: number | null
          revenue_total?: number | null
          cost_bland?: number | null
          cost_openai?: number | null
          cost_supabase?: number | null
          cost_total?: number | null
          gross_margin?: number | null
          gross_margin_percent?: number | null
          avg_revenue_per_company?: number | null
          avg_minutes_per_call?: number | null
          overage_revenue_percent?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          type: string
          data: Json
          processed: boolean
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id: string
          type: string
          data: Json
          processed?: boolean
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          type?: string
          data?: Json
          processed?: boolean
          created_at?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          type: string
          title: string
          message: string
          read: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          type: string
          title: string
          message: string
          read?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string | null
          type?: string
          title?: string
          message?: string
          read?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      follow_up_queue: {
        Row: {
          id: string
          company_id: string
          agent_run_id: string
          contact_id: string
          original_call_id: string | null
          attempt_number: number
          max_attempts: number
          next_attempt_at: string
          last_attempt_at: string | null
          status: string
          reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          agent_run_id: string
          contact_id: string
          original_call_id?: string | null
          attempt_number?: number
          max_attempts?: number
          next_attempt_at: string
          last_attempt_at?: string | null
          status?: string
          reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          agent_run_id?: string
          contact_id?: string
          original_call_id?: string | null
          attempt_number?: number
          max_attempts?: number
          next_attempt_at?: string
          last_attempt_at?: string | null
          status?: string
          reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_agent_run_id_fkey"
            columns: ["agent_run_id"]
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_original_call_id_fkey"
            columns: ["original_call_id"]
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          }
        ]
      }
      voicemail_logs: {
        Row: {
          id: string
          company_id: string
          call_id: string
          agent_run_id: string | null
          contact_id: string | null
          detected_at: string
          confidence_score: number | null
          detection_method: string | null
          message_left: boolean
          message_text: string | null
          message_duration: number | null
          message_audio_url: string | null
          follow_up_scheduled: boolean
          follow_up_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          call_id: string
          agent_run_id?: string | null
          contact_id?: string | null
          detected_at: string
          confidence_score?: number | null
          detection_method?: string | null
          message_left?: boolean
          message_text?: string | null
          message_duration?: number | null
          message_audio_url?: string | null
          follow_up_scheduled?: boolean
          follow_up_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          call_id?: string
          agent_run_id?: string | null
          contact_id?: string | null
          detected_at?: string
          confidence_score?: number | null
          detection_method?: string | null
          message_left?: boolean
          message_text?: string | null
          message_duration?: number | null
          message_audio_url?: string | null
          follow_up_scheduled?: boolean
          follow_up_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voicemail_logs_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemail_logs_call_id_fkey"
            columns: ["call_id"]
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemail_logs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemail_logs_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemail_logs_follow_up_id_fkey"
            columns: ["follow_up_id"]
            referencedRelation: "follow_up_queue"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Export types for convenience
export type Company = Database['public']['Tables']['companies']['Row'] & {
  phone_number?: string | null;
};
export type AgentTemplate = Database['public']['Tables']['agent_templates']['Row'];
export type CompanyAgent = Database['public']['Tables']['company_agents']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type ContactList = Database['public']['Tables']['contact_lists']['Row'];
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
export type CompanySubscription = Database['public']['Tables']['company_subscriptions']['Row'];
export type UsageTracking = Database['public']['Tables']['usage_tracking']['Row'];
export type BillingHistory = Database['public']['Tables']['billing_history']['Row'];
export type CallQueue = Database['public']['Tables']['call_queue']['Row'];
export type BillingEvent = Database['public']['Tables']['billing_events']['Row'];
export type AdminFinance = Database['public']['Tables']['admin_finances']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];

// Agent Run Settings Configuration
export interface AgentRunSettings {
  voice: string;
  maxDuration: number;
  intervalMinutes: number;
  maxCallsPerDay?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timezone?: string;
  customTask?: string;
  selectedLists?: string[]; // Array of list IDs
  companyInfo?: {
    name: string;
    description?: string;
    website?: string;
    phone?: string;
  };
}