import fetch from "node-fetch";

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(phone: string): Promise<void> {
  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }

  const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otp}&route=otp&numbers=${phone}`;
  const res = await fetch(url, { method: "GET", headers: { "cache-control": "no-cache" } });
  const data: any = await res.json();

  if (!data.return) {
    throw new Error(`Fast2SMS error: ${JSON.stringify(data)}`);
  }
}

export function verifyOtp(phone: string, otp: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) { otpStore.delete(phone); return false; }
  if (stored.otp !== otp) return false;
  otpStore.delete(phone);
  return true;
}
