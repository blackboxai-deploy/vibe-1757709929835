// SMS Service - Provider Abstraction Layer

import { 
  SmsLog, 
  SendSmsRequest, 
  SendBulkSmsRequest, 
  SmsApiResponse 
} from '@/types/sms';

// Base SMS Provider Interface
export interface ISmsProvider {
  name: string;
  slug: string;
  sendSms(to: string, message: string, from?: string): Promise<SmsProviderResponse>;
  getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus>;
  validateConfig(config: Record<string, any>): boolean;
}

export interface SmsProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  currency?: string;
}

export interface SmsDeliveryStatus {
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';
  updatedAt: string;
  error?: string;
}

class SmsService {
  private providers: Map<string, ISmsProvider> = new Map();
  private defaultProvider: string = 'twilio';
  private enableFallback: boolean = true;
  private fallbackProviders: string[] = ['vonage', 'aws_sns'];

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Dynamic import of providers to avoid dependency issues
    try {
      const { TwilioProvider } = await import('./providers/TwilioProvider');
      const { VonageProvider } = await import('./providers/VonageProvider');
      const { AwsSnsProvider } = await import('./providers/AwsSnsProvider');

      this.providers.set('twilio', new TwilioProvider());
      this.providers.set('vonage', new VonageProvider());
      this.providers.set('aws_sns', new AwsSnsProvider());
    } catch (error) {
      console.error('Failed to initialize SMS providers:', error);
    }
  }

  // Set SMS configuration
  public configure(settings: {
    defaultProvider: string;
    enableFallback: boolean;
    fallbackProviders: string[];
  }) {
    this.defaultProvider = settings.defaultProvider;
    this.enableFallback = settings.enableFallback;
    this.fallbackProviders = settings.fallbackProviders;
  }

  // Send single SMS
  public async sendSms(request: SendSmsRequest): Promise<SmsApiResponse<SmsLog>> {
    const provider = request.provider || this.defaultProvider;
    
    try {
      const smsProvider = this.providers.get(provider);
      if (!smsProvider) {
        throw new Error(`SMS provider '${provider}' not found`);
      }

      // Process template variables if template is used
      let message = request.message;
      if (request.template_id && request.template_variables) {
        message = await this.processTemplate(request.template_id, request.template_variables);
      }

      const result = await smsProvider.sendSms(request.recipient, message);
      
      if (!result.success && this.enableFallback) {
        // Try fallback providers
        for (const fallbackProvider of this.fallbackProviders) {
          if (fallbackProvider !== provider) {
            const fallback = this.providers.get(fallbackProvider);
            if (fallback) {
              const fallbackResult = await fallback.sendSms(request.recipient, message);
              if (fallbackResult.success) {
                return this.createSmsLog({
                  ...request,
                  message,
                  provider: fallbackProvider,
                  result: fallbackResult
                });
              }
            }
          }
        }
      }

      return this.createSmsLog({
        ...request,
        message,
        provider,
        result
      });

    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        message: 'Failed to send SMS',
        errors: { general: [(error as Error).message] }
      };
    }
  }

  // Send bulk SMS
  public async sendBulkSms(request: SendBulkSmsRequest): Promise<SmsApiResponse<{ 
    campaign_id: string; 
    total_recipients: number;
    status: string;
  }>> {
    try {
      const campaignId = this.generateCampaignId();
      let recipients = [...request.recipients];

      // Add contacts from groups if specified
      if (request.contact_groups && request.contact_groups.length > 0) {
        const groupContacts = await this.getContactsFromGroups(request.contact_groups);
        recipients = [...recipients, ...groupContacts];
      }

      // Remove duplicates
      recipients = [...new Set(recipients)];

      // Process template if provided
      let message = request.message;
      if (request.template_id) {
        message = await this.processTemplate(request.template_id, request.template_variables);
      }

      // Queue bulk SMS for background processing
      await this.queueBulkSms({
        campaignId,
        recipients,
        message: message || '',
        provider: request.provider || this.defaultProvider,
        templateId: request.template_id,
        templateVariables: request.template_variables,
        scheduledAt: request.scheduled_at
      });

      return {
        success: true,
        message: `Bulk SMS campaign queued successfully`,
        data: {
          campaign_id: campaignId,
          total_recipients: recipients.length,
          status: request.scheduled_at ? 'scheduled' : 'queued'
        }
      };

    } catch (error) {
      console.error('Bulk SMS failed:', error);
      return {
        success: false,
        message: 'Failed to queue bulk SMS',
        errors: { general: [(error as Error).message] }
      };
    }
  }

  // Process SMS template with variables
  private async processTemplate(templateId: string, variables?: Record<string, string>): Promise<string> {
    try {
      // Simulate template fetching (in real Laravel, this would query the database)
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template with ID '${templateId}' not found`);
      }

      let processedMessage = template.content;

      // Replace variables in template
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          processedMessage = processedMessage.replace(placeholder, value);
        }
      }

      return processedMessage;
    } catch (error) {
      console.error('Template processing failed:', error);
      throw error;
    }
  }

  // Create SMS log entry
  private async createSmsLog(params: {
    recipient: string;
    message: string;
    provider: string;
    template_id?: string;
    template_variables?: Record<string, string>;
    result: SmsProviderResponse;
  }): Promise<SmsApiResponse<SmsLog>> {
    const log: SmsLog = {
      id: this.generateId(),
      direction: 'outbound',
      recipient: params.recipient,
      message: params.message,
      provider: params.provider,
      provider_message_id: params.result.messageId,
      status: params.result.success ? 'sent' : 'failed',
      error_message: params.result.error,
      template_id: params.template_id,
      template_variables: params.template_variables,
      message_type: 'original',
      cost: params.result.cost,
      currency: params.result.currency,
      sent_at: params.result.success ? new Date().toISOString() : undefined,
      failed_at: !params.result.success ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // In real Laravel application, this would save to database
    await this.saveSmsLog(log);

    return {
      success: params.result.success,
      message: params.result.success ? 'SMS sent successfully' : 'SMS sending failed',
      data: log
    };
  }

  // Helper methods (these would interact with Laravel's database/cache in real implementation)
  private generateId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCampaignId(): string {
    return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getTemplate(templateId: string): Promise<{ content: string } | null> {
    // Simulate database query
    const templates: Record<string, { content: string }> = {
      'welcome': { content: 'Welcome {{name}} to {{company}}! Your account is now active.' },
      'verification': { content: 'Your verification code is: {{code}}. Valid for 10 minutes.' },
      'reminder': { content: 'Hi {{name}}, reminder: {{message}}' }
    };
    return templates[templateId] || null;
  }

  private async getContactsFromGroups(_groupIds: string[]): Promise<string[]> {
    // Simulate fetching contacts from groups
    const mockContacts = ['+1234567890', '+0987654321', '+1122334455'];
    return mockContacts;
  }

  private async saveSmsLog(log: SmsLog): Promise<void> {
    // In real Laravel, this would save to database
    console.log('SMS Log saved:', log);
  }

  private async queueBulkSms(params: {
    campaignId: string;
    recipients: string[];
    message: string;
    provider: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
    scheduledAt?: string;
  }): Promise<void> {
    // In real Laravel, this would add to queue (Redis/Database)
    console.log('Bulk SMS queued:', params);
  }

  // Get available providers
  public getAvailableProviders(): Array<{ slug: string; name: string }> {
    const providers = [];
    for (const [slug, provider] of this.providers) {
      providers.push({ slug, name: provider.name });
    }
    return providers;
  }

  // Check provider status
  public async checkProviderHealth(providerSlug: string): Promise<boolean> {
    try {
      const provider = this.providers.get(providerSlug);
      if (!provider) return false;
      
      // Simulate health check (in real implementation, this would ping the provider's API)
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new SmsService();