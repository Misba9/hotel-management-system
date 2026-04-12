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
import com.facebook.drawee.view.SimpleDraweeView
import com.google.firebase.Timestamp
import com.google.firebase.firestore.ListenerRegistration

class CounterActivity : AppCompatActivity() {
  private lateinit var productsRecyclerView: RecyclerView
  private lateinit var cartRecyclerView: RecyclerView
  private lateinit var loadingView: ProgressBar
  private lateinit var emptyProductsText: TextView
  private lateinit var totalText: TextView
  private lateinit var placeOrderButton: Button

  private val productsAdapter = ProductAdapter { product -> addToCart(product) }
  private val cartAdapter = CartAdapter(
    onIncrease = { item -> addToCart(item.toProduct()) },
    onDecrease = { item -> decreaseCartItem(item.productId) }
  )

  private val cartMap = linkedMapOf<String, CartItemUi>()
  private var productsListener: ListenerRegistration? = null
  private var placingOrder = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "Counter"
    setContentView(R.layout.activity_counter_pos)

    productsRecyclerView = findViewById(R.id.productsRecyclerView)
    cartRecyclerView = findViewById(R.id.cartRecyclerView)
    loadingView = findViewById(R.id.posLoading)
    emptyProductsText = findViewById(R.id.emptyProductsText)
    totalText = findViewById(R.id.totalAmountText)
    placeOrderButton = findViewById(R.id.placeOrderButton)

    productsRecyclerView.layoutManager = GridLayoutManager(this, 2)
    productsRecyclerView.adapter = productsAdapter
    productsRecyclerView.setHasFixedSize(true)
    productsRecyclerView.itemAnimator = null

    cartRecyclerView.layoutManager = LinearLayoutManager(this)
    cartRecyclerView.adapter = cartAdapter
    cartRecyclerView.setHasFixedSize(true)
    cartRecyclerView.itemAnimator = null

    placeOrderButton.setOnClickListener {
      placeOrder()
    }

    listenProducts()
    renderCart()
  }

  override fun onDestroy() {
    super.onDestroy()
    productsListener?.remove()
  }

  private fun listenProducts() {
    loadingView.visibility = View.VISIBLE
    productsListener?.remove()
    productsListener = FirebaseManager.firestore.collection("products")
      .addSnapshotListener { snapshot, error ->
        loadingView.visibility = View.GONE
        if (error != null) {
          Log.e("CounterActivity", "Failed to load products.", error)
          emptyProductsText.visibility = View.VISIBLE
          emptyProductsText.text = "Failed to load products."
          return@addSnapshotListener
        }
        val products = snapshot?.documents?.mapNotNull { doc ->
          val available = doc.getBoolean("isAvailable")
            ?: doc.getBoolean("available")
            ?: false
          if (!available) return@mapNotNull null

          ProductUi(
            id = doc.id,
            name = doc.getString("name").orEmpty().ifBlank { "Unnamed" },
            price = (doc.getDouble("price") ?: 0.0).toInt(),
            imageUrl = doc.getString("image") ?: doc.getString("imageUrl")
          )
        } ?: emptyList()

        productsAdapter.submitList(products)
        emptyProductsText.visibility = if (products.isEmpty()) View.VISIBLE else View.GONE
      }
  }

  private fun addToCart(product: ProductUi) {
    val existing = cartMap[product.id]
    if (existing == null) {
      cartMap[product.id] = CartItemUi(product.id, product.name, product.price, 1)
    } else {
      cartMap[product.id] = existing.copy(quantity = existing.quantity + 1)
    }
    renderCart()
  }

  private fun decreaseCartItem(productId: String) {
    val existing = cartMap[productId] ?: return
    val nextQty = existing.quantity - 1
    if (nextQty <= 0) {
      cartMap.remove(productId)
    } else {
      cartMap[productId] = existing.copy(quantity = nextQty)
    }
    renderCart()
  }

  private fun renderCart() {
    val cartItems = cartMap.values.toList()
    cartAdapter.submitList(cartItems)
    val totalAmount = cartItems.sumOf { it.price * it.quantity }
    totalText.text = "Total Amount: Rs. $totalAmount"
    placeOrderButton.isEnabled = cartItems.isNotEmpty() && !placingOrder
    placeOrderButton.alpha = if (placeOrderButton.isEnabled) 1f else 0.6f
  }

  private fun placeOrder() {
    if (placingOrder || cartMap.isEmpty()) return
    placingOrder = true
    renderCart()

    val cartItems = cartMap.values.toList()
    val totalAmount = cartItems.sumOf { it.price * it.quantity }

    val orderPayload = hashMapOf(
      "type" to "offline",
      "orderType" to "offline",
      "payment" to "cash",
      "paymentMethod" to "cash",
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
      .add(orderPayload)
      .addOnSuccessListener {
        Toast.makeText(this, "Order placed successfully.", Toast.LENGTH_SHORT).show()
        cartMap.clear()
        placingOrder = false
        renderCart()
      }
      .addOnFailureListener { error ->
        Log.e("CounterActivity", "Failed to place order.", error)
        Toast.makeText(this, "Failed to place order.", Toast.LENGTH_SHORT).show()
        placingOrder = false
        renderCart()
      }
  }
}

