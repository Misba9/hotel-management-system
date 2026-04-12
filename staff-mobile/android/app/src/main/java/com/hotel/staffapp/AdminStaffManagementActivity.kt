package com.hotel.staffapp

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.firestore.ListenerRegistration

class AdminStaffManagementActivity : AppCompatActivity() {
  private lateinit var recyclerView: RecyclerView
  private lateinit var loadingView: ProgressBar
  private lateinit var emptyText: TextView
  private lateinit var accessErrorText: TextView
  private val adapter = StaffUsersAdapter(
    onRoleChanged = { user, role -> updateUserRole(user.id, role) },
    onActiveChanged = { user, active -> updateUserActive(user.id, active) }
  )
  private var usersListener: ListenerRegistration? = null
  private var currentUid: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Staff Management"
    setContentView(R.layout.activity_admin_staff_management)

    recyclerView = findViewById(R.id.staffUsersRecyclerView)
    loadingView = findViewById(R.id.staffUsersLoading)
    emptyText = findViewById(R.id.staffUsersEmptyState)
    accessErrorText = findViewById(R.id.staffAccessErrorText)

    recyclerView.layoutManager = LinearLayoutManager(this)
    recyclerView.adapter = adapter
    recyclerView.setHasFixedSize(true)
    recyclerView.itemAnimator = null

    val uid = FirebaseManager.auth.currentUser?.uid
    if (uid.isNullOrBlank()) {
      denyAccess("No authenticated user.")
      return
    }
    currentUid = uid
    verifyAdminAndLoad()
  }

  override fun onDestroy() {
    super.onDestroy()
    usersListener?.remove()
  }

  private fun verifyAdminAndLoad() {
    loadingView.visibility = View.VISIBLE
    FirebaseManager.firestore.collection("users").document(currentUid)
      .get()
      .addOnSuccessListener { snapshot ->
        val role = (snapshot.getString("role") ?: "").trim().lowercase()
        val normalized = when (role) {
          "admin" -> "admin"
          else -> role
        }
        if (normalized != "admin") {
          denyAccess("Admin access only.")
          return@addOnSuccessListener
        }
        listenUsers()
      }
      .addOnFailureListener { error ->
        Log.e("AdminStaff", "Failed to verify admin role.", error)
        denyAccess("Failed to verify access.")
      }
  }

  private fun denyAccess(message: String) {
    loadingView.visibility = View.GONE
    recyclerView.visibility = View.GONE
    emptyText.visibility = View.GONE
    accessErrorText.visibility = View.VISIBLE
    accessErrorText.text = message
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
  }

  private fun listenUsers() {
    usersListener?.remove()
    usersListener = FirebaseManager.firestore.collection("users")
      .addSnapshotListener { snapshot, error ->
        loadingView.visibility = View.GONE
        if (error != null) {
          Log.e("AdminStaff", "Failed loading users.", error)
          Toast.makeText(this, "Failed to load users.", Toast.LENGTH_SHORT).show()
          return@addSnapshotListener
        }

        val rows = snapshot?.documents?.map { doc ->
          StaffUserUi(
            id = doc.id,
            name = (doc.getString("name") ?: doc.getString("fullName")).orEmpty().ifBlank { "—" },
            email = doc.getString("email").orEmpty().ifBlank { "—" },
            role = normalizeRole(doc.getString("role")),
            isActive = doc.getBoolean("isActive") != false
          )
        }?.sortedBy { it.name.lowercase() } ?: emptyList()

        adapter.submitList(rows)
        emptyText.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        recyclerView.visibility = if (rows.isEmpty()) View.GONE else View.VISIBLE
      }
  }

  private fun updateUserRole(userId: String, role: String) {
    FirebaseManager.firestore.collection("users").document(userId)
      .update("role", role)
      .addOnFailureListener { error ->
        Log.e("AdminStaff", "Failed updating role.", error)
        Toast.makeText(this, "Failed to update role.", Toast.LENGTH_SHORT).show()
      }
  }

  private fun updateUserActive(userId: String, active: Boolean) {
    FirebaseManager.firestore.collection("users").document(userId)
      .update("isActive", active)
      .addOnFailureListener { error ->
        Log.e("AdminStaff", "Failed updating status.", error)
        Toast.makeText(this, "Failed to update user status.", Toast.LENGTH_SHORT).show()
      }
  }

  private fun normalizeRole(raw: String?): String {
    val role = (raw ?: "").trim().lowercase()
    return when (role) {
      "kitchen_staff" -> "kitchen"
      "delivery_boy" -> "delivery"
      "cashier" -> "counter"
      "waiter", "kitchen", "delivery", "counter", "admin" -> role
      else -> "waiter"
    }
  }
}

data class StaffUserUi(
  val id: String,
  val name: String,
  val email: String,
  val role: String,
  val isActive: Boolean
)

private class StaffUsersAdapter(
  private val onRoleChanged: (StaffUserUi, String) -> Unit,
  private val onActiveChanged: (StaffUserUi, Boolean) -> Unit
) : RecyclerView.Adapter<StaffUsersAdapter.StaffUserViewHolder>() {
  private val items = mutableListOf<StaffUserUi>()
  private val roleOptions = listOf("kitchen", "delivery", "counter", "waiter")

  fun submitList(next: List<StaffUserUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StaffUserViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_staff_user, parent, false)
    return StaffUserViewHolder(view, roleOptions)
  }

  override fun onBindViewHolder(holder: StaffUserViewHolder, position: Int) {
    holder.bind(items[position], onRoleChanged, onActiveChanged)
  }

  override fun getItemCount(): Int = items.size

  class StaffUserViewHolder(itemView: View, roleOptions: List<String>) : RecyclerView.ViewHolder(itemView) {
    private val nameText: TextView = itemView.findViewById(R.id.staffNameText)
    private val emailText: TextView = itemView.findViewById(R.id.staffEmailText)
    private val roleSpinner: Spinner = itemView.findViewById(R.id.staffRoleSpinner)
    private val activeToggle: SwitchCompat = itemView.findViewById(R.id.staffActiveToggle)

    init {
      roleSpinner.adapter = ArrayAdapter(
        itemView.context,
        android.R.layout.simple_spinner_dropdown_item,
        roleOptions
      )
    }

    fun bind(
      user: StaffUserUi,
      onRoleChanged: (StaffUserUi, String) -> Unit,
      onActiveChanged: (StaffUserUi, Boolean) -> Unit
    ) {
      nameText.text = user.name
      emailText.text = user.email

      val currentIndex = (roleSpinner.adapter as ArrayAdapter<String>).getPosition(user.role)
      if (currentIndex >= 0 && roleSpinner.selectedItemPosition != currentIndex) {
        roleSpinner.setSelection(currentIndex, false)
      }

      roleSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
          val selected = parent?.getItemAtPosition(position)?.toString() ?: return
          if (selected != user.role) {
            onRoleChanged(user, selected)
          }
        }
        override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
      }

      activeToggle.setOnCheckedChangeListener(null)
      activeToggle.isChecked = user.isActive
      activeToggle.text = if (user.isActive) "Active" else "Inactive"
      activeToggle.setOnCheckedChangeListener { _, checked ->
        activeToggle.text = if (checked) "Active" else "Inactive"
        onActiveChanged(user, checked)
      }
    }
  }
}
