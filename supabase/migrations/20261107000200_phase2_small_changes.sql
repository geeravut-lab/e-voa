-- Phase 2: the package is chosen with the trip (step 1 of the wizard); an unpaid order can go back to draft so the traveler can pay again.
alter table public.trips add column if not exists package text check (package is null or package in ('regular','express'));

create or replace function public.application_transition_ok(p_from text, p_to text) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('draft','awaiting_payment'), ('draft','cancelled'), ('draft','expired'),
    ('awaiting_payment','paid'), ('awaiting_payment','expired'), ('awaiting_payment','cancelled'), ('awaiting_payment','draft'),
    ('paid','pre_check'), ('paid','cancelled'),
    ('pre_check','submitted'), ('pre_check','submission_failed'), ('pre_check','action_required'), ('pre_check','cancelled'),
    ('action_required','pre_check'), ('action_required','submitted'), ('action_required','under_review'), ('action_required','cancelled'),
    ('submitted','under_review'), ('submitted','submission_failed'), ('submitted','approved'), ('submitted','rejected'), ('submitted','action_required'),
    ('submission_failed','submitted'), ('submission_failed','pre_check'), ('submission_failed','cancelled'),
    ('under_review','approved'), ('under_review','rejected'), ('under_review','action_required'),
    ('approved','used'), ('approved','no_show')
  );
$$;
