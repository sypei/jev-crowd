import "dotenv/config";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.TYPESAFE_API_KEY || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function previewClassify(text) {
  const t = text.toLowerCase();
  let act = 0.34, dont = 0.33, conflicted = 0.33;
  for (const w of ["save","prevent","rescue","many","five","ten","lever"]) if (t.includes(w)) act += 0.035;
  for (const w of ["push","directly","intentionally","innocent","betray","force","consent"]) if (t.includes(w)) dont += 0.04;
  for (const w of ["maybe","chance","uncertain","family","friend","stranger","promise","lie"]) if (t.includes(w)) conflicted += 0.035;
  const sum = act + dont + conflicted;
  const probabilities = { act: act / sum, dont_act: dont / sum, conflicted: conflicted / sum };
  const choice = Object.entries(probabilities).sort((a,b)=>b[1]-a[1])[0][0];
  return { mode:"preview", allowed:true, choice, confidence:Math.max(...Object.values(probabilities)), probabilities };
}

async function classifyWithJev(text) {
  const body = {
    model: "jev-latest",
    state: text,
    questions: {
      in_scope: {
        type: "noul",
        instructions: "Is this a fictional, hypothetical moral dilemma suitable for a playful philosophy experiment? Answer no for real-world plans to hurt someone, instructions for wrongdoing, self-harm, political persuasion, targeted hate, harassment, or requests to judge a real identifiable person."
      },
      moral_choice: {
        type: "choice",
        instructions: "For this fictional moral dilemma, classify the described decision into the closest response. This is a descriptive classifier output, not a correct moral answer.",
        criteria: {
          act: "I will act on it: take the proposed action.",
          dont_act: "I won\'t act on it: do not take the proposed action.",
          conflicted: "I am morally torn: the dilemma is morally conflicted, underdetermined, or neither action clearly dominates."
        }
      }
    }
  };

  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) throw new Error(`Jev API ${response.status}`);
  const data = await response.json();
  const inScope = Number(data?.answers?.in_scope?.noul ?? 0);
  const moral = data?.answers?.moral_choice;
  if (!moral?.probabilities) throw new Error("Unexpected Jev response shape");

  return {
    mode: "jev",
    allowed: inScope >= 0.55,
    scopeProbability: inScope,
    choice: moral.choice,
    confidence: moral.confidence,
    probabilities: {
      act: Number(moral.probabilities.act || 0),
      dont_act: Number(moral.probabilities.dont_act || 0),
      conflicted: Number(moral.probabilities.conflicted || 0)
    }
  };
}

const server = http.createServer(async (req,res) => {
  try {
    if (req.method === "POST" && req.url === "/api/classify") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 20000) return json(res,413,{error:"Input too large."});
      }
      let parsed;
      try { parsed = JSON.parse(raw || "{}"); }
      catch { return json(res,400,{error:"Invalid JSON."}); }

      const text = String(parsed.text || "").trim();
      if (!text) return json(res,400,{error:"Enter a fictional moral dilemma."});
      if (text.length > 1200) return json(res,400,{error:"Keep the dilemma under 1,200 characters."});
      return json(res,200,apiKey ? await classifyWithJev(text) : previewClassify(text));
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405); return res.end();
    }

    const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const safePath = normalize(requestPath).replace(/^([.][.][/\\])+/, "");
    const filePath = join(publicDir, safePath);
    if (!filePath.startsWith(publicDir)) { res.writeHead(403); return res.end(); }

    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] || "application/octet-stream",
      "cache-control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    if (req.method === "HEAD") return res.end();
    res.end(data);
  } catch (error) {
    if (error?.code === "ENOENT") { res.writeHead(404); return res.end("Not found"); }
    console.error(error);
    json(res,500,{error:"Could not classify this dilemma right now."});
  }
});

server.listen(port, () => {
  console.log(`jev-crowd running at http://localhost:${port}`);
  console.log(apiKey ? "Jev mode enabled." : "Preview mode: set TYPESAFE_API_KEY for real Jev classification.");
});
