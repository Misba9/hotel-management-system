import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export const seedInitialData = onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Only admins can seed data.");
  }

  const now = new Date().toISOString();
  const batch = db.batch();

  const branchRef = db.collection("branches").doc("hyderabad-main");
  batch.set(branchRef, {
    id: "hyderabad-main",
    name: "Nausheen Fruits Juice Center - Main",
    city: "Hyderabad",
    address: "Banjara Hills, Hyderabad",
    location: { lat: 17.4126, lng: 78.4482 },
    deliveryRadiusKm: 20,
    active: true
  });

  const roles = ["delivery_boy", "kitchen_staff", "waiter", "cashier", "manager", "admin"];
  for (const role of roles) {
    const roleRef = db.collection("roles").doc(role);
    batch.set(roleRef, {
      id: role,
      permissions: getPermissions(role)
    });
  }

  const categories = [
    "Fresh Juices",
    "Milkshakes",
    "Fruit Bowls",
    "Smoothies",
    "Seasonal Specials"
  ];
  categories.forEach((category, index) => {
    const id = category.toLowerCase().replace(/\s+/g, "_");
    batch.set(db.collection("menu_categories").doc(id), {
      id,
      branchId: "hyderabad-main",
      name: category,
      priority: index + 1,
      active: true
    });
  });

  const starterMenu = [
    { id: "mango_juice", categoryId: "fresh_juices", name: "Mango Juice", price: 180 },
    { id: "banana_shake", categoryId: "milkshakes", name: "Banana Shake", price: 220 },
    { id: "fruit_bowl", categoryId: "fruit_bowls", name: "Mixed Fruit Bowl", price: 260 },
    { id: "protein_smoothie", categoryId: "smoothies", name: "Protein Smoothie", price: 320 }
  ];
  starterMenu.forEach((item) => {
    batch.set(db.collection("menu_items").doc(item.id), {
      ...item,
      branchId: "hyderabad-main",
      description: `${item.name} made fresh to order`,
      imageUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea",
      available: true,
      tags: ["fresh", "premium"]
    });
  });

  const inventory = ["Apple", "Mango", "Banana", "Pomegranate"];
  inventory.forEach((ingredient) => {
    const id = ingredient.toLowerCase();
    batch.set(db.collection("inventory").doc(id), {
      id,
      branchId: "hyderabad-main",
      ingredientName: ingredient,
      unit: "kg",
      currentStock: 100,
      minStock: 20,
      isLowStock: false,
      updatedAt: now
    });
  });

  await batch.commit();
  return { ok: true };
});

function getPermissions(role: string): string[] {
  switch (role) {
    case "delivery_boy":
      return ["delivery:update_status", "delivery:view_assigned"];
    case "kitchen_staff":
      return ["kitchen:update_status", "kitchen:view_orders"];
    case "waiter":
      return ["waiter:create_table_order", "waiter:view_status"];
    case "cashier":
      return ["pos:create_order", "pos:close_payment"];
    case "manager":
      return ["branch:manage_orders", "branch:view_reports", "staff:view_performance"];
    case "admin":
      return ["*"];
    default:
      return [];
  }
}
