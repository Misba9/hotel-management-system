# Firestore Schema

Collections:

- `users`: profile, role, loyalty, referral
- `roles`: role permissions
- `menu_categories`: category metadata per branch
- `menu_items`: item pricing, availability
- `orders`: top-level order doc with denormalized fields (`dayKey`, `statusBucket`)
- `order_items`: line items for each order
- `payments`: Razorpay/COD records with verification fields
- `addresses`: saved customer addresses
- `delivery_assignments`: delivery rider assignment and status
- `staff`: staff profile, live status, active workload
- `inventory`: ingredient stock and low stock flags
- `coupons`: discount rules and limits
- `notifications`: in-app push feed records
- `branches`: branch metadata and geolocation

Performance notes:

- Use `dayKey` (`YYYY-MM-DD`) for daily analytics partitions.
- Keep `statusBucket` (`active`/`completed`) in `orders` to avoid expensive OR queries.
- Keep branch-level denormalized counters in aggregate docs updated by Cloud Functions.