data class ProductUi(
  val id: String,
  val name: String,
  val price: Int,
  val imageUrl: String?
)

data class CartItemUi(
  val productId: String,
  val name: String,
  val price: Int,
  val quantity: Int
) {
  fun toProduct(): ProductUi = ProductUi(productId, name, price, null)
}

private class ProductAdapter(
  private val onAdd: (ProductUi) -> Unit
) : RecyclerView.Adapter<ProductAdapter.ProductViewHolder>() {
  private val items = mutableListOf<ProductUi>()

  fun submitList(next: List<ProductUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_product, parent, false)
    return ProductViewHolder(view)
  }

  override fun onBindViewHolder(holder: ProductViewHolder, position: Int) {
    holder.bind(items[position], onAdd)
  }

  override fun getItemCount(): Int = items.size

  class ProductViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val image: SimpleDraweeView = itemView.findViewById(R.id.productImage)
    private val name: TextView = itemView.findViewById(R.id.productName)
    private val price: TextView = itemView.findViewById(R.id.productPrice)
    private val addButton: Button = itemView.findViewById(R.id.addToCartButton)

    fun bind(item: ProductUi, onAdd: (ProductUi) -> Unit) {
      name.text = item.name
      price.text = "Rs. ${item.price}"
      image.setImageURI(item.imageUrl)
      addButton.setOnClickListener { onAdd(item) }
    }
  }
}

private class CartAdapter(
  private val onIncrease: (CartItemUi) -> Unit,
  private val onDecrease: (CartItemUi) -> Unit
) : RecyclerView.Adapter<CartAdapter.CartViewHolder>() {
  private val items = mutableListOf<CartItemUi>()

  fun submitList(next: List<CartItemUi>) {
    items.clear()
    items.addAll(next)
    notifyDataSetChanged()
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CartViewHolder {
    val view = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_cart, parent, false)
    return CartViewHolder(view)
  }

  override fun onBindViewHolder(holder: CartViewHolder, position: Int) {
    holder.bind(items[position], onIncrease, onDecrease)
  }

  override fun getItemCount(): Int = items.size

  class CartViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val name: TextView = itemView.findViewById(R.id.cartItemName)
    private val linePrice: TextView = itemView.findViewById(R.id.cartItemLinePrice)
    private val qty: TextView = itemView.findViewById(R.id.cartItemQty)
    private val plusButton: Button = itemView.findViewById(R.id.cartPlusButton)
    private val minusButton: Button = itemView.findViewById(R.id.cartMinusButton)

    fun bind(
      item: CartItemUi,
      onIncrease: (CartItemUi) -> Unit,
      onDecrease: (CartItemUi) -> Unit
    ) {
      name.text = item.name
      qty.text = item.quantity.toString()
      linePrice.text = "Rs. ${item.price * item.quantity}"
      plusButton.setOnClickListener { onIncrease(item) }
      minusButton.setOnClickListener { onDecrease(item) }
    }
  }
}
