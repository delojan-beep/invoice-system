-- Fix: deleting a line that has attachments failed.
-- Postgres removes the line before cascading to its attachments, so the
-- attachment guard could no longer find the invoice and wrote an audit event
-- with no invoice. The line's own delete is already checked (locked invoices)
-- and audited, so attachments removed with their line need nothing more.

create or replace function private.guard_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  att public.attachments := coalesce(new, old);
  inv record;
begin
  select i.id, i.status, i.employee_id into inv
  from public.line_items li join public.invoices i on i.id = li.invoice_id
  where li.id = att.line_item_id;

  if tg_op = 'DELETE' and inv.id is null then
    return old; -- removed together with its line
  end if;

  if not private.is_editable(inv.status) then
    raise exception 'This invoice is % and can no longer be changed', inv.status using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and new.storage_path not like inv.employee_id || '/' || inv.id || '/%' then
    raise exception 'Attachment path must be <employee>/<invoice>/<file>' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    perform private.audit(inv.id, 'attachment_add', inv.status, inv.status, null, new.file_name);
    return new;
  end if;
  perform private.audit(inv.id, 'attachment_remove', inv.status, inv.status, null, old.file_name);
  return old;
end;
$$;

revoke execute on function private.guard_attachment() from public, anon, authenticated;
