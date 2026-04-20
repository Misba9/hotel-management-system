import type { DeliveryAddressInput } from "@/lib/delivery-address-types";

export function validateNewAddress(
  input: DeliveryAddressInput
): Partial<Record<keyof DeliveryAddressInput, string>> {
  const e: Partial<Record<keyof DeliveryAddressInput, string>> = {};
  if (input.name.trim().length < 2) e.name = "Enter the recipient name.";
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number.";
  if (input.addressLine.trim().length < 5) e.addressLine = "Enter a complete street / area.";
  if (input.city.trim().length < 2) e.city = "Enter city.";
  const pc = input.pincode.trim();
  if (!/^\d{6}$/.test(pc)) e.pincode = "Enter a 6-digit PIN code.";
  return e;
}
