-- =====================================================================
-- Allow a manager to verify a payment that has no proof of payment,
-- after explicitly confirming the money was received.
-- Recorded on the payment (verified_without_proof) and as an internal note.
-- =====================================================================

alter table public.order_payments
  add column if not exists verified_without_proof boolean not null default false;

-- Replace the 3-argument version with one that has two optional extra arguments.
drop function if exists public.manager_review_payment(uuid, boolean, text);

create or replace function public.manager_review_payment(
  p_payment_id    uuid,
  p_approve       boolean,
  p_comment       text,
  p_without_proof boolean default false,  -- manager confirmed receipt without a proof file
  p_reference     text    default null    -- optional reference no. from the bank / GCash app
)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare
  v_pay       public.order_payments%rowtype;
  v_order     public.orders%rowtype;
  v_label     text;
  v_no_proof  boolean;
  v_new       public.order_status;
begin
  if not public.is_manager() then raise exception 'Managers only'; end if;

  select * into v_pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;

  if v_order.status in ('payment_verified', 'shipped', 'delivered', 'received', 'cancelled') then
    raise exception 'This order is no longer waiting for payment verification';
  end if;
  if v_pay.status = 'verified' then raise exception 'This payment is already verified'; end if;

  -- "No proof" = nothing waiting for review (never uploaded, or the last upload was rejected)
  v_no_proof := v_pay.status <> 'submitted';

  if v_no_proof and not (p_approve and coalesce(p_without_proof, false)) then
    raise exception 'This payment has no proof of payment. To verify it anyway, confirm that you received the money.';
  end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then
    raise exception 'Please add a comment telling the customer why the payment could not be verified';
  end if;

  update public.order_payments
  set status = case when p_approve then 'verified'::public.payment_status else 'rejected'::public.payment_status end,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = nullif(trim(p_comment), ''),
      verified_without_proof = (p_approve and v_no_proof),
      reference_no = coalesce(nullif(trim(p_reference), ''), reference_no)
  where id = p_payment_id;

  if coalesce(trim(p_comment), '') <> '' then
    insert into public.order_comments (order_id, author_id, body) values (v_order.id, auth.uid(), trim(p_comment));
  end if;

  -- audit trail for no-proof verifications (managers only)
  if p_approve and v_no_proof then
    select label into v_label from public.payment_methods where id = v_pay.method_id;
    insert into public.order_comments (order_id, author_id, body, is_internal)
    values (v_order.id, auth.uid(),
            format('Payment of ₱%s to %s was verified WITHOUT proof of payment. The manager confirmed the money was received.%s',
                   to_char(v_pay.amount, 'FM999,999,990.00'), coalesce(v_label, 'the account'),
                   case when coalesce(trim(p_reference), '') <> '' then ' Ref: ' || trim(p_reference) else '' end),
            true);
  end if;

  if exists (select 1 from public.order_payments where order_id = v_order.id and status = 'rejected') then
    v_new := 'payment_rejected';
  elsif not exists (select 1 from public.order_payments where order_id = v_order.id and status <> 'verified') then
    v_new := 'payment_verified';
  elsif exists (select 1 from public.order_payments where order_id = v_order.id and status = 'awaiting_proof') then
    v_new := 'pending_payment';
  else
    v_new := 'for_verification';
  end if;

  update public.orders
  set status = v_new,
      verified_at = case when v_new = 'payment_verified' then now() else verified_at end
  where id = v_order.id and status is distinct from v_new;

  return v_new;
end $$;

revoke execute on function public.manager_review_payment(uuid, boolean, text, boolean, text) from anon;
