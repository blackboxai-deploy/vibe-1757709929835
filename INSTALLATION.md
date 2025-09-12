# SMS Module for Laravel Worksuite - Installation Guide

This guide will help you integrate the SMS Module into your Laravel Worksuite application.

## Prerequisites

- Laravel 8.0 or higher
- PHP 7.4 or higher
- MySQL 5.7 or higher
- Dinstar SMS Gateway
- Node.js 16+ (for admin interface)
- Composer
- npm/pnpm

## Installation Steps

### 1. Laravel Backend Integration

#### Database Migration
Create the SMS module database tables:

```bash
php artisan make:migration create_sms_tables
```

Add this content to the migration file:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSmsTables extends Migration
{
    public function up()
    {
        // SMS Providers
        Schema::create('sms_providers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('slug', ['dinstar', 'twilio', 'vonage', 'aws_sns']);
            $table->enum('status', ['active', 'inactive']);
            $table->json('config');
            $table->integer('priority')->default(0);
            $table->boolean('supports_receive')->default(false);
            $table->boolean('supports_delivery_reports')->default(false);
            $table->timestamps();
        });

        // SMS Templates
        Schema::create('sms_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('content');
            $table->json('variables')->nullable();
            $table->json('hashtags')->nullable();
            $table->string('category')->nullable();
            $table->enum('status', ['active', 'inactive']);
            $table->string('language', 5)->default('en');
            $table->unsignedBigInteger('created_by');
            $table->timestamps();
            
            $table->foreign('created_by')->references('id')->on('users');
        });

        // SMS Logs
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->enum('direction', ['outbound', 'inbound']);
            $table->string('recipient')->nullable();
            $table->string('sender')->nullable();
            $table->text('message');
            $table->string('provider');
            $table->string('provider_message_id')->nullable();
            $table->enum('status', ['pending', 'sent', 'delivered', 'failed', 'expired', 'received']);
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('template_id')->nullable();
            $table->json('template_variables')->nullable();
            $table->decimal('cost', 8, 4)->nullable();
            $table->string('currency', 3)->nullable();
            $table->unsignedBigInteger('parent_message_id')->nullable();
            $table->enum('message_type', ['original', 'reply', 'forward']);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            
            $table->foreign('template_id')->references('id')->on('sms_templates');
            $table->foreign('parent_message_id')->references('id')->on('sms_logs');
            $table->index(['direction', 'status']);
            $table->index(['provider', 'created_at']);
        });

        // SMS Contacts
        Schema::create('sms_contacts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->json('groups')->nullable();
            $table->json('user_data')->nullable();
            $table->json('metadata')->nullable();
            $table->enum('status', ['active', 'inactive', 'blocked']);
            $table->timestamps();
            
            $table->unique('phone');
            $table->index('status');
        });

        // SMS Contact Groups
        Schema::create('sms_contact_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('contact_count')->default(0);
            $table->boolean('auto_sync_from_users')->default(false);
            $table->json('sync_filters')->nullable();
            $table->timestamps();
        });

        // SMS Rules
        Schema::create('sms_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive']);
            $table->enum('trigger_type', ['schedule', 'event', 'webhook']);
            $table->json('schedule_config')->nullable();
            $table->json('event_config')->nullable();
            $table->unsignedBigInteger('template_id');
            $table->json('recipient_config');
            $table->unsignedBigInteger('created_by');
            $table->timestamp('last_executed')->nullable();
            $table->timestamp('next_execution')->nullable();
            $table->integer('execution_count')->default(0);
            $table->timestamps();
            
            $table->foreign('template_id')->references('id')->on('sms_templates');
            $table->foreign('created_by')->references('id')->on('users');
        });

        // SMS Settings
        Schema::create('sms_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('sms_settings');
        Schema::dropIfExists('sms_rules');
        Schema::dropIfExists('sms_contact_groups');
        Schema::dropIfExists('sms_contacts');
        Schema::dropIfExists('sms_logs');
        Schema::dropIfExists('sms_templates');
        Schema::dropIfExists('sms_providers');
    }
}
```

Run the migration:

```bash
php artisan migrate
```

#### Laravel Models

Create Eloquent models for each table:

```bash
php artisan make:model SmsProvider
php artisan make:model SmsTemplate
php artisan make:model SmsLog
php artisan make:model SmsContact
php artisan make:model SmsContactGroup
php artisan make:model SmsRule
php artisan make:model SmsSetting
```

#### SMS Service Provider

Create a Laravel Service Provider:

```bash
php artisan make:provider SmsServiceProvider
```

Add SMS service registration and configuration loading.

#### Controllers

Create controllers for SMS management:

```bash
php artisan make:controller Api/SmsController
php artisan make:controller Api/SmsTemplateController
php artisan make:controller Api/SmsRuleController
```

### 2. Environment Configuration

Add these variables to your `.env` file:

```env
# SMS Module Configuration
SMS_DEFAULT_PROVIDER=dinstar
SMS_ENABLE_FALLBACK=true

