-- Approver and accounts (milestone M4).
-- Accounts confirm each paid invoice against the Wise records: transfer ID,
-- amount sent, fee and who paid it, amount received and the actual rate.

alter table public.payments
  add column confirmed_by uuid references public.profiles (id),
  add constraint payments_amounts_not_negative check (
    coalesce(amount_sent_minor, 0) >= 0 and coalesce(wise_fee_minor, 0) >= 0
    and coalesce(amount_received_minor, 0) >= 0
  ),
  add constraint payments_rate_positive check (actual_exchange_rate is null or actual_exchange_rate > 0);

create function public.confirm_payment(
  p_invoice uuid,
  p_wise_transfer_id text,
  p_amount_sent_minor bigint,
  p_sent_currency text,
  p_wise_fee_minor bigint,
  p_fee_paid_by public.wise_fee_payer,
  p_amount_received_minor bigint,
  p_received_currency text,
  p_actual_rate numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  payment_id uuid;
begin
  if not public.has_role('accounts') then
    raise exception 'Only accounts can confirm payments' using errcode = '42501';
  end if;

  select * into inv from public.invoices where id = p_invoice for update;
  if inv.id is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'paid' then
    raise exception 'Only invoices marked paid can be confirmed' using errcode = 'P0001';
  end if;
  if nullif(trim(p_wise_transfer_id), '') is null then
    raise exception 'Add the Wise transfer ID' using errcode = 'P0001';
  end if;
  if p_amount_sent_minor is null or p_amount_received_minor is null or p_fee_paid_by is null then
    raise exception 'Add the amount sent, the amount received and who paid the fee' using errcode = 'P0001';
  end if;

  select id into payment_id from public.payments
  where invoice_id = p_invoice order by paid_at desc limit 1;

  update public.payments set
    wise_transfer_id = trim(p_wise_transfer_id),
    amount_sent_minor = p_amount_sent_minor,
    sent_currency = coalesce(p_sent_currency, inv.currency_code),
    wise_fee_minor = coalesce(p_wise_fee_minor, 0),
    fee_paid_by = p_fee_paid_by,
    amount_received_minor = p_amount_received_minor,
    received_currency = coalesce(p_received_currency, inv.currency_code),
    actual_exchange_rate = p_actual_rate,
    confirmed_by_accounts_at = now(),
    confirmed_by = auth.uid()
  where id = payment_id;

  perform private.audit(inv.id, 'payment_confirm', inv.status, inv.status, null,
    format('Wise %s', trim(p_wise_transfer_id)));
end;
$$;

revoke execute on function public.confirm_payment(uuid, text, bigint, text, bigint, public.wise_fee_payer, bigint, text, numeric)
  from public, anon;
grant execute on function public.confirm_payment(uuid, text, bigint, text, bigint, public.wise_fee_payer, bigint, text, numeric)
  to authenticated;
