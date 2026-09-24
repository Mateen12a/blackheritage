import { Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, IUser } from "./models";
import MongoStore from "connect-mongo";
import { generateReferralCode } from "./referrals";

// DEV FALLBACK: when MongoDB is unreachable (local preview), users live in
// memory so registration and login still work. Never used in production.
interface DevUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: "user" | "organizer" | "admin";
  createdAt: Date;
}

const devUsersByUsername = new Map<string, DevUser>();
const devUsersById = new Map<string, DevUser>();

export const usingDevStore = () => mongoose.connection.readyState !== 1;

/**
 * Look up a user by id in whichever store is live. Lives here because the
 * dev user map is private to this module. Always resolves to undefined for
 * unknown ids: never throws (guards Mongoose ObjectId cast errors).
 */
export async function findUserById(id: string): Promise<any> {
  if (!id) return undefined;
  if (usingDevStore()) {
    return devUsersById.get(String(id));
  }
  if (!mongoose.Types.ObjectId.isValid(String(id))) return undefined;
  try {
    return await User.findById(String(id));
  } catch {
    return undefined;
  }
}

function safeUser(user: any) {
  const obj = typeof user?.toObject === "function" ? user.toObject() : user;
  if (!obj) return obj;
  const { password, ...rest } = obj;
  return rest;
}

// Fixed-window rate limiter for credential endpoints. In-memory is correct
// for a single server instance; move to a shared store only if the API ever
// runs multi-instance.

export function rateLimit(max: number, windowMs: number) {
  // Each limiter instance gets its own counter map. A shared map would let
  // heavy-but-legit traffic on one route (a test suite logging in, for
  // example) exhaust a different route's budget under the same key.
  const bucket = new Map<string, { count: number; windowStart: number }>();
  return (req: any, res: any, next: any) => {
    const key = String(req.ip || "unknown");
    const now = Date.now();
    const entry = bucket.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      bucket.set(key, { count: 1, windowStart: now });
      return next();
    }
    entry.count += 1;
    if (bucket.size > 5000) {
      Array.from(bucket.entries()).forEach(([k, v]) => {
        if (now - v.windowStart > windowMs) bucket.delete(k);
      });
    }
    if (entry.count > max) {
      return res.status(429).json({ message: "Too many attempts. Try again in a few minutes." });
    }
    next();
  };
}

export function setupAuth(app: Express) {
  // Session cookies are signed with this secret. Production must set
  // SESSION_SECRET, otherwise cookies can be forged by anyone who guesses
  // the fallback.
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    console.error("SESSION_SECRET is required in production. Set it and restart.");
    process.exit(1);
  }
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || "blackheritage-dev-secret",
    resave: false,
    saveUninitialized: false,
    store: process.env.MONGODB_URI ? MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }) : undefined,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = usingDevStore()
          ? devUsersByUsername.get(username.toLowerCase())
          : await User.findOne({ username });
        if (!user || !user.password) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user._id);
  });

  // Deserialize through findUserById: a session cookie can outlive the
  // process (in-memory store restarts) or hold a malformed id. Resolve to
  // "no user" so the request gets a clean 401 instead of a 500.
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await findUserById(id as string);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", rateLimit(20, 15 * 60 * 1000), async (req, res) => {
    const { username, email, password } = req.body;
    // Referral: capture the code before anything else can fail. Attribution
    // must survive a failed attempt, so it rides on the session cookie and
    // resolves at the moment the account actually lands.
    if (req.body.referredBy) {
      (req.session as any).referredByCode = String(req.body.referredBy).toUpperCase().trim();
    }
    // Role is limited to self-serve signup choices. admin is never
    // assignable here; platform admins are created by the seed only.
    const role = req.body.role === "organizer" ? "organizer" : "user";
    if (req.body.acceptedTerms !== true) {
      return res.status(400).json({ message: "You must accept the terms of service and privacy policy" });
    }
    if (typeof username !== "string" || username.trim().length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    // Optional at signup: the name guests see on tickets, or the brand an
    // organizer runs events as. Editable later from settings.
    const displayName =
      typeof req.body.displayName === "string" && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 80)
        : undefined;
    try {
      const existing = usingDevStore()
        ? devUsersByUsername.get(String(username).toLowerCase()) ||
          Array.from(devUsersByUsername.values()).find(
            (u) => u.email === String(email)
          )
        : await User.findOne({ $or: [{ username }, { email }] });
      if (existing) {
        return res.status(400).json({ message: "Username or email already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      if (usingDevStore()) {
        const user: DevUser = {
          _id: "dev-user-" + Date.now().toString(36),
          username,
          email,
          password: hashedPassword,
          role: role || "user",
          createdAt: new Date(),
        };
        devUsersByUsername.set(username.toLowerCase(), user);
        devUsersById.set(user._id, user);
        return req.login(user, (err) => {
          if (err) return res.status(500).json({ message: "Login failed after registration" });
          res.status(201).json(safeUser(user));
        });
      }
      // Resolve the referral now that signup actually succeeded. The code
      // was stashed on the session at request start.
      let referrerId: string | undefined;
      const stash = (req.session as any)?.referredByCode;
      if (stash) {
        try {
          const { findUserIdByCode } = await import("./referrals");
          referrerId = (await findUserIdByCode(stash)) || undefined;
        } catch {
          // A bad referral code never blocks a signup.
        }
      }
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || "user",
        ...(displayName ? { displayName } : {}),
        ...(referrerId ? { referredBy: referrerId } : {}),
        referralCode: generateReferralCode(),
        termsAcceptedAt: new Date(), // consent record, NDPA audit trail
      });
      await user.save();
      (req.session as any).referredByCode = undefined;
      // Welcome email is fire-and-forget: signup must never wait on email.
      // The role decides the variant: organizers get next steps, guests get
      // discovery.
      if (process.env.RESEND_API_KEY) {
        import("./emails")
          .then(({ sendWelcomeEmail }) =>
            sendWelcomeEmail(
              { name: String(displayName || username), email: String(email) },
              role === "organizer" ? "organizer" : "user",
            ),
          )
          .catch((e) => console.error("Welcome email failed:", e));
      }
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(safeUser(user));
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", rateLimit(30, 15 * 60 * 1000), passport.authenticate("local"), (req, res) => {
    res.json(safeUser(req.user));
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not logged in" });
    res.json(safeUser(req.user));
  });

  // ── Referrals: a code per account, one endpoint to read your own ──
  app.get("/api/referrals/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not logged in" });
    const me = req.user as any;
    const fresh = await User.findById(me._id).select("referralCode referredBy displayName username").lean();
    if (!fresh) return res.status(404).json({ message: "Account not found" });
    // Self-heal: accounts from before the program get a code on first read.
    let code = (fresh as any).referralCode;
    if (!code) {
      code = generateReferralCode();
      await User.updateOne({ _id: fresh._id }, { $set: { referralCode: code } }).catch(() => {});
    }
    const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
    const invites = await User.countDocuments({ referredBy: String(fresh._id) }).catch(() => 0);
    return res.json({
      code,
      link: `${base}/r/${code}`,
      invites: invites || 0,
      referredBy: (fresh as any).referredBy || null,
    });
  });
}
