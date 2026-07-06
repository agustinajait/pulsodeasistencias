import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, centersTable, orgUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";

const router = Router();

// ── Super-admin ──────────────────────────────────────────────────────────────

router.post("/auth/super-admin/verify", (req, res) => {
  const { passcode } = req.body as { passcode?: string };
  if (!passcode) { res.status(400).json({ error: "passcode is required" }); return; }
  const superAdminPasscode = process.env.SUPER_ADMIN_PASSCODE;
  if (!superAdminPasscode) { res.status(500).json({ error: "Super admin not configured" }); return; }
  if (passcode.trim() === superAdminPasscode) {
    const token = process.env.JWT_SECRET ? signToken({ centerId: null, role: "superadmin" }) : null;
    res.json({ status: "ok", token });
  } else {
    res.status(401).json({ status: "invalid" });
  }
});

// ── Org register ─────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res) => {
  try {
    const { orgName, email, password } = req.body as {
      orgName?: string;
      email?: string;
      password?: string;
    };

    if (!orgName?.trim()) { res.status(400).json({ error: "orgName is required" }); return; }
    if (!email?.trim()) { res.status(400).json({ error: "email is required" }); return; }
    if (!password || password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email not already registered
    const existing = await db
      .select({ id: orgUsersTable.id })
      .from(orgUsersTable)
      .where(eq(orgUsersTable.email, normalizedEmail))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Ya existe una cuenta con ese email" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create center + org user in sequence
    const [center] = await db
      .insert(centersTable)
      .values({ name: orgName.trim() })
      .returning();

    const [orgUser] = await db
      .insert(orgUsersTable)
      .values({ centerId: center.id, email: normalizedEmail, passwordHash })
      .returning();

    const token = process.env.JWT_SECRET
      ? signToken({ centerId: center.id, role: "center" })
      : null;

    res.status(201).json({
      status: "ok",
      token,
      center: { id: center.id, name: center.name },
      userId: orgUser.id,
    });
  } catch (err) {
    req.log.error(err, "Error registering org");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Org login ────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [orgUser] = await db
      .select()
      .from(orgUsersTable)
      .where(eq(orgUsersTable.email, normalizedEmail))
      .limit(1);

    if (!orgUser) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }

    const valid = await bcrypt.compare(password, orgUser.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }

    const [center] = await db
      .select()
      .from(centersTable)
      .where(eq(centersTable.id, orgUser.centerId))
      .limit(1);

    const token = process.env.JWT_SECRET
      ? signToken({ centerId: orgUser.centerId, role: "center" })
      : null;

    res.json({
      status: "ok",
      token,
      center: center ? { id: center.id, name: center.name } : null,
      userId: orgUser.id,
    });
  } catch (err) {
    req.log.error(err, "Error logging in");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
