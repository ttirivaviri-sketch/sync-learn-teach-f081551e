-- 1) payments: payer must be the learner on the referenced booking
drop policy if exists "Payer can create payments" on public.payments;
create policy "Payer can create payments"
on public.payments
for insert
to authenticated
with check (
  payer_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and b.learner_id = (select auth.uid())
  )
);

-- 2) reviews: reviewed_id must be the counterpart on the completed booking
drop policy if exists "Users can create reviews for their bookings" on public.reviews;
create policy "Users can create reviews for their bookings"
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from public.bookings bk
    where bk.id = reviews.booking_id
      and bk.status = 'completed'::booking_status
      and (
        ((select auth.uid()) = bk.learner_id and reviews.reviewed_id = bk.tutor_id)
        or
        ((select auth.uid()) = bk.tutor_id and reviews.reviewed_id = bk.learner_id)
      )
  )
);

-- 3) tutor_booking_insights: booking must link this tutor and student
drop policy if exists "Users insert own booking insights" on public.tutor_booking_insights;
create policy "Users insert own booking insights"
on public.tutor_booking_insights
for insert
to authenticated
with check (
  tutor_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = tutor_booking_insights.booking_id
      and b.tutor_id = tutor_booking_insights.tutor_id
      and b.learner_id = tutor_booking_insights.student_id
  )
);