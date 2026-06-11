import { Router } from "express";

const router = Router();

router.post("/auth/super-admin/verify", (req, res) => {
  const { passcode } = req.body as { passcode?: string };
  if (!passcode) { res.status(400).json({ error: "passcode is required" }); return; }
  const superAdminPasscode = process.env.SUPER_ADMIN_PASSCODE;
  if (!superAdminPasscode) { res.status(500).json({ error: "Super admin not configured" }); return; }
  if (passcode.trim() === superAdminPasscode) {
    res.json({ status: "ok" });
  } else {
    res.status(401).json({ status: "invalid" });
  }
});

export default router;
