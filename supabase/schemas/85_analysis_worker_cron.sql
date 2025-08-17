-- Analysis worker cron job setup  
-- Sets up minimal fallback cron job for analysis worker (hourly)
-- Primary mechanism is Database Webhooks for instant processing

-- Schedule analysis worker as fallback (every hour) for error recovery
select cron.schedule(
  'analysis_worker_fallback',
  '0 * * * *',
  'SELECT net.http_post(
    url := ''https://rbginqvgkonnoktrttqv.supabase.co/functions/v1/analysis_worker'',
    headers := ''{"Content-Type": "application/json", "Authorization": "Bearer '' || current_setting(''app.settings.service_role_key'') || ''"}''::jsonb
  ) as request_id;'
);