// SMS Module Type Definitions for Laravel Worksuite

export interface SmsProvider {
  id: string;
  name: string;
  slug: 'twilio' | 'vonage' | 'aws_sns';
  status: 'active' | 'inactive';
  config: {
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
    region?: string; // For AWS SNS
    accountSid?: string; // For Twilio
  };
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  slug: string;
  content: string;
  variables: string[]; // Array of variable names like ['name', 'company', 'date']
  category: string;
  status: 'active' | 'inactive';
  language: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SmsLog {
  id: string;
  direction: 'outbound' | 'inbound'; // Track both sent and received messages
  recipient?: string; // For outbound messages
  sender?: string; // For inbound messages
  message: string;
  provider: string;
  provider_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired' | 'received';
  error_message?: string;
  template_id?: string;
  template_variables?: Record<string, string>;
  cost?: number;
  currency?: string;
  // Reply/Forward tracking
  parent_message_id?: string; // For replies and forwards
  message_type: 'original' | 'reply' | 'forward';
  // Timestamps
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  received_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SmsContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  groups: string[];
  metadata?: Record<string, any>;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface SmsContactGroup {
  id: string;
  name: string;
  description?: string;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface SmsCampaign {
  id: string;
  name: string;
  template_id: string;
  recipient_groups: string[];
  recipient_contacts: string[];
  template_variables?: Record<string, string>;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SmsSettings {
  default_provider: string;
  enable_fallback: boolean;
  fallback_providers: string[];
  rate_limiting: {
    enabled: boolean;
    max_per_minute: number;
    max_per_hour: number;
  };
  notification_settings: {
    email_on_failure: boolean;
    email_recipients: string[];
  };
  webhook_url?: string;
  webhook_secret?: string;
}

export interface SmsStats {
  total_sent: number;
  total_received: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
  cost_this_month: number;
  cost_last_month: number;
  recent_logs: SmsLog[];
  conversation_stats: {
    active_conversations: number;
    avg_response_time: number;
  };
}

// API Request/Response Types
export interface SendSmsRequest {
  recipient: string;
  message: string;
  template_id?: string;
  template_variables?: Record<string, string>;
  provider?: string;
  scheduled_at?: string;
}

export interface SendBulkSmsRequest {
  recipients: string[];
  message?: string;
  template_id?: string;
  template_variables?: Record<string, string>;
  provider?: string;
  scheduled_at?: string;
  contact_groups?: string[];
}

export interface SmsApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface SmsPaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Provider-specific types
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface VonageConfig {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
}

export interface AwsSnsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

// Webhook payload types
export interface SmsWebhookPayload {
  event: 'sms.sent' | 'sms.delivered' | 'sms.failed';
  log_id: string;
  recipient: string;
  status: string;
  timestamp: string;
  provider: string;
  error_message?: string;
}