import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /ai/generate-followup-text
router.post("/ai/generate-followup-text", async (req, res) => {
  try {
    const { childName, childAge, sala, lider, facilitadora, adultNombre, existingText } = req.body;
    if (!childName) {
      res.status(400).json({ error: "childName is required" });
      return;
    }

    const isImproving = existingText && existingText.trim().length > 30;

    const context = [
      childName ? `Nombre del niño/a: ${childName}` : null,
      childAge ? `Edad: ${childAge}` : null,
      sala ? `Sala: ${sala}` : null,
      lider ? `Líder: ${lider}` : null,
      facilitadora ? `Facilitadora: ${facilitadora}` : null,
      adultNombre ? `Adulto responsable: ${adultNombre}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `Sos redactora de informes para un Centro de Primera Infancia (CPI) en Argentina.
Escribís en español rioplatense formal, claro y empático.
Los informes son documentos institucionales que describen el desarrollo y situación de un niño/a.
Usá vocabulario apropiado para educación inicial y trabajo social.
No uses bullets ni títulos — el informe es texto continuo en uno o dos párrafos.
No incluyas encabezados, fechas ni saludos — solo el cuerpo del texto.`;

    const userPrompt = isImproving
      ? `Mejorá el siguiente texto de informe de seguimiento. Mantené la información existente pero mejorá la redacción, claridad y formalidad institucional. Podés expandirlo si es necesario.

Datos del niño/a:
${context}

Texto actual:
${existingText}

Devolvé solo el texto mejorado, sin comentarios adicionales.`
      : `Redactá el cuerpo de un informe de seguimiento para el siguiente niño/a. Describí de forma general el proceso de acompañamiento, participación en el espacio y bienestar observado. El texto debe ser apropiado para ser firmado por un profesional.

Datos del niño/a:
${context}

Devolvé solo el texto del informe, sin comentarios adicionales.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content.find((c) => c.type === "text")?.text ?? "";
    res.json({ text });
  } catch (err: any) {
    req.log.error(err, "AI generate error");
    res.status(500).json({ error: "Error al generar texto", detail: err?.message });
  }
});

export default router;
