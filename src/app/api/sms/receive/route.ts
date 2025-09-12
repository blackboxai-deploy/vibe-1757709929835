import { NextRequest, NextResponse } from 'next/server';
import { SmsApiResponse } from '@/types/sms';

export async function POST(request: NextRequest) {
  try {
    // This endpoint is typically called by Dinstar webhook
    const { sender, message, timestamp, provider } = await request.json();
    
    // Validate required fields
    if (!sender || !message) {
      return NextResponse.json({
        success: false,
        message: 'Sender and message are required',
        errors: { 
          sender: !sender ? ['Sender is required'] : undefined,
          message: !message ? ['Message is required'] : undefined 
        }
      } as SmsApiResponse, { status: 400 });
    }

    // Create SMS log for received message
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      direction: 'inbound' as const,
      sender: sender,
      message: message,
      provider: provider || 'dinstar',
      status: 'received' as const,
      message_type: 'original' as const,
      received_at: timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // In a real application, this would save to database
    console.log('SMS received:', smsLog);

    // Trigger notifications for new received messages
    // This would typically send email/push notifications to admin users

    return NextResponse.json({
      success: true,
      message: 'SMS received and processed successfully',
      data: smsLog
    } as SmsApiResponse, { status: 200 });

  } catch (error) {
    console.error('SMS receive error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to process received SMS',
      errors: { general: [error instanceof Error ? error.message : 'Unknown error occurred'] }
    } as SmsApiResponse, { status: 500 });
  }
}