-- Rename provider 'legacy' to 'trial' for billing records.
-- The trial system is not legacy-specific; it's the standard free trial for all new users.

UPDATE accounts.billing_subscriptions SET provider = 'trial' WHERE provider = 'legacy';
UPDATE accounts.billing_customers SET provider = 'trial' WHERE provider = 'legacy';
