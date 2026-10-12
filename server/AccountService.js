import { AccountStore } from "./AccountStore.js";
import {
  cookies,
  fail,
  json,
  jsonBody,
  sameOrigin,
  requestAddress,
} from "./http.js";
const COOKIE = "maze-account";
export class AccountService {
  constructor(directory) {
    this.store = new AccountStore(directory);
    this.attempts = new Map();
    this.onLogout = () => {};
  }
  user(req) {
    return this.store.identify(cookies(req)[COOKIE]);
  }
  cookie(req, res, token) {
    const secure =
      !!req.socket.encrypted ||
      (process.env.TRUST_PROXY === "true" &&
        req.headers["x-forwarded-proto"] === "https");
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 2592000 : 0}${secure ? "; Secure" : ""}`,
    );
  }
  limit(req) {
    const key = requestAddress(req),
      now = Date.now();
    const record = this.attempts.get(key) || { since: now, count: 0 };
    if (now - record.since > 60000) {
      record.since = now;
      record.count = 0;
    }
    if (++record.count > 20) throw fail(429, "accountTooFast");
    this.attempts.set(key, record);
    for (const [key, r] of this.attempts)
      if (now - r.since > 60000) this.attempts.delete(key);
  }
  async handle(req, res, url) {
    if (!url.pathname.startsWith("/api/account/")) return false;
    try {
      if (!sameOrigin(req)) throw fail(403, "badOrigin");
      await this.store.ready;
      const action = url.pathname.slice("/api/account/".length);
      if (["register", "login"].includes(action) && req.method === "POST") {
        this.limit(req);
        const { username, password } = await jsonBody(req);
        const user = await this.store[action](username, password),
          token = await this.store.session(user.id);
        this.cookie(req, res, token);
        json(res, 200, {
          user,
          profile: this.store.publicProfile(
            await this.store.readProfile(user.id),
          ),
        });
        return true;
      }
      const user = await this.user(req);
      if (action === "me" && req.method === "GET") {
        json(
          res,
          200,
          user
            ? {
                user,
                profile: this.store.publicProfile(
                  await this.store.readProfile(user.id),
                ),
              }
            : { user: null },
        );
        return true;
      }
      if (!user) throw fail(401, "loginRequired");
      if (action === "logout" && req.method === "POST") {
        await this.store.logout(cookies(req)[COOKIE]);
        this.onLogout(user.id, cookies(req)[COOKIE]);
        this.cookie(req, res, null);
        json(res, 200, { ok: true });
      } else if (action === "profile" && req.method === "POST") {
        const data = await jsonBody(req);
        if (data.accountId && data.accountId !== user.id)
          throw fail(401, "loginRequired");
        json(
          res,
          200,
          await this.store.patch(user.id, data.revision, data.changes),
        );
      } else if (action === "import" && req.method === "POST") {
        const data = await jsonBody(req);
        if (data.accountId && data.accountId !== user.id)
          throw fail(401, "loginRequired");
        json(res, 200, await this.store.import(user.id, data.data));
      } else throw fail(404, "badRequest");
    } catch (error) {
      json(res, error.status || 503, {
        error: error.code || "accountUnavailable",
        ...(error.profile ? { profile: error.profile } : {}),
      });
    }
    return true;
  }
}
