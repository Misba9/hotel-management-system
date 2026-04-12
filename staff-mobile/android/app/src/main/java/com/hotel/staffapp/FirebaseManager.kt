package com.hotel.staffapp

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

object FirebaseManager {
  private const val TAG = "FirebaseManager"

  val auth: FirebaseAuth by lazy {
    FirebaseAuth.getInstance()
  }

  val firestore: FirebaseFirestore by lazy {
    FirebaseFirestore.getInstance()
  }

  fun initialize(context: Context) {
    try {
      if (FirebaseApp.getApps(context).isEmpty()) {
        FirebaseApp.initializeApp(context)
      }
      auth
      firestore
      Log.i(TAG, "FirebaseAuth and FirebaseFirestore are ready.")
    } catch (error: Exception) {
      Log.e(TAG, "Failed to initialize Firebase services.", error)
    }
  }
}