# Dinstar Gateway Configuration
SMS_DINSTAR_URL=http://192.168.1.100
SMS_DINSTAR_PORT=8080
SMS_DINSTAR_USERNAME=admin
SMS_DINSTAR_PASSWORD=your_password
SMS_DINSTAR_FROM_NUMBER=+1234567890
SMS_DINSTAR_ENCODING=utf8
SMS_DINSTAR_TIMEOUT=30

# Optional: Other Providers
SMS_TWILIO_SID=your_twilio_sid
SMS_TWILIO_TOKEN=your_twilio_token
SMS_TWILIO_FROM=+1234567890

# SMS Notifications
SMS_NOTIFICATION_EMAIL=admin@yourcompany.com
SMS_WEBHOOK_URL=https://yoursite.com/api/sms/webhook
SMS_WEBHOOK_SECRET=your_webhook_secret

# Queue Configuration (for bulk SMS)
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### 3. Dinstar Gateway Setup

#### Configure Dinstar Device

1. Access your Dinstar gateway admin panel (usually http://device-ip:8080)
2. Enable HTTP API access
3. Configure the webhook URL to point to your Laravel application:
   ```
   http://yoursite.com/api/sms/receive
   ```
4. Set up API credentials (username/password)
5. Configure SMS routing and carrier settings

#### Test Dinstar Connection

Use the health check endpoint to verify connectivity:

```bash
curl -X GET "http://localhost:8000/api/sms/providers/dinstar/health" \
  -H "Authorization: Bearer your_api_token"
```

### 4. Frontend Integration

#### Install Node.js Dependencies

In your Laravel project root (or separate frontend folder):

```bash
# Install Next.js and dependencies
npm install next react react-dom typescript @types/node @types/react

# Install UI components
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar
npm install @radix-ui/react-button @radix-ui/react-card @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu @radix-ui/react-input @radix-ui/react-label
npm install @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-textarea

# Install utilities
npm install class-variance-authority clsx tailwind-merge date-fns
npm install tailwindcss postcss autoprefixer
npm install lucide-react # for icons
```

#### Build Frontend

```bash
npm run build
npm start
```

The SMS admin interface will be available at `http://localhost:3000`

### 5. Laravel Routes

Add these routes to `routes/api.php`:

```php
<?php

use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\SmsTemplateController;
use App\Http\Controllers\Api\SmsRuleController;

Route::prefix('sms')->middleware(['auth:api'])->group(function () {
    // SMS Operations
    Route::post('/send', [SmsController::class, 'send']);
    Route::post('/bulk-send', [SmsController::class, 'bulkSend']);
    Route::post('/reply', [SmsController::class, 'reply']);
    Route::post('/forward', [SmsController::class, 'forward']);
    
    // Webhook (no auth required)
    Route::post('/receive', [SmsController::class, 'receive'])->withoutMiddleware(['auth:api']);
    
    // Templates
    Route::apiResource('templates', SmsTemplateController::class);
    
    // Rules
    Route::apiResource('rules', SmsRuleController::class);
    
    // Logs and Statistics
    Route::get('/logs', [SmsController::class, 'logs']);
    Route::get('/stats', [SmsController::class, 'stats']);
    Route::get('/conversations', [SmsController::class, 'conversations']);
    
    // Provider Management
    Route::get('/providers', [SmsController::class, 'providers']);
    Route::post('/providers/{provider}/configure', [SmsController::class, 'configureProvider']);
    Route::get('/providers/{provider}/health', [SmsController::class, 'providerHealth']);
});
```

### 6. Queue Setup (for Bulk SMS)

Configure Laravel queues for background processing:

```bash
# Create jobs
php artisan make:job SendBulkSms
php artisan make:job ProcessSmsDeliveryReport

# Start queue worker
php artisan queue:work redis --queue=sms --tries=3
```

### 7. Scheduled Tasks

Add to `app/Console/Kernel.php` for SMS rules and delivery tracking:

```php
protected function schedule(Schedule $schedule)
{
    // Process SMS rules every minute
    $schedule->command('sms:process-rules')->everyMinute();
    
    // Update delivery reports every 5 minutes
    $schedule->command('sms:update-delivery-reports')->everyFiveMinutes();
    
    // Sync contacts from users table daily
    $schedule->command('sms:sync-contacts')->daily();
}
```

## Usage Examples

### Send SMS with Hashtags

```php
use App\Services\SmsService;

$smsService = new SmsService();

$result = $smsService->sendSms([
    'recipient' => '+1234567890',
    'message' => 'Hello #first_name#, your appointment at #company# is confirmed!',
    'template_id' => 'appointment_confirmation'
]);
```

### Create SMS Template

```php
$template = SmsTemplate::create([
    'name' => 'Welcome Message',
    'slug' => 'welcome',
    'content' => 'Welcome to #company#, #first_name#! Your account is now active.',
    'hashtags' => ['first_name', 'company'],
    'category' => 'onboarding',
    'created_by' => auth()->id()
]);
```

### Schedule SMS Rule

```php
$rule = SmsRule::create([
    'name' => 'Daily Reminder',
    'trigger_type' => 'schedule',
    'schedule_config' => [
        'type' => 'recurring',
        'cron_expression' => '0 9 * * *', // Daily at 9 AM
        'timezone' => 'UTC'
    ],
    'template_id' => $reminderTemplate->id,
    'recipient_config' => [
        'type' => 'groups',
        'group_ids' => ['customers']
    ],
    'created_by' => auth()->id()
]);
```

## Testing

### API Endpoint Testing

```bash
# Test single SMS
curl -X POST http://localhost:8000/api/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"recipient": "+1234567890", "message": "Test message"}'

# Test bulk SMS
curl -X POST http://localhost:8000/api/sms/bulk-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"recipients": ["+1234567890"], "template_id": "welcome"}'

# Test webhook (simulate Dinstar)
curl -X POST http://localhost:8000/api/sms/receive \
  -H "Content-Type: application/json" \
  -d '{"sender": "+1234567890", "message": "Hello", "provider": "dinstar"}'
```

### Dinstar Gateway Testing

1. Send test SMS through Dinstar interface
2. Verify SMS appears in logs
3. Test webhook delivery by sending SMS to your Dinstar number
4. Check delivery reports update correctly

## Troubleshooting

### Common Issues

1. **Dinstar Connection Failed**
   - Check IP address and port configuration
   - Verify network connectivity to Dinstar device
   - Ensure HTTP API is enabled on Dinstar

2. **SMS Not Sending**
   - Check provider configuration in database
   - Verify API credentials
   - Check Laravel logs for detailed error messages

3. **Webhooks Not Working**
   - Ensure webhook URL is accessible from Dinstar device
   - Check Laravel route configuration
   - Verify firewall settings allow incoming connections

4. **Queue Jobs Failing**
   - Check Redis connection
   - Verify queue worker is running
   - Review failed job logs

### Debug Commands

```bash
# Check SMS service status
php artisan sms:status

# Test provider connectivity
php artisan sms:test-provider dinstar

# Process pending rules manually
php artisan sms:process-rules

# Clear SMS cache
php artisan cache:forget sms_*
```

## Security Considerations

1. **API Authentication**: Always use proper authentication for SMS endpoints
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Input Validation**: Validate all phone numbers and message content
4. **Webhook Security**: Verify webhook signatures from Dinstar
5. **Data Encryption**: Encrypt sensitive configuration data
6. **Access Control**: Implement role-based access to SMS features

## Production Deployment

1. **Environment**: Set up production environment variables
2. **SSL/TLS**: Ensure HTTPS for all API endpoints
3. **Monitoring**: Set up monitoring for SMS delivery rates and errors
4. **Backup**: Regular backup of SMS logs and configuration
5. **Scaling**: Configure queue workers for high-volume SMS processing

## Support

For installation support:
- Check Laravel logs: `storage/logs/laravel.log`
- Enable SMS debug mode: `SMS_DEBUG=true`
- Contact support: support@worksuite.com

---

**SMS Module for Laravel Worksuite** - Complete installation and integration guide.