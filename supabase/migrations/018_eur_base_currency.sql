-- Migration: 018_eur_base_currency.sql
-- Every stored amount is in EUR and Stripe charges in EUR. The `currency`
-- columns still defaulted to 'USD', which was only ever a wrong label.
--  - products.currency: pure label, never used for charging -> set to EUR.
--  - profiles.currency: the viewer's DISPLAY preference. Only the default
--    changes; existing users keep whatever they have.
--  - purchases rows are historical records and are left untouched.

alter table products alter column currency set default 'EUR';
update products set currency = 'EUR' where currency is distinct from 'EUR';

alter table profiles alter column currency set default 'EUR';
