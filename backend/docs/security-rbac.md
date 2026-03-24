# RBAC Strategy

- Use Firebase Auth custom claims with `role` key.
- Source of permissions remains in `roles` collection.
- Privileged writes (payments, delivery assignment, inventory mutation) happen through Cloud Functions.
- Function middleware:
  - `assertRole()` for role checks
  - `rateLimit()` for endpoint throttling using RTDB
  - `withIdempotency()` for payment/order duplicate protection

Example claim set:

```json
{
  "role": "manager"
}
```
