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
        message: 'Missing required configuration parameters (baseUrl, port, username, password, serialNumber)'
      }, { status: 400 });
    }

    // Clean up the base URL - ensure HTTPS for Dinstar
    let cleanBaseUrl = baseUrl.trim();
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `https://${cleanBaseUrl}`;
    }
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, ''); // Remove trailing slash

    // Test connection using Dinstar send_sms API (based on working PHP example)
    const testUrl = `${cleanBaseUrl}:${port}/api/send_sms`;
    
    console.log('Testing Dinstar connection to:', testUrl);
    console.log('Credentials:', { username, serialNumber, password: '***' });

    try {
      // Create test SMS data (similar to PHP example)
      const testData = {
        "text": "Connection test from CRM SMS Module",
        "port": [0], // Use port 0 for test
        "param": [{
          "number": "+355694000000", // Test number
          "user_id": Math.floor(Math.random() * 9000) + 1000,
          "sn": serialNumber
        }]
      };

       // Create Basic Auth credentials
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json',
          'User-Agent': 'CRM-SMS-Module/1.0'
        },
        body: JSON.stringify(testData),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      console.log('Response status:', response.status);
       // console.log('Response headers:', response.headers);

      const responseText = await response.text();
      console.log('Response body:', responseText);

       let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // Gateway might return non-JSON responses, let's check for success indicators
        console.log('Non-JSON response from Dinstar:', responseText);
        
        // Check if response contains success indicators
        if (response.status === 200 || response.status === 202) {
          // Consider it successful if HTTP status is OK
          return NextResponse.json({
            success: true,
            message: 'Connection successful - Gateway responded (non-JSON format)',
            data: {
              response_text: responseText,
              status: response.status,
              gateway_reachable: true
            }
          });
        }
        
        // Check for common success patterns in text response
        const successPatterns = [
          /success/i,
          /ok/i,
          /202/,
          /accepted/i,
          /authenticated/i
        ];
        
        const errorPatterns = [
          /error/i,
          /fail/i,
          /401/,
          /403/,
          /unauthorized/i,
          /forbidden/i
        ];
        
        let hasSuccess = successPatterns.some(pattern => pattern.test(responseText));
        let hasError = errorPatterns.some(pattern => pattern.test(responseText));
        
        if (hasSuccess && !hasError) {
          return NextResponse.json({
            success: true,
            message: 'Connection successful - Gateway responded positively',
            data: {
              response_text: responseText,
              status: response.status,
              format: 'text'
            }
          });
        } else if (hasError) {
          return NextResponse.json({
            success: false,
            message: 'Gateway authentication failed - Check credentials',
            debug: {
              url: testUrl,
              status: response.status,
              body: responseText.substring(0, 200),
              error: 'Authentication error detected in response'
            }
          }, { status: 401 });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Gateway returned unexpected response format',
            debug: {
              url: testUrl,
              status: response.status,
              body: responseText.substring(0, 200),
              error: 'Unknown response format'
            }
          }, { status: 500 });
        }
      }

      // Check for successful connection based on Dinstar response format
      // Error code 202 means success according to PHP example
      if (result.error_code === 202 || result.error_code === 200 || response.status === 200) {
        return NextResponse.json({
          success: true,
          message: 'Connection successful - Gateway responded correctly',
          data: {
            error_code: result.error_code,
            response: result,
            gateway_reachable: true
          }
        });
      } else if (result.error_code) {
        // Gateway responded but with error
        return NextResponse.json({
          success: false,
          message: `Gateway error: Code ${result.error_code} - ${result.error_msg || 'Unknown error'}`,
          debug: {
            url: testUrl,
            error_code: result.error_code,
            error_msg: result.error_msg,
            response: result
          }
        }, { status: 400 });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Unexpected gateway response format',
          debug: {
            url: testUrl,
            status: response.status,
            response: result
          }
        }, { status: 500 });
      }

    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout - Gateway not responding. Check IP address and port.',
          debug: {
            url: testUrl,
            error: 'timeout'
          }
        }, { status: 408 });
      }

      // Network errors
      if (fetchError.code === 'ECONNREFUSED' || fetchError.message.includes('ECONNREFUSED')) {
        return NextResponse.json({
          success: false,
          message: 'Connection refused - Gateway not accessible. Check IP address and port.',
          debug: {
            url: testUrl,
            error: fetchError.message
          }
        }, { status: 500 });
      }

      // Certificate errors for HTTPS
      if (fetchError.message.includes('certificate') || fetchError.message.includes('SSL')) {
        return NextResponse.json({
          success: false,
          message: 'SSL Certificate error - Try using HTTP instead of HTTPS, or check certificate configuration.',
          debug: {
            url: testUrl,
            error: fetchError.message
          }
        }, { status: 500 });
      }

      // Authentication errors
      if (fetchError.message.includes('401') || fetchError.message.includes('Unauthorized')) {
        return NextResponse.json({
          success: false,
          message: 'Authentication failed - Check username and password.',
          debug: {
            url: testUrl,
            error: fetchError.message
          }
        }, { status: 401 });
      }

      throw fetchError; // Re-throw to be caught by outer catch
    }

  } catch (error: any) {
    console.error('Dinstar connection test error:', error);
    
    return NextResponse.json({
      success: false,
      message: `Connection error: ${error.message}`,
      debug: {
        error: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      }
    }, { status: 500 });
  }
}