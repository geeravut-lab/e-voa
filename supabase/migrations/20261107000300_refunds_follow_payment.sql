-- Deleting an account must be possible even when it has refunds: the refund rows follow their payment (same rule as payments, add-ons and applications).
alter table public.refunds drop constraint if exists refunds_payment_id_fkey;
alter table public.refunds add constraint refunds_payment_id_fkey foreign key (payment_id) references public.payments(id) on delete cascade;
