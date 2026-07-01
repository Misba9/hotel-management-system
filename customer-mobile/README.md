# Nausheen Fruits — Customer Mobile

React Native Expo app for customers. Mirrors `customer-web` business logic with a native UI.

## Setup

1. Copy `.env.example` to `.env` and fill Firebase + API values (same project as `customer-web`).
2. Copy `google-services.json` from Firebase Console (Android) — or reuse from `staff-mobile` for dev.
3. From repo root:

```bash
npm install
npm run dev:customer-mobile
```

## API

Set `EXPO_PUBLIC_API_BASE_URL` to your `customer-web` deployment (e.g. `http://localhost:3000` in dev). Checkout, coupons, cart sync, and auth email/OTP routes call this backend unchanged.

## Architecture

- **Expo Router** — file-based navigation (`app/`)
- **Firebase** — Auth (AsyncStorage persistence), Firestore (menu, orders, profile, notifications)
- **Shared** — `@shared/types`, `@shared/hooks/useFirebaseMenu`, `@shared/theme/react-native`
- **State** — React Context (auth, cart, favorites) + React Query provider
- **Secure storage** — `expo-secure-store` for ID token cache

## Screens

Auth: Splash, Login, Signup, OTP, Forgot Password  
Tabs: Home, Search, Cart, Orders, Profile  
Stack: Categories, Product Details, Wishlist, Checkout, Order Success, Tracking, Notifications, Coupons, Addresses, Settings, Help
