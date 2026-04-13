package com.hotel.staffapp

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException

class LoginActivity : AppCompatActivity() {
  private lateinit var emailInput: EditText
  private lateinit var passwordInput: EditText
  private lateinit var loginButton: Button
  private lateinit var loadingIndicator: ProgressBar
  private lateinit var errorText: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_login)

    FirebaseManager.initialize(this)

    emailInput = findViewById(R.id.emailInput)
    passwordInput = findViewById(R.id.passwordInput)
    loginButton = findViewById(R.id.loginButton)
    loadingIndicator = findViewById(R.id.loadingIndicator)
    errorText = findViewById(R.id.errorText)

    loginButton.setOnClickListener {
      attemptLogin()
    }
  }

  private fun attemptLogin() {
    val email = emailInput.text.toString().trim()
    val password = passwordInput.text.toString()

    val validationError = validateInputs(email, password)
    if (validationError != null) {
      showError(validationError)
      return
    }

    setLoading(true)
    FirebaseManager.auth.signInWithEmailAndPassword(email, password)
      .addOnSuccessListener { result ->
        val uid = result.user?.uid
        if (uid.isNullOrBlank()) {
          setLoading(false)
          showError("Login succeeded but user UID is missing.")
          return@addOnSuccessListener
        }
        fetchUserRole(uid)
      }
      .addOnFailureListener { error ->
        setLoading(false)
        val message = when (error) {
          is FirebaseAuthInvalidUserException -> "User does not exist."
          is FirebaseAuthInvalidCredentialsException -> "Invalid email or password."
          else -> error.message ?: "Login failed. Please try again."
        }
        Log.e("LoginActivity", "Sign-in failed.", error)
        showError(message)
      }
  }

  private fun fetchUserRole(uid: String) {
    FirebaseManager.firestore.collection("users").document(uid)
      .get()
      .addOnSuccessListener { snapshot ->
        setLoading(false)
        if (!snapshot.exists()) {
          showError("User profile not found in Firestore.")
          return@addOnSuccessListener
        }
        val role = (snapshot.getString("role") ?: "unknown").trim().lowercase()
        Toast.makeText(this, "Login successful as $role", Toast.LENGTH_SHORT).show()
        Log.i("LoginActivity", "User role: $role")

        val destination = when (role) {
          "kitchen", "kitchen_staff" -> KitchenActivity::class.java
          "delivery", "delivery_boy" -> DeliveryActivity::class.java
          "counter", "cashier" -> CounterActivity::class.java
          "waiter" -> WaiterActivity::class.java
          "admin", "manager" -> MainActivity::class.java
          else -> null
        }

        if (destination == null) {
          val message = "Invalid role '$role'. Contact administrator."
          Log.e("LoginActivity", message)
          showError(message)
          return@addOnSuccessListener
        }

        val intent = Intent(this, destination).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        startActivity(intent)
        finishAffinity()
      }
      .addOnFailureListener { error ->
        setLoading(false)
        Log.e("LoginActivity", "Failed to fetch user role.", error)
        showError(error.message ?: "Failed to fetch user profile.")
      }
  }

  private fun validateInputs(email: String, password: String): String? {
    if (email.isBlank()) return "Email is required."
    val emailRegex = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")
    if (!emailRegex.matches(email)) return "Please enter a valid email."
    if (password.isBlank()) return "Password is required."
    if (password.length < 6) return "Password must be at least 6 characters."
    return null
  }

  private fun setLoading(loading: Boolean) {
    loadingIndicator.visibility = if (loading) View.VISIBLE else View.GONE
    loginButton.isEnabled = !loading
    emailInput.isEnabled = !loading
    passwordInput.isEnabled = !loading
    if (loading) {
      errorText.visibility = View.GONE
    }
  }

  private fun showError(message: String) {
    errorText.text = message
    errorText.visibility = View.VISIBLE
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
  }
}
