-- ============================================================
-- Bug: the "owner contact reveal" feature in UserBookings.tsx never
-- actually worked. It does:
--   const ownerUser = users.find(u => u.id === house.ownerId)
--   const ownerPhone = ownerUser?.phone || booking.userPhone
-- but users_select_own only lets a guest SELECT their OWN row (001),
-- so `users` client-side always contains just the guest's own profile.
-- ownerUser is always undefined, so ownerPhone silently fell back to
-- booking.userPhone — the GUEST'S OWN phone number, displayed to them
-- as if it were the house owner's contact info.
--
-- houses has owner_name denormalized but no owner_phone column, and
-- widening users RLS to let any guest read any owner's full row would
-- expose email/address/DOB/points. Instead: a narrow SECURITY DEFINER
-- RPC that returns only name+phone, and only once the caller's own
-- booking for that house is actually approved and deposit-paid — the
-- exact condition the client already gates the reveal UI on.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_house_owner_contact(p_booking_id TEXT)
RETURNS TABLE(name TEXT, phone TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT u.name, u.phone
    FROM public.bookings b
    JOIN public.houses h ON h.id = b.house_id
    JOIN public.users u ON u.id = h.owner_id
    WHERE b.id = p_booking_id
      AND b.user_id = auth.uid()
      AND b.status = 'approved'
      AND b.deposit_paid = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_house_owner_contact(TEXT) TO authenticated;
