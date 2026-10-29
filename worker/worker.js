const ALLOWED_ORIGINS = ["https://cayambe.runs.nz", "https://bogdanstate.github.io"];
const GITHUB_REPO = "bogdanstate/camp-cayambe-submissions";
const FIELDS = ["name", "email", "phone", "country", "experience", "comments"];
const REQUIRED_FIELDS = ["name", "email"];
const MAX_LENGTH = 4000;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// JSON strings are valid YAML double-quoted scalars, so multi-line answers survive.
function toYaml(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}: ${JSON.stringify(String(value))}`)
    .join("\n") + "\n";
}

function generateFilename() {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `eoi/${ts}-${rand}.yml`;
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  return btoa(Array.from(bytes, (b) => String.fromCodePoint(b)).join(""));
}

async function saveToGitHub(submission, env) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${generateFilename()}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "camp-cayambe-eoi-worker",
      },
      body: JSON.stringify({
        message: `New EOI from ${submission.name}`,
        content: base64Encode(toYaml(submission)),
      }),
    }
  );
  if (!response.ok) {
    console.error("GitHub API error:", await response.text());
    throw new Error("Failed to save submission");
  }
}

async function handleEoi(request, env, origin) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
    return json({ error: "Unsupported content type" }, 400, origin);
  }
  const data = await request.json();

  // Honeypot: bots fill the hidden "website" field; pretend success.
  if (data.website) return json({ ok: true }, 200, origin);

  const missing = REQUIRED_FIELDS.filter((f) => !data[f] || !String(data[f]).trim());
  if (missing.length > 0) {
    return json({ error: `Missing required fields: ${missing.join(", ")}` }, 400, origin);
  }

  const submission = {};
  for (const f of FIELDS) {
    submission[f] = String(data[f] || "").trim().slice(0, MAX_LENGTH);
  }
  submission.submitted_at = new Date().toISOString();

  try {
    await saveToGitHub(submission, env);
  } catch (err) {
    return json({ error: "Failed to save. Please try again." }, 500, origin);
  }
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/eoi" && request.method === "POST") {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return json({ error: "Forbidden" }, 403, origin);
      }
      return handleEoi(request, env, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};
