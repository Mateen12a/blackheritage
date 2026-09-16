import { Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, IUser } from "./models";
import MongoStore from "connect-mongo";

// DEV FALLBACK — when MongoDB is unreachable (local preview), users live in
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

const usingDevStore = () => mongoose.connection.readyState !== 1;

function safeUser(user: any) {
  const obj = typeof user?.toObject === "function" ? user.toObject() : user;
  if (!obj) return obj;
  const { password, ...rest } = obj;
  return rest;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "blackheritage-secret",
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

  passport.deserializeUser(async (id, done) => {
    try {
      const user = usingDevStore()
        ? devUsersById.get(String(id))
        : await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, email, password, role } = req.body;
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
          role: role || "organizer",
          createdAt: new Date(),
        };
        devUsersByUsername.set(username.toLowerCase(), user);
        devUsersById.set(user._id, user);
        return req.login(user, (err) => {
          if (err) return res.status(500).json({ message: "Login failed after registration" });
          res.status(201).json(safeUser(user));
        });
      }
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || "organizer",
      });
      await user.save();
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(safeUser(user));
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
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
}
