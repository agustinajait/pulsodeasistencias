import { Router } from "express";
import { db, childrenTable, childDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const childDocsRouter = Router();

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://idsqnnyyoybknwqugspv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

const DOC_TYPES = ["dni_nino", "acta_nac", "dni_padres", "apto_fisico", "aut_retiro", "aut_llamada", "aut_fotos", "carnet_vac"];

// GET /child-docs/:token — returns child info + docs status
childDocsRouter.get("/:token", async (req, res) => {
  try {
    const child = await db.query.childrenTable.findFirst({ where: eq(childrenTable.docsToken, req.params.token) });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }
    const docs = await db.select().from(childDocumentsTable).where(eq(childDocumentsTable.childId, child.id));
    res.json({
      childId: child.id,
      nombre: child.nombre,
      apellido: child.apellido,
      panialesAuth: child.panialesAuth ?? false,
      docs: docs.map(d => ({ tipo: d.tipo, url: d.url, uploadedAt: d.uploadedAt })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /child-docs/:token/paniales — toggle paniales auth
childDocsRouter.post("/:token/paniales", async (req, res) => {
  try {
    const { auth } = req.body as { auth: boolean };
    const child = await db.query.childrenTable.findFirst({ where: eq(childrenTable.docsToken, req.params.token) });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }
    await db.update(childrenTable).set({ panialesAuth: auth }).where(eq(childrenTable.id, child.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /child-docs/:token/upload — upload a document (base64 body)
// Body: { tipo: string, fileBase64: string, mimeType: string, ext: string }
childDocsRouter.post("/:token/upload", async (req, res) => {
  try {
    const { tipo, fileBase64, mimeType, ext } = req.body as { tipo: string; fileBase64: string; mimeType: string; ext: string };
    if (!tipo || !fileBase64 || !DOC_TYPES.includes(tipo)) { res.status(400).json({ error: "Datos inválidos" }); return; }
    const child = await db.query.childrenTable.findFirst({ where: eq(childrenTable.docsToken, req.params.token) });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }

    const buffer = Buffer.from(fileBase64, "base64");
    const safeName = `${tipo}.${ext ?? "jpg"}`;
    const path = `${child.id}/${safeName}`;

    // Upload to Supabase storage bucket "documentos"
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documentos/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": mimeType ?? "image/jpeg",
        "x-upsert": "true",
      },
      body: buffer,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      res.status(500).json({ error: "Error al subir archivo", detail: errText }); return;
    }

    const url = `${SUPABASE_URL}/storage/v1/object/public/documentos/${path}`;

    // Upsert document record
    await db.insert(childDocumentsTable)
      .values({ childId: child.id, tipo, url })
      .onConflictDoUpdate({
        target: [childDocumentsTable.childId, childDocumentsTable.tipo],
        set: { url, uploadedAt: new Date() },
      });

    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});
