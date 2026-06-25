"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRazorpayCredentials = readRazorpayCredentials;
exports.createRazorpayOrder = createRazorpayOrder;
exports.verifyRazorpayPaymentSignature = verifyRazorpayPaymentSignature;
const node_crypto_1 = __importDefault(require("node:crypto"));
function readRazorpayCredentials(env) {
    const keyId = env.RAZORPAY_KEY_ID?.trim();
    const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret)
        return null;
    return { keyId, keySecret };
}
async function createRazorpayOrder(params) {
    const amount = Math.round(params.amountPaise);
    if (!Number.isFinite(amount) || amount < 100) {
        throw new Error("Amount must be at least ₹1.00 (100 paise).");
    }
    const auth = Buffer.from(`${params.credentials.keyId}:${params.credentials.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            amount,
            currency: params.currency ?? "INR",
            receipt: params.receipt.slice(0, 40),
            ...(params.notes ? { notes: params.notes } : {})
        })
    });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    }
    catch {
        data = null;
    }
    if (!res.ok || !data?.id) {
        const desc = data?.error?.description ?? text?.slice(0, 200) ?? `HTTP ${res.status}`;
        throw new Error(desc);
    }
    return { id: data.id, currency: data.currency ?? "INR" };
}
function verifyRazorpayPaymentSignature(params) {
    const expected = node_crypto_1.default
        .createHmac("sha256", params.keySecret)
        .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
        .digest("hex");
    return expected === params.razorpaySignature;
}
