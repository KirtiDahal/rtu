import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import kuromiThinking from "../../images/kuromi.png";

const categories = ["All", "Basics", "Phases", "Nutrition", "Common Concerns"];

export function KnowledgePage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantHint, setAssistantHint] = useState("");
  const trimmedSearch = search.trim();
  const effectiveCategory = trimmedSearch ? "All" : category;
  const { data: articles = [] } = useQuery({
    queryKey: ["knowledge-list", effectiveCategory, trimmedSearch],
    queryFn: () => api.knowledge.list({ category: effectiveCategory, search: trimmedSearch })
  });

  const filtered = useMemo(
    () =>
      articles.filter((article) => {
        const normalizedSearch = trimmedSearch.toLowerCase();
        const matchSearch =
          !normalizedSearch ||
          article.title.toLowerCase().includes(normalizedSearch) ||
          article.summary.toLowerCase().includes(normalizedSearch);
        return matchSearch;
      }),
    [articles, trimmedSearch]
  );

  const [activeSlug, setActiveSlug] = useState<string>("");
  useEffect(() => {
    if (!filtered[0]) {
      setActiveSlug("");
      return;
    }

    setActiveSlug((current) => {
      if (current && filtered.some((article) => article.slug === current)) {
        return current;
      }
      return filtered[0].slug;
    });
  }, [filtered]);

  const detailQuery = useQuery({
    queryKey: ["knowledge-detail", activeSlug],
    queryFn: () => api.knowledge.detail(activeSlug),
    enabled: Boolean(activeSlug)
  });

  const aiMutation = useMutation({
    mutationFn: (query: string) => api.knowledge.ask(query)
  });

  const showFaq = filtered.length > 0;
  const hasSearchInput = trimmedSearch.length > 0;

  const quickPrompts = [
    "Why is my period late this month?",
    "How can I reduce cramps naturally?",
    "Mood swings before period, what helps?"
  ];

  function submitKnowledgeSearch(event: FormEvent) {
    event.preventDefault();

    if (!trimmedSearch) {
      setAssistantHint("Type a question first.");
      return;
    }

    if (trimmedSearch.length < 3) {
      setAssistantHint("Please enter at least 3 characters to ask AI.");
      return;
    }

    if (showFaq) {
      setAssistantHint("FAQ matches found. Generating an AI answer too.");
      setActiveSlug(filtered[0]?.slug ?? "");
    } else {
      setAssistantHint("");
    }

    setAssistantQuestion(trimmedSearch);
    aiMutation.mutate(trimmedSearch);
  }

  const hasAnswerForCurrentSearch = aiMutation.isSuccess && assistantQuestion === trimmedSearch;
  const hasErrorForCurrentSearch = aiMutation.isError && assistantQuestion === trimmedSearch;
  const isLoadingCurrentSearch = aiMutation.isPending && assistantQuestion === trimmedSearch;
  const assistantErrorMessage =
    aiMutation.error instanceof Error
      ? aiMutation.error.message
      : "AI assistant could not answer right now. Please try again in a few seconds.";
  const assistantCard = hasSearchInput ? (
    <div className="ai-answer-card">
      <div className="kuromi-chat-header">
        <div>
          <h2>Kuromi Companion</h2>
          <p className="subtitle">Tell me what&apos;s bothering you, and I&apos;ll guide you gently.</p>
        </div>
      </div>

      <div className="assistant-chip-row">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="assistant-chip"
            onClick={() => {
              setSearch(prompt);
              setAssistantHint("Press Enter or Ask AI to send this question.");
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {assistantHint && <p className="knowledge-hint">{assistantHint}</p>}

      {isLoadingCurrentSearch && (
        <div className="ai-loading" role="status" aria-live="polite">
          <span className="ai-loading-dot" />
          <span className="ai-loading-dot" />
          <span className="ai-loading-dot" />
          <p>Companion is preparing your answer...</p>
        </div>
      )}

      {hasAnswerForCurrentSearch && aiMutation.data ? (
        <>
          <p className="subtitle">
            Answer for: <strong>{assistantQuestion}</strong>
          </p>
          <div className="kuromi-thought-layout">
            <img src={kuromiThinking} alt="Kuromi thinking" className="kuromi-character" />
            <div className="kuromi-thought-stage">
              <span className="kuromi-thought-dot dot-one" />
              <span className="kuromi-thought-dot dot-two" />
              <div className="kuromi-bubble">
                <p className="ai-answer-body">{aiMutation.data.answer}</p>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {hasErrorForCurrentSearch ? (
        <p className="knowledge-hint error">{assistantErrorMessage}</p>
      ) : null}

      {hasAnswerForCurrentSearch && (
        <p className="ai-answer-note">
          Educational guidance only. If symptoms feel severe or unusual, contact a licensed clinician.
        </p>
      )}
    </div>
  ) : null;

  return (
    <div className="knowledge-layout">
      <section className="panel knowledge-main">
        <header className="knowledge-hero">
          <h1>How can we help you today?</h1>
          <p>Explore our knowledge base to understand your body&apos;s natural rhythms.</p>
          <form className="knowledge-search-form" onSubmit={submitKnowledgeSearch}>
            <input
              placeholder="Search for luteal phase, cramps, or mood..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setAssistantHint("");
              }}
            />
            <button type="submit" className="knowledge-ask-btn">
              Ask AI
            </button>
          </form>
          <p className="knowledge-search-note">
            Press Enter or use Ask AI. If FAQ matches exist, you&apos;ll see both FAQ and AI guidance.
          </p>
        </header>
        <div className="category-row">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={category === item ? "category-pill active" : "category-pill"}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="knowledge-content">
          <aside>
            {filtered.length > 0 ? (
              filtered.map((article) => (
                <button
                  type="button"
                  key={article.slug}
                  className={article.slug === activeSlug ? "article-link active" : "article-link"}
                  onClick={() => setActiveSlug(article.slug)}
                >
                  <strong>{article.title}</strong>
                  <span>{article.summary}</span>
                </button>
              ))
            ) : trimmedSearch ? (
              <p className="knowledge-empty">No FAQ matched your search. Showing AI assistant response.</p>
            ) : (
              <p className="knowledge-empty">No articles available in this category.</p>
            )}
          </aside>
          <article className="article-detail">
            {detailQuery.data && showFaq ? (
              <>
                <h2>{detailQuery.data.title}</h2>
                <p className="subtitle">{detailQuery.data.summary}</p>
                {detailQuery.data.content.map((section) => (
                  <details key={section.heading} open>
                    <summary>{section.heading}</summary>
                    <p>{section.body}</p>
                  </details>
                ))}
                {assistantCard}
              </>
            ) : hasSearchInput ? (
              assistantCard
            ) : detailQuery.isLoading && showFaq ? (
              <p>Loading article...</p>
            ) : (
              <p>Choose an article to read.</p>
            )}
          </article>
        </div>
      </section>
      <aside className="panel knowledge-side">
        <h3>Did you know?</h3>
        {(detailQuery.data?.tips ?? []).slice(0, 3).map((tip) => (
          <article key={tip.id} className={`tip-card ${tip.theme}`}>
            <h4>{tip.title}</h4>
            <p>{tip.body}</p>
          </article>
        ))}
      </aside>
    </div>
  );
}
