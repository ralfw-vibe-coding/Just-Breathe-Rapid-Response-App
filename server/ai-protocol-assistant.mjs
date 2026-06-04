import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTIONS = ["up", "down", "horizontal", "restorative", "functional"];
const STORAGE_SCHEMA = {
  name: "jbr2_protocol_suggestions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            overallDirection: { type: "string", enum: DIRECTIONS },
            phases: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  position: { type: "integer" },
                  direction: { type: "string", enum: DIRECTIONS },
                  techniqueId: { type: "string" },
                  variationDimensionId: { type: "string" },
                  variationA: { type: "string" },
                  variationB: { type: "string" },
                  variationC: { type: "string" }
                },
                required: [
                  "position",
                  "direction",
                  "techniqueId",
                  "variationDimensionId",
                  "variationA",
                  "variationB",
                  "variationC"
                ]
              }
            }
          },
          required: ["id", "title", "summary", "overallDirection", "phases"]
        }
      }
    },
    required: ["suggestions"]
  }
};

function parseDotEnv(text) {
  const result = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

async function getEnvValue(key) {
  if (process.env[key]) {
    return process.env[key];
  }

  const requirementsDir = await findProjectRoot();
  const envPath = path.join(requirementsDir, ".env");

  try {
    const text = await readFile(envPath, "utf8");
    const parsed = parseDotEnv(text);
    return parsed[key];
  } catch {
    return undefined;
  }
}

async function findProjectRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  const candidates = [
    process.cwd(),
    path.resolve(currentDir, ".."),
    path.resolve(currentDir, "../.."),
    process.env.LAMBDA_TASK_ROOT || ""
  ].filter(Boolean);

  for (const candidate of candidates) {
    const requirementsPath = path.join(candidate, "requirements", "techniques.json");
    try {
      await readFile(requirementsPath, "utf8");
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("Could not locate project root with requirements directory.");
}

async function loadKnowledgeBase() {
  const root = await findProjectRoot();
  const [manualText, techniquesText] = await Promise.all([
    readFile(path.join(root, "requirements", "manual.txt"), "utf8"),
    readFile(path.join(root, "requirements", "techniques.json"), "utf8")
  ]);

  const techniques = JSON.parse(techniquesText);
  return {
    manualText,
    techniquesText,
    techniques
  };
}

function buildTechniqueCatalog(techniques) {
  return techniques.techniques
    .filter((technique) => technique.dimensions.structure === "single")
    .map((technique) => ({
      id: technique.id,
      title: technique.title,
      directions: technique.dimensions.direction,
      response: technique.dimensions.response ?? null,
      temperature: technique.dimensions.temperature ?? null,
      variationDimensions: technique.variationDimensions ?? []
    }));
}

function buildVariationCatalog(techniques) {
  return techniques.variationDimensions.map((variation) => ({
    id: variation.id,
    title: variation.title,
    text: variation.text
  }));
}

function validateSuggestionPayload(payload, techniques) {
  const techniqueMap = new Map(
    techniques.techniques
      .filter((technique) => technique.dimensions.structure === "single")
      .map((technique) => [technique.id, technique])
  );
  const variationMap = new Map(techniques.variationDimensions.map((variation) => [variation.id, variation]));

  if (!payload || !Array.isArray(payload.suggestions) || payload.suggestions.length !== 3) {
    throw new Error("Assistant did not return exactly three suggestions.");
  }

  return {
    suggestions: payload.suggestions.map((suggestion, suggestionIndex) => {
      if (!Array.isArray(suggestion.phases) || suggestion.phases.length !== 3) {
        throw new Error(`Suggestion ${suggestionIndex + 1} must contain exactly three phases.`);
      }

      return {
        ...suggestion,
        phases: suggestion.phases.map((phase, phaseIndex) => {
          const technique = techniqueMap.get(phase.techniqueId);
          if (!technique) {
            throw new Error(`Unknown technique id: ${phase.techniqueId}`);
          }

          if (!technique.dimensions.direction.includes(phase.direction)) {
            throw new Error(
              `Technique ${phase.techniqueId} is not compatible with direction ${phase.direction}.`
            );
          }

          if (!(technique.variationDimensions ?? []).includes(phase.variationDimensionId)) {
            throw new Error(
              `Variation dimension ${phase.variationDimensionId} is not allowed for technique ${phase.techniqueId}.`
            );
          }

          if (!variationMap.has(phase.variationDimensionId)) {
            throw new Error(`Unknown variation dimension id: ${phase.variationDimensionId}`);
          }

          return {
            ...phase,
            position: phaseIndex + 1
          };
        })
      };
    })
  };
}

export async function generateProtocolSuggestions({
  clientDescription,
  overallDirectionHint,
  phaseHints
}) {
  if (!clientDescription || clientDescription.trim().length < 10) {
    throw new Error("Please provide a more detailed client description.");
  }

  const apiKey = await getEnvValue("OPENAI_API_KEY");
  const model = (await getEnvValue("OPENAI_MODEL")) || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const knowledgeBase = await loadKnowledgeBase();
  const techniqueCatalog = buildTechniqueCatalog(knowledgeBase.techniques);
  const variationCatalog = buildVariationCatalog(knowledgeBase.techniques);

  const systemPrompt = [
    "You are the AI assistant inside Just Breathe Rapid Response (JBR2).",
    "Your task is to propose exactly three different ABC123 breathwork protocols.",
    "You must use only the knowledge contained in the provided manual.txt and techniques.json.",
    "Do not invent techniques, variation dimensions, or directions.",
    "Each protocol must contain exactly three phases.",
    "For each phase, choose one technique whose direction list includes that phase direction.",
    "For each chosen technique, choose exactly one valid variation dimension from that technique's allowed variationDimensions.",
    "Then generate three concrete variations A, B, and C that fit the client case and the chosen variation dimension.",
    "Keep summaries concise and practical.",
    "Return valid JSON only."
  ].join("\n");

  const userPrompt = [
    "Client description:",
    clientDescription.trim(),
    "",
    `Overall direction hint: ${overallDirectionHint || "none"}`,
    `Phase direction hints: ${(phaseHints ?? []).map((hint) => hint || "any").join(", ")}`,
    "",
    "Allowed directions:",
    JSON.stringify(DIRECTIONS),
    "",
    "Single-technique catalog:",
    JSON.stringify(techniqueCatalog),
    "",
    "Variation-dimension catalog:",
    JSON.stringify(variationCatalog),
    "",
    "Full techniques.json knowledge base:",
    knowledgeBase.techniquesText,
    "",
    "Full manual.txt knowledge base:",
    knowledgeBase.manualText
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: STORAGE_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not contain assistant content.");
  }

  const parsed = JSON.parse(content);
  return validateSuggestionPayload(parsed, knowledgeBase.techniques);
}
