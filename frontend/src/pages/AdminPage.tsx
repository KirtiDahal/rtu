import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { api } from "../lib/api";
import type { AdminKnowledgeArticle } from "../types";

export function AdminPage() {
  const queryClient = useQueryClient();

  const [channelSlug, setChannelSlug] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");

  const [articleSlug, setArticleSlug] = useState("");
  const [articleCategory, setArticleCategory] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSummary, setArticleSummary] = useState("");
  const [articleHeading, setArticleHeading] = useState("");
  const [articleBody, setArticleBody] = useState("");

  const [adminMessage, setAdminMessage] = useState("");
  const [adminError, setAdminError] = useState("");
  const [articleFormError, setArticleFormError] = useState("");
  const [moderationChannelFilter, setModerationChannelFilter] = useState("all");
  const [moderationRoleFilter, setModerationRoleFilter] = useState("all");
  const [showAddArticleForm, setShowAddArticleForm] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleSlug, setEditArticleSlug] = useState("");
  const [editArticleCategory, setEditArticleCategory] = useState("");
  const [editArticleTitle, setEditArticleTitle] = useState("");
  const [editArticleSummary, setEditArticleSummary] = useState("");
  const [editArticleHeading, setEditArticleHeading] = useState("");
  const [editArticleBody, setEditArticleBody] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.admin.overview()
  });

  const messagesQuery = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => api.admin.messages(50)
  });

  const articlesQuery = useQuery({
    queryKey: ["admin-knowledge-articles"],
    queryFn: () => api.admin.knowledgeArticles()
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteMessage(id),
    onSuccess: async () => {
      setAdminMessage("Message removed.");
      setAdminError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-messages"] })
      ]);
    },
    onError: (error) => {
      setAdminError((error as Error).message);
      setAdminMessage("");
    }
  });

  const createChannelMutation = useMutation({
    mutationFn: () =>
      api.admin.createChannel({
        slug: channelSlug.trim().toLowerCase(),
        name: channelName.trim(),
        description: channelDescription.trim()
      }),
    onSuccess: async () => {
      setAdminMessage("Channel created.");
      setAdminError("");
      setChannelSlug("");
      setChannelName("");
      setChannelDescription("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["community-channels"] })
      ]);
    },
    onError: (error) => {
      setAdminError((error as Error).message);
      setAdminMessage("");
    }
  });

  const createArticleMutation = useMutation({
    mutationFn: () =>
      api.admin.createKnowledgeArticle({
        slug: articleSlug.trim().toLowerCase(),
        category: articleCategory.trim(),
        title: articleTitle.trim(),
        summary: articleSummary.trim(),
        content: [{ heading: articleHeading.trim(), body: articleBody.trim() }]
      }),
    onSuccess: async () => {
      setAdminMessage("Knowledge article created.");
      setAdminError("");
      setArticleFormError("");
      setArticleSlug("");
      setArticleCategory("");
      setArticleTitle("");
      setArticleSummary("");
      setArticleHeading("");
      setArticleBody("");
      setShowAddArticleForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-knowledge-articles"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] })
      ]);
    },
    onError: (error) => {
      setArticleFormError((error as Error).message);
      setAdminError((error as Error).message);
      setAdminMessage("");
    }
  });

  const updateArticleMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      slug: string;
      category: string;
      title: string;
      summary: string;
      heading: string;
      body: string;
    }) =>
      api.admin.updateKnowledgeArticle(payload.id, {
        slug: payload.slug.trim().toLowerCase(),
        category: payload.category.trim(),
        title: payload.title.trim(),
        summary: payload.summary.trim(),
        content: [{ heading: payload.heading.trim(), body: payload.body.trim() }]
      }),
    onSuccess: async () => {
      setAdminMessage("Knowledge article updated.");
      setAdminError("");
      setEditingArticleId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-knowledge-articles"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] })
      ]);
    },
    onError: (error) => {
      setAdminError((error as Error).message);
      setAdminMessage("");
    }
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteKnowledgeArticle(id),
    onSuccess: async () => {
      setAdminMessage("Knowledge article deleted.");
      setAdminError("");
      if (editingArticleId) {
        setEditingArticleId(null);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-knowledge-articles"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] })
      ]);
    },
    onError: (error) => {
      setAdminError((error as Error).message);
      setAdminMessage("");
    }
  });

  if (overviewQuery.isLoading || messagesQuery.isLoading || articlesQuery.isLoading) {
    return <div className="panel">Loading admin tools...</div>;
  }

  if (!overviewQuery.data || !messagesQuery.data || !articlesQuery.data) {
    return <div className="panel">Unable to load admin tools.</div>;
  }

  const channelFilters = [...new Set(messagesQuery.data.map((message) => message.channelName))].sort((a, b) =>
    a.localeCompare(b)
  );
  const roleFilters = [...new Set(messagesQuery.data.map((message) => message.roleLabel))].sort((a, b) =>
    a.localeCompare(b)
  );

  const filteredMessages = messagesQuery.data.filter((message) => {
    const channelMatches =
      moderationChannelFilter === "all" || message.channelName === moderationChannelFilter;
    const roleMatches = moderationRoleFilter === "all" || message.roleLabel === moderationRoleFilter;
    return channelMatches && roleMatches;
  });

  const groupedMessages = filteredMessages.reduce<Record<string, typeof filteredMessages>>((acc, message) => {
    if (!acc[message.channelName]) {
      acc[message.channelName] = [];
    }
    acc[message.channelName].push(message);
    return acc;
  }, {});
  const groupedMessageEntries = Object.entries(groupedMessages).sort(([a], [b]) => a.localeCompare(b));

  function startEditingArticle(article: AdminKnowledgeArticle) {
    const firstSection = article.content[0];
    setEditingArticleId(article.id);
    setEditArticleSlug(article.slug);
    setEditArticleCategory(article.category);
    setEditArticleTitle(article.title);
    setEditArticleSummary(article.summary);
    setEditArticleHeading(firstSection?.heading ?? "");
    setEditArticleBody(firstSection?.body ?? "");
  }

  function cancelEditingArticle() {
    setEditingArticleId(null);
    setEditArticleSlug("");
    setEditArticleCategory("");
    setEditArticleTitle("");
    setEditArticleSummary("");
    setEditArticleHeading("");
    setEditArticleBody("");
  }

  function saveEditedArticle() {
    if (!editingArticleId) {
      return;
    }

    if (
      !editArticleSlug.trim() ||
      !editArticleCategory.trim() ||
      !editArticleTitle.trim() ||
      !editArticleSummary.trim() ||
      !editArticleHeading.trim() ||
      !editArticleBody.trim()
    ) {
      setAdminError("All edit fields are required to update an article.");
      setAdminMessage("");
      return;
    }

    updateArticleMutation.mutate({
      id: editingArticleId,
      slug: editArticleSlug,
      category: editArticleCategory,
      title: editArticleTitle,
      summary: editArticleSummary,
      heading: editArticleHeading,
      body: editArticleBody
    });
  }

  function removeArticle(id: string) {
    const shouldDelete = window.confirm("Delete this knowledge article permanently?");
    if (!shouldDelete) {
      return;
    }
    deleteArticleMutation.mutate(id);
  }

  function validateArticleDraft(): string | null {
    const slug = articleSlug.trim().toLowerCase();
    const category = articleCategory.trim();
    const title = articleTitle.trim();
    const summary = articleSummary.trim();
    const heading = articleHeading.trim();
    const body = articleBody.trim();

    if (!slug) {
      return "Slug is required.";
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return "Slug can only contain lowercase letters, numbers, and hyphens.";
    }
    if (category.length < 2) {
      return "Category must be at least 2 characters.";
    }
    if (title.length < 3) {
      return "Title must be at least 3 characters.";
    }
    if (summary.length < 10) {
      return "Summary must be at least 10 characters.";
    }
    if (heading.length < 2) {
      return "Section Heading must be at least 2 characters.";
    }
    if (body.length < 2) {
      return "Section Body must be at least 2 characters.";
    }
    return null;
  }

  function publishArticle() {
    const validationError = validateArticleDraft();
    if (validationError) {
      setArticleFormError(validationError);
      setAdminError("");
      setAdminMessage("");
      return;
    }

    setArticleFormError("");
    createArticleMutation.mutate();
  }

  return (
    <div className="admin-page-grid">
      <section className="panel admin-main">
        <h1>Admin Workspace</h1>
        <p className="subtitle">Moderation and content controls for platform management.</p>

        <div className="admin-stat-grid">
          <article className="metric-card">
            <h4>Members</h4>
            <p className="sleep-value">{overviewQuery.data.totalUsers}</p>
          </article>
          <article className="metric-card">
            <h4>Admins</h4>
            <p className="sleep-value">{overviewQuery.data.totalAdmins}</p>
          </article>
          <article className="metric-card">
            <h4>Messages</h4>
            <p className="sleep-value">{overviewQuery.data.totalMessages}</p>
          </article>
          <article className="metric-card">
            <h4>Articles</h4>
            <p className="sleep-value">{overviewQuery.data.totalArticles}</p>
          </article>
        </div>

        <article className="admin-card">
          <h3>Moderate Messages</h3>
          <p className="subtitle">Remove harmful or off-topic posts from public channels.</p>

          <div className="admin-moderation-toolbar">
            <label>
              Channel
              <select
                value={moderationChannelFilter}
                onChange={(event) => setModerationChannelFilter(event.target.value)}
              >
                <option value="all">All channels</option>
                {channelFilters.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Role
              <select value={moderationRoleFilter} onChange={(event) => setModerationRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                {roleFilters.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <p className="subtitle">{filteredMessages.length} messages in current view</p>
          </div>

          <div className="admin-scroll-list">
            {groupedMessageEntries.length === 0 && (
              <p className="subtitle">No messages found for the current filters.</p>
            )}

            {groupedMessageEntries.map(([channelName, messages]) => (
              <div key={channelName} className="admin-message-group">
                <div className="admin-message-group-title">
                  <strong>#{channelName}</strong>
                  <span>{messages.length}</span>
                </div>

                <ul className="activity-list">
                  {messages.map((message) => (
                    <li key={message.id}>
                      <strong>{message.senderName}</strong>
                      <span>{message.body}</span>
                      <span>
                        {message.roleLabel} | {format(new Date(message.createdAt), "MMM d, h:mm a")}
                      </span>
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={deleteMessageMutation.isPending}
                        onClick={() => deleteMessageMutation.mutate(message.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <div className="admin-form-grid">
          <article className="admin-card">
            <h3>Create Community Channel</h3>
            <div className="profile-form-grid">
              <label>
                Slug
                <input
                  value={channelSlug}
                  onChange={(event) => setChannelSlug(event.target.value)}
                  placeholder="self-care-room"
                />
              </label>
              <label>
                Name
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  placeholder="Self Care Room"
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={channelDescription}
                  onChange={(event) => setChannelDescription(event.target.value)}
                  placeholder="Who this channel is for..."
                />
              </label>
            </div>
            <div className="profile-actions">
              <button
                type="button"
                className="primary-btn admin-compact-btn"
                disabled={createChannelMutation.isPending}
                onClick={() => createChannelMutation.mutate()}
              >
                {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </article>
        </div>

        <article className="admin-card">
          <div className="admin-card-head">
            <h3>Knowledge Library (Latest)</h3>
            <button
              type="button"
              className="primary-btn admin-compact-btn"
              onClick={() => setShowAddArticleForm((prev) => !prev)}
              disabled={createArticleMutation.isPending || updateArticleMutation.isPending}
            >
              {showAddArticleForm ? "Close Add Form" : "Add Article"}
            </button>
          </div>

          {showAddArticleForm && (
            <div className="admin-edit-block">
              <div className="profile-form-grid">
                <label>
                  Slug
                  <input
                    value={articleSlug}
                    onChange={(event) => setArticleSlug(event.target.value)}
                    placeholder="cycle-sleep-basics"
                  />
                </label>
                <label>
                  Category
                  <input
                    value={articleCategory}
                    onChange={(event) => setArticleCategory(event.target.value)}
                    placeholder="Sleep"
                  />
                </label>
                <label>
                  Title
                  <input
                    value={articleTitle}
                    onChange={(event) => setArticleTitle(event.target.value)}
                    placeholder="Sleep and Your Cycle"
                  />
                </label>
                <label>
                  Summary
                  <textarea
                    rows={2}
                    value={articleSummary}
                    onChange={(event) => setArticleSummary(event.target.value)}
                  />
                </label>
                <label>
                  Section Heading
                  <input
                    value={articleHeading}
                    onChange={(event) => setArticleHeading(event.target.value)}
                    placeholder="Why sleep quality matters"
                  />
                </label>
                <label>
                  Section Body
                  <textarea rows={4} value={articleBody} onChange={(event) => setArticleBody(event.target.value)} />
                </label>
              </div>
              <div className="admin-inline-actions">
                <button
                  type="button"
                  className="primary-btn admin-compact-btn"
                  disabled={createArticleMutation.isPending}
                  onClick={publishArticle}
                >
                  {createArticleMutation.isPending ? "Publishing..." : "Publish Article"}
                </button>
                <button
                  type="button"
                  className="secondary-btn admin-compact-btn"
                  disabled={createArticleMutation.isPending}
                  onClick={() => {
                    setShowAddArticleForm(false);
                    setArticleFormError("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {articleFormError && <p className="action-error">{articleFormError}</p>}
            </div>
          )}

          <ul className="activity-list">
            {articlesQuery.data.slice(0, 8).map((article) => (
              <li key={article.id}>
                <strong>{article.title}</strong>
                <span>
                  {article.category} | {article.slug}
                </span>
                <span>{format(new Date(article.updatedAt), "MMM d, yyyy")}</span>
                <div className="admin-inline-actions">
                  <button
                    type="button"
                    className="secondary-btn admin-compact-btn"
                    onClick={() => startEditingArticle(article)}
                    disabled={deleteArticleMutation.isPending || updateArticleMutation.isPending}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger-btn admin-small-danger-btn"
                    onClick={() => removeArticle(article.id)}
                    disabled={deleteArticleMutation.isPending || updateArticleMutation.isPending}
                  >
                    Delete
                  </button>
                </div>

                {editingArticleId === article.id && (
                  <div className="admin-edit-block">
                    <label>
                      Slug
                      <input value={editArticleSlug} onChange={(event) => setEditArticleSlug(event.target.value)} />
                    </label>
                    <label>
                      Category
                      <input
                        value={editArticleCategory}
                        onChange={(event) => setEditArticleCategory(event.target.value)}
                      />
                    </label>
                    <label>
                      Title
                      <input value={editArticleTitle} onChange={(event) => setEditArticleTitle(event.target.value)} />
                    </label>
                    <label>
                      Summary
                      <textarea
                        rows={2}
                        value={editArticleSummary}
                        onChange={(event) => setEditArticleSummary(event.target.value)}
                      />
                    </label>
                    <label>
                      Section Heading
                      <input
                        value={editArticleHeading}
                        onChange={(event) => setEditArticleHeading(event.target.value)}
                      />
                    </label>
                    <label>
                      Section Body
                      <textarea rows={4} value={editArticleBody} onChange={(event) => setEditArticleBody(event.target.value)} />
                    </label>
                    <div className="admin-inline-actions">
                      <button
                        type="button"
                        className="primary-btn admin-compact-btn"
                        onClick={saveEditedArticle}
                        disabled={updateArticleMutation.isPending}
                      >
                        {updateArticleMutation.isPending ? "Updating..." : "Update"}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn admin-compact-btn"
                        onClick={cancelEditingArticle}
                        disabled={updateArticleMutation.isPending}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>

        {adminMessage && <p className="action-feedback">{adminMessage}</p>}
        {adminError && <p className="action-error">{adminError}</p>}
      </section>
    </div>
  );
}
