alter table "accounts"."accounts" drop constraint "accounts_accounts_slug_null_if_personal_account_true";

alter table "accounts"."accounts" add constraint "accounts_accounts_slug_null_if_personal_account_true" CHECK (((personal_account = true) AND (slug IS NULL))) not valid;

alter table "accounts"."accounts" validate constraint "accounts_accounts_slug_null_if_personal_account_true";


