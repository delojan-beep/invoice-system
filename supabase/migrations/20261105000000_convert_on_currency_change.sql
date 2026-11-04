-- Changing an invoice's currency converts its lines at the latest stored exchange
-- rates, instead of relabelling the same numbers. The page shows the rate and new
-- subtotal and asks first; without a rate the change is refused, never guessed.

-- The latest stored rate from a currency into the base currency.
create function private.rate_to_base(p_currency text, p_base text) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when p_currency = p_base then 1::numeric else (
    select rate from public.exchange_rates
    where from_currency = p_currency and to_currency = p_base
    order by rate_date desc
    limit 1
  ) end;
$$;

revoke execute on function private.rate_to_base(text, text) from public, anon;

create or replace function public.update_invoice_details(p_invoice uuid, p_currency text, p_reference text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices := private.lock_own_invoice(p_invoice);
  has_lines boolean;
  base text;
  from_rate numeric;
  to_rate numeric;
  from_places integer;
  to_places integer;
begin
  if not private.is_editable(inv.status) then
    raise exception 'This invoice is % and can no longer be changed', inv.status using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.currencies where code = p_currency and active) then
    raise exception 'That currency is not available' using errcode = 'P0001';
  end if;

  has_lines := exists (select 1 from public.line_items where invoice_id = p_invoice);

  if p_currency <> inv.currency_code and has_lines then
    base := coalesce(private.setting('base_currency') #>> '{}', 'CAD');
    from_rate := private.rate_to_base(inv.currency_code, base);
    to_rate := private.rate_to_base(p_currency, base);
    if from_rate is null or to_rate is null then
      raise exception 'There''s no exchange rate for % yet, so this invoice can''t be converted. Try again tomorrow.',
        case when from_rate is null then inv.currency_code else p_currency end
        using errcode = 'P0001';
    end if;
    select decimal_places into from_places from public.currencies where code = inv.currency_code;
    select decimal_places into to_places from public.currencies where code = p_currency;
  end if;

  perform private.begin_action('update', null);
  update public.invoices
  set currency_code = p_currency,
      employee_reference = nullif(trim(p_reference), '')
  where id = p_invoice;

  if p_currency <> inv.currency_code then
    -- Tax rates belong to one currency; drop any that no longer match.
    update public.line_items set tax_rate_id = null
    where invoice_id = p_invoice and tax_rate_id is not null;

    if has_lines then
      update public.line_items
      set rate_minor = round(rate_minor::numeric / 10 ^ from_places * from_rate / to_rate * 10 ^ to_places)::bigint
      where invoice_id = p_invoice;

      perform private.audit(
        p_invoice, 'currency_convert', inv.status, inv.status, null,
        format('From %s to %s, at 1 %s = %s %s', inv.currency_code, p_currency, inv.currency_code,
          round(from_rate / to_rate, 6), p_currency)
      );
    end if;
  end if;
end;
$$;
