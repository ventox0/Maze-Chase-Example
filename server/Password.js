import { scrypt as derive, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
// Scrypt: şifre uzunluğu veya karakter politikası yok; hash tekniği bağımsızdır.
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let tail = Promise.resolve();
function work(fn) {
  const result = tail.then(fn);
  tail = result.catch(() => {});
  return result;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await work(() => scrypt(password, salt, 64, options));
  return { salt, hash: key.toString("hex") };
}
export async function verifyPassword(password, record) {
  const salt = record?.salt || "00000000000000000000000000000000";
  const key = await work(() => scrypt(password, salt, 64, options));
  const expected = Buffer.from(record?.hash || "00".repeat(64), "hex");
  return (
    expected.length === key.length && timingSafeEqual(expected, key) && !!record
  );
}
