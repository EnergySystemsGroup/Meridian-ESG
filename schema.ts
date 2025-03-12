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
      agent_executions: {
        Row: {
          agent_type: string
          created_at: string
          error: string | null
          execution_time: number | null
          id: string
          input: Json | null
          output: Json | null
          token_usage: Json | null
        }
        Insert: {
          agent_type: string
          created_at?: string
          error?: string | null
          execution_time?: number | null
          id?: string
          input?: Json | null
          output?: Json | null
          token_usage?: Json | null
        }
        Update: {
          agent_type?: string
          created_at?: string
          error?: string | null
          execution_time?: number | null
          id?: string
          input?: Json | null
          output?: Json | null
          token_usage?: Json | null
        }
        Relationships: []
      }
      api_activity_logs: {
        Row: {
          action: Database["public"]["Enums"]["api_action_type"]
          created_at: string
          details: Json | null
          id: string
          source_id: string
          status: Database["public"]["Enums"]["api_status_type"]
        }
        Insert: {
          action: Database["public"]["Enums"]["api_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          source_id: string
          status: Database["public"]["Enums"]["api_status_type"]
        }
        Update: {
          action?: Database["public"]["Enums"]["api_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          source_id?: string
          status?: Database["public"]["Enums"]["api_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "api_activity_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "active_api_sources_with_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_activity_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_extracted_opportunities: {
        Row: {
          confidence_score: number | null
          created_at: string
          data: Json
          id: string
          processed: boolean | null
          processing_details: Json | null
          processing_result:
            | Database["public"]["Enums"]["data_action_type"]
            | null
          raw_response_id: string
          source_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          data: Json
          id?: string
          processed?: boolean | null
          processing_details?: Json | null
          processing_result?:
            | Database["public"]["Enums"]["data_action_type"]
            | null
          raw_response_id: string
          source_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          data?: Json
          id?: string
          processed?: boolean | null
          processing_details?: Json | null
          processing_result?:
            | Database["public"]["Enums"]["data_action_type"]
            | null
          raw_response_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_extracted_opportunities_raw_response_id_fkey"
            columns: ["raw_response_id"]
            isOneToOne: false
            referencedRelation: "api_raw_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_extracted_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "active_api_sources_with_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_extracted_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_raw_responses: {
        Row: {
          content: Json
          created_at: string
          id: string
          processed: boolean | null
          processing_errors: string | null
          request_details: Json | null
          source_id: string
          timestamp: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          processed?: boolean | null
          processing_errors?: string | null
          request_details?: Json | null
          source_id: string
          timestamp?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          processed?: boolean | null
          processing_errors?: string | null
          request_details?: Json | null
          source_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_raw_responses_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "active_api_sources_with_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_raw_responses_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_source_configurations: {
        Row: {
          config_type: string
          configuration: Json
          created_at: string
          id: string
          source_id: string
          updated_at: string
        }
        Insert: {
          config_type: string
          configuration: Json
          created_at?: string
          id?: string
          source_id: string
          updated_at?: string
        }
        Update: {
          config_type?: string
          configuration?: Json
          created_at?: string
          id?: string
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_source_configurations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "active_api_sources_with_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_source_configurations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_sources: {
        Row: {
          active: boolean | null
          api_documentation_url: string | null
          api_endpoint: string | null
          auth_details: Json | null
          auth_type: Database["public"]["Enums"]["api_auth_type"]
          created_at: string
          id: string
          last_checked: string | null
          name: string
          notes: string | null
          organization: string | null
          priority: number | null
          type: string
          update_frequency: string | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean | null
          api_documentation_url?: string | null
          api_endpoint?: string | null
          auth_details?: Json | null
          auth_type?: Database["public"]["Enums"]["api_auth_type"]
          created_at?: string
          id?: string
          last_checked?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          priority?: number | null
          type: string
          update_frequency?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean | null
          api_documentation_url?: string | null
          api_endpoint?: string | null
          auth_details?: Json | null
          auth_type?: Database["public"]["Enums"]["api_auth_type"]
          created_at?: string
          id?: string
          last_checked?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          priority?: number | null
          type?: string
          update_frequency?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      counties: {
        Row: {
          created_at: string
          fips_code: string | null
          id: number
          name: string
          state_id: number
        }
        Insert: {
          created_at?: string
          fips_code?: string | null
          id?: number
          name: string
          state_id: number
        }
        Update: {
          created_at?: string
          fips_code?: string | null
          id?: number
          name?: string
          state_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "counties_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_applications: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          next_deadline: string | null
          notes: string | null
          opportunity_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          next_deadline?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          next_deadline?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities_with_geography"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          opportunity_id: string | null
          phone: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          opportunity_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          opportunity_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities_with_geography"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_eligibility_criteria: {
        Row: {
          created_at: string | null
          entity_type: string
          geographic_restriction: string | null
          id: string
          opportunity_id: string | null
          other_requirements: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          geographic_restriction?: string | null
          id?: string
          opportunity_id?: string | null
          other_requirements?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          geographic_restriction?: string | null
          id?: string
          opportunity_id?: string | null
          other_requirements?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_eligibility_criteria_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_eligibility_criteria_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities_with_geography"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_opportunities: {
        Row: {
          close_date: string
          cost_share_percentage: number | null
          cost_share_required: boolean | null
          created_at: string | null
          description: string | null
          eligibility: string | null
          id: string
          is_national: boolean | null
          max_amount: number | null
          maximum_award: number | null
          min_amount: number | null
          minimum_award: number | null
          objectives: string | null
          open_date: string | null
          opportunity_number: string | null
          posted_date: string | null
          program_id: string | null
          source_name: string
          source_type: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          close_date: string
          cost_share_percentage?: number | null
          cost_share_required?: boolean | null
          created_at?: string | null
          description?: string | null
          eligibility?: string | null
          id?: string
          is_national?: boolean | null
          max_amount?: number | null
          maximum_award?: number | null
          min_amount?: number | null
          minimum_award?: number | null
          objectives?: string | null
          open_date?: string | null
          opportunity_number?: string | null
          posted_date?: string | null
          program_id?: string | null
          source_name: string
          source_type?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          close_date?: string
          cost_share_percentage?: number | null
          cost_share_required?: boolean | null
          created_at?: string | null
          description?: string | null
          eligibility?: string | null
          id?: string
          is_national?: boolean | null
          max_amount?: number | null
          maximum_award?: number | null
          min_amount?: number | null
          minimum_award?: number | null
          objectives?: string | null
          open_date?: string | null
          opportunity_number?: string | null
          posted_date?: string | null
          program_id?: string | null
          source_name?: string
          source_type?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_opportunities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "funding_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_programs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_sources: {
        Row: {
          agency_type: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          agency_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          agency_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      opportunity_county_eligibility: {
        Row: {
          county_id: number
          created_at: string
          id: string
          opportunity_id: string
        }
        Insert: {
          county_id: number
          created_at?: string
          id?: string
          opportunity_id: string
        }
        Update: {
          county_id?: number
          created_at?: string
          id?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_county_eligibility_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_county_eligibility_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_county_eligibility_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities_with_geography"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_state_eligibility: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          state_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          state_id: number
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          state_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_state_eligibility_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_state_eligibility_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "funding_opportunities_with_geography"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_state_eligibility_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      states: {
        Row: {
          code: string
          created_at: string
          id: number
          name: string
          region: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          name: string
          region?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      your_table_name: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_api_sources_with_config: {
        Row: {
          api_endpoint: string | null
          auth_details: Json | null
          auth_type: Database["public"]["Enums"]["api_auth_type"] | null
          configurations: Json | null
          id: string | null
          last_checked: string | null
          name: string | null
          notes: string | null
          organization: string | null
          priority: number | null
          type: string | null
          update_frequency: string | null
          url: string | null
        }
        Relationships: []
      }
      funding_opportunities_with_geography: {
        Row: {
          close_date: string | null
          cost_share_percentage: number | null
          cost_share_required: boolean | null
          created_at: string | null
          description: string | null
          eligibility: string | null
          eligible_states: string[] | null
          id: string | null
          is_national: boolean | null
          max_amount: number | null
          maximum_award: number | null
          min_amount: number | null
          minimum_award: number | null
          objectives: string | null
          open_date: string | null
          opportunity_number: string | null
          posted_date: string | null
          program_id: string | null
          program_name: string | null
          source_name: string | null
          source_type: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_opportunities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "funding_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_funding_by_county: {
        Args: {
          input_state_code: string
          status?: string
          source_type?: string
          min_amount?: number
          max_amount?: number
        }
        Returns: {
          county_name: string
          state_code: string
          value: number
          opportunities: number
        }[]
      }
      get_funding_by_state: {
        Args: {
          p_status?: string
          p_source_type?: string
          p_min_amount?: number
          p_max_amount?: number
        }
        Returns: {
          state: string
          state_code: string
          value: number
          opportunities: number
        }[]
      }
      get_next_api_source_to_process: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          organization: string
          type: string
          url: string
          api_endpoint: string
          auth_type: Database["public"]["Enums"]["api_auth_type"]
          auth_details: Json
          update_frequency: string
          last_checked: string
          priority: number
          notes: string
          configurations: Json
        }[]
      }
      get_opportunities_by_state: {
        Args: {
          p_state_code: string
        }
        Returns: {
          id: string
          title: string
          opportunity_number: string
          source_name: string
          source_type: string
          min_amount: number
          max_amount: number
          cost_share_required: boolean
          cost_share_percentage: number
          posted_date: string
          open_date: string
          close_date: string
          description: string
          objectives: string
          eligibility: string
          status: string
          tags: string[]
          url: string
          minimum_award: number
          maximum_award: number
          is_national: boolean
          program_id: string
          created_at: string
          updated_at: string
          program_name: string
          eligible_states: string[]
        }[]
      }
    }
    Enums: {
      api_action_type: "api_check" | "processing" | "error"
      api_auth_type: "none" | "apikey" | "oauth" | "basic"
      api_handler_type: "standard" | "document" | "statePortal"
      api_status_type: "success" | "failure" | "partial"
      data_action_type: "insert" | "update" | "ignore"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: {
          _bucket_id: string
          _name: string
        }
        Returns: undefined
      }
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      delete_prefix: {
        Args: {
          _bucket_id: string
          _name: string
        }
        Returns: boolean
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_level: {
        Args: {
          name: string
        }
        Returns: number
      }
      get_prefix: {
        Args: {
          name: string
        }
        Returns: string
      }
      get_prefixes: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_legacy_v1: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v1_optimised: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v2: {
        Args: {
          prefix: string
          bucket_name: string
          limits?: number
          levels?: number
          start_after?: string
        }
        Returns: {
          key: string
          name: string
          id: string
          updated_at: string
          created_at: string
          metadata: Json
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

