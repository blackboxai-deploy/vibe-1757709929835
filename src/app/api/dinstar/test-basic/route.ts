import { NextRequest, NextResponse } from 'next/server';

interface DinstarConfig {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
  serialNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, port, username, password, serialNumber }: DinstarConfig = body;

    if (!baseUrl || !port || !username || !password || !serialNumber) {
      return NextResponse.json({
        success: false,
        message: 'Missing required configuration parameters'
      }, { status: 400 });
    }

    // Clean up the base URL
    let cleanBaseUrl = baseUrl.trim();
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `https://${cleanBaseUrl}`;
    }
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

    // Test basic connectivity first
    const testUrl = `${cleanBaseUrl}:${port}`;
    
    console.log('Testing basic connectivity to:', testUrl);

    try {
      // First, test if the gateway responds at all
      const basicResponse = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      console.log('Basic connectivity test - Status:', basicResponse.status);

      if (basicResponse.status === 200 || basicResponse.status === 401 || basicResponse.status === 403) {
        // Gateway is reachable (even if it returns auth error, it's responding)
        return NextResponse.json({
          success: true,
          message: `Gateway is reachable at ${testUrl}`,
          data: {
            url: testUrl,
            status: basicResponse.status,
            reachable: true,
            next_step: 'gateway_reachable'
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `Gateway responded with unexpected status: ${basicResponse.status}`,
          debug: {
            url: testUrl,
            status: basicResponse.status,
            statusText: basicResponse.statusText
          }
        }, { status: 500 });
      }

    } catch (fetchError: any) {
      console.error('Basic connectivity test failed:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout - Gateway not responding at this IP/port',
          debug: {
            url: testUrl,
            error: 'timeout',
            suggestion: 'Check IP address and port number'
          }
        }, { status: 408 });
      }

      if (fetchError.message.includes('ECONNREFUSED')) {
        return NextResponse.json({
          success: false,
          message: 'Connection refused - Gateway not accessible',
          debug: {
            url: testUrl,
            error: 'connection_refused',
            suggestion: 'Check if gateway is running and accessible from this network'
          }
        }, { status: 500 });
      }

      if (fetchError.message.includes('certificate') || fetchError.message.includes('SSL')) {
        return NextResponse.json({
          success: false,
          message: 'SSL/Certificate error - Try HTTP instead of HTTPS',
          debug: {
            url: testUrl,
            error: 'ssl_error',
            suggestion: 'Change URL to http:// or configure SSL properly'
          }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: false,
        message: `Network error: ${fetchError.message}`,
        debug: {
          url: testUrl,
          error: fetchError.name,
          message: fetchError.message
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Test basic connectivity error:', error);
    
    return NextResponse.json({
      success: false,
      message: `Configuration error: ${error.message}`
    }, { status: 500 });
  }
}