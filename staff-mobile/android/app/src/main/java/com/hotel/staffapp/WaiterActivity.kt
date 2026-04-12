package com.hotel.staffapp

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
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration

class WaiterActivity : AppCompatActivity() {
  private lateinit var tablesSection: View
  private lateinit var orderSection: View
  private lateinit var tableRecyclerView: RecyclerView
  private lateinit var menuRecyclerView: RecyclerView
  private lateinit var cartRecyclerView: RecyclerView
  private lateinit var loadingView: ProgressBar
  private lateinit var selectedTableText: TextView
  private lateinit var totalText: TextView
  private lateinit var placeOrderButton: Button
  private lateinit var backToTablesButton: Button

  private val tableAdapter = TableAdapter { tableNo -> openOrderScreen(tableNo) }
  private val menuAdapter = WaiterMenuAdapter { product -> addToCart(product) }
  private val cartAdapter = WaiterCartAdapter(
    onIncrease = { item -> addToCart(item.toProduct()) },
    onDecrease = { item -> decreaseCartItem(item.productId) }
  )

  private val cartMap = linkedMapOf<String, WaiterCartItemUi>()
  private var productsListener: ListenerRegistration? = null
  private var selectedTable: Int? = null
  private var placing = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Waiter"
    setContentView(R.layout.activity_waiter_ordering)

    tablesSection = findViewById(R.id.tablesSection)
    orderSection = findViewById(R.id.orderSection)
    tableRecyclerView = findViewById(R.id.tablesRecyclerView)
    menuRecyclerView = findViewById(R.id.waiterMenuRecyclerView)
    cartRecyclerView = findViewById(R.id.waiterCartRecyclerView)
    loadingView = findViewById(R.id.waiterLoading)
    selectedTableText = findViewById(R.id.selectedTableText)
    totalText = findViewById(R.id.waiterTotalText)
    placeOrderButton = findViewById(R.id.waiterPlaceOrderButton)
    backToTablesButton = findViewById(R.id.backToTablesButton)

    tableRecyclerView.layoutManager = GridLayoutManager(this, 4)
    tableRecyclerView.adapter = tableAdapter
    tableRecyclerView.setHasFixedSize(true)
    tableRecyclerView.itemAnimator = null

    menuRecyclerView.layoutManager = GridLayoutManager(this, 2)
    menuRecyclerView.adapter = menuAdapter
    menuRecyclerView.setHasFixedSize(true)
    menuRecyclerView.itemAnimator = null

    cartRecyclerView.layoutManager = LinearLayoutManager(this)
    cartRecyclerView.adapter = cartAdapter
    cartRecyclerView.setHasFixedSize(true)
    cartRecyclerView.itemAnimator = null

    tableAdapter.submitList((1..20).toList())
    renderCart()

    backToTablesButton.setOnClickListener {
      selectedTable = null
      cartMap.clear()
      renderCart()
      showTableScreen()
    }

    placeOrderButton.setOnClickListener {
      placeOrder()
    }

    showTableScreen()
    listenProducts()
  }

  override fun onDestroy() {
    super.onDestroy()
    productsListener?.remove()
  }

  private fun showTableScreen() {
    tablesSection.visibility = View.VISIBLE
    orderSection.visibility = View.GONE
  }

  private fun openOrderScreen(tableNo: Int) {
    selectedTable = tableNo
    selectedTableText.text = "Table $tableNo"
    tablesSection.visibility = View.GONE
    orderSection.visibility = View.VISIBLE
  }

  private fun listenProducts() {
    loadingView.visibility = View.VISIBLE
    productsListener?.remove()
    productsListener = FirebaseManager.firestore.collection("products")
      .addSnapshotListener { snapshot, error ->
        loadingView.visibility = View.GONE
        if (error != null) {
          Log.e("WaiterActivity", "Failed to load products.", error)
          Toast.makeText(this, "Failed to load menu.", Toast.LENGTH_SHORT).show()
          return@addSnapshotListener
        }
        val products = snapshot?.documents?.mapNotNull { doc ->
          val available = doc.getBoolean("isAvailable")
            ?: doc.getBoolean("available")
            ?: false
          if (!available) return@mapNotNull null
          WaiterProductUi(
            id = doc.id,
            name = doc.getString("name").orEmpty().ifBlank { "Unnamed" },
            price = (doc.getDouble("price") ?: 0.0).toInt()
          )
        } ?: emptyList()
        menuAdapter.submitList(products)
      }
  }

  private fun addToCart(product: WaiterProductUi) {
    val existing = cartMap[product.id]
    if (existing == null) {
      cartMap[product.id] = WaiterCartItemUi(product.id, product.name, product.price, 1)
    } else {
      cartMap[product.id] = existing.copy(quantity = existing.quantity + 1)
    }
    renderCart()
  }

  private fun decreaseCartItem(productId: String) {
    val existing = cartMap[productId] ?: return
    val next = existing.quantity - 1
    if (next <= 0) {
      cartMap.remove(productId)
    } else {
      cartMap[productId] = existing.copy(quantity = next)
    }
    renderCart()
  }

  private fun renderCart() {
    val cartItems = cartMap.values.toList()
    cartAdapter.submitList(cartItems)
    val total = cartItems.sumOf { it.price * it.quantity }
    totalText.text = "Total: Rs. $total"
    placeOrderButton.isEnabled = cartItems.isNotEmpty() && selectedTable != null && !placing
    placeOrderButton.alpha = if (placeOrderButton.isEnabled) 1f else 0.6f
  }

  private fun placeOrder() {
    val tableNo = selectedTable
    if (tableNo == null) {
      Toast.makeText(this, "Select a table first.", Toast.LENGTH_SHORT).show()
      return
    }
    if (cartMap.isEmpty()) {
      Toast.makeText(this, "Add items to cart.", Toast.LENGTH_SHORT).show()
      return
    }
    if (placing) return

    placing = true
    renderCart()

    val cartItems = cartMap.values.toList()
    val totalAmount = cartItems.sumOf { it.price * it.quantity }

    val payload = hashMapOf(
      "type" to "dine-in",
      "orderType" to "dine-in",
      "tableNumber" to tableNo,
      "status" to "pending",
      "totalAmount" to totalAmount,
      "createdAt" to Timestamp.now(),
      "updatedAt" to Timestamp.now(),
      "items" to cartItems.map {
        mapOf(
          "name" to it.name,
          "qty" to it.quantity,
          "price" to it.price
        )
      }
    )

    FirebaseManager.firestore.collection("orders")
      .add(payload)
      .addOnSuccessListener {
        Toast.makeText(this, "Order sent to kitchen.", Toast.LENGTH_SHORT).show()
        cartMap.clear()
        placing = false
        renderCart()
      }
      .addOnFailureListener { error ->
        Log.e("WaiterActivity", "Failed to place order.", error)
        Toast.makeText(this, "Failed to place order.", Toast.LENGTH_SHORT).show()
        placing = false
        renderCart()
      }
  }
}

data class WaiterProductUi(
  val id: String,
  val name: String,
  val price: Int
)

data class WaiterCartItemUi(
  val productId: String,
  val name: String,
  val price: Int,
  val quantity: Int
) {
  fun toProduct(): WaiterProductUi = WaiterProductUi(productId, name, price)
}

private class TableAdapter(
  private val onTap: (Int) -> Unit
) : RecyclerView.Adapter<TableAdapter.TableViewHolder>() {
  private val items = mutableListOf<Int>()

  fun submitList(next: List<Int>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TableViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_waiter_table, parent, false)
    return TableViewHolder(view)
  }

  override fun onBindViewHolder(holder: TableViewHolder, position: Int) {
    holder.bind(items[position], onTap)
  }

  override fun getItemCount(): Int = items.size

  class TableViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val button: Button = itemView.findViewById(R.id.tableButton)
    fun bind(tableNo: Int, onTap: (Int) -> Unit) {
      button.text = tableNo.toString()
      button.setOnClickListener { onTap(tableNo) }
    }
  }
}

private class WaiterMenuAdapter(
  private val onAdd: (WaiterProductUi) -> Unit
) : RecyclerView.Adapter<WaiterMenuAdapter.MenuViewHolder>() {
  private val items = mutableListOf<WaiterProductUi>()

  fun submitList(next: List<WaiterProductUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MenuViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_waiter_product, parent, false)
    return MenuViewHolder(view)
  }

  override fun onBindViewHolder(holder: MenuViewHolder, position: Int) {
    holder.bind(items[position], onAdd)
  }

  override fun getItemCount(): Int = items.size

  class MenuViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val name: TextView = itemView.findViewById(R.id.waiterProductName)
    private val price: TextView = itemView.findViewById(R.id.waiterProductPrice)
    private val addButton: Button = itemView.findViewById(R.id.waiterProductAddButton)

    fun bind(item: WaiterProductUi, onAdd: (WaiterProductUi) -> Unit) {
      name.text = item.name
      price.text = "Rs. ${item.price}"
      addButton.setOnClickListener { onAdd(item) }
    }
  }
}

private class WaiterCartAdapter(
  private val onIncrease: (WaiterCartItemUi) -> Unit,
  private val onDecrease: (WaiterCartItemUi) -> Unit
) : RecyclerView.Adapter<WaiterCartAdapter.CartViewHolder>() {
  private val items = mutableListOf<WaiterCartItemUi>()

  fun submitList(next: List<WaiterCartItemUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CartViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_waiter_cart, parent, false)
    return CartViewHolder(view)
  }

  override fun onBindViewHolder(holder: CartViewHolder, position: Int) {
    holder.bind(items[position], onIncrease, onDecrease)
  }

  override fun getItemCount(): Int = items.size

  class CartViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val name: TextView = itemView.findViewById(R.id.waiterCartName)
    private val linePrice: TextView = itemView.findViewById(R.id.waiterCartLinePrice)
    private val qty: TextView = itemView.findViewById(R.id.waiterCartQty)
    private val plus: Button = itemView.findViewById(R.id.waiterCartPlus)
    private val minus: Button = itemView.findViewById(R.id.waiterCartMinus)

    fun bind(
      item: WaiterCartItemUi,
      onIncrease: (WaiterCartItemUi) -> Unit,
      onDecrease: (WaiterCartItemUi) -> Unit
    ) {
      name.text = item.name
      linePrice.text = "Rs. ${item.price * item.quantity}"
      qty.text = item.quantity.toString()
      plus.setOnClickListener { onIncrease(item) }
      minus.setOnClickListener { onDecrease(item) }
    }
  }
}
