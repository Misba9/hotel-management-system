package com.hotel.staffapp

import android.graphics.Color
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
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query

class KitchenActivity : AppCompatActivity() {
  private lateinit var recyclerView: RecyclerView
  private lateinit var progressBar: ProgressBar
  private lateinit var emptyText: TextView
  private val adapter = KitchenOrdersAdapter(
    onAccept = { order -> updateOrderStatus(order.id, "preparing") },
    onReady = { order -> updateOrderStatus(order.id, "ready") }
  )
  private var ordersListener: ListenerRegistration? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Kitchen"
    setContentView(R.layout.activity_kitchen_dashboard)

    recyclerView = findViewById(R.id.ordersRecyclerView)
    progressBar = findViewById(R.id.loadingProgress)
    emptyText = findViewById(R.id.emptyStateText)

    recyclerView.layoutManager = LinearLayoutManager(this)
    recyclerView.adapter = adapter

    listenForKitchenOrders()
  }

  override fun onDestroy() {
    super.onDestroy()
    ordersListener?.remove()
  }

  private fun listenForKitchenOrders() {
    setLoading(true)
    ordersListener?.remove()

    ordersListener = FirebaseManager.firestore
      .collection("orders")
      .whereIn("status", listOf("pending", "preparing"))
      .orderBy("createdAt", Query.Direction.DESCENDING)
      .addSnapshotListener { snapshot, error ->
        if (error != null) {
          Log.e("KitchenActivity", "Failed to listen kitchen orders.", error)
          setLoading(false)
          Toast.makeText(this, "Failed to load kitchen orders.", Toast.LENGTH_SHORT).show()
          return@addSnapshotListener
        }

        val rows = snapshot?.documents?.map { doc ->
          val status = doc.getString("status") ?: "pending"
          val createdAt = doc.get("createdAt")
          val itemsRaw = doc.get("items")
          KitchenOrderUi(
            id = doc.id,
            status = status,
            itemsText = formatItems(itemsRaw),
            timeText = formatCreatedAt(createdAt)
          )
        } ?: emptyList()

        adapter.submitList(rows)
        setLoading(false)
        emptyText.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
      }
  }

  private fun updateOrderStatus(orderId: String, status: String) {
    FirebaseManager.firestore.collection("orders").document(orderId)
      .update(
        mapOf(
          "status" to status,
          "updatedAt" to Timestamp.now()
        )
      )
      .addOnSuccessListener {
        Toast.makeText(this, "Order updated to $status", Toast.LENGTH_SHORT).show()
      }
      .addOnFailureListener { error ->
        Log.e("KitchenActivity", "Failed to update status.", error)
        Toast.makeText(this, "Failed to update order status.", Toast.LENGTH_SHORT).show()
      }
  }

  private fun setLoading(loading: Boolean) {
    progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    if (loading) {
      emptyText.visibility = View.GONE
    }
  }

  private fun formatItems(raw: Any?): String {
    if (raw !is List<*>) return "No items"
    val lines = raw.mapNotNull { item ->
      val map = item as? Map<*, *> ?: return@mapNotNull null
      val name = map["name"]?.toString()?.trim().orEmpty()
      val qty = map["qty"] ?: map["quantity"] ?: 1
      if (name.isBlank()) null else "$name x$qty"
    }
    return if (lines.isEmpty()) "No items" else lines.joinToString(separator = "\n")
  }

  private fun formatCreatedAt(raw: Any?): String {
    val date = when (raw) {
      is Timestamp -> raw.toDate()
      is String -> runCatching { java.util.Date(java.time.Instant.parse(raw).toEpochMilli()) }.getOrNull()
      else -> null
    } ?: return "Time: --"
    val elapsedMs = System.currentTimeMillis() - date.time
    val mins = (elapsedMs / 60000).toInt().coerceAtLeast(0)
    return if (mins < 60) "Time: ${mins}m ago" else "Time: ${mins / 60}h ${mins % 60}m ago"
  }
}

data class KitchenOrderUi(
  val id: String,
  val itemsText: String,
  val status: String,
  val timeText: String
)

private class KitchenOrdersAdapter(
  private val onAccept: (KitchenOrderUi) -> Unit,
  private val onReady: (KitchenOrderUi) -> Unit
) : RecyclerView.Adapter<KitchenOrdersAdapter.KitchenOrderViewHolder>() {

  private val items = mutableListOf<KitchenOrderUi>()

  fun submitList(next: List<KitchenOrderUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): KitchenOrderViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_kitchen_order, parent, false)
    return KitchenOrderViewHolder(view)
  }

  override fun onBindViewHolder(holder: KitchenOrderViewHolder, position: Int) {
    holder.bind(items[position], onAccept, onReady)
  }

  override fun getItemCount(): Int = items.size

  class KitchenOrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val cardRoot: CardView = itemView.findViewById(R.id.orderCardRoot)
    private val orderIdText: TextView = itemView.findViewById(R.id.orderIdText)
    private val itemsText: TextView = itemView.findViewById(R.id.orderItemsText)
    private val statusText: TextView = itemView.findViewById(R.id.orderStatusText)
    private val timeText: TextView = itemView.findViewById(R.id.orderTimeText)
    private val acceptButton: Button = itemView.findViewById(R.id.acceptButton)
    private val readyButton: Button = itemView.findViewById(R.id.readyButton)

    fun bind(
      order: KitchenOrderUi,
      onAccept: (KitchenOrderUi) -> Unit,
      onReady: (KitchenOrderUi) -> Unit
    ) {
      orderIdText.text = "Order ID: ${order.id}"
      itemsText.text = order.itemsText
      statusText.text = "Status: ${order.status}"
      timeText.text = order.timeText

      val status = order.status.lowercase()
      val cardColor = when (status) {
        "pending" -> Color.parseColor("#FEF3C7")
        "preparing" -> Color.parseColor("#DBEAFE")
        "ready" -> Color.parseColor("#DCFCE7")
        else -> Color.parseColor("#FFFFFF")
      }
      cardRoot.setCardBackgroundColor(cardColor)

      acceptButton.visibility = if (status == "pending") View.VISIBLE else View.GONE
      readyButton.visibility = if (status == "preparing") View.VISIBLE else View.GONE

      acceptButton.setOnClickListener { onAccept(order) }
      readyButton.setOnClickListener { onReady(order) }
    }
  }
}
