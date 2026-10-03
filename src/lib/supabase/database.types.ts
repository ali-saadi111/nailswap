
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"id": number,"ip": string | null,"payload": NonNullable<Json>,"target_id": string | null,"target_type": string | null
                  }
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"ip"?: string | null,"payload"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"ip"?: string | null,"payload"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_cost_log": {
                  Row: {
                    "cost_usd": number,"created_at": string,"duration_ms": number | null,"id": number,"job_id": string | null,"model": string,"operation": string,"provider": Database["public"]['Enums']["ai_provider"],"salon_id": string | null,"success": boolean
                  }
                  Insert: {
                    "cost_usd"?: number,"created_at"?: string,"duration_ms"?: number | null,"id"?: never,"job_id"?: string | null,"model": string,"operation": string,"provider": Database["public"]['Enums']["ai_provider"],"salon_id"?: string | null,"success": boolean
                  }
                  Update: {
                    "cost_usd"?: number,"created_at"?: string,"duration_ms"?: number | null,"id"?: never,"job_id"?: string | null,"model"?: string,"operation"?: string,"provider"?: Database["public"]['Enums']["ai_provider"],"salon_id"?: string | null,"success"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_cost_log_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "tryon_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_cost_log_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "anon_id": string | null,"created_at": string,"design_id": string | null,"id": number,"kind": Database["public"]['Enums']["analytics_event_kind"],"payload": NonNullable<Json>,"polish_id": string | null,"salon_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "anon_id"?: string | null,"created_at"?: string,"design_id"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["analytics_event_kind"],"payload"?: NonNullable<Json>,"polish_id"?: string | null,"salon_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "anon_id"?: string | null,"created_at"?: string,"design_id"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["analytics_event_kind"],"payload"?: NonNullable<Json>,"polish_id"?: string | null,"salon_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_dismissals": {
                  Row: {
                    "announcement_id": string,"dismissed_at": string,"user_id": string
                  }
                  Insert: {
                    "announcement_id": string,"dismissed_at"?: string,"user_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"dismissed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_dismissals_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_dismissals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience": string,"body": string,"created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"level": string,"starts_at": string,"title": string
                  }
                  Insert: {
                    "audience"?: string,"body": string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"level"?: string,"starts_at"?: string,"title": string
                  }
                  Update: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"level"?: string,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_config": {
                  Row: {
                    "key": string,"updated_at": string,"value": string
                  }
                  Insert: {
                    "key": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_events": {
                  Row: {
                    "actor_id": string | null,"actor_role": string | null,"booking_id": string,"created_at": string,"id": number,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"actor_role"?: string | null,"booking_id": string,"created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_role"?: string | null,"booking_id"?: string,"created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_by": string | null,"client_id": string,"client_notes": string | null,"created_at": string,"created_by": string | null,"currency": string,"deposit_amount": number,"deposit_payment_id": string | null,"design_id": string | null,"design_price": number,"ends_at": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"manage_token": string,"reminder_24h_sent_at": string | null,"reminder_2h_sent_at": string | null,"salon_id": string,"service_id": string,"service_price": number,"source": Database["public"]['Enums']["booking_source"],"staff_id": string,"staff_notes": string | null,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"total_price": number,"tryon_image_path": string | null,"tryon_job_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_by"?: string | null,"client_id": string,"client_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deposit_amount"?: number,"deposit_payment_id"?: string | null,"design_id"?: string | null,"design_price"?: number,"ends_at": string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"manage_token"?: string,"reminder_24h_sent_at"?: string | null,"reminder_2h_sent_at"?: string | null,"salon_id": string,"service_id": string,"service_price"?: number,"source"?: Database["public"]['Enums']["booking_source"],"staff_id": string,"staff_notes"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"total_price"?: number,"tryon_image_path"?: string | null,"tryon_job_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_by"?: string | null,"client_id"?: string,"client_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deposit_amount"?: number,"deposit_payment_id"?: string | null,"design_id"?: string | null,"design_price"?: number,"ends_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"manage_token"?: string,"reminder_24h_sent_at"?: string | null,"reminder_2h_sent_at"?: string | null,"salon_id"?: string,"service_id"?: string,"service_price"?: number,"source"?: Database["public"]['Enums']["booking_source"],"staff_id"?: string,"staff_notes"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"total_price"?: number,"tryon_image_path"?: string | null,"tryon_job_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_deposit_payment_fk"
      columns: ["deposit_payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_tryon_job_id_fkey"
      columns: ["tryon_job_id"]
isOneToOne: false
      referencedRelation: "tryon_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"last_visit_at": string | null,"no_show_count": number,"notes": string | null,"phone": string,"preferred_locale": Database["public"]['Enums']["app_locale"],"salon_id": string,"updated_at": string,"user_id": string | null,"visit_count": number
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"last_visit_at"?: string | null,"no_show_count"?: number,"notes"?: string | null,"phone": string,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"salon_id": string,"updated_at"?: string,"user_id"?: string | null,"visit_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"last_visit_at"?: string | null,"no_show_count"?: number,"notes"?: string | null,"phone"?: string,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"salon_id"?: string,"updated_at"?: string,"user_id"?: string | null,"visit_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"design_images": {
                  Row: {
                    "alt": string | null,"design_id": string,"id": string,"path": string,"sort_order": number
                  }
                  Insert: {
                    "alt"?: string | null,"design_id": string,"id"?: string,"path": string,"sort_order"?: number
                  }
                  Update: {
                    "alt"?: string | null,"design_id"?: string,"id"?: string,"path"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "design_images_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    }
                  ]
                },"design_polishes": {
                  Row: {
                    "design_id": string,"polish_id": string
                  }
                  Insert: {
                    "design_id": string,"polish_id": string
                  }
                  Update: {
                    "design_id"?: string,"polish_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "design_polishes_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "design_polishes_polish_id_fkey"
      columns: ["polish_id"]
isOneToOne: false
      referencedRelation: "polishes"
      referencedColumns: ["id"]
    }
                  ]
                },"design_services": {
                  Row: {
                    "design_id": string,"service_id": string
                  }
                  Insert: {
                    "design_id": string,"service_id": string
                  }
                  Update: {
                    "design_id"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "design_services_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "design_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"designs": {
                  Row: {
                    "booking_count": number,"category": Database["public"]['Enums']["design_category"],"cover_path": string | null,"created_at": string,"description": string | null,"duration_addon_min": number,"id": string,"is_featured": boolean,"is_visible": boolean,"length": Database["public"]['Enums']["nail_length"] | null,"name": string,"name_i18n": NonNullable<Json>,"price_addon": number,"prompt_text": string | null,"salon_id": string,"shape": Database["public"]['Enums']["nail_shape"] | null,"slug": string,"sort_order": number,"tags": (string)[],"tryon_count": number,"updated_at": string
                  }
                  Insert: {
                    "booking_count"?: number,"category"?: Database["public"]['Enums']["design_category"],"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"duration_addon_min"?: number,"id"?: string,"is_featured"?: boolean,"is_visible"?: boolean,"length"?: Database["public"]['Enums']["nail_length"] | null,"name": string,"name_i18n"?: NonNullable<Json>,"price_addon"?: number,"prompt_text"?: string | null,"salon_id": string,"shape"?: Database["public"]['Enums']["nail_shape"] | null,"slug": string,"sort_order"?: number,"tags"?: (string)[],"tryon_count"?: number,"updated_at"?: string
                  }
                  Update: {
                    "booking_count"?: number,"category"?: Database["public"]['Enums']["design_category"],"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"duration_addon_min"?: number,"id"?: string,"is_featured"?: boolean,"is_visible"?: boolean,"length"?: Database["public"]['Enums']["nail_length"] | null,"name"?: string,"name_i18n"?: NonNullable<Json>,"price_addon"?: number,"prompt_text"?: string | null,"salon_id"?: string,"shape"?: Database["public"]['Enums']["nail_shape"] | null,"slug"?: string,"sort_order"?: number,"tags"?: (string)[],"tryon_count"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "designs_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_flags": {
                  Row: {
                    "description": string | null,"enabled": boolean,"key": string,"rules": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "description"?: string | null,"enabled"?: boolean,"key": string,"rules"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string | null,"enabled"?: boolean,"key"?: string,"rules"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"impersonation_sessions": {
                  Row: {
                    "admin_id": string,"ended_at": string | null,"expires_at": string,"id": string,"reason": string | null,"salon_id": string,"started_at": string
                  }
                  Insert: {
                    "admin_id": string,"ended_at"?: string | null,"expires_at"?: string,"id"?: string,"reason"?: string | null,"salon_id": string,"started_at"?: string
                  }
                  Update: {
                    "admin_id"?: string,"ended_at"?: string | null,"expires_at"?: string,"id"?: string,"reason"?: string | null,"salon_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "impersonation_sessions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "impersonation_sessions_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"currency": string,"due_at": string,"id": string,"line_items": NonNullable<Json>,"notes": string | null,"number": string,"paid_at": string | null,"pdf_path": string | null,"period_end": string | null,"period_start": string | null,"salon_id": string,"status": Database["public"]['Enums']["invoice_status"],"subscription_id": string | null,"subtotal": number,"tax": number,"total": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"due_at"?: string,"id"?: string,"line_items"?: NonNullable<Json>,"notes"?: string | null,"number"?: string,"paid_at"?: string | null,"pdf_path"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"salon_id": string,"status"?: Database["public"]['Enums']["invoice_status"],"subscription_id"?: string | null,"subtotal"?: number,"tax"?: number,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"due_at"?: string,"id"?: string,"line_items"?: NonNullable<Json>,"notes"?: string | null,"number"?: string,"paid_at"?: string | null,"pdf_path"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"salon_id"?: string,"status"?: Database["public"]['Enums']["invoice_status"],"subscription_id"?: string | null,"subtotal"?: number,"tax"?: number,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "created_at": string,"design_id": string | null,"full_name": string | null,"id": string,"notes": string | null,"phone": string | null,"salon_id": string,"status": Database["public"]['Enums']["lead_status"],"tryon_job_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"design_id"?: string | null,"full_name"?: string | null,"id"?: string,"notes"?: string | null,"phone"?: string | null,"salon_id": string,"status"?: Database["public"]['Enums']["lead_status"],"tryon_job_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"design_id"?: string | null,"full_name"?: string | null,"id"?: string,"notes"?: string | null,"phone"?: string | null,"salon_id"?: string,"status"?: Database["public"]['Enums']["lead_status"],"tryon_job_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_tryon_job_fk"
      columns: ["tryon_job_id"]
isOneToOne: false
      referencedRelation: "tryon_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_queue": {
                  Row: {
                    "created_at": string,"id": string,"image_path": string | null,"kind": Database["public"]['Enums']["moderation_kind"],"reason": string | null,"ref_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"salon_id": string | null,"status": Database["public"]['Enums']["moderation_status"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"kind": Database["public"]['Enums']["moderation_kind"],"reason"?: string | null,"ref_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"salon_id"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"kind"?: Database["public"]['Enums']["moderation_kind"],"reason"?: string | null,"ref_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"salon_id"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_queue_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_queue_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"booking_id": string | null,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"delivered_at": string | null,"error": string | null,"id": string,"kind": Database["public"]['Enums']["notification_kind"],"locale": Database["public"]['Enums']["app_locale"],"payload": NonNullable<Json>,"provider_ref": string | null,"recipient": string,"salon_id": string | null,"scheduled_for": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"]
                  }
                  Insert: {
                    "attempts"?: number,"booking_id"?: string | null,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"delivered_at"?: string | null,"error"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["notification_kind"],"locale"?: Database["public"]['Enums']["app_locale"],"payload"?: NonNullable<Json>,"provider_ref"?: string | null,"recipient": string,"salon_id"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"]
                  }
                  Update: {
                    "attempts"?: number,"booking_id"?: string | null,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"delivered_at"?: string | null,"error"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"locale"?: Database["public"]['Enums']["app_locale"],"payload"?: NonNullable<Json>,"provider_ref"?: string | null,"recipient"?: string,"salon_id"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"booking_id": string | null,"created_at": string,"currency": string,"id": string,"invoice_id": string | null,"marked_by": string | null,"metadata": NonNullable<Json>,"method": Database["public"]['Enums']["payment_method"],"provider": string,"provider_ref": string | null,"provider_session_id": string | null,"purpose": Database["public"]['Enums']["payment_purpose"],"reference_note": string | null,"salon_id": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  Insert: {
                    "amount": number,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"invoice_id"?: string | null,"marked_by"?: string | null,"metadata"?: NonNullable<Json>,"method": Database["public"]['Enums']["payment_method"],"provider": string,"provider_ref"?: string | null,"provider_session_id"?: string | null,"purpose": Database["public"]['Enums']["payment_purpose"],"reference_note"?: string | null,"salon_id": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"invoice_id"?: string | null,"marked_by"?: string | null,"metadata"?: NonNullable<Json>,"method"?: Database["public"]['Enums']["payment_method"],"provider"?: string,"provider_ref"?: string | null,"provider_session_id"?: string | null,"purpose"?: Database["public"]['Enums']["payment_purpose"],"reference_note"?: string | null,"salon_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "ai_quota_monthly": number,"code": Database["public"]['Enums']["plan_code"],"directory_priority": number,"features": NonNullable<Json>,"is_active": boolean,"name": string,"price_usd": number,"remove_branding": boolean,"staff_seats": number,"trial_days": number
                  }
                  Insert: {
                    "ai_quota_monthly": number,"code": Database["public"]['Enums']["plan_code"],"directory_priority"?: number,"features"?: NonNullable<Json>,"is_active"?: boolean,"name": string,"price_usd": number,"remove_branding"?: boolean,"staff_seats": number,"trial_days"?: number
                  }
                  Update: {
                    "ai_quota_monthly"?: number,"code"?: Database["public"]['Enums']["plan_code"],"directory_priority"?: number,"features"?: NonNullable<Json>,"is_active"?: boolean,"name"?: string,"price_usd"?: number,"remove_branding"?: boolean,"staff_seats"?: number,"trial_days"?: number
                  }
                  Relationships: [
                    
                  ]
                },"polishes": {
                  Row: {
                    "brand": string,"collection": string | null,"created_at": string,"finish": Database["public"]['Enums']["polish_finish"],"hex_color": string,"hex_color_auto": string | null,"id": string,"in_stock": boolean,"salon_id": string,"shade_code": string | null,"shade_name": string,"sort_order": number,"swatch_path": string | null,"updated_at": string
                  }
                  Insert: {
                    "brand": string,"collection"?: string | null,"created_at"?: string,"finish"?: Database["public"]['Enums']["polish_finish"],"hex_color": string,"hex_color_auto"?: string | null,"id"?: string,"in_stock"?: boolean,"salon_id": string,"shade_code"?: string | null,"shade_name": string,"sort_order"?: number,"swatch_path"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string,"collection"?: string | null,"created_at"?: string,"finish"?: Database["public"]['Enums']["polish_finish"],"hex_color"?: string,"hex_color_auto"?: string | null,"id"?: string,"in_stock"?: boolean,"salon_id"?: string,"shade_code"?: string | null,"shade_name"?: string,"sort_order"?: number,"swatch_path"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polishes_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"is_platform_admin": boolean,"phone": string | null,"preferred_locale": Database["public"]['Enums']["app_locale"],"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"is_platform_admin"?: boolean,"phone"?: string | null,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"is_platform_admin"?: boolean,"phone"?: string | null,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quota_topups": {
                  Row: {
                    "created_at": string,"credits": number,"expires_at": string | null,"id": string,"payment_id": string | null,"salon_id": string
                  }
                  Insert: {
                    "created_at"?: string,"credits": number,"expires_at"?: string | null,"id"?: string,"payment_id"?: string | null,"salon_id": string
                  }
                  Update: {
                    "created_at"?: string,"credits"?: number,"expires_at"?: string | null,"id"?: string,"payment_id"?: string | null,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quota_topups_payment_fk"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quota_topups_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string | null,"booking_id": string,"client_id": string,"created_at": string,"flagged_reason": string | null,"id": string,"photo_paths": (string)[],"rating": number,"replied_at": string | null,"salon_id": string,"salon_reply": string | null,"status": Database["public"]['Enums']["moderation_status"],"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "body"?: string | null,"booking_id": string,"client_id": string,"created_at"?: string,"flagged_reason"?: string | null,"id"?: string,"photo_paths"?: (string)[],"rating": number,"replied_at"?: string | null,"salon_id": string,"salon_reply"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"booking_id"?: string,"client_id"?: string,"created_at"?: string,"flagged_reason"?: string | null,"id"?: string,"photo_paths"?: (string)[],"rating"?: number,"replied_at"?: string | null,"salon_id"?: string,"salon_reply"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"salon_holidays": {
                  Row: {
                    "date": string,"id": string,"name": string | null,"salon_id": string
                  }
                  Insert: {
                    "date": string,"id"?: string,"name"?: string | null,"salon_id": string
                  }
                  Update: {
                    "date"?: string,"id"?: string,"name"?: string | null,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_holidays_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"salon_hours": {
                  Row: {
                    "close_time": string | null,"is_closed": boolean,"open_time": string | null,"salon_id": string,"weekday": number
                  }
                  Insert: {
                    "close_time"?: string | null,"is_closed"?: boolean,"open_time"?: string | null,"salon_id": string,"weekday": number
                  }
                  Update: {
                    "close_time"?: string | null,"is_closed"?: boolean,"open_time"?: string | null,"salon_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_hours_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"salon_members": {
                  Row: {
                    "created_at": string,"invited_by": string | null,"permissions": NonNullable<Json>,"role": Database["public"]['Enums']["salon_member_role"],"salon_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"invited_by"?: string | null,"permissions"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["salon_member_role"],"salon_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"invited_by"?: string | null,"permissions"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["salon_member_role"],"salon_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salon_members_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salon_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"salon_notification_templates": {
                  Row: {
                    "body": string,"kind": Database["public"]['Enums']["notification_kind"],"locale": Database["public"]['Enums']["app_locale"],"salon_id": string
                  }
                  Insert: {
                    "body": string,"kind": Database["public"]['Enums']["notification_kind"],"locale": Database["public"]['Enums']["app_locale"],"salon_id": string
                  }
                  Update: {
                    "body"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"locale"?: Database["public"]['Enums']["app_locale"],"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_notification_templates_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"salons": {
                  Row: {
                    "address": string | null,"area": string | null,"booking_mode": Database["public"]['Enums']["booking_mode"],"brand_color": string,"cancel_cutoff_hours": number,"city": string | null,"country": string,"cover_path": string | null,"created_at": string,"currency": string,"default_locale": Database["public"]['Enums']["app_locale"],"deposit_amount": number,"deposit_required": boolean,"description": string | null,"description_i18n": NonNullable<Json>,"directory_approved": boolean,"email": string | null,"gallery_paths": (string)[],"id": string,"instagram": string | null,"languages": (Database["public"]['Enums']["app_locale"])[],"lat": number | null,"lng": number | null,"logo_path": string | null,"max_advance_days": number,"min_lead_time_min": number,"name": string,"onboarding_completed_at": string | null,"onboarding_step": number,"owner_id": string,"phone": string | null,"rating_avg": number,"rating_count": number,"remove_branding": boolean,"reschedule_cutoff_hours": number,"settings": NonNullable<Json>,"slot_interval_min": number,"slug": string,"status": Database["public"]['Enums']["salon_status"],"timezone": string,"updated_at": string,"website": string | null,"whatsapp_number": string | null
                  }
                  Insert: {
                    "address"?: string | null,"area"?: string | null,"booking_mode"?: Database["public"]['Enums']["booking_mode"],"brand_color"?: string,"cancel_cutoff_hours"?: number,"city"?: string | null,"country"?: string,"cover_path"?: string | null,"created_at"?: string,"currency"?: string,"default_locale"?: Database["public"]['Enums']["app_locale"],"deposit_amount"?: number,"deposit_required"?: boolean,"description"?: string | null,"description_i18n"?: NonNullable<Json>,"directory_approved"?: boolean,"email"?: string | null,"gallery_paths"?: (string)[],"id"?: string,"instagram"?: string | null,"languages"?: (Database["public"]['Enums']["app_locale"])[],"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"max_advance_days"?: number,"min_lead_time_min"?: number,"name": string,"onboarding_completed_at"?: string | null,"onboarding_step"?: number,"owner_id": string,"phone"?: string | null,"rating_avg"?: number,"rating_count"?: number,"remove_branding"?: boolean,"reschedule_cutoff_hours"?: number,"settings"?: NonNullable<Json>,"slot_interval_min"?: number,"slug": string,"status"?: Database["public"]['Enums']["salon_status"],"timezone"?: string,"updated_at"?: string,"website"?: string | null,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"area"?: string | null,"booking_mode"?: Database["public"]['Enums']["booking_mode"],"brand_color"?: string,"cancel_cutoff_hours"?: number,"city"?: string | null,"country"?: string,"cover_path"?: string | null,"created_at"?: string,"currency"?: string,"default_locale"?: Database["public"]['Enums']["app_locale"],"deposit_amount"?: number,"deposit_required"?: boolean,"description"?: string | null,"description_i18n"?: NonNullable<Json>,"directory_approved"?: boolean,"email"?: string | null,"gallery_paths"?: (string)[],"id"?: string,"instagram"?: string | null,"languages"?: (Database["public"]['Enums']["app_locale"])[],"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"max_advance_days"?: number,"min_lead_time_min"?: number,"name"?: string,"onboarding_completed_at"?: string | null,"onboarding_step"?: number,"owner_id"?: string,"phone"?: string | null,"rating_avg"?: number,"rating_count"?: number,"remove_branding"?: boolean,"reschedule_cutoff_hours"?: number,"settings"?: NonNullable<Json>,"slot_interval_min"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["salon_status"],"timezone"?: string,"updated_at"?: string,"website"?: string | null,"whatsapp_number"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "salons_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_looks": {
                  Row: {
                    "created_at": string,"design_id": string | null,"id": string,"image_path": string,"job_id": string | null,"polish_id": string | null,"salon_id": string | null,"title": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"design_id"?: string | null,"id"?: string,"image_path": string,"job_id"?: string | null,"polish_id"?: string | null,"salon_id"?: string | null,"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"design_id"?: string | null,"id"?: string,"image_path"?: string,"job_id"?: string | null,"polish_id"?: string | null,"salon_id"?: string | null,"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_looks_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_looks_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "tryon_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_looks_polish_id_fkey"
      columns: ["polish_id"]
isOneToOne: false
      referencedRelation: "polishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_looks_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_looks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "buffer_min": number,"category": Database["public"]['Enums']["service_category"],"created_at": string,"description": string | null,"duration_min": number,"id": string,"is_active": boolean,"name": string,"name_i18n": NonNullable<Json>,"price": number,"salon_id": string,"sort_order": number,"supports_tryon": boolean,"updated_at": string
                  }
                  Insert: {
                    "buffer_min"?: number,"category"?: Database["public"]['Enums']["service_category"],"created_at"?: string,"description"?: string | null,"duration_min": number,"id"?: string,"is_active"?: boolean,"name": string,"name_i18n"?: NonNullable<Json>,"price": number,"salon_id": string,"sort_order"?: number,"supports_tryon"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "buffer_min"?: number,"category"?: Database["public"]['Enums']["service_category"],"created_at"?: string,"description"?: string | null,"duration_min"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"name_i18n"?: NonNullable<Json>,"price"?: number,"salon_id"?: string,"sort_order"?: number,"supports_tryon"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "accepts_online_booking": boolean,"avatar_path": string | null,"bio": string | null,"color": string,"created_at": string,"display_name": string,"id": string,"is_active": boolean,"salon_id": string,"sort_order": number,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "accepts_online_booking"?: boolean,"avatar_path"?: string | null,"bio"?: string | null,"color"?: string,"created_at"?: string,"display_name": string,"id"?: string,"is_active"?: boolean,"salon_id": string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "accepts_online_booking"?: boolean,"avatar_path"?: string | null,"bio"?: string | null,"color"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"salon_id"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_schedule_rules": {
                  Row: {
                    "end_time": string,"id": string,"kind": Database["public"]['Enums']["schedule_rule_kind"],"staff_id": string,"start_time": string,"weekday": number
                  }
                  Insert: {
                    "end_time": string,"id"?: string,"kind"?: Database["public"]['Enums']["schedule_rule_kind"],"staff_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["schedule_rule_kind"],"staff_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_schedule_rules_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_services": {
                  Row: {
                    "service_id": string,"staff_id": string
                  }
                  Insert: {
                    "service_id": string,"staff_id": string
                  }
                  Update: {
                    "service_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_services_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_time_off": {
                  Row: {
                    "ends_at": string,"id": string,"reason": string | null,"staff_id": string,"starts_at": string
                  }
                  Insert: {
                    "ends_at": string,"id"?: string,"reason"?: string | null,"staff_id": string,"starts_at": string
                  }
                  Update: {
                    "ends_at"?: string,"id"?: string,"reason"?: string | null,"staff_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_time_off_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"created_at": string,"current_period_end": string,"current_period_start": string,"downgrade_to": Database["public"]['Enums']["plan_code"],"grace_days": number,"grace_ends_at": string | null,"id": string,"plan_code": Database["public"]['Enums']["plan_code"],"salon_id": string,"status": Database["public"]['Enums']["subscription_status"],"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string,"current_period_start"?: string,"downgrade_to"?: Database["public"]['Enums']["plan_code"],"grace_days"?: number,"grace_ends_at"?: string | null,"id"?: string,"plan_code"?: Database["public"]['Enums']["plan_code"],"salon_id": string,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string,"current_period_start"?: string,"downgrade_to"?: Database["public"]['Enums']["plan_code"],"grace_days"?: number,"grace_ends_at"?: string | null,"id"?: string,"plan_code"?: Database["public"]['Enums']["plan_code"],"salon_id"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: true
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"tryon_jobs": {
                  Row: {
                    "anon_id": string | null,"attempts": number,"cache_key": string,"cached_from_job_id": string | null,"cost_usd": number,"created_at": string,"design_id": string | null,"duration_ms": number | null,"error_code": string | null,"error_message": string | null,"expires_at": string,"id": string,"input_hash": string,"input_path": string,"is_saved": boolean,"locale": Database["public"]['Enums']["app_locale"],"mask_path": string | null,"params": NonNullable<Json>,"polish_id": string | null,"progress": number,"prompt": string | null,"provider": Database["public"]['Enums']["ai_provider"] | null,"provider_job_id": string | null,"provider_model": string | null,"result_paths": (string)[],"salon_id": string | null,"session_id": string | null,"status": Database["public"]['Enums']["tryon_job_status"],"updated_at": string,"user_id": string | null,"variations": number
                  }
                  Insert: {
                    "anon_id"?: string | null,"attempts"?: number,"cache_key": string,"cached_from_job_id"?: string | null,"cost_usd"?: number,"created_at"?: string,"design_id"?: string | null,"duration_ms"?: number | null,"error_code"?: string | null,"error_message"?: string | null,"expires_at"?: string,"id"?: string,"input_hash": string,"input_path": string,"is_saved"?: boolean,"locale"?: Database["public"]['Enums']["app_locale"],"mask_path"?: string | null,"params"?: NonNullable<Json>,"polish_id"?: string | null,"progress"?: number,"prompt"?: string | null,"provider"?: Database["public"]['Enums']["ai_provider"] | null,"provider_job_id"?: string | null,"provider_model"?: string | null,"result_paths"?: (string)[],"salon_id"?: string | null,"session_id"?: string | null,"status"?: Database["public"]['Enums']["tryon_job_status"],"updated_at"?: string,"user_id"?: string | null,"variations"?: number
                  }
                  Update: {
                    "anon_id"?: string | null,"attempts"?: number,"cache_key"?: string,"cached_from_job_id"?: string | null,"cost_usd"?: number,"created_at"?: string,"design_id"?: string | null,"duration_ms"?: number | null,"error_code"?: string | null,"error_message"?: string | null,"expires_at"?: string,"id"?: string,"input_hash"?: string,"input_path"?: string,"is_saved"?: boolean,"locale"?: Database["public"]['Enums']["app_locale"],"mask_path"?: string | null,"params"?: NonNullable<Json>,"polish_id"?: string | null,"progress"?: number,"prompt"?: string | null,"provider"?: Database["public"]['Enums']["ai_provider"] | null,"provider_job_id"?: string | null,"provider_model"?: string | null,"result_paths"?: (string)[],"salon_id"?: string | null,"session_id"?: string | null,"status"?: Database["public"]['Enums']["tryon_job_status"],"updated_at"?: string,"user_id"?: string | null,"variations"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tryon_jobs_cached_from_job_id_fkey"
      columns: ["cached_from_job_id"]
isOneToOne: false
      referencedRelation: "tryon_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_jobs_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_jobs_polish_id_fkey"
      columns: ["polish_id"]
isOneToOne: false
      referencedRelation: "polishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_jobs_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_jobs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "tryon_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tryon_sessions": {
                  Row: {
                    "anon_id": string | null,"created_at": string,"design_id": string | null,"device": NonNullable<Json>,"id": string,"mode": Database["public"]['Enums']["tryon_mode"],"polish_id": string | null,"salon_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "anon_id"?: string | null,"created_at"?: string,"design_id"?: string | null,"device"?: NonNullable<Json>,"id"?: string,"mode": Database["public"]['Enums']["tryon_mode"],"polish_id"?: string | null,"salon_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "anon_id"?: string | null,"created_at"?: string,"design_id"?: string | null,"device"?: NonNullable<Json>,"id"?: string,"mode"?: Database["public"]['Enums']["tryon_mode"],"polish_id"?: string | null,"salon_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tryon_sessions_design_id_fkey"
      columns: ["design_id"]
isOneToOne: false
      referencedRelation: "designs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_sessions_polish_id_fkey"
      columns: ["polish_id"]
isOneToOne: false
      referencedRelation: "polishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_sessions_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tryon_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_change_plan":
{ Args: { "p_plan": Database["public"]['Enums']["plan_code"],"p_reason"?: string,"p_salon_id": string }; Returns: {
              "cancel_at_period_end": boolean,
"created_at": string,
"current_period_end": string,
"current_period_start": string,
"downgrade_to": Database["public"]['Enums']["plan_code"],
"grace_days": number,
"grace_ends_at": string | null,
"id": string,
"plan_code": Database["public"]['Enums']["plan_code"],
"salon_id": string,
"status": Database["public"]['Enums']["subscription_status"],
"trial_ends_at": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "subscriptions"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_salon_status":
{ Args: { "p_directory_approved"?: boolean,"p_reason"?: string,"p_salon_id": string,"p_status": Database["public"]['Enums']["salon_status"] }; Returns: {
              "address": string | null,
"area": string | null,
"booking_mode": Database["public"]['Enums']["booking_mode"],
"brand_color": string,
"cancel_cutoff_hours": number,
"city": string | null,
"country": string,
"cover_path": string | null,
"created_at": string,
"currency": string,
"default_locale": Database["public"]['Enums']["app_locale"],
"deposit_amount": number,
"deposit_required": boolean,
"description": string | null,
"description_i18n": NonNullable<Json>,
"directory_approved": boolean,
"email": string | null,
"gallery_paths": (string)[],
"id": string,
"instagram": string | null,
"languages": (Database["public"]['Enums']["app_locale"])[],
"lat": number | null,
"lng": number | null,
"logo_path": string | null,
"max_advance_days": number,
"min_lead_time_min": number,
"name": string,
"onboarding_completed_at": string | null,
"onboarding_step": number,
"owner_id": string,
"phone": string | null,
"rating_avg": number,
"rating_count": number,
"remove_branding": boolean,
"reschedule_cutoff_hours": number,
"settings": NonNullable<Json>,
"slot_interval_min": number,
"slug": string,
"status": Database["public"]['Enums']["salon_status"],
"timezone": string,
"updated_at": string,
"website": string | null,
"whatsapp_number": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "salons"
        isOneToOne: true
        isSetofReturn: false
      } },
"book_slot":
{ Args: { "p_client_name": string,"p_client_notes"?: string,"p_client_phone": string,"p_client_user_id"?: string,"p_design_id"?: string,"p_locale"?: Database["public"]['Enums']["app_locale"],"p_salon_id": string,"p_service_id": string,"p_source"?: Database["public"]['Enums']["booking_source"],"p_staff_id": string,"p_starts_at": string,"p_tryon_job_id"?: string }; Returns: {
              "cancel_reason": string | null,
"cancelled_by": string | null,
"client_id": string,
"client_notes": string | null,
"created_at": string,
"created_by": string | null,
"currency": string,
"deposit_amount": number,
"deposit_payment_id": string | null,
"design_id": string | null,
"design_price": number,
"ends_at": string,
"id": string,
"locale": Database["public"]['Enums']["app_locale"],
"manage_token": string,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"salon_id": string,
"service_id": string,
"service_price": number,
"source": Database["public"]['Enums']["booking_source"],
"staff_id": string,
"staff_notes": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"total_price": number,
"tryon_image_path": string | null,
"tryon_job_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"booking_by_token":
{ Args: { "p_token": string }; Returns: {
              "cancel_cutoff_hours": number,"client_name": string,"currency": string,"design_id": string,"design_name": string,"ends_at": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"reschedule_cutoff_hours": number,"salon_id": string,"salon_name": string,"salon_slug": string,"service_id": string,"service_name": string,"staff_id": string,"staff_name": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"total_price": number
            }[]
                           },
"call_internal":
{ Args: { "p_body"?: Json,"p_path": string }; Returns: number
                           },
"cancel_booking_by_token":
{ Args: { "p_reason"?: string,"p_token": string }; Returns: {
              "cancel_reason": string | null,
"cancelled_by": string | null,
"client_id": string,
"client_notes": string | null,
"created_at": string,
"created_by": string | null,
"currency": string,
"deposit_amount": number,
"deposit_payment_id": string | null,
"design_id": string | null,
"design_price": number,
"ends_at": string,
"id": string,
"locale": Database["public"]['Enums']["app_locale"],
"manage_token": string,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"salon_id": string,
"service_id": string,
"service_price": number,
"source": Database["public"]['Enums']["booking_source"],
"staff_id": string,
"staff_notes": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"total_price": number,
"tryon_image_path": string | null,
"tryon_job_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_salon":
{ Args: { "p_brand_color"?: string,"p_city"?: string,"p_default_locale"?: Database["public"]['Enums']["app_locale"],"p_name": string,"p_slug": string }; Returns: {
              "address": string | null,
"area": string | null,
"booking_mode": Database["public"]['Enums']["booking_mode"],
"brand_color": string,
"cancel_cutoff_hours": number,
"city": string | null,
"country": string,
"cover_path": string | null,
"created_at": string,
"currency": string,
"default_locale": Database["public"]['Enums']["app_locale"],
"deposit_amount": number,
"deposit_required": boolean,
"description": string | null,
"description_i18n": NonNullable<Json>,
"directory_approved": boolean,
"email": string | null,
"gallery_paths": (string)[],
"id": string,
"instagram": string | null,
"languages": (Database["public"]['Enums']["app_locale"])[],
"lat": number | null,
"lng": number | null,
"logo_path": string | null,
"max_advance_days": number,
"min_lead_time_min": number,
"name": string,
"onboarding_completed_at": string | null,
"onboarding_step": number,
"owner_id": string,
"phone": string | null,
"rating_avg": number,
"rating_count": number,
"remove_branding": boolean,
"reschedule_cutoff_hours": number,
"settings": NonNullable<Json>,
"slot_interval_min": number,
"slug": string,
"status": Database["public"]['Enums']["salon_status"],
"timezone": string,
"updated_at": string,
"website": string | null,
"whatsapp_number": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "salons"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_phone":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"increment_design_tryon":
{ Args: { "p_design_id": string }; Returns: undefined
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_salon_manager":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"is_salon_member":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"is_salon_owner":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"my_staff_id":
{ Args: { "p_salon_id": string }; Returns: string
                           },
"reschedule_booking_by_token":
{ Args: { "p_starts_at": string,"p_token": string }; Returns: {
              "cancel_reason": string | null,
"cancelled_by": string | null,
"client_id": string,
"client_notes": string | null,
"created_at": string,
"created_by": string | null,
"currency": string,
"deposit_amount": number,
"deposit_payment_id": string | null,
"design_id": string | null,
"design_price": number,
"ends_at": string,
"id": string,
"locale": Database["public"]['Enums']["app_locale"],
"manage_token": string,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"salon_id": string,
"service_id": string,
"service_price": number,
"source": Database["public"]['Enums']["booking_source"],
"staff_id": string,
"staff_notes": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"total_price": number,
"tryon_image_path": string | null,
"tryon_job_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"reserve_ai_credit":
{ Args: { "p_job_id": string,"p_salon_id": string }; Returns: Json
                           },
"run_billing_lifecycle":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"salon_ai_quota":
{ Args: { "p_salon_id": string }; Returns: {
              "period_end": string,"period_start": string,"plan_code": Database["public"]['Enums']["plan_code"],"quota": number,"remaining": number,"subscription_status": Database["public"]['Enums']["subscription_status"],"topup_credits": number,"used": number
            }[]
                           },
"salon_analytics_summary":
{ Args: { "p_from": string,"p_salon_id": string,"p_to": string }; Returns: Json
                           },
"salon_is_public":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"salon_role":
{ Args: { "p_salon_id": string }; Returns: Database["public"]['Enums']["salon_member_role"]
                           },
"schedule_booking_reminders":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"slugify":
{ Args: { "input": string }; Returns: string
                           },
"staff_is_available":
{ Args: { "p_end": string,"p_staff_id": string,"p_start": string }; Returns: boolean
                           }
          }
          Enums: {
            "ai_provider": "fal"|"replicate"|"cache","analytics_event_kind": "page_view"|"tryon_ar_start"|"tryon_ar_capture"|"tryon_ai_request"|"tryon_ai_success"|"tryon_ai_failed"|"book_click"|"booking_created"|"share"|"qr_scan"|"whatsapp_click","app_locale": "ar"|"en"|"fr","booking_mode": "instant"|"approval","booking_source": "tryon"|"direct"|"rebook"|"dashboard","booking_status": "new"|"confirmed"|"completed"|"no_show"|"cancelled","design_category": "french"|"chrome"|"ombre"|"art_3d"|"minimal"|"bridal"|"seasonal","invoice_status": "draft"|"open"|"paid"|"void"|"uncollectible","lead_status": "new"|"contacted"|"converted"|"lost","moderation_kind": "review"|"upload"|"design","moderation_status": "pending"|"approved"|"rejected","nail_length": "short"|"medium"|"long","nail_shape": "square"|"squoval"|"round"|"almond"|"coffin"|"stiletto","notification_channel": "whatsapp"|"sms"|"email","notification_kind": "booking_confirmation"|"booking_pending"|"booking_approved"|"booking_reminder_24h"|"booking_reminder_2h"|"booking_rescheduled"|"booking_cancelled"|"salon_new_booking"|"salon_invoice"|"salon_quota_warning","notification_status": "queued"|"sent"|"delivered"|"failed"|"cancelled","payment_method": "card"|"cash"|"whish"|"omt"|"bank_transfer","payment_purpose": "subscription"|"topup"|"deposit","payment_status": "pending"|"paid"|"failed"|"refunded","plan_code": "trial"|"basic"|"pro","polish_finish": "glossy"|"matte"|"chrome"|"cat_eye"|"glitter"|"shimmer"|"french_tip","salon_member_role": "owner"|"manager"|"staff","salon_status": "pending"|"active"|"suspended","schedule_rule_kind": "work"|"break","service_category": "gel"|"acrylic"|"biab"|"extensions"|"removal"|"manicure"|"pedicure"|"nail_art"|"other","subscription_status": "trialing"|"active"|"past_due"|"grace"|"cancelled"|"expired","tryon_job_status": "queued"|"moderating"|"validating"|"masking"|"generating"|"succeeded"|"failed"|"rejected","tryon_mode": "ar"|"ai"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "ai_provider": ["fal", "replicate", "cache"],"analytics_event_kind": ["page_view", "tryon_ar_start", "tryon_ar_capture", "tryon_ai_request", "tryon_ai_success", "tryon_ai_failed", "book_click", "booking_created", "share", "qr_scan", "whatsapp_click"],"app_locale": ["ar", "en", "fr"],"booking_mode": ["instant", "approval"],"booking_source": ["tryon", "direct", "rebook", "dashboard"],"booking_status": ["new", "confirmed", "completed", "no_show", "cancelled"],"design_category": ["french", "chrome", "ombre", "art_3d", "minimal", "bridal", "seasonal"],"invoice_status": ["draft", "open", "paid", "void", "uncollectible"],"lead_status": ["new", "contacted", "converted", "lost"],"moderation_kind": ["review", "upload", "design"],"moderation_status": ["pending", "approved", "rejected"],"nail_length": ["short", "medium", "long"],"nail_shape": ["square", "squoval", "round", "almond", "coffin", "stiletto"],"notification_channel": ["whatsapp", "sms", "email"],"notification_kind": ["booking_confirmation", "booking_pending", "booking_approved", "booking_reminder_24h", "booking_reminder_2h", "booking_rescheduled", "booking_cancelled", "salon_new_booking", "salon_invoice", "salon_quota_warning"],"notification_status": ["queued", "sent", "delivered", "failed", "cancelled"],"payment_method": ["card", "cash", "whish", "omt", "bank_transfer"],"payment_purpose": ["subscription", "topup", "deposit"],"payment_status": ["pending", "paid", "failed", "refunded"],"plan_code": ["trial", "basic", "pro"],"polish_finish": ["glossy", "matte", "chrome", "cat_eye", "glitter", "shimmer", "french_tip"],"salon_member_role": ["owner", "manager", "staff"],"salon_status": ["pending", "active", "suspended"],"schedule_rule_kind": ["work", "break"],"service_category": ["gel", "acrylic", "biab", "extensions", "removal", "manicure", "pedicure", "nail_art", "other"],"subscription_status": ["trialing", "active", "past_due", "grace", "cancelled", "expired"],"tryon_job_status": ["queued", "moderating", "validating", "masking", "generating", "succeeded", "failed", "rejected"],"tryon_mode": ["ar", "ai"]
          }
        }
} as const

