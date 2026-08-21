import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada en el servidor");
  return new Anthropic({ apiKey });
}

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

    const anthropic = getClient();
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
    res.status(500).json({ error: err?.message ?? "Error al generar texto" });
  }
});

// POST /ai/resumir-bloque
router.post("/ai/resumir-bloque", async (req, res) => {
  try {
    const { campo, texto, bloque } = req.body as { campo: "inicio" | "desarrollo" | "cierre"; texto: string; bloque?: string };
    if (!texto?.trim()) { res.status(400).json({ error: "texto requerido" }); return; }

    const labels: Record<string, string> = { inicio: "Inicio", desarrollo: "Desarrollo", cierre: "Cierre" };
    const label = labels[campo] ?? campo;

    const anthropic = getClient();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `Sos asistente pedagógico de un Centro de Primera Infancia (CPI) en Argentina.
Tu tarea es resumir descripciones de momentos de una planificación pedagógica mensual.
Escribís en español rioplatense, en tono profesional y claro.
El resumen debe ser conciso (2-3 oraciones máximo), preservar la información clave y sonar natural.
No uses bullets ni encabezados. Devolvé solo el resumen, sin comentarios.`,
      messages: [{
        role: "user",
        content: `Resumí el siguiente texto del momento "${label}"${bloque ? ` del bloque "${bloque}"` : ""} de una planificación pedagógica mensual. Mantenélo breve pero completo.\n\nTexto original:\n${texto}`,
      }],
    });

    const summary = message.content.find(c => c.type === "text")?.text ?? "";
    res.json({ summary });
  } catch (err: any) {
    req.log.error(err, "AI resumir-bloque error");
    res.status(500).json({ error: err?.message ?? "Error al resumir" });
  }
});

// POST /ai/adaptar-cronograma
router.post("/ai/adaptar-cronograma", async (req, res) => {
  try {
    const { actividad, bloque, horario } = req.body as { actividad: string; bloque?: string; horario?: string };
    if (!actividad?.trim()) { res.status(400).json({ error: "actividad requerida" }); return; }

    const anthropic = getClient();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: `Sos asistente pedagógico de un Centro de Primera Infancia (CPI) en Argentina.
Tu tarea es adaptar descripciones de actividades para un cronograma semanal.
El texto del cronograma debe ser muy breve (1 línea, máximo 10 palabras), en infinitivo o sustantivo, sin explicaciones.
Ejemplos de formato correcto: "Exploración sensorial con masa", "Juego libre en rincones", "Lectura de cuento grupal".
Devolvé solo la frase adaptada, sin puntos finales ni comentarios.`,
      messages: [{
        role: "user",
        content: `Adaptá esta actividad para el cronograma${bloque ? ` (bloque: ${bloque})` : ""}${horario ? ` a las ${horario}` : ""}:\n\n${actividad}`,
      }],
    });

    const adapted = message.content.find(c => c.type === "text")?.text?.trim() ?? actividad;
    res.json({ adapted });
  } catch (err: any) {
    req.log.error(err, "AI adaptar-cronograma error");
    res.status(500).json({ error: err?.message ?? "Error al adaptar" });
  }
});

export default router;
