
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "approval_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"comment": string | null,"created_at": string,"id": string,"invoice_id": string,"ip_address": unknown,"new_status": Database["public"]['Enums']["invoice_status"] | null,"previous_status": Database["public"]['Enums']["invoice_status"] | null,"system_note": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"invoice_id": string,"ip_address"?: unknown,"new_status"?: Database["public"]['Enums']["invoice_status"] | null,"previous_status"?: Database["public"]['Enums']["invoice_status"] | null,"system_note"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"invoice_id"?: string,"ip_address"?: unknown,"new_status"?: Database["public"]['Enums']["invoice_status"] | null,"previous_status"?: Database["public"]['Enums']["invoice_status"] | null,"system_note"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_events_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"line_item_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"line_item_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"line_item_id"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_line_item_id_fkey"
      columns: ["line_item_id"]
isOneToOne: false
      referencedRelation: "line_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"currencies": {
                  Row: {
                    "active": boolean,"code": string,"decimal_places": number,"name": string,"symbol": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"decimal_places": number,"name": string,"symbol": string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"decimal_places"?: number,"name"?: string,"symbol"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exchange_rates": {
                  Row: {
                    "created_at": string,"from_currency": string,"id": string,"rate": number,"rate_date": string,"source": string,"to_currency": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_currency": string,"id"?: string,"rate": number,"rate_date": string,"source": string,"to_currency": string
                  }
                  Update: {
                    "created_at"?: string,"from_currency"?: string,"id"?: string,"rate"?: number,"rate_date"?: string,"source"?: string,"to_currency"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchange_rates_from_currency_fkey"
      columns: ["from_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "exchange_rates_to_currency_fkey"
      columns: ["to_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "approved_at": string | null,"created_at": string,"currency_code": string,"employee_confirmed_at": string | null,"employee_id": string,"employee_reference": string | null,"exchange_rate_to_base": number | null,"id": string,"marked_paid_by": Database["public"]['Enums']["paid_marker"] | null,"month": string,"number": string | null,"paid_at": string | null,"recalled_at": string | null,"rejected_at": string | null,"review_deadline": string | null,"review_started_at": string | null,"status": Database["public"]['Enums']["invoice_status"],"submitted_at": string | null,"subtotal_minor": number,"tax_total_minor": number,"total_minor": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"created_at"?: string,"currency_code": string,"employee_confirmed_at"?: string | null,"employee_id": string,"employee_reference"?: string | null,"exchange_rate_to_base"?: number | null,"id"?: string,"marked_paid_by"?: Database["public"]['Enums']["paid_marker"] | null,"month": string,"number"?: string | null,"paid_at"?: string | null,"recalled_at"?: string | null,"rejected_at"?: string | null,"review_deadline"?: string | null,"review_started_at"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"submitted_at"?: string | null,"subtotal_minor"?: number,"tax_total_minor"?: number,"total_minor"?: number,"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"created_at"?: string,"currency_code"?: string,"employee_confirmed_at"?: string | null,"employee_id"?: string,"employee_reference"?: string | null,"exchange_rate_to_base"?: number | null,"id"?: string,"marked_paid_by"?: Database["public"]['Enums']["paid_marker"] | null,"month"?: string,"number"?: string | null,"paid_at"?: string | null,"recalled_at"?: string | null,"rejected_at"?: string | null,"review_deadline"?: string | null,"review_started_at"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"submitted_at"?: string | null,"subtotal_minor"?: number,"tax_total_minor"?: number,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_currency_code_fkey"
      columns: ["currency_code"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "invoices_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"line_items": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"invoice_id": string,"line_total_minor": number,"line_type_id": string,"position": number,"quantity": number,"rate_minor": number,"tax_minor": number,"tax_rate_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"invoice_id": string,"line_total_minor"?: number,"line_type_id": string,"position"?: number,"quantity"?: number,"rate_minor": number,"tax_minor"?: number,"tax_rate_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"invoice_id"?: string,"line_total_minor"?: number,"line_type_id"?: string,"position"?: number,"quantity"?: number,"rate_minor"?: number,"tax_minor"?: number,"tax_rate_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "line_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "line_items_line_type_id_fkey"
      columns: ["line_type_id"]
isOneToOne: false
      referencedRelation: "line_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "line_items_tax_rate_id_fkey"
      columns: ["tax_rate_id"]
isOneToOne: false
      referencedRelation: "tax_rates"
      referencedColumns: ["id"]
    }
                  ]
                },"line_types": {
                  Row: {
                    "active": boolean,"default_tax_rate_id": string | null,"id": string,"name": string,"receipt_required": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"default_tax_rate_id"?: string | null,"id"?: string,"name": string,"receipt_required"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"default_tax_rate_id"?: string | null,"id"?: string,"name"?: string,"receipt_required"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "line_types_default_tax_rate_id_fkey"
      columns: ["default_tax_rate_id"]
isOneToOne: false
      referencedRelation: "tax_rates"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_logs": {
                  Row: {
                    "error": string | null,"id": string,"invoice_id": string | null,"provider_message_id": string | null,"recipient": string,"sent_at": string,"status": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id"?: string,"invoice_id"?: string | null,"provider_message_id"?: string | null,"recipient": string,"sent_at"?: string,"status": string,"type": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: string,"invoice_id"?: string | null,"provider_message_id"?: string | null,"recipient"?: string,"sent_at"?: string,"status"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_logs_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "actual_exchange_rate": number | null,"amount_received_minor": number | null,"amount_sent_minor": number | null,"confirmed_by_accounts_at": string | null,"created_at": string,"fee_paid_by": Database["public"]['Enums']["wise_fee_payer"] | null,"id": string,"invoice_id": string,"paid_at": string,"received_currency": string | null,"recorded_by": string,"sent_currency": string | null,"wise_fee_minor": number | null,"wise_transfer_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_exchange_rate"?: number | null,"amount_received_minor"?: number | null,"amount_sent_minor"?: number | null,"confirmed_by_accounts_at"?: string | null,"created_at"?: string,"fee_paid_by"?: Database["public"]['Enums']["wise_fee_payer"] | null,"id"?: string,"invoice_id": string,"paid_at"?: string,"received_currency"?: string | null,"recorded_by": string,"sent_currency"?: string | null,"wise_fee_minor"?: number | null,"wise_transfer_id"?: string | null
                  }
                  Update: {
                    "actual_exchange_rate"?: number | null,"amount_received_minor"?: number | null,"amount_sent_minor"?: number | null,"confirmed_by_accounts_at"?: string | null,"created_at"?: string,"fee_paid_by"?: Database["public"]['Enums']["wise_fee_payer"] | null,"id"?: string,"invoice_id"?: string,"paid_at"?: string,"received_currency"?: string | null,"recorded_by"?: string,"sent_currency"?: string | null,"wise_fee_minor"?: number | null,"wise_transfer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_received_currency_fkey"
      columns: ["received_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_sent_currency_fkey"
      columns: ["sent_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "address": string | null,"created_at": string,"default_currency": string | null,"email": string,"employee_code": string | null,"id": string,"joined_on": string | null,"last_invoice_seq": number,"name": string,"nic_or_tin": string | null,"status": Database["public"]['Enums']["user_status"],"timezone": string,"updated_at": string,"wise_recipient_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"default_currency"?: string | null,"email": string,"employee_code"?: string | null,"id": string,"joined_on"?: string | null,"last_invoice_seq"?: number,"name": string,"nic_or_tin"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"timezone"?: string,"updated_at"?: string,"wise_recipient_ref"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"default_currency"?: string | null,"email"?: string,"employee_code"?: string | null,"id"?: string,"joined_on"?: string | null,"last_invoice_seq"?: number,"name"?: string,"nic_or_tin"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"timezone"?: string,"updated_at"?: string,"wise_recipient_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_default_currency_fkey"
      columns: ["default_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"tax_rates": {
                  Row: {
                    "active": boolean,"currency_code": string,"id": string,"label": string,"name": string,"percentage": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"currency_code": string,"id"?: string,"label": string,"name": string,"percentage": number
                  }
                  Update: {
                    "active"?: boolean,"currency_code"?: string,"id"?: string,"label"?: string,"name"?: string,"percentage"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tax_rates_currency_code_fkey"
      columns: ["currency_code"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_user_id_fkey"
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
            "approve_invoices":
{ Args: { "p_invoices": (string)[] }; Returns: number
                           },
"ensure_monthly_draft":
{ Args: { "p_employee"?: string,"p_month"?: string }; Returns: string
                           },
"has_role":
{ Args: { "required": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_invoices_paid":
{ Args: { "p_amount_received_minor"?: number,"p_invoices": (string)[],"p_received_currency"?: string }; Returns: number
                           },
"open_for_review":
{ Args: { "p_invoice": string }; Returns: undefined
                           },
"recall_invoice":
{ Args: { "p_invoice": string }; Returns: undefined
                           },
"reject_invoice":
{ Args: { "p_comment": string,"p_invoice": string }; Returns: undefined
                           },
"submit_invoice":
{ Args: { "p_confirmed": boolean,"p_invoice": string }; Returns: string
                           },
"update_invoice_details":
{ Args: { "p_currency": string,"p_invoice": string,"p_reference": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "employee"|"approver"|"accounts"|"admin","invoice_status": "draft"|"submitted"|"approved"|"rejected"|"paid","paid_marker": "approver"|"employee","user_status": "active"|"inactive","wise_fee_payer": "company"|"deducted"
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
            "app_role": ["employee", "approver", "accounts", "admin"],"invoice_status": ["draft", "submitted", "approved", "rejected", "paid"],"paid_marker": ["approver", "employee"],"user_status": ["active", "inactive"],"wise_fee_payer": ["company", "deducted"]
          }
        }
} as const
