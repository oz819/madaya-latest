// Generated from the live Supabase schema (mcp: generate_typescript_types). Regenerate after any
// migration instead of hand-editing. `deprecated_*` tables are archived data (old custom-auth
// prototype tables and, as deprecated_v1_*, the pre-tracks daily/tilawah records), unused by the app.
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
      push_subscriptions: {
        Row: { id: string; user_id: string; center_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; created_at: string }
        Insert: { id?: string; user_id?: string; center_id?: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; center_id?: string; endpoint?: string; p256dh?: string; auth?: string; user_agent?: string | null; created_at?: string }
        Relationships: []
      }
      platform_admins: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string; created_at?: string }
        Relationships: []
      }
      centers: {
        Row: {
          id: string
          slug: string
          name: string
          country: string | null
          city: string | null
          logo_url: string | null
          palette: string
          primary_color: string | null
          registrations_open: boolean
          about: string | null
          extra_notes: string | null
          contact_phone: string | null
          contact_email: string | null
          whatsapp: string | null
          instagram: string | null
          facebook: string | null
          address: string | null
          timezone: string
          locale: string
          domain: string | null
          status: string
          plan: string
          trial_ends_at: string | null
          onboarded: boolean
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          country?: string | null
          city?: string | null
          logo_url?: string | null
          palette?: string
          primary_color?: string | null
          registrations_open?: boolean
          about?: string | null
          extra_notes?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          whatsapp?: string | null
          instagram?: string | null
          facebook?: string | null
          address?: string | null
          timezone?: string
          locale?: string
          domain?: string | null
          status?: string
          plan?: string
          trial_ends_at?: string | null
          onboarded?: boolean
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          country?: string | null
          city?: string | null
          logo_url?: string | null
          palette?: string
          primary_color?: string | null
          registrations_open?: boolean
          about?: string | null
          extra_notes?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          whatsapp?: string | null
          instagram?: string | null
          facebook?: string | null
          address?: string | null
          timezone?: string
          locale?: string
          domain?: string | null
          status?: string
          plan?: string
          trial_ends_at?: string | null
          onboarded?: boolean
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          user_id: string
          center_id: string
          name: string
          role: string
          is_owner: boolean
          active: boolean
          default_filter: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          deleted_by: string | null
        }
        Insert: {
          user_id: string
          center_id: string
          name: string
          role: string
          is_owner?: boolean
          active?: boolean
          default_filter?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: {
          user_id?: string
          center_id?: string
          name?: string
          role?: string
          is_owner?: boolean
          active?: boolean
          default_filter?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Relationships: []
      }
      center_invites: {
        Row: {
          id: string
          center_id: string
          email: string
          name: string | null
          role: string
          token: string
          created_by: string | null
          created_at: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          center_id?: string
          email: string
          name?: string | null
          role?: string
          token?: string
          created_by?: string | null
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
        }
        Update: {
          id?: string
          center_id?: string
          email?: string
          name?: string | null
          role?: string
          token?: string
          created_by?: string | null
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      app_users: {
        Row: {
          id: string
          name: string
          created_at: string
          current_center_id: string | null
        }
        Insert: {
          id: string
          name: string
          created_at?: string
          current_center_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          current_center_id?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          center_id: string
          activity_date: string
          circle_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          id: string
          student_ids: string[]
          teacher_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          activity_date: string
          circle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          student_ids?: string[]
          teacher_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          activity_date?: string
          circle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          student_ids?: string[]
          teacher_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          center_id: string
          action: string
          actor: string | null
          at: string
          changes: Json
          id: number
          row_key: string
          student_id: string | null
          table_name: string
        }
        Insert: {
          center_id?: string
          action: string
          actor?: string | null
          at?: string
          changes: Json
          id?: number
          row_key: string
          student_id?: string | null
          table_name: string
        }
        Update: {
          center_id?: string
          action?: string
          actor?: string | null
          at?: string
          changes?: Json
          id?: number
          row_key?: string
          student_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      ranking_settings: {
        Row: {
          center_id: string
          absence_message: string | null
          absence_threshold: number
          course_start: string | null
          grades: Json
          honor_enabled: boolean
          id: number
          pass_mark: number
          updated_at: string
          updated_by: string | null
          week_start: number
          weights: Json
        }
        Insert: {
          center_id?: string
          absence_message?: string | null
          absence_threshold?: number
          course_start?: string | null
          grades?: Json
          honor_enabled?: boolean
          id?: number
          pass_mark?: number
          updated_at?: string
          updated_by?: string | null
          week_start?: number
          weights?: Json
        }
        Update: {
          center_id?: string
          absence_message?: string | null
          absence_threshold?: number
          course_start?: string | null
          grades?: Json
          honor_enabled?: boolean
          id?: number
          pass_mark?: number
          updated_at?: string
          updated_by?: string | null
          week_start?: number
          weights?: Json
        }
        Relationships: []
      }
      arabic_books: {
        Row: {
          center_id: string
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          id: string
          title: string
          total_pages: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          title: string
          total_pages: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          title?: string
          total_pages?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      arabic_entries: {
        Row: {
          center_id: string
          book_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          entry_date: string
          from_page: number
          id: string
          notes: string | null
          quality: string | null
          student_id: string
          teacher_id: string | null
          to_page: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          book_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          entry_date?: string
          from_page: number
          id?: string
          notes?: string | null
          quality?: string | null
          student_id: string
          teacher_id?: string | null
          to_page: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          book_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          entry_date?: string
          from_page?: number
          id?: string
          notes?: string | null
          quality?: string | null
          student_id?: string
          teacher_id?: string | null
          to_page?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arabic_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "arabic_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arabic_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "arabic_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arabic_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          center_id: string
          att_date: string
          created_at: string
          deleted_at: string | null
          edited_at: string
          status: string
          student_id: string
          teacher_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          att_date: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          status: string
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          att_date?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          status?: string
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_lessons: {
        Row: {
          center_id: string
          circle_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          lesson_date: string
          teacher_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          circle_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          lesson_date: string
          teacher_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          circle_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          lesson_date?: string
          teacher_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_lessons_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          center_id: string
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          id: string
          name: string
          section: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          name: string
          section?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          name?: string
          section?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      deprecated_circles: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circles_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "deprecated_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_daily_records: {
        Row: {
          attendance: string
          created_at: string
          from_ayah: number | null
          grade: string | null
          id: string
          notes: string | null
          points: number
          record_date: string
          student_id: string
          surah: string | null
          teacher_id: string
          to_ayah: number | null
          work_type: string
        }
        Insert: {
          attendance: string
          created_at?: string
          from_ayah?: number | null
          grade?: string | null
          id?: string
          notes?: string | null
          points: number
          record_date?: string
          student_id: string
          surah?: string | null
          teacher_id: string
          to_ayah?: number | null
          work_type: string
        }
        Update: {
          attendance?: string
          created_at?: string
          from_ayah?: number | null
          grade?: string | null
          id?: string
          notes?: string | null
          points?: number
          record_date?: string
          student_id?: string
          surah?: string | null
          teacher_id?: string
          to_ayah?: number | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "deprecated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "deprecated_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_edu_notes: {
        Row: {
          area: string
          created_at: string
          id: string
          note: string
          points: number
          record_date: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          note: string
          points: number
          record_date?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          note?: string
          points?: number
          record_date?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "deprecated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "deprecated_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_students: {
        Row: {
          circle_id: string
          created_at: string
          current_from_ayah: number | null
          current_grade: string | null
          current_surah: string | null
          current_surah_no: number | null
          current_to_ayah: number | null
          id: string
          name: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          current_from_ayah?: number | null
          current_grade?: string | null
          current_surah?: string | null
          current_surah_no?: number | null
          current_to_ayah?: number | null
          id?: string
          name: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          current_from_ayah?: number | null
          current_grade?: string | null
          current_surah?: string | null
          current_surah_no?: number | null
          current_to_ayah?: number | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "deprecated_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_tilawah_records: {
        Row: {
          created_at: string
          from_ayah: number
          grade: string
          id: string
          notes: string | null
          record_date: string
          student_id: string
          surah: string
          surah_no: number
          teacher_id: string
          to_ayah: number
        }
        Insert: {
          created_at?: string
          from_ayah: number
          grade: string
          id?: string
          notes?: string | null
          record_date?: string
          student_id: string
          surah: string
          surah_no: number
          teacher_id: string
          to_ayah: number
        }
        Update: {
          created_at?: string
          from_ayah?: number
          grade?: string
          id?: string
          notes?: string | null
          record_date?: string
          student_id?: string
          surah?: string
          surah_no?: number
          teacher_id?: string
          to_ayah?: number
        }
        Relationships: [
          {
            foreignKeyName: "tilawah_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "deprecated_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilawah_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "deprecated_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          password_hash: string
          role: string
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          password_hash: string
          role: string
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          password_hash?: string
          role?: string
          username?: string
        }
        Relationships: []
      }
      deprecated_v1_daily_records: {
        Row: {
          adjustment: number
          attendance: string
          created_at: string
          from_ayah: number | null
          grade: string | null
          id: string
          notes: string | null
          points: number
          record_date: string
          student_id: string
          surah: string | null
          teacher_id: string
          to_ayah: number | null
          work_type: string
        }
        Insert: {
          adjustment?: number
          attendance: string
          created_at?: string
          from_ayah?: number | null
          grade?: string | null
          id?: string
          notes?: string | null
          points?: number
          record_date?: string
          student_id: string
          surah?: string | null
          teacher_id: string
          to_ayah?: number | null
          work_type: string
        }
        Update: {
          adjustment?: number
          attendance?: string
          created_at?: string
          from_ayah?: number | null
          grade?: string | null
          id?: string
          notes?: string | null
          points?: number
          record_date?: string
          student_id?: string
          surah?: string | null
          teacher_id?: string
          to_ayah?: number | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "daily_records_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_records_teacher_id_fkey1"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deprecated_v1_tilawah_records: {
        Row: {
          created_at: string
          from_ayah: number
          grade: string
          id: string
          notes: string | null
          record_date: string
          student_id: string
          surah: string
          surah_no: number
          teacher_id: string
          to_ayah: number
        }
        Insert: {
          created_at?: string
          from_ayah: number
          grade: string
          id?: string
          notes?: string | null
          record_date?: string
          student_id: string
          surah: string
          surah_no: number
          teacher_id: string
          to_ayah: number
        }
        Update: {
          created_at?: string
          from_ayah?: number
          grade?: string
          id?: string
          notes?: string | null
          record_date?: string
          student_id?: string
          surah?: string
          surah_no?: number
          teacher_id?: string
          to_ayah?: number
        }
        Relationships: [
          {
            foreignKeyName: "tilawah_records_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "tilawah_records_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tilawah_records_surah_no_fkey"
            columns: ["surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "tilawah_records_teacher_id_fkey1"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_notes: {
        Row: {
          center_id: string
          area: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          id: string
          note: string
          points: number
          quality: string | null
          record_date: string
          student_id: string
          teacher_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          area: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          note: string
          points?: number
          quality?: string | null
          record_date?: string
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          area?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          id?: string
          note?: string
          points?: number
          quality?: string | null
          record_date?: string
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_notes_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "edu_notes_student_id_fkey1"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_notes_teacher_id_fkey1"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          center_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          exam_date: string
          examiner: string | null
          id: string
          juz_no: number | null
          kind: string
          notes: string | null
          passed: boolean
          score: number
          student_id: string
          surah_no: number | null
          teacher_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          exam_date: string
          examiner?: string | null
          id?: string
          juz_no?: number | null
          kind: string
          notes?: string | null
          passed: boolean
          score: number
          student_id: string
          surah_no?: number | null
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          exam_date?: string
          examiner?: string | null
          id?: string
          juz_no?: number | null
          kind?: string
          notes?: string | null
          passed?: boolean
          score?: number
          student_id?: string
          surah_no?: number | null
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      guardian_links: {
        Row: {
          center_id: string
          created_at: string
          last_opened_at: string | null
          open_count: number
          student_id: string
          token: string
          updated_at: string
        }
        Insert: {
          center_id?: string
          created_at?: string
          last_opened_at?: string | null
          open_count?: number
          student_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          last_opened_at?: string | null
          open_count?: number
          student_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          center_id: string
          is_owner: boolean
          updated_at: string
          active: boolean
          created_at: string
          default_filter: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_filter?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id: string
          name: string
          role: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_filter?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      quran_entries: {
        Row: {
          center_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          entry_date: string
          from_ayah: number | null
          from_surah_no: number | null
          id: string
          notes: string | null
          quality: string | null
          student_id: string
          talqeen_session_id: string | null
          teacher_id: string | null
          to_ayah: number | null
          to_surah_no: number | null
          track: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          entry_date?: string
          from_ayah?: number | null
          from_surah_no?: number | null
          id?: string
          notes?: string | null
          quality?: string | null
          student_id: string
          talqeen_session_id?: string | null
          teacher_id?: string | null
          to_ayah?: number | null
          to_surah_no?: number | null
          track: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          entry_date?: string
          from_ayah?: number | null
          from_surah_no?: number | null
          id?: string
          notes?: string | null
          quality?: string | null
          student_id?: string
          talqeen_session_id?: string | null
          teacher_id?: string | null
          to_ayah?: number | null
          to_surah_no?: number | null
          track?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quran_entries_from_surah_no_fkey"
            columns: ["from_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "quran_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_entries_talqeen_session_id_fkey"
            columns: ["talqeen_session_id"]
            isOneToOne: false
            referencedRelation: "talqeen_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_entries_to_surah_no_fkey"
            columns: ["to_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
        ]
      }
      quran_surahs: {
        Row: {
          ayah_count: number
          name: string
          surah_no: number
        }
        Insert: {
          ayah_count: number
          name: string
          surah_no: number
        }
        Update: {
          ayah_count?: number
          name?: string
          surah_no?: number
        }
        Relationships: []
      }
      student_arabic_enrollments: {
        Row: {
          center_id: string
          book_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string
          finished_on: string | null
          id: string
          started_on: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          book_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          finished_on?: string | null
          id?: string
          started_on?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          book_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          finished_on?: string | null
          id?: string
          started_on?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_arabic_enrollments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "arabic_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_arabic_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_progress"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_arabic_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          center_id: string
          age: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          guardian_name: string | null
          guardian_phone: string
          id: string
          memorized: string | null
          section: string
          status: string
          student_id: string | null
          student_name: string
        }
        Insert: {
          center_id?: string
          age?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          guardian_name?: string | null
          guardian_phone: string
          id?: string
          memorized?: string | null
          section: string
          status?: string
          student_id?: string | null
          student_name: string
        }
        Update: {
          center_id?: string
          age?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          guardian_name?: string | null
          guardian_phone?: string
          id?: string
          memorized?: string | null
          section?: string
          status?: string
          student_id?: string | null
          student_name?: string
        }
        Relationships: []
      }
      report_sends: {
        Row: {
          center_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          kind: string
          send_date: string
          student_id: string
          teacher_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          kind: string
          send_date: string
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          kind?: string
          send_date?: string
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      student_transfers: {
        Row: {
          center_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_circle_id: string | null
          id: string
          student_id: string
          to_circle_id: string | null
          transfer_date: string
          updated_at: string
        }
        Insert: {
          center_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_circle_id?: string | null
          id?: string
          student_id: string
          to_circle_id?: string | null
          transfer_date: string
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_circle_id?: string | null
          id?: string
          student_id?: string
          to_circle_id?: string | null
          transfer_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          center_id: string
          active: boolean
          circle_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          weekly_goal_ayahs: number | null
        }
        Insert: {
          center_id?: string
          active?: boolean
          circle_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          weekly_goal_ayahs?: number | null
        }
        Update: {
          center_id?: string
          active?: boolean
          circle_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          weekly_goal_ayahs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_circle_id_fkey1"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      talqeen_sessions: {
        Row: {
          center_id: string
          circle_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string
          from_ayah: number
          from_surah_no: number
          id: string
          notes: string | null
          session_date: string
          teacher_id: string | null
          to_ayah: number
          to_surah_no: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_id?: string
          circle_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          from_ayah: number
          from_surah_no: number
          id?: string
          notes?: string | null
          session_date?: string
          teacher_id?: string | null
          to_ayah: number
          to_surah_no: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_id?: string
          circle_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string
          from_ayah?: number
          from_surah_no?: number
          id?: string
          notes?: string | null
          session_date?: string
          teacher_id?: string | null
          to_ayah?: number
          to_surah_no?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talqeen_sessions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talqeen_sessions_from_surah_no_fkey"
            columns: ["from_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "talqeen_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talqeen_sessions_to_surah_no_fkey"
            columns: ["to_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
        ]
      }
      user_settings: {
        Row: {
          center_id: string
          filter: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          center_id?: string
          filter?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          center_id?: string
          filter?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_progress: {
        Row: {
          arabic_book_id: string | null
          arabic_page: number | null
          arabic_percent: number | null
          attendance_today: string | null
          circle_id: string | null
          hifz_ayah: number | null
          hifz_date: string | null
          hifz_surah_no: number | null
          last_tarbiya_date: string | null
          murajaa_date: string | null
          murajaa_from_ayah: number | null
          murajaa_from_surah_no: number | null
          murajaa_to_ayah: number | null
          murajaa_to_surah_no: number | null
          name: string | null
          student_id: string | null
          talqeen_date: string | null
          talqeen_from_ayah: number | null
          talqeen_from_surah_no: number | null
          talqeen_to_ayah: number | null
          talqeen_to_surah_no: number | null
          tilawa_ayah: number | null
          tilawa_percent: number | null
          tilawa_surah_no: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arabic_entries_book_id_fkey"
            columns: ["arabic_book_id"]
            isOneToOne: false
            referencedRelation: "arabic_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_entries_from_surah_no_fkey"
            columns: ["murajaa_from_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_from_surah_no_fkey"
            columns: ["talqeen_from_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_to_surah_no_fkey"
            columns: ["talqeen_to_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_to_surah_no_fkey"
            columns: ["tilawa_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_to_surah_no_fkey"
            columns: ["murajaa_to_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "quran_entries_to_surah_no_fkey"
            columns: ["hifz_surah_no"]
            isOneToOne: false
            referencedRelation: "quran_surahs"
            referencedColumns: ["surah_no"]
          },
          {
            foreignKeyName: "students_circle_id_fkey1"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      my_context: { Args: never; Returns: Json }
      service_user_id: { Args: { p_email: string }; Returns: string }
      switch_center: { Args: { p_center_id: string }; Returns: undefined }
      public_center: { Args: { p_slug?: string | null; p_domain?: string | null }; Returns: Json }
      create_center: {
        Args: { p_name: string; p_slug: string; p_country: string; p_city: string; p_owner_name: string; p_about?: string | null; p_phone?: string | null; p_palette?: string | null }
        Returns: Json
      }
      invite_info: { Args: { p_token: string }; Returns: Json }
      accept_invite: { Args: { p_token: string; p_name?: string | null }; Returns: Json }
      super_centers: { Args: never; Returns: Json }
      super_set_center: { Args: { p_id: string; p_status?: string | null; p_plan?: string | null }; Returns: undefined }
      admin_create_circle: {
        Args: { p_name: string; p_section?: string | null; p_students?: Json }
        Returns: Json
      }
      admin_accept_registration: {
        Args: { p_circle_id: string; p_id: string }
        Returns: string
      }
      admin_purge: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      admin_restore: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      admin_soft_delete: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      admin_trash: {
        Args: never
        Returns: {
          deleted_at: string
          deleted_by_name: string
          detail: string
          id: string
          kind: string
          label: string
        }[]
      }
      ayahs_before: { Args: { p_surah_no: number }; Returns: number }
      guardian_view: { Args: { p_token: string }; Returns: Json }
      report_data: {
        Args: {
          p_circle_id?: string
          p_from: string
          p_student_id?: string
          p_to: string
        }
        Returns: Json
      }
      admin_reject_registration: { Args: { p_id: string }; Returns: undefined }
      rotate_guardian_link: { Args: { p_student_id: string }; Returns: string }
      save_talqeen_session: {
        Args: { p_entries: Json; p_session: Json }
        Returns: undefined
      }
      submit_registration: {
        Args: {
          p_age: number | null
          p_guardian_name: string | null
          p_guardian_phone: string
          p_memorized: string | null
          p_section: string
          p_student_name: string
          p_trap?: string | null
          p_center?: string | null
        }
        Returns: boolean
      }
      sync_latest_arabic_entries: {
        Args: never
        Returns: {
          book_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string
          entry_date: string
          from_page: number
          id: string
          notes: string | null
          quality: string | null
          student_id: string
          teacher_id: string | null
          to_page: number
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "arabic_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sync_latest_quran_entries: {
        Args: never
        Returns: {
          created_at: string
          deleted_at: string | null
          edited_at: string
          entry_date: string
          from_ayah: number | null
          from_surah_no: number | null
          id: string
          notes: string | null
          quality: string | null
          student_id: string
          talqeen_session_id: string | null
          teacher_id: string | null
          to_ayah: number | null
          to_surah_no: number | null
          track: string
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "quran_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tilawah_percent: {
        Args: { p_ayah: number; p_surah_no: number }
        Returns: number
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
