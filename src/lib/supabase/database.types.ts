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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          accuracy_m: number | null
          checked_in_at: string | null
          created_at: string
          distance_m: number | null
          event_id: string
          method: string
          minutes_late: number | null
          recorded_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          checked_in_at?: string | null
          created_at?: string
          distance_m?: number | null
          event_id: string
          method?: string
          minutes_late?: number | null
          recorded_by?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          checked_in_at?: string | null
          created_at?: string
          distance_m?: number | null
          event_id?: string
          method?: string
          minutes_late?: number | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_periods: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          kind: string
          note: string | null
          set_by: string | null
          starts_on: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          kind: string
          note?: string | null
          set_by?: string | null
          starts_on: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          kind?: string
          note?: string | null
          set_by?: string | null
          starts_on?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_periods_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_periods_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          created_at: string
          id: string
          revoked_at: string | null
          team_id: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          team_id?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          team_id?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_feeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          body: string | null
          client_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          pinned_at: string | null
          pinned_by: string | null
          poll_multi: boolean
          reply_to: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          body?: string | null
          client_id: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          pinned_at?: string | null
          pinned_by?: string | null
          poll_multi?: boolean
          reply_to?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          body?: string | null
          client_id?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          pinned_at?: string | null
          pinned_by?: string | null
          poll_multi?: boolean
          reply_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_admins: {
        Row: {
          club_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_admins_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          blurb: string | null
          color: string
          color_secondary: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          join_open: boolean
          location: string | null
          logo_path: string | null
          name: string
          slug: string
          sport: string | null
          updated_at: string
          welcome_text: string | null
        }
        Insert: {
          blurb?: string | null
          color?: string
          color_secondary?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          join_open?: boolean
          location?: string | null
          logo_path?: string | null
          name: string
          slug: string
          sport?: string | null
          updated_at?: string
          welcome_text?: string | null
        }
        Update: {
          blurb?: string | null
          color?: string
          color_secondary?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          join_open?: boolean
          location?: string | null
          logo_path?: string | null
          name?: string
          slug?: string
          sport?: string | null
          updated_at?: string
          welcome_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          kind: string
          team_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          team_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          team_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dues: {
        Row: {
          amount_cents: number
          created_at: string
          fee_id: string
          id: string
          updated_at: string
          user_id: string
          waived: boolean
        }
        Insert: {
          amount_cents: number
          created_at?: string
          fee_id: string
          id?: string
          updated_at?: string
          user_id: string
          waived?: boolean
        }
        Update: {
          amount_cents?: number
          created_at?: string
          fee_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          waived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dues_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_managers: {
        Row: {
          created_at: string
          event_id: string
          permissions: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          permissions?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          permissions?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_managers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          created_by: string | null
          duration_minutes: number
          ends_on: string | null
          id: string
          local_start_time: string
          rrule: string
          starts_on: string
          team_id: string
          tz: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_minutes: number
          ends_on?: string | null
          id?: string
          local_start_time: string
          rrule: string
          starts_on: string
          team_id: string
          tz: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ends_on?: string | null
          id?: string
          local_start_time?: string
          rrule?: string
          starts_on?: string
          team_id?: string
          tz?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          competition: string | null
          created_at: string
          created_by: string | null
          end_at: string
          home_away: string | null
          id: string
          location_text: string | null
          meet_at: string | null
          notes: string | null
          opponent: string | null
          potm_open: boolean
          season_id: string | null
          series_id: string | null
          sponsor_visible: boolean | null
          squad_size: number | null
          start_at: string
          status: string
          status_reason: string | null
          team_id: string
          time_tbd: boolean
          title: string | null
          type: string
          tz: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          competition?: string | null
          created_at?: string
          created_by?: string | null
          end_at: string
          home_away?: string | null
          id?: string
          location_text?: string | null
          meet_at?: string | null
          notes?: string | null
          opponent?: string | null
          potm_open?: boolean
          season_id?: string | null
          series_id?: string | null
          sponsor_visible?: boolean | null
          squad_size?: number | null
          start_at: string
          status?: string
          status_reason?: string | null
          team_id: string
          time_tbd?: boolean
          title?: string | null
          type: string
          tz: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          competition?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string
          home_away?: string | null
          id?: string
          location_text?: string | null
          meet_at?: string | null
          notes?: string | null
          opponent?: string | null
          potm_open?: boolean
          season_id?: string | null
          series_id?: string | null
          sponsor_visible?: boolean | null
          squad_size?: number | null
          start_at?: string
          status?: string
          status_reason?: string | null
          team_id?: string
          time_tbd?: boolean
          title?: string | null
          type?: string
          tz?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          due_on: string | null
          id: string
          name: string
          season_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          due_on?: string | null
          id?: string
          name: string
          season_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          due_on?: string | null
          id?: string
          name?: string
          season_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          status: string
          team_id: string
          user_id: string
          via: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: string
          team_id: string
          user_id: string
          via?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: string
          team_id?: string
          user_id?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          kind: string
          minute: number | null
          note: string | null
          side: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          kind: string
          minute?: number | null
          note?: string | null
          side?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          kind?: string
          minute?: number | null
          note?: string | null
          side?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_private: {
        Row: {
          created_at: string
          emergency_name: string | null
          emergency_phone: string | null
          medical_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emergency_name?: string | null
          emergency_phone?: string | null
          medical_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emergency_name?: string | null
          emergency_phone?: string | null
          medical_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          subject: string
          team_id: string
          to_all: boolean
          to_sponsors: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          subject: string
          team_id: string
          to_all?: boolean
          to_sponsors?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          subject?: string
          team_id?: string
          to_all?: boolean
          to_sponsors?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          chat: string
          email: boolean
          live_scores: boolean
          push: boolean
          reminders: boolean
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat?: string
          email?: boolean
          live_scores?: boolean
          push?: boolean
          reminders?: boolean
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat?: string
          email?: boolean
          live_scores?: boolean
          push?: boolean
          reminders?: boolean
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          run_after: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          payload: Json
          run_after?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          run_after?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          due_id: string
          id: string
          method: string
          paid_on: string
          reference: string | null
          reported_by: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_id: string
          id?: string
          method: string
          paid_on: string
          reference?: string | null
          reported_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_id?: string
          id?: string
          method?: string
          paid_on?: string
          reference?: string | null
          reported_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_due_id_fkey"
            columns: ["due_id"]
            isOneToOne: false
            referencedRelation: "dues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          note: string | null
          points: number
          reason: string
          season_id: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          note?: string | null
          points: number
          reason: string
          season_id?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          note?: string | null
          points?: number
          reason?: string
          season_id?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          label: string
          message_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          message_id: string
          position: number
        }
        Update: {
          id?: string
          label?: string
          message_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          message_id: string
          option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          option_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      potm_votes: {
        Row: {
          created_at: string
          event_id: string
          nominee_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          nominee_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          nominee_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "potm_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "potm_votes_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "potm_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          theme: string
          updated_at: string
          use_team_colors: boolean
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone?: string | null
          theme?: string
          updated_at?: string
          use_team_colors?: boolean
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          theme?: string
          updated_at?: string
          use_team_colors?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          created_at: string
          driver_id: string
          event_id: string
          id: string
          leaves_at: string | null
          leaves_from: string
          note: string | null
          return_trip: boolean
          seats: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          event_id: string
          id?: string
          leaves_at?: string | null
          leaves_from: string
          note?: string | null
          return_trip?: boolean
          seats: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          event_id?: string
          id?: string
          leaves_at?: string | null
          leaves_from?: string
          note?: string | null
          return_trip?: boolean
          seats?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          offer_id: string | null
          picked_up_at: string | null
          pickup_area: string | null
          rider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          offer_id?: string | null
          picked_up_at?: string | null
          pickup_area?: string | null
          rider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          offer_id?: string | null
          picked_up_at?: string | null
          pickup_area?: string | null
          rider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_members: {
        Row: {
          created_at: string
          id: string
          invite_token_hash: string | null
          invited_email: string | null
          invited_name: string | null
          is_player: boolean
          jersey: string | null
          joined_at: string | null
          permissions: string[]
          position: string | null
          roles: string[]
          status: string
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_token_hash?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_player?: boolean
          jersey?: string | null
          joined_at?: string | null
          permissions?: string[]
          position?: string | null
          roles?: string[]
          status?: string
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_token_hash?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_player?: boolean
          jersey?: string | null
          joined_at?: string | null
          permissions?: string[]
          position?: string | null
          roles?: string[]
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          responded_by: string | null
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          responded_by?: string | null
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          responded_by?: string | null
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string
          event_id: string
          opponent_score: number
          period: string | null
          status: string
          team_score: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          event_id: string
          opponent_score?: number
          period?: string | null
          status?: string
          team_score?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          opponent_score?: number
          period?: string | null
          status?: string
          team_score?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          starts_on: string
          team_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          starts_on: string
          team_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          blurb: string | null
          club_id: string | null
          contact_user_id: string | null
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          invite_token_hash: string | null
          invited_email: string | null
          logo_url: string | null
          name: string
          starts_on: string | null
          status: string
          team_id: string | null
          tier: string
          updated_at: string
          website: string | null
        }
        Insert: {
          blurb?: string | null
          club_id?: string | null
          contact_user_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          invite_token_hash?: string | null
          invited_email?: string | null
          logo_url?: string | null
          name: string
          starts_on?: string | null
          status?: string
          team_id?: string | null
          tier: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          blurb?: string | null
          club_id?: string | null
          contact_user_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          invite_token_hash?: string | null
          invited_email?: string | null
          logo_url?: string | null
          name?: string
          starts_on?: string | null
          status?: string
          team_id?: string | null
          tier?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invite_links: {
        Row: {
          needs_approval: boolean
          reset_at: string | null
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          needs_approval?: boolean
          reset_at?: string | null
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          needs_approval?: boolean
          reset_at?: string | null
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invite_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          archived_at: string | null
          club_id: string | null
          color: string
          color_secondary: string | null
          created_at: string
          created_by: string
          geo_checkin_enabled: boolean
          id: string
          is_public: boolean
          join_code: string
          level: string | null
          location: string | null
          logo_path: string | null
          members_can_post: boolean
          name: string
          points_enabled: boolean
          points_public: boolean
          points_rules: Json
          roster_visible: boolean
          sponsor_chat: boolean
          sport: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          club_id?: string | null
          color?: string
          color_secondary?: string | null
          created_at?: string
          created_by: string
          geo_checkin_enabled?: boolean
          id?: string
          is_public?: boolean
          join_code?: string
          level?: string | null
          location?: string | null
          logo_path?: string | null
          members_can_post?: boolean
          name: string
          points_enabled?: boolean
          points_public?: boolean
          points_rules?: Json
          roster_visible?: boolean
          sponsor_chat?: boolean
          sport: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          club_id?: string | null
          color?: string
          color_secondary?: string | null
          created_at?: string
          created_by?: string
          geo_checkin_enabled?: boolean
          id?: string
          is_public?: boolean
          join_code?: string
          level?: string | null
          location?: string | null
          logo_path?: string | null
          members_can_post?: boolean
          name?: string
          points_enabled?: boolean
          points_public?: boolean
          points_rules?: Json
          roster_visible?: boolean
          sponsor_chat?: boolean
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          check_in_radius_m: number
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          check_in_radius_m?: number
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          check_in_radius_m?: number
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      availability_public: {
        Row: {
          ends_on: string | null
          starts_on: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          ends_on?: string | null
          starts_on?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          ends_on?: string | null
          starts_on?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_periods_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      potm_results: {
        Row: {
          event_id: string | null
          nominee_id: string | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "potm_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "potm_votes_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps_public: {
        Row: {
          event_id: string | null
          response: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          response?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          response?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors_public: {
        Row: {
          blurb: string | null
          club_id: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          team_id: string | null
          tier: string | null
          website: string | null
        }
        Insert: {
          blurb?: string | null
          club_id?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          team_id?: string | null
          tier?: string | null
          website?: string | null
        }
        Update: {
          blurb?: string | null
          club_id?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          team_id?: string | null
          tier?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_me_as_player: { Args: { p_team: string }; Returns: undefined }
      can_manage_sponsors: {
        Args: { p_club: string; p_team: string }
        Returns: boolean
      }
      can_read_conversation: { Args: { c: string }; Returns: boolean }
      can_view_team: { Args: { t: string }; Returns: boolean }
      chat_people: {
        Args: { c: string }
        Returns: {
          display_name: string
          sponsor_name: string
          sponsor_tier: string
          user_id: string
        }[]
      }
      check_in: {
        Args: {
          p_accuracy_m: number
          p_event: string
          p_lat: number
          p_lng: number
        }
        Returns: {
          distance_m: number
          minutes_late: number
          status: string
        }[]
      }
      conversation_team: { Args: { c: string }; Returns: string }
      decide_join_request: {
        Args: { p_approve: boolean; p_request: string }
        Returns: undefined
      }
      due_team: { Args: { d: string }; Returns: string }
      event_team: { Args: { e: string }; Returns: string }
      fee_team: { Args: { f: string }; Returns: string }
      has_event_perm: { Args: { e: string; perm: string }; Returns: boolean }
      has_team_perm: { Args: { perm: string; t: string }; Returns: boolean }
      is_club_admin: { Args: { c: string }; Returns: boolean }
      is_club_admin_of_team: { Args: { t: string }; Returns: boolean }
      is_club_owner: { Args: { c: string }; Returns: boolean }
      is_club_treasurer_of_team: { Args: { t: string }; Returns: boolean }
      is_sponsor_of_team: { Args: { t: string }; Returns: boolean }
      is_staff_of_user: { Args: { u: string }; Returns: boolean }
      is_team_member: { Args: { t: string }; Returns: boolean }
      is_team_staff: { Args: { t: string }; Returns: boolean }
      join_by_code: { Args: { p_code: string }; Returns: string }
      join_by_link: {
        Args: { p_token: string }
        Returns: {
          status: string
          team_id: string
        }[]
      }
      join_page: {
        Args: { p_token: string }
        Returns: {
          club_name: string
          club_slug: string
          color: string
          color_secondary: string
          level: string
          location: string
          logo_path: string
          me: string
          name: string
          needs_approval: boolean
          players: number
          sport: string
          team_id: string
        }[]
      }
      played_in: { Args: { e: string; u: string }; Returns: boolean }
      request_to_join: {
        Args: { p_message: string; p_team: string; p_via?: string }
        Returns: string
      }
      reset_invite_link: { Args: { p_team: string }; Returns: string }
      shares_team_with: { Args: { u: string }; Returns: boolean }
      sponsor_feed: {
        Args: { p_team: string }
        Returns: {
          competition: string
          end_at: string
          event_id: string
          home_away: string
          opponent: string
          opponent_score: number
          player_of_match: string
          score_status: string
          start_at: string
          status: string
          team_score: number
          title: string
          type: string
          tz: string
          venue_name: string
        }[]
      }
      sponsor_news: {
        Args: { p_team: string }
        Returns: {
          body: string
          created_at: string
          message_id: string
          subject: string
        }[]
      }
      tell_roster_managers: {
        Args: { p_key: string; p_kind: string; p_payload: Json; p_team: string }
        Returns: undefined
      }
      set_my_player_details: {
        Args: { p_is_player: boolean; p_jersey: string; p_position: string; t: string }
        Returns: undefined
      }
      tier_rank: { Args: { t: string }; Returns: number }
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
    Enums: {},
  },
} as const
