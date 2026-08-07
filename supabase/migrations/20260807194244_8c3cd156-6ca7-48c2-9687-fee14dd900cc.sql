SELECT cron.schedule(
  'prune-ai-rate-limit-counters',
  '17 3 * * *',
  $$SELECT public.prune_ai_rate_limit_counters();$$
);