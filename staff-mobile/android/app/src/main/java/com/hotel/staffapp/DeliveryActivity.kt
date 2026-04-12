package com.hotel.staffapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.ListenerRegistration
import java.net.URLEncoder

class DeliveryActivity : AppCompatActivity() {
  private lateinit var recyclerView: RecyclerView
  private lateinit var progressBar: ProgressBar
  private lateinit var emptyText: TextView
  private val adapter = DeliveryOrdersAdapter(
    onAccept = { order -> acceptDelivery(order.id) },
    onPickedUp = { order -> updateStatus(order.id, "out_for_delivery") },
    onDelivered = { order -> updateStatus(order.id, "delivered") },
    onCall = { order -> openDialer(order.phone) },
    onMap = { order -> openMaps(order.address) }
  )
  private var readyListener: ListenerRegistration? = null
  private var assignedListener: ListenerRegistration? = null
  private val readyOrders = mutableMapOf<String, DeliveryOrderUi>()
  private val assignedOrders = mutableMapOf<String, DeliveryOrderUi>()
  private var currentUid: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Delivery"
    setContentView(R.layout.activity_delivery_dashboard)

    recyclerView = findViewById(R.id.deliveryRecyclerView)
    progressBar = findViewById(R.id.deliveryLoading)
    emptyText = findViewById(R.id.deliveryEmptyState)

    recyclerView.layoutManager = LinearLayoutManager(this)
    recyclerView.adapter = adapter

    val uid = FirebaseManager.auth.currentUser?.uid
    if (uid.isNullOrBlank()) {
      emptyText.visibility = View.VISIBLE
      emptyText.text = "No authenticated delivery user."
      return
    }
    currentUid = uid
    listenDeliveryOrders(uid)
  }

  override fun onDestroy() {
    super.onDestroy()
    readyListener?.remove()
    assignedListener?.remove()
  }

  private fun listenDeliveryOrders(uid: String) {
    setLoading(true)

    readyListener?.remove()
    assignedListener?.remove()

    // Query requirement: status = ready
    readyListener = FirebaseManager.firestore
      .collection("orders")
      .whereEqualTo("status", "ready")
      .addSnapshotListener { snapshot, error ->
        if (error != null) {
          Log.e("DeliveryActivity", "Ready orders listener failed.", error)
          return@addSnapshotListener
        }
        readyOrders.clear()
        snapshot?.documents?.forEach { doc ->
          val item = toDeliveryUi(doc)
          readyOrders[item.id] = item
        }
        renderAssignedOnly(uid)
      }

    // Query requirement: assigned to current user
    assignedListener = FirebaseManager.firestore
      .collection("orders")
      .whereEqualTo("deliveryBoyId", uid)
      .addSnapshotListener { snapshot, error ->
        if (error != null) {
          Log.e("DeliveryActivity", "Assigned orders listener failed.", error)
          Toast.makeText(this, "Failed loading delivery orders.", Toast.LENGTH_SHORT).show()
          setLoading(false)
          return@addSnapshotListener
        }
        assignedOrders.clear()
        snapshot?.documents?.forEach { doc ->
          val item = toDeliveryUi(doc)
          assignedOrders[item.id] = item
        }
        renderAssignedOnly(uid)
      }
  }

  private fun renderAssignedOnly(uid: String) {
    // Combine ready + assigned data, then show only assigned orders as requested.
    val combined = linkedMapOf<String, DeliveryOrderUi>()
    combined.putAll(readyOrders)
    combined.putAll(assignedOrders)

    val visible = combined.values
      .filter { it.deliveryBoyId == uid }
      .sortedByDescending { it.createdAtMs }

    adapter.submitList(visible)
    setLoading(false)
    emptyText.visibility = if (visible.isEmpty()) View.VISIBLE else View.GONE
  }

  private fun acceptDelivery(orderId: String) {
    if (currentUid.isBlank()) return
    FirebaseManager.firestore.collection("orders").document(orderId)
      .update(
        mapOf(
          "deliveryBoyId" to currentUid,
          "updatedAt" to Timestamp.now()
        )
      )
      .addOnSuccessListener {
        Toast.makeText(this, "Delivery accepted.", Toast.LENGTH_SHORT).show()
      }
      .addOnFailureListener { error ->
        Log.e("DeliveryActivity", "Failed to accept delivery.", error)
        Toast.makeText(this, "Failed to accept delivery.", Toast.LENGTH_SHORT).show()
      }
  }

  private fun updateStatus(orderId: String, next: String) {
    FirebaseManager.firestore.collection("orders").document(orderId)
      .update(
        mapOf(
          "status" to next,
          "updatedAt" to Timestamp.now()
        )
      )
      .addOnSuccessListener {
        Toast.makeText(this, "Order updated: $next", Toast.LENGTH_SHORT).show()
      }
      .addOnFailureListener { error ->
        Log.e("DeliveryActivity", "Failed to update delivery status.", error)
        Toast.makeText(this, "Failed to update status.", Toast.LENGTH_SHORT).show()
      }
  }

  private fun openDialer(phone: String) {
    if (phone.isBlank()) {
      Toast.makeText(this, "Phone number not available.", Toast.LENGTH_SHORT).show()
      return
    }
    startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
  }

  private fun openMaps(address: String) {
    if (address.isBlank()) {
      Toast.makeText(this, "Address not available.", Toast.LENGTH_SHORT).show()
      return
    }
    val encoded = URLEncoder.encode(address, "UTF-8")
    val uri = Uri.parse("google.navigation:q=$encoded")
    val mapsIntent = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage("com.google.android.apps.maps")
    }
    if (mapsIntent.resolveActivity(packageManager) != null) {
      startActivity(mapsIntent)
    } else {
      val browserUri = Uri.parse("https://www.google.com/maps/search/?api=1&query=$encoded")
      startActivity(Intent(Intent.ACTION_VIEW, browserUri))
    }
  }

  private fun toDeliveryUi(doc: DocumentSnapshot): DeliveryOrderUi {
    val status = doc.getString("status").orEmpty()
    val createdAtMs = when (val value = doc.get("createdAt")) {
      is Timestamp -> value.toDate().time
      is String -> runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
      else -> 0L
    }
    return DeliveryOrderUi(
      id = doc.id,
      customerName = doc.getString("customerName").orEmpty(),
      phone = doc.getString("phone").orEmpty(),
      address = (doc.getString("address") ?: doc.getString("deliveryAddress")).orEmpty(),
      status = status,
      deliveryBoyId = doc.getString("deliveryBoyId").orEmpty(),
      createdAtMs = createdAtMs
    )
  }

  private fun setLoading(loading: Boolean) {
    progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    if (loading) emptyText.visibility = View.GONE
  }
}

data class DeliveryOrderUi(
  val id: String,
  val customerName: String,
  val phone: String,
  val address: String,
  val status: String,
  val deliveryBoyId: String,
  val createdAtMs: Long
)

private class DeliveryOrdersAdapter(
  private val onAccept: (DeliveryOrderUi) -> Unit,
  private val onPickedUp: (DeliveryOrderUi) -> Unit,
  private val onDelivered: (DeliveryOrderUi) -> Unit,
  private val onCall: (DeliveryOrderUi) -> Unit,
  private val onMap: (DeliveryOrderUi) -> Unit
) : RecyclerView.Adapter<DeliveryOrdersAdapter.DeliveryOrderViewHolder>() {

  private val items = mutableListOf<DeliveryOrderUi>()

  fun submitList(next: List<DeliveryOrderUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DeliveryOrderViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_delivery_order, parent, false)
    return DeliveryOrderViewHolder(view)
  }

  override fun onBindViewHolder(holder: DeliveryOrderViewHolder, position: Int) {
    holder.bind(items[position], onAccept, onPickedUp, onDelivered, onCall, onMap)
  }

  override fun getItemCount(): Int = items.size

  class DeliveryOrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val nameText: TextView = itemView.findViewById(R.id.deliveryCustomerName)
    private val phoneText: TextView = itemView.findViewById(R.id.deliveryPhone)
    private val addressText: TextView = itemView.findViewById(R.id.deliveryAddress)
    private val statusText: TextView = itemView.findViewById(R.id.deliveryStatus)
    private val acceptButton: Button = itemView.findViewById(R.id.deliveryAcceptButton)
    private val pickedButton: Button = itemView.findViewById(R.id.deliveryPickedButton)
    private val deliveredButton: Button = itemView.findViewById(R.id.deliveryDeliveredButton)
    private val callButton: Button = itemView.findViewById(R.id.deliveryCallButton)
    private val mapButton: Button = itemView.findViewById(R.id.deliveryMapButton)

    fun bind(
      order: DeliveryOrderUi,
      onAccept: (DeliveryOrderUi) -> Unit,
      onPickedUp: (DeliveryOrderUi) -> Unit,
      onDelivered: (DeliveryOrderUi) -> Unit,
      onCall: (DeliveryOrderUi) -> Unit,
      onMap: (DeliveryOrderUi) -> Unit
    ) {
      nameText.text = if (order.customerName.isBlank()) "Customer" else order.customerName
      phoneText.text = "Phone: ${if (order.phone.isBlank()) "N/A" else order.phone}"
      addressText.text = "Address: ${if (order.address.isBlank()) "N/A" else order.address}"
      statusText.text = "Status: ${order.status}"

      val status = order.status.lowercase()
      acceptButton.visibility = if (status == "ready") View.VISIBLE else View.GONE
      pickedButton.visibility = if (status == "ready" || status == "accepted") View.VISIBLE else View.GONE
      deliveredButton.visibility = if (status == "out_for_delivery") View.VISIBLE else View.GONE

      acceptButton.setOnClickListener { onAccept(order) }
      pickedButton.setOnClickListener { onPickedUp(order) }
      deliveredButton.setOnClickListener { onDelivered(order) }
      callButton.setOnClickListener { onCall(order) }
      mapButton.setOnClickListener { onMap(order) }
    }
  }
}
