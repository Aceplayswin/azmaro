/** Shared client/server validators. Keep messages short and human. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Please enter your email address.";
  if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email address.";
  return null;
}

/** Indian mobile number: 10 digits starting 6–9, optional +91 / 0 prefix. */
export function normaliseIndianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function validatePhone(value: string, required = true): string | null {
  if (!value.trim()) return required ? "Please enter your mobile number." : null;
  return normaliseIndianPhone(value) ? null : "Enter a 10-digit Indian mobile number.";
}

export function validatePin(value: string): string | null {
  if (!value.trim()) return "Please enter a PIN code.";
  return /^[1-9]\d{5}$/.test(value.trim()) ? null : "Enter a valid 6-digit PIN code.";
}

export function validateRequired(value: string, label: string, min = 2): string | null {
  if (!value.trim()) return `Please enter your ${label}.`;
  if (value.trim().length < min) return `${label[0]!.toUpperCase()}${label.slice(1)} looks too short.`;
  return null;
}

export function validateOrderNumber(value: string): string | null {
  if (!value.trim()) return "Please enter your order number.";
  return /^AZM-?[A-Z0-9]{4,12}$/i.test(value.trim()) ? null : "Order numbers look like AZM-XXXXXX.";
}

export function validatePassword(value: string): string | null {
  if (!value) return "Please enter a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  return null;
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
