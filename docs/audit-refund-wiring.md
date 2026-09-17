# Refund audit wiring status

Refund route uses the authenticated admin session and records REFUND_CREATED / REFUND_FAILED through the record_admin_audit RPC.
