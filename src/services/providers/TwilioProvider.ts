// Twilio SMS Provider Implementation

import { ISmsProvider, SmsProviderResponse, SmsDeliveryStatus } from '../SmsService';

export class TwilioProvider implements ISmsProvider {
  public readonly name = 'Twilio';
  public readonly slug = 'twilio';
  
  private accountSid: string = '';
  private authToken: string = '';
  private fromNumber: string = '';

  constructor(config?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  }) {
    if (config) {
      this.configure(config);
    }
  }

  public configure(config: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  }) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
  }

  public async sendSms(to: string, message: string, from?: string): Promise<SmsProviderResponse> {
    try {
      if (!this.validateConfig({ 
        accountSid: this.accountSid, 
        authToken: this.authToken, 
        fromNumber: this.fromNumber 
      })) {
        throw new Error('Twilio provider not properly configured');
      }

      // Simulate Twilio API call
      // In real implementation, this would use the Twilio SDK:
      // const client = require('twilio')(this.accountSid, this.authToken);
      // const message = await client.messages.create({
      //   body: message,
      //   from: from || this.fromNumber,
      //   to: to
      // });

      const response = await this.mockTwilioApi({
        to,
        from: from || this.fromNumber,
        body: message
      });

      return {
        success: response.status === 'queued' || response.status === 'sent',
        messageId: response.sid,
        cost: response.price ? Math.abs(parseFloat(response.price)) : 0.0075,
        currency: response.priceUnit || 'USD',
        error: response.errorMessage
      };

    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  public async getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus> {
    try {
      // Simulate Twilio status check
      // In real implementation:
      // const client = require('twilio')(this.accountSid, this.authToken);
      // const message = await client.messages(messageId).fetch();

      const statusResponse = await this.mockTwilioStatusCheck(messageId);

      return {
        status: this.mapTwilioStatus(statusResponse.status),
        updatedAt: statusResponse.dateUpdated,
        error: statusResponse.errorMessage
      };

    } catch (error) {
      return {
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  public validateConfig(config: Record<string, any>): boolean {
    return !!(
      config.accountSid && 
      config.authToken && 
      config.fromNumber &&
      config.accountSid.startsWith('AC') &&
      config.fromNumber.match(/^\+?[1-9]\d{1,14}$/)
    );
  }

  // Map Twilio status to our standard status
  private mapTwilioStatus(twilioStatus: string): 'pending' | 'sent' | 'delivered' | 'failed' | 'expired' {
    const statusMap: Record<string, 'pending' | 'sent' | 'delivered' | 'failed' | 'expired'> = {
      'queued': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'failed': 'failed',
      'undelivered': 'failed',
      'expired': 'expired'
    };
    return statusMap[twilioStatus] || 'failed';
  }

  // Mock Twilio API for demonstration
  private async mockTwilioApi(params: {
    to: string;
    from: string;
    body: string;
  }): Promise<{
    sid: string;
    status: string;
    price?: string;
    priceUnit?: string;
    errorMessage?: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate different response scenarios
    const isValidNumber = params.to.match(/^\+?[1-9]\d{1,14}$/);
    const isTestNumber = params.to.includes('555'); // Test numbers might fail

    if (!isValidNumber) {
      return {
        sid: '',
        status: 'failed',
        errorMessage: 'Invalid phone number format'
      };
    }

    if (isTestNumber) {
      return {
        sid: '',
        status: 'failed',
        errorMessage: 'Invalid destination number'
      };
    }

    return {
      sid: `SM${Math.random().toString(36).substr(2, 32)}`,
      status: Math.random() > 0.1 ? 'queued' : 'failed',
      price: '-0.0075',
      priceUnit: 'USD'
    };
  }

  // Mock Twilio status check
  private async mockTwilioStatusCheck(_messageId: string): Promise<{
    status: string;
    dateUpdated: string;
    errorMessage?: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Simulate message progression
    const statuses = ['queued', 'sent', 'delivered'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      status: randomStatus,
      dateUpdated: new Date().toISOString(),
      errorMessage: randomStatus === 'failed' ? 'Message delivery failed' : undefined
    };
  }

  // Health check for Twilio service
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.validateConfig({ 
        accountSid: this.accountSid, 
        authToken: this.authToken, 
        fromNumber: this.fromNumber 
      })) {
        return false;
      }

      // In real implementation, this would make a simple API call to verify credentials
      // const client = require('twilio')(this.accountSid, this.authToken);
      // await client.api.accounts(this.accountSid).fetch();
      
      return true;
    } catch (error) {
      console.error('Twilio health check failed:', error);
      return false;
    }
  }

  // Get pricing information
  public getPricingEstimate(messageLength: number, recipientCount: number = 1): number {
    // Twilio pricing: ~$0.0075 per SMS (160 characters)
    const messagesPerRecipient = Math.ceil(messageLength / 160);
    return messagesPerRecipient * recipientCount * 0.0075;
  }

  // Get provider limits
  public getProviderLimits(): {
    maxMessageLength: number;
    maxRecipientsPerBulk: number;
    rateLimitPerSecond: number;
  } {
    return {
      maxMessageLength: 1600, // 10 SMS segments
      maxRecipientsPerBulk: 1000,
      rateLimitPerSecond: 10
    };
  }
}