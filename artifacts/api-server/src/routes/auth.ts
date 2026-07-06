import { Router } from "express";
import { signToken } from "../lib/jwt.js";

const router = Router();

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

export default router;
