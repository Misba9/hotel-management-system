# 🍹 Fruit Hotel Management Platform

A complete Restaurant / Hotel Management SaaS Platform built with Firebase.
---


# 📂 Project Structure

```text

fruit-hotel-management-platform

│

├── admin-dashboard      # Admin Web Application

├── customer-web         # Customer Website

├── customer-mobile      # React Native Customer App

├── staff-desktop        # Staff Desktop (Electron/Web)

├── staff-mobile         # React Native Staff App

├── backend              # Optional Node.js API

├── functions            # Firebase Cloud Functions

├── shared               # Shared Components & Utilities

├── packages             # Shared Packages

├── firebase.json

├── firestore.rules

├── storage.rules

└── package.json

```

---
# 🚀 Prerequisites

Install:

- Node.js 20+
- npm
- Firebase CLI
- Android Studio (for Android)
- Xcode (for iOS - macOS only)
- Java JDK 17+




---

# 💻 Run Applications



Each application runs independently.

Open a separate terminal for each application.


## Admin Dashboard

```bash

cd admin-dashboard

npm install & npm run dev

```

---

## Customer Web

```bash

cd customer-web

npm install & npm run dev

```
---

## Customer Mobile

```bash

cd customer-mobile

npm install && npm run dev

```

---

## Staff Desktop

```bash

cd staff-desktop

npm install && npm run dev

```

---

## Staff Mobile

```bash

cd staff-mobile

npm install && npm run dev

```

---

## Firebase Functions

```bash

cd functions

npm install

```

---

# ☁️ Firebase Deployment

---

## Deploy Customer Website

```bash

cd customer-web
npm run build
firebase deploy --only hosting

```
---

## Deploy Admin Dashboard

```bash

cd admin-dashboard
npm run build
firebase deploy --only hosting

```
---

## Deploy Firebase Functions

```bash
firebase deploy --only functions

```
---

## Deploy Firestore Rules

```bash

firebase deploy --only firestore

```
---

## Deploy Storage Rules
```bash

firebase deploy --only storage

```
---

## Deploy Everything

```bash

firebase deploy

```

---

# 📱 Build Mobile Apps

## Android APK

Customer App

```bash
cd customer-mobile/android
./gradlew assembleRelease

```
Output

```text

android/app/build/outputs/apk/release/app-release.apk

```
---

Staff App


```bash

cd staff-mobile/android
./gradlew assembleRelease

```
---

## Android AAB

```bash

./gradlew bundleRelease

```

Output

```text

android/app/build/outputs/bundle/release/app-release.aab

```

Upload the AAB to the Google Play Console.

---


# 📌 Notes

- Admin Dashboard and Customer Website are deployed using Firebase Hosting.
- Customer Mobile and Staff Mobile connect directly to Firebase services.
- The Backend folder is optional and only required if you maintain a separate Node.js API.
- Use the Firebase Emulator Suite for local testing of Cloud Functions and Firestore.

---

# 👨‍💻 Tech Stack

- React
- React Native
- Electron
- TypeScript
- Node.js

---

# 📄 License



Private Project © Fruit Hotel Management Platform