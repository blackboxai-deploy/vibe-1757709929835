import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // In a real Laravel application, this would fetch from database
    // For this demo, we'll return a success response that indicates no config is stored
    // The frontend will handle this by using localStorage
    
    return NextResponse.json({
      success: false,
      message: 'No configuration stored in database - using localStorage',
      data: null
    });

  } catch (error: any) {
    console.error('Get config error:', error);
    return NextResponse.json({
      success: false,
      message: `Error retrieving configuration: ${error.message}`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // This would save configuration to database in a real Laravel app
    const body = await request.json();
    
    console.log('Saving Dinstar config:', { 
      ...body, 
      password: '***' // Don't log password
    });

    // For demo purposes, just return success
    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
      data: {
        id: Date.now(),
        ...body,
        created_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Save config error:', error);
    return NextResponse.json({
      success: false,
      message: `Error saving configuration: ${error.message}`
    }, { status: 500 });
  }
}