-- Employee flow (milestone M3).
-- The PRD lets employees add their own "My reference" note to any invoice,
-- whatever its status; currency and lines stay locked once submitted.

create function public.set_invoice_reference(p_invoice uuid, p_reference text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_own_invoice(p_invoice);
  perform private.begin_action('reference', null);
  update public.invoices
  set employee_reference = nullif(trim(p_reference), '')
  where id = p_invoice;
end;
$$;

revoke execute on function public.set_invoice_reference(uuid, text) from public, anon;
grant execute on function public.set_invoice_reference(uuid, text) to authenticated;
