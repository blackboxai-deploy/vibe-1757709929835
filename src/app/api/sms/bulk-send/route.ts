import { NextRequest, NextResponse } from 'next/server';
import { SendBulkSmsRequest, SmsApiResponse } from '@/types/sms';
import SmsService from '@/services/SmsService';

export async function POST(request: NextRequest) {
  try {
    const body: SendBulkSmsRequest = await request.json();
    
    // Validate required fields
    if (!body.recipients || body.recipients.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Recipients are required',
        errors: { recipients: ['At least one recipient is required'] }
      } as SmsApiResponse, { status: 400 });
    }

    if (!body.message && !body.template_id) {
      return NextResponse.json({
        success: false,
        message: 'Message or template is required',
        errors: { message: ['Either message content or template_id is required'] }
      } as SmsApiResponse, { status: 400 });
    }

    // Send bulk SMS using the SMS service
    const result = await SmsService.sendBulkSms(body);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error) {
    console.error('Bulk SMS send error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to send bulk SMS',
      errors: { general: [error instanceof Error ? error.message : 'Unknown error occurred'] }
    } as SmsApiResponse, { status: 500 });
  }
}