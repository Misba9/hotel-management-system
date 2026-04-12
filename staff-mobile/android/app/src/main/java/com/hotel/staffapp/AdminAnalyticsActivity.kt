package com.hotel.staffapp

import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class AdminAnalyticsActivity : AppCompatActivity() {
  private lateinit var loadingView: ProgressBar
  private lateinit var totalOrdersText: TextView
  private lateinit var totalRevenueText: TextView
  private lateinit var pendingOrdersText: TextView
  private lateinit var deliveredOrdersText: TextView
  private lateinit var chartContainer: LinearLayout
  private lateinit var emptyChartText: TextView
  private var ordersListener: ListenerRegistration? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Analytics"
    setContentView(R.layout.activity_admin_analytics)

    loadingView = findViewById(R.id.analyticsLoading)
    totalOrdersText = findViewById(R.id.metricTotalOrdersToday)
    totalRevenueText = findViewById(R.id.metricTotalRevenue)
    pendingOrdersText = findViewById(R.id.metricPendingOrders)
    deliveredOrdersText = findViewById(R.id.metricDeliveredOrders)
    chartContainer = findViewById(R.id.ordersPerHourBars)
    emptyChartText = findViewById(R.id.emptyChartText)

    listenOrders()
  }

  override fun onDestroy() {
    super.onDestroy()
    ordersListener?.remove()
  }

  private fun listenOrders() {
    loadingView.visibility = View.VISIBLE
    ordersListener?.remove()

    ordersListener = FirebaseManager.firestore.collection("orders")
      .addSnapshotListener { snapshot, error ->
        loadingView.visibility = View.GONE
        if (error != null) {
          Log.e("AdminAnalytics", "Failed to load orders.", error)
          Toast.makeText(this, "Failed to load analytics.", Toast.LENGTH_SHORT).show()
          return@addSnapshotListener
        }

        val today = LocalDate.now()
        val hourly = IntArray(24) { 0 }
        var totalOrdersToday = 0
        var totalRevenue = 0.0
        var pendingOrders = 0
        var deliveredOrders = 0

        snapshot?.documents?.forEach { doc ->
          val status = (doc.getString("status") ?: "").trim().lowercase()
          if (status == "pending") pendingOrders += 1
          if (status == "delivered") deliveredOrders += 1

          val createdAt = parseCreatedAt(doc.get("createdAt")) ?: return@forEach
          val orderDate = createdAt.toLocalDate()
          if (orderDate == today) {
            totalOrdersToday += 1
            totalRevenue += (doc.getDouble("totalAmount")
              ?: doc.getDouble("total")
              ?: 0.0)
            hourly[createdAt.hour] += 1
          }
        }

        totalOrdersText.text = totalOrdersToday.toString()
        totalRevenueText.text = "Rs. ${totalRevenue.toInt()}"
        pendingOrdersText.text = pendingOrders.toString()
        deliveredOrdersText.text = deliveredOrders.toString()
        renderOrdersPerHourChart(hourly)
      }
  }

  private fun parseCreatedAt(raw: Any?): java.time.LocalDateTime? {
    return when (raw) {
      is Timestamp -> Instant.ofEpochMilli(raw.toDate().time).atZone(ZoneId.systemDefault()).toLocalDateTime()
      is String -> runCatching { Instant.parse(raw).atZone(ZoneId.systemDefault()).toLocalDateTime() }.getOrNull()
      else -> null
    }
  }

  private fun renderOrdersPerHourChart(hourly: IntArray) {
    chartContainer.removeAllViews()
    val maxValue = hourly.maxOrNull()?.coerceAtLeast(1) ?: 1
    val hasData = hourly.any { it > 0 }
    emptyChartText.visibility = if (hasData) View.GONE else View.VISIBLE

    hourly.forEachIndexed { hour, count ->
      val column = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = LinearLayout.LayoutParams(52, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
          marginEnd = 8
        }
      }

      val countText = TextView(this).apply {
        text = count.toString()
        textSize = 10f
        setTextColor(Color.parseColor("#475569"))
        textAlignment = View.TEXT_ALIGNMENT_CENTER
      }

      val barHeight = if (count == 0) 8 else ((count.toFloat() / maxValue.toFloat()) * 140f).toInt().coerceAtLeast(8)
      val bar = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          barHeight
        )
        setBackgroundColor(Color.parseColor("#F97316"))
      }

      val hourText = TextView(this).apply {
        text = hour.toString()
        textSize = 10f
        setTextColor(Color.parseColor("#64748B"))
        textAlignment = View.TEXT_ALIGNMENT_CENTER
      }

      column.addView(countText)
      column.addView(bar)
      column.addView(hourText)
      chartContainer.addView(column)
    }
  }
}
