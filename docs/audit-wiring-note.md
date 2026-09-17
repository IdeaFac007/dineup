# Audit wiring

Admin audit logging is backed by Supabase triggers for restaurant status/claim changes and application review transitions.

Refund creation logging is intended to record REFUND_CREATED / REFUND_FAILED from the authenticated admin refund route.
