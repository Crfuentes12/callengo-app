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
        }
        Insert: {
          id: string
          company_id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
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
          }
        ]
      }
      call_logs: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          agent_template_id: string | null
          call_id: string
          status: string | null
          completed: boolean
          call_length: number | null
          price: number | null
          answered_by: string | null
          recording_url: string | null
          transcript: string | null
          summary: string | null
          analysis: Json | null
          error_message: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          agent_template_id?: string | null
          call_id: string
          status?: string | null
          completed?: boolean
          call_length?: number | null
          price?: number | null
          answered_by?: string | null
          recording_url?: string | null
          transcript?: string | null
          summary?: string | null
          analysis?: Json | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string | null
          agent_template_id?: string | null
          call_id?: string
          status?: string | null
          completed?: boolean
          call_length?: number | null
          price?: number | null
          answered_by?: string | null
          recording_url?: string | null
          transcript?: string | null
          summary?: string | null
          analysis?: Json | null
          error_message?: string | null
          metadata?: Json | null
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
          total_cost: number
          settings: Json | null
          started_at: string | null
          completed_at: string | null
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
          total_cost?: number
          settings?: Json | null
          started_at?: string | null
          completed_at?: string | null
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
          total_cost?: number
          settings?: Json | null
          started_at?: string | null
          completed_at?: string | null
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
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];

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
  companyInfo?: {
    name: string;
    description?: string;
    website?: string;
    phone?: string;
  };
}