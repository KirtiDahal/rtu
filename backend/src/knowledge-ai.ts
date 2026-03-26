type KnowledgeSection = {
  heading: string;
  body: string;
};

export type KnowledgeContextArticle = {
  slug: string;
  title: string;
  summary: string;
  content: unknown;
};

export type KnowledgeAiAnswer = {
  answer: string;
  model: string;
  relatedArticles: Array<{ slug: string; title: string }>;
};

type AskKnowledgeAiOptions = {
  apiKey: string;
  model: string;
  query: string;
  timeoutMs: number;
  appOrigin?: string;
  articles: KnowledgeContextArticle[];
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function extractSections(content: unknown): KnowledgeSection[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const heading = "heading" in item && typeof item.heading === "string" ? item.heading : "";
      const body = "body" in item && typeof item.body === "string" ? item.body : "";
      if (!heading && !body) {
        return null;
      }
      return { heading, body };
    })
    .filter((item): item is KnowledgeSection => Boolean(item));
}

function buildKnowledgeContext(articles: KnowledgeContextArticle[]): string {
  if (articles.length === 0) {
    return "No direct FAQ context found for this question.";
  }

  return articles
    .map((article, index) => {
      const sections = extractSections(article.content)
        .slice(0, 2)
        .map((section) => `- ${section.heading}: ${section.body}`)
        .join("\n");
      return [
        `Article ${index + 1}: ${article.title}`,
        `Summary: ${article.summary}`,
        sections ? `Sections:\n${sections}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function extractMessageContent(raw: unknown): string {
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (!Array.isArray(raw)) {
    return "";
  }

  return raw
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .trim();
}

export async function askKnowledgeAi(options: AskKnowledgeAiOptions): Promise<KnowledgeAiAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const context = buildKnowledgeContext(options.articles);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        ...(options.appOrigin ? { "HTTP-Referer": options.appOrigin } : {}),
        "X-Title": "RTU Knowledge Assistant"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You are a supportive menstrual health education assistant. Provide concise, factual guidance. Do not diagnose. If urgent symptoms are described, suggest seeing a licensed clinician."
          },
          {
            role: "user",
            content: [
              `Question: ${options.query}`,
              "",
              "Relevant FAQ context from the app knowledge base:",
              context,
              "",
              "Answer in plain language with 2-5 short paragraphs."
            ].join("\n")
          }
        ]
      }),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{
            message?: {
              content?: unknown;
            };
          }>;
          error?: { message?: string };
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "OpenRouter request failed");
    }

    const answer = extractMessageContent(payload?.choices?.[0]?.message?.content);
    if (!answer) {
      throw new Error("Empty response from AI model");
    }

    return {
      answer,
      model: options.model,
      relatedArticles: options.articles.map((article) => ({ slug: article.slug, title: article.title }))
    };
  } finally {
    clearTimeout(timeout);
  }
}
