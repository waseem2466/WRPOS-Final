// ====================== core.ts (patched for current @langchain version) ======================
// Use CommonJS requires – they work regardless of the package's "exports" field.
const { ChatOllama } = require("@langchain/community/llms/ollama"); // <-- note the path change
const { HumanMessage, SystemMessage } = require("@langchain/schema");
const { BufferMemory } = require("langchain/memory");
import { errorHandler } from './errorHandler';
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config(); // load .env if present


// ------------------------------------------------------------------
// 1️⃣  Absolute repo root
// ------------------------------------------------------------------
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ------------------------------------------------------------------
// 2️⃣  Safety – never leave the repo
// ------------------------------------------------------------------
function safePath(rel: string): string {

  const abs = path.resolve(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT)) {
    throw new Error("Attempted to escape the project root");
  }
  return abs;
}

// ------------------------------------------------------------------
// 3️⃣  Tiny virtual tools
// ------------------------------------------------------------------
function readFile(rel: string): string {
  return fs.readFileSync(safePath(rel), "utf8");
}
function writeFile(rel: string, content: string): void {
  fs.writeFileSync(safePath(rel), content, "utf8");
}
function runCmd(cmd: string): string {

  const exec = require("child_process").execSync;
  return exec(cmd, { cwd: REPO_ROOT, stdio: "pipe" }).toString();
}

// ------------------------------------------------------------------
// 4️⃣  LLM wrapper (points at local Ollama)
// ------------------------------------------------------------------
const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  model: process.env.LOCAL_OLLAMA_MODEL ?? "qwen2.5:3b",
  temperature: 0.2,
  streaming: false
});
const memory = new BufferMemory({ returnMessages: true });

const SYSTEM = `You are a developer assistant for the repo at ${REPO_ROOT}.
You may use these virtual commands on their own lines:
<READ  path>            – read a file.
<WRITE path> <content> – overwrite a file.
<RUN   cmd>             – run a shell command inside the repo.
Never fabricate a file; always READ first if you are unsure.
Answer in plain text unless the user explicitly asks for Markdown.`;

// ------------------------------------------------------------------
// 5️⃣  Public async function
// ------------------------------------------------------------------
async function ask(prompt: string, _context?: unknown, _options?: unknown): Promise<string> {

  // ----- tool handling -------------------------------------------------
  const tool = prompt.trim().match(/^<(READ|WRITE|RUN)\s+([^>]+)>(?:\s+([\s\S]*))?$/);
  if (tool) {
    const [, cmd, arg, extra] = tool;
    try {
      if (cmd === "READ")   return readFile(arg.trim());
      if (cmd === "WRITE") {
        const [filePath, ...rest] = arg.trim().split(/\s+/);
        const content = extra !== undefined ? extra : rest.join(" ");
        writeFile(filePath, content);
        return `✅ Wrote ${filePath}`;
      }
      if (cmd === "RUN")    return runCmd(arg.trim());
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      errorHandler.log('AI-Assistant-Core', err, { operation: 'tool', cmd }, 'high');
      return `⚠️ Tool error: ${err.message}`;
    }

  }

  // ----- normal LLM chat ----------------------------------------------
  const messages = [
    new SystemMessage(SYSTEM),
    ...((await memory.loadMemoryVariables({}))?.chat_history ?? []),
    new HumanMessage(prompt)
  ];
  const resp = await model.invoke(messages);
  const txt = resp.content?.toString() ?? "";
  await memory.saveContext({ input: prompt }, { output: txt });
  return txt;
}

// Export for the server
export { ask };
