import { NextRequest, NextResponse } from 'next/server';

interface DinstarSendRequest {
  recipient: string;
  message: string;
  template_id?: string;
  simPort?: number;
}

interface DinstarConfig {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
  serialNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DinstarSendRequest = await request.json();
    const { recipient, message, template_id, simPort } = body;

    if (!recipient || !message) {
      return NextResponse.json({
        success: false,
        message: 'Recipient and message are required'
      }, { status: 400 });
    }

    // Try to get Dinstar configuration (in real Laravel app, from database)
    let dinstarConfig: DinstarConfig | null = null;
    
    try {
      // For demo purposes, we'll try to get config from a theoretical storage
      // In Laravel, this would be: SmsConfig::where('is_active', true)->first()
      const configResponse = await fetch(`${request.nextUrl.origin}/api/dinstar/get-config`);
      if (configResponse.ok) {
        const configResult = await configResponse.json();
        if (configResult.success) {
          dinstarConfig = configResult.data;
        }
      }
    } catch (error) {
      console.log('No stored config found, will return demo response');
    }

    // If we have real config, use actual Dinstar API
    if (dinstarConfig) {
      try {
        return await sendViaDinstar(dinstarConfig, recipient, message, simPort || 0, template_id);
       } catch (error: any) {
        console.error('Dinstar API error:', error);
        return NextResponse.json({
          success: false,
          message: `Dinstar API error: ${error.message}`,
          data: createErrorLog(recipient, message, simPort, error.message)
        }, { status: 500 });
      }
    }

    // Fallback to demo response
    const success = Math.random() > 0.2; // 80% success rate for demo
    
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      direction: 'outbound' as const,
      recipient: recipient,
      message: message,
      provider: 'dinstar',
      provider_message_id: success ? `dinstar_${Date.now()}` : undefined,
      status: success ? 'sent' as const : 'failed' as const,
      error_message: success ? undefined : 'Dinstar gateway not configured - demo mode',
      template_id: template_id,
      message_type: 'original' as const,
      cost: success ? 0.02 : undefined, // Cost in EUR
      currency: 'EUR',
      sim_port: simPort || 0,
      sent_at: success ? new Date().toISOString() : undefined,
      failed_at: success ? undefined : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: success,
      message: success ? 'SMS sent successfully (demo mode)' : 'SMS sending failed (demo mode)',
      data: smsLog
    }, { status: success ? 200 : 500 });

  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}

async function sendViaDinstar(
  config: DinstarConfig, 
  recipient: string, 
  message: string, 
  simPort: number, 
  templateId?: string
): Promise<Response> {
  
  const url = `${config.baseUrl}:${config.port}/api/send_sms`;
  
  // Format data according to working PHP example
  const smsData = {
    "text": message,
    "port": [simPort], // Array with single port
    "param": [{
      "number": recipient,
      "user_id": Math.floor(Math.random() * 9000) + 1000,
      "sn": config.serialNumber
    }]
  };

  console.log('Sending SMS via Dinstar:', { url, recipient, simPort, sn: config.serialNumber });

  try {
    // Create Basic Auth credentials
    const credentials = btoa(`${config.username}:${config.password}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'User-Agent': 'CRM-SMS-Module/1.0'
      },
      body: JSON.stringify(smsData),
      signal: AbortSignal.timeout(30000) // 30 second timeout for SMS
    });

    const responseText = await response.text();
    console.log('Dinstar response:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    // Check for success (error_code 202 means success according to PHP example)
    const isSuccess = result.error_code === 202 || result.error_code === 200;
    
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      direction: 'outbound' as const,
      recipient: recipient,
      message: message,
      provider: 'dinstar',
      provider_message_id: result.message_id || `dinstar_${Date.now()}`,
      status: isSuccess ? 'sent' as const : 'failed' as const,
      error_message: isSuccess ? undefined : `Error ${result.error_code}: ${result.error_msg || 'Unknown error'}`,
      template_id: templateId,
      message_type: 'original' as const,
      cost: isSuccess ? 0.02 : undefined,
      currency: 'EUR',
      sim_port: simPort,
      sent_at: isSuccess ? new Date().toISOString() : undefined,
      failed_at: !isSuccess ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dinstar_response: result
    };

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess 
        ? 'SMS sent successfully via Dinstar' 
        : `Dinstar error: ${result.error_code} - ${result.error_msg || 'Unknown error'}`,
      data: smsLog
    }, { status: isSuccess ? 200 : 400 });

  } catch (fetchError: any) {
    console.error('Dinstar fetch error:', fetchError);
    
    throw new Error(`Connection to Dinstar failed: ${fetchError.message}`);
  }
}

function createErrorLog(recipient: string, message: string, simPort?: number, errorMessage?: string) {
  return {
    id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    direction: 'outbound' as const,
    recipient: recipient,
    message: message,
    provider: 'dinstar',
    status: 'failed' as const,
    error_message: errorMessage || 'Unknown error',
    message_type: 'original' as const,
    sim_port: simPort || 0,
    failed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}