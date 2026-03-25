import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import readline from "node:readline";

const mcpUrl = process.env.MCP_URL || "http://localhost:3333/mcp";
const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:1b";
const todayIso = process.env.TODAY_ISO || new Date().toISOString().slice(0, 10);

async function readInputText() {
  const fromArgs = process.argv.slice(2).join(" ").trim();
  if (fromArgs) return fromArgs;

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve());
    process.stdin.resume();
  });

  return Buffer.concat(chunks).toString("utf-8").trim();
}

const ToolArgsSchema = z.object({
  chaletId: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName: z.string(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

type ToolArgs = z.infer<typeof ToolArgsSchema>;

const SYSTEM_PROMPT = [
  "Voce e um extrator de dados para reservas de chales.",
  "Retorne APENAS JSON valido (sem texto extra, sem markdown, sem crases, sem comentarios).",
  "A resposta deve comecar com '{' e terminar com '}'.",
  "Campos obrigatorios: chaletId, checkIn, checkOut, guestName; arrivalTime opcional.",
  "checkIn/checkOut no formato YYYY-MM-DD.",
  "arrivalTime HH:MM se existir, extraido de parenteses.",
  "Se faltar guestName, retorne guestName como \"\" (string vazia).",
  "Se mes sem ano, assuma ano do contexto TODAY_ISO.",
  "Mapeie 'chale amarelo' para 'chale-amarelo' e 'chale azul' para 'chale-azul'.",
  "Nunca retorne chaletId vazio."
].join(" ");

function buildUserPrompt(text: string) {
  return [
    `today: ${todayIso}`,
    "chalets aliases: chale amarelo -> chale-amarelo, chale azul -> chale-azul",
    `Texto: ${text}`
  ].join("\n");
}

const SCHEMA_HINT = [
  "Formato EXATO esperado:",
  "{",
  "  \"chaletId\": \"chale-amarelo\",",
  "  \"checkIn\": \"YYYY-MM-DD\",",
  "  \"checkOut\": \"YYYY-MM-DD\",",
  "  \"guestName\": \"\",",
  "  \"arrivalTime\": \"HH:MM\"",
  "}",
  "Regras estritas: checkIn/checkOut NUNCA podem ter hora; arrivalTime NUNCA pode ter data."
].join("\n");

async function callOllama(messages: { role: string; content: string }[]) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
      format: "json",
      messages,
      options: { temperature: 0.1 }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Ollama response missing message.content");
  }

  return content;
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

function parseAndValidate(raw: string) {
  const jsonText = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false as const, error: "JSON.parse failed", raw };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false as const, error: "JSON is not an object", raw };
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.arrivalTime === "") {
    delete candidate.arrivalTime;
  }

  const parsedArgs = ToolArgsSchema.safeParse(candidate);
  if (!parsedArgs.success) {
    return { ok: false as const, error: parsedArgs.error.message, raw };
  }

  return { ok: true as const, value: parsedArgs.data };
}

async function callMcp(args: ToolArgs) {
  const client = new Client({ name: "ai-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  await client.connect(transport);

  const result = await client.callTool({
    name: "reservations.create",
    arguments: args
  });

  await client.close();
  return result;
}

async function handleText(inputText: string) {
  const userPrompt = buildUserPrompt(inputText);
  const first = await callOllama([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${userPrompt}\n${SCHEMA_HINT}` }
  ]);

  const parsed1 = parseAndValidate(first);
  if (!parsed1.ok) {
    const repairPrompt = [
      "Corrija o JSON abaixo para atender ao schema e formato exigidos.",
      "Regras: retorne APENAS JSON valido, sem markdown e sem texto extra.",
      SCHEMA_HINT,
      `Erros: ${parsed1.error}`,
      `JSON invalido: ${parsed1.raw}`
    ].join("\n");

    const second = await callOllama([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
      { role: "assistant", content: first },
      { role: "user", content: repairPrompt }
    ]);

    const parsed2 = parseAndValidate(second);
    if (!parsed2.ok) {
      const finalRepair = [
        "ULTIMA CHANCE: retorne APENAS JSON valido e conforme o formato.",
        SCHEMA_HINT,
        `Erros: ${parsed2.error}`,
        `JSON invalido: ${parsed2.raw}`
      ].join("\n");

      const third = await callOllama([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${userPrompt}\n${SCHEMA_HINT}` },
        { role: "assistant", content: second },
        { role: "user", content: finalRepair }
      ]);

      const parsed3 = parseAndValidate(third);
      if (!parsed3.ok) {
        throw new Error(`Invalid JSON from Ollama after retry: ${parsed3.raw}`);
      }

      const result = await callMcp(parsed3.value);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const result = await callMcp(parsed2.value);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await callMcp(parsed1.value);
  console.log(JSON.stringify(result, null, 2));
}

async function runServeMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = () => rl.question("> ", async (line) => {
    const text = line.trim();
    if (text === "") {
      ask();
      return;
    }
    if (text.toLowerCase() === "exit" || text.toLowerCase() === "quit") {
      rl.close();
      return;
    }
    try {
      await handleText(text);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    }
    ask();
  });

  console.log("AI agent pronto. Digite o pedido (ou 'exit' para sair).");
  ask();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--serve")) {
    await runServeMode();
    return;
  }

  const inputText = await readInputText();
  if (!inputText) {
    console.error("Missing input text. Provide a reservation request.");
    process.exit(1);
  }

  await handleText(inputText);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
