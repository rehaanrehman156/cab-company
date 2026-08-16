import fetch from "node-fetch";

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(phone: string): Promise<void> {
  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min

  const apiKey = process.env.MSG91_API_KEY;
  const senderId = process.env.MSG91_SENDER_ID || "CABCMP";
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    // Dev mode: log OTP to console
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }

  const url = `https://api.msg91.com/api/v5/otp?template_id=${templateId}&mobile=91${phone}&authkey=${apiKey}&otp=${otp}&sender=${senderId}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`MSG91 error: ${response.status}`);
  }
}

export function verifyOtp(phone: string, otp: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  if (stored.otp !== otp) return false;
  otpStore.delete(phone);
  return true;
}
