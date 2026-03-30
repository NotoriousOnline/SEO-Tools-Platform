"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ToolConfig } from "@/lib/toolRegistry";

type ImageItem = {
  type: "featured" | "in-content";
  index: number;
  prompt: string;
  base64: string;
  mimeType: string;
  included: boolean;
  altText?: string;
  fileSlug?: string;
  h2Index?: number;
  sectionHeading?: string;
};

type InternalLink = { title: string; url: string };

type Site = {
  id: string;
  name: string;
  url: string;
  username: string;
  app_password: string;
  tone_prompt?: string;
};

export function ContentProductionTool({
  config,
  apiPrefix = "/api/content-production",
}: {
  config: ToolConfig;
  /** Separate API namespace per product (e.g. Weed.com uses `/api/weed-com-content-production`). */
  apiPrefix?: string;
}) {
  const api = apiPrefix.replace(/\/$/, "");
  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string; url: string } | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTonePrompt, setEditTonePrompt] = useState("");
  const [addForm, setAddForm] = useState({
    name: "",
    url: "",
    username: "",
    app_password: "",
    tone_prompt: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordExtractLoading, setKeywordExtractLoading] = useState(false);
  const [keywordExtractError, setKeywordExtractError] = useState<string | null>(null);
  const [keywordExtractInfo, setKeywordExtractInfo] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [wordCount, setWordCount] = useState(1500);
  const [generating, setGenerating] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ImageItem[] | null>(null);
  const [internalLinksUsed, setInternalLinksUsed] = useState<InternalLink[]>([]);
  const [contentApproved, setContentApproved] = useState(false);
  const [imagesApproved, setImagesApproved] = useState(false);
  const [approvedContent, setApprovedContent] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{
    postId: number;
    postUrl: string;
    editUrl: string;
    site: { name: string; url: string };
    yoast?: { focusKeyphrase?: string; metaDescriptionSet?: boolean };
  } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const siteUnlocked = !!selectedSite;
  const contentWordCount = approvedContent
    ? approvedContent.split(/\s+/).filter(Boolean).length
    : generatedContent
      ? generatedContent.split(/\s+/).filter(Boolean).length
      : 0;

  const fetchSites = async () => {
    setSitesLoading(true);
    try {
      const res = await fetch(`${api}/sites`);
      const data = await res.json();
      if (res.ok) setSites(Array.isArray(data) ? data : []);
      else setSites([]);
    } catch {
      setSites([]);
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`${api}/sites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, tone_prompt: editTonePrompt }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchSites();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      const res = await fetch(`${api}/sites/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirmId(null);
        if (selectedSite?.id === id) setSelectedSite(null);
        fetchSites();
      }
    } catch {
      setDeleteConfirmId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);
    if (!addForm.name.trim() || !addForm.url.trim() || !addForm.username.trim() || !addForm.app_password.trim()) {
      setAddError("All fields except Tone are required.");
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`${api}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          url: addForm.url.trim(),
          username: addForm.username.trim(),
          app_password: addForm.app_password,
          tone_prompt: addForm.tone_prompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add site");
        return;
      }
      setAddForm({ name: "", url: "", username: "", app_password: "", tone_prompt: "" });
      setAddSuccess(true);
      fetchSites();
    } catch {
      setAddError("Request failed");
    } finally {
      setAddLoading(false);
    }
  };

  const startEdit = (site: Site) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditTonePrompt(site.tone_prompt ?? "");
  };

  const addKeyword = () => {
    const val = keywordInput.trim().replace(/,/g, "");
    if (val && !keywords.includes(val)) {
      setKeywords((k) => [...k, val]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (idx: number) => {
    setKeywords((k) => k.filter((_, i) => i !== idx));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleExtractKeywordsFromTitle = async () => {
    if (!title.trim()) {
      setKeywordExtractError("Enter a title first.");
      return;
    }
    setKeywordExtractError(null);
    setKeywordExtractInfo(null);
    setKeywordExtractLoading(true);
    const fileLockHint =
      " If the dev terminal shows EBUSY file-lock errors, stop the server, run npm run clean, then exclude the .next folder from OneDrive sync or move the project outside OneDrive.";

    const doFetch = () =>
      fetch(`${api}/extract-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

    try {
      let res = await doFetch();
      if (res.status >= 500 && res.status < 600) {
        await new Promise((r) => setTimeout(r, 500));
        res = await doFetch();
      }

      const rawText = await res.text();
      let data: {
        error?: string;
        keywords?: unknown;
        sources?: { ahrefs?: { enabled?: boolean; mergedCount?: number; error?: string | null; country?: string | null } };
      };
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        setKeywordExtractError(
          `Server returned a non-JSON response (HTTP ${res.status}).${fileLockHint}`
        );
        return;
      }

      if (!res.ok) {
        setKeywordExtractError(
          (data.error ?? "Could not extract keywords") + (res.status >= 500 ? fileLockHint : "")
        );
        return;
      }

      const list = Array.isArray(data.keywords) ? data.keywords : [];
      const ah = data.sources?.ahrefs;
      if (ah?.enabled && (ah.mergedCount ?? 0) > 0) {
        setKeywordExtractInfo(
          `Ahrefs: merged ${ah.mergedCount} matching term(s) by volume (${String(ah.country ?? "us").toUpperCase()}).`
        );
      } else if (ah?.enabled && ah.error) {
        setKeywordExtractInfo(`Ahrefs unavailable (${ah.error}). Keywords use Claude only.`);
      } else if (ah?.enabled && (ah.mergedCount ?? 0) === 0) {
        setKeywordExtractInfo("Ahrefs returned no matching terms for this title; list is Claude-only.");
      } else if (!ah?.enabled) {
        setKeywordExtractInfo("Optional: set AHREFS_API_KEY in .env.local to prepend volume-sorted matching terms from Ahrefs.");
      }

      setKeywords((prev) => {
        const next = [...prev];
        for (const k of list) {
          if (typeof k !== "string" || !k.trim()) continue;
          const t = k.trim();
          if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
        }
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKeywordExtractError(
        `Request failed: ${msg}.${/load failed|fetch|network/i.test(msg) ? fileLockHint : ""}`
      );
    } finally {
      setKeywordExtractLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedSite || !title.trim() || keywords.length === 0) return;
    setGenerating(true);
    setContentLoading(true);
    setImagesLoading(false);
    setGeneratedContent(null);
    setGeneratedImages(null);
    setInternalLinksUsed([]);
    setContentApproved(false);
    setImagesApproved(false);
    setApprovedContent(null);
    setPublishResult(null);
    setImagesError(null);

    try {
      const contentRes = await fetch(`${api}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSite.id,
          title: title.trim(),
          keywords,
          wordCount,
        }),
      });
      const contentData = await contentRes.json();

      if (!contentRes.ok) {
        setContentLoading(false);
        setGenerating(false);
        setImagesError(null);
        return;
      }

      setContentLoading(false);
      setGeneratedContent(contentData.content);
      setInternalLinksUsed(contentData.internalLinksUsed ?? []);
      setImagesLoading(true);

      const imagesRes = await fetch(`${api}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          keywords,
          content: contentData.content,
          wordCount,
        }),
      });
      const imagesData = await imagesRes.json();

      setImagesLoading(false);
      setGenerating(false);
      if (imagesRes.ok && Array.isArray(imagesData)) {
        setImagesError(null);
        setGeneratedImages(
          imagesData.map(
            (img: {
              type?: string;
              index?: number;
              prompt?: string;
              base64?: string;
              mimeType?: string;
              altText?: string;
              fileSlug?: string;
              h2Index?: number;
              sectionHeading?: string;
            }) => ({
              type: img.type === "featured" ? "featured" : "in-content",
              index: img.index ?? 0,
              prompt: img.prompt ?? "",
              base64: img.base64 ?? "",
              mimeType: img.mimeType ?? "image/png",
              included: true,
              altText: typeof img.altText === "string" ? img.altText : undefined,
              fileSlug: typeof img.fileSlug === "string" ? img.fileSlug : undefined,
              h2Index: typeof img.h2Index === "number" ? img.h2Index : undefined,
              sectionHeading: typeof img.sectionHeading === "string" ? img.sectionHeading : undefined,
            })
          )
        );
      } else {
        setImagesError(imagesData?.error ?? "Image generation failed. You can retry below.");
      }
    } catch (err) {
      setContentLoading(false);
      setImagesLoading(false);
      setGenerating(false);
      setImagesError(err instanceof Error ? err.message : "Image generation failed. You can retry below.");
    }
  };

  const handleGenerateImages = useCallback(async () => {
    const content = approvedContent ?? generatedContent;
    if (!content || !title.trim() || keywords.length === 0) return;
    setImagesError(null);
    setImagesLoading(true);
    try {
      const imagesRes = await fetch(`${api}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          keywords,
          content,
          wordCount,
        }),
      });
      const imagesData = await imagesRes.json();
      setImagesLoading(false);
      if (imagesRes.ok && Array.isArray(imagesData)) {
        setGeneratedImages(
          imagesData.map(
            (img: {
              type?: string;
              index?: number;
              prompt?: string;
              base64?: string;
              mimeType?: string;
              altText?: string;
              fileSlug?: string;
              h2Index?: number;
              sectionHeading?: string;
            }) => ({
              type: img.type === "featured" ? "featured" : "in-content",
              index: img.index ?? 0,
              prompt: img.prompt ?? "",
              base64: img.base64 ?? "",
              mimeType: img.mimeType ?? "image/png",
              included: true,
              altText: typeof img.altText === "string" ? img.altText : undefined,
              fileSlug: typeof img.fileSlug === "string" ? img.fileSlug : undefined,
              h2Index: typeof img.h2Index === "number" ? img.h2Index : undefined,
              sectionHeading: typeof img.sectionHeading === "string" ? img.sectionHeading : undefined,
            })
          )
        );
      } else {
        setImagesError(imagesData?.error ?? "Image generation failed. Try again.");
      }
    } catch (err) {
      setImagesLoading(false);
      setImagesError(err instanceof Error ? err.message : "Image generation failed. Try again.");
    }
  }, [approvedContent, generatedContent, title, keywords, wordCount]);

  const section2Unlocked = contentLoading || !!generatedContent;
  const hasContent = !!generatedContent || !!contentApproved;
  const section3Unlocked = hasContent;
  const section4Unlocked = contentApproved && imagesApproved;
  const includedImagesCount =
    generatedImages?.filter((i) => i.included).length ?? 0;

  useEffect(() => {
    if (contentEditableRef.current && generatedContent && !contentApproved) {
      contentEditableRef.current.innerHTML = generatedContent;
    }
  }, [generatedContent, contentApproved]);

  const handleContentInput = useCallback(() => {
    const html = contentEditableRef.current?.innerHTML ?? "";
    setGeneratedContent(html);
  }, []);

  const handleContentApprove = useCallback(() => {
    const html = contentEditableRef.current?.innerHTML ?? generatedContent ?? "";
    setApprovedContent(html);
    setContentApproved(true);
  }, [generatedContent]);

  const handleImagesApprove = useCallback(() => {
    setImagesApproved(true);
  }, []);

  const handleRegenerateImage = useCallback(async (idx: number) => {
    const img = generatedImages?.[idx];
    if (!img?.prompt) return;
    try {
      const res = await fetch(`${api}/generate-images/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: img.prompt }),
      });
      const data = await res.json();
      if (res.ok && data.base64) {
        setGeneratedImages((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], base64: data.base64, mimeType: data.mimeType ?? "image/png" };
          return next;
        });
      }
    } catch {
      // ignore
    }
  }, [generatedImages]);

  const handleToggleInclude = useCallback((idx: number) => {
    setGeneratedImages((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], included: !next[idx].included };
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!selectedSite || !title.trim() || !approvedContent || !generatedImages) return;
    setPublishing(true);
    setPublishStep("Uploading featured image...");
    const t2 = setTimeout(() => setPublishStep("Uploading in-content images..."), 400);
    const t3 = setTimeout(() => setPublishStep("Creating draft post..."), 800);
    try {
      const included = generatedImages.filter((i) => i.included);
      const imagesPayload = included.map(
        ({ type, index, base64, mimeType, altText, fileSlug, h2Index }) => ({
          type,
          index,
          base64,
          mimeType,
          altText,
          fileSlug,
          h2Index,
        })
      );
      const res = await fetch(`${api}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSite.id,
          title: title.trim(),
          content: approvedContent,
          images: imagesPayload,
          referenceUrl: referenceUrl.trim() || undefined,
          keywords,
        }),
      });
      const data = await res.json();
      clearTimeout(t2);
      clearTimeout(t3);
      if (!res.ok) {
        throw new Error(data.error ?? "Publish failed");
      }
      setPublishResult({
        postId: data.postId,
        postUrl: data.postUrl,
        editUrl: data.editUrl,
        site: data.site ?? { name: selectedSite.name, url: selectedSite.url },
        yoast: data.yoast,
      });
    } catch (err) {
      clearTimeout(t2);
      clearTimeout(t3);
      setPublishStep(null);
      setPublishResult(null);
      console.error(err);
    } finally {
      clearTimeout(t2);
      clearTimeout(t3);
      setPublishing(false);
      setPublishStep(null);
    }
  }, [selectedSite, title, approvedContent, generatedImages, referenceUrl, keywords]);

  const handleStartNewPost = useCallback(() => {
    setTitle("");
    setKeywords([]);
    setKeywordInput("");
    setKeywordExtractError(null);
    setReferenceUrl("");
    setGeneratedContent(null);
    setGeneratedImages(null);
    setInternalLinksUsed([]);
    setContentApproved(false);
    setImagesApproved(false);
    setApprovedContent(null);
    setPublishResult(null);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{config.name}</h1>
          <p className="mt-2 text-slate-600">{config.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label={panelOpen ? "Close site manager" : "Open site manager"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {panelOpen && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Site Manager</h2>

          {/* List of sites */}
          <div className="mb-6 space-y-3">
            {sitesLoading ? (
              <p className="text-sm text-slate-500">Loading sites...</p>
            ) : sites.length === 0 ? (
              <p className="text-sm text-slate-500">No sites yet. Add one below.</p>
            ) : (
              sites.map((site) => (
                <div
                  key={site.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editingId === site.id ? (
                    <div className="flex flex-1 flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Site name"
                        className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <textarea
                        value={editTonePrompt}
                        onChange={(e) => setEditTonePrompt(e.target.value)}
                        placeholder="Tone / writing style"
                        rows={2}
                        className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(site.id)}
                          className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium text-slate-900">{site.name}</p>
                        <p className="text-sm text-slate-500">{site.url}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(site)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {deleteConfirmId === site.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDelete(site.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(site.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add new site form */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-700">Add new site</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Site name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Green.org"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">WordPress URL</label>
                <input
                  type="url"
                  value={addForm.url}
                  onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Username</label>
                <input
                  type="text"
                  value={addForm.username}
                  onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="WordPress username"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Application password</label>
                <input
                  type="password"
                  value={addForm.app_password}
                  onChange={(e) => setAddForm((f) => ({ ...f, app_password: e.target.value }))}
                  placeholder="WordPress application password"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Tone / writing style</label>
                <textarea
                  value={addForm.tone_prompt}
                  onChange={(e) => setAddForm((f) => ({ ...f, tone_prompt: e.target.value }))}
                  placeholder="Describe how Claude should write for this site..."
                  rows={3}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              {addError && (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{addError}</div>
              )}
              {addSuccess && (
                <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
                  Site added successfully.
                </div>
              )}
              <button
                type="submit"
                disabled={addLoading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {addLoading ? "Testing..." : "Test & Save"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Section 0 — Site selector (always visible at top) */}
      <div>
        <h2 className="text-sm font-medium text-slate-500">Site</h2>
        <div className="mt-2">
          <select
            value={selectedSite?.id ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              const s = sites.find((x) => x.id === id);
              setSelectedSite(s ? { id: s.id, name: s.name, url: s.url } : null);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">Select a site...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.url}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 1 — Input form (unlocks after site selected) */}
      <div className={siteUnlocked ? "" : "opacity-50 pointer-events-none"}>
        <h2 className="text-sm font-medium text-slate-500">Input</h2>
        {siteUnlocked ? (
          <div className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                required
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs text-slate-500">Keywords</label>
                <button
                  type="button"
                  onClick={handleExtractKeywordsFromTitle}
                  disabled={keywordExtractLoading || !title.trim()}
                  className="rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {keywordExtractLoading ? "Extracting…" : "Extract from title"}
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                Claude proposes phrases (including 1–2 WordPress-focused terms). If{" "}
                <span className="font-mono text-[11px]">AHREFS_API_KEY</span> is set server-side, Ahrefs matching
                terms (sorted by estimated monthly volume) are merged first. Consumes Ahrefs API units.
              </p>
              {keywordExtractError && (
                <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                  {keywordExtractError}
                </div>
              )}
              {keywordExtractInfo && !keywordExtractError && (
                <div className="mb-2 rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900">
                  {keywordExtractInfo}
                </div>
              )}
              <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-2">
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-sm text-teal-800"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(i)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-teal-200"
                      aria-label="Remove"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={addKeyword}
                  placeholder="Type keyword + Enter or comma"
                  className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Source / reference URL (optional)</label>
              <input
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://example.com/original-article"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                If set, this is appended at the <span className="font-medium">end of the post body</span> when you publish:
                <span className="mt-1 block font-mono text-[11px] leading-relaxed text-slate-600">
                  This article is for informational purposes only.
                  <br />
                  Reference: [your URL]
                </span>
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs text-slate-500">Word count</label>
              <div className="flex gap-2">
                {[1200, 1500, 1800].map((n) => (
                  <label
                    key={n}
                    className={`flex cursor-pointer items-center rounded-lg border px-4 py-2 text-sm transition-colors ${
                      wordCount === n
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="wordCount"
                      value={n}
                      checked={wordCount === n}
                      onChange={() => setWordCount(n)}
                      className="sr-only"
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !title.trim() || keywords.length === 0}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Generate Content
            </button>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
            Select a site above to continue
          </div>
        )}
      </div>

      {/* Section 2 — Content review */}
      <div className={section2Unlocked ? "" : "opacity-50 pointer-events-none"}>
        <h2 className="text-sm font-medium text-slate-500">Content review</h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
          {contentLoading ? (
            <p className="text-sm text-slate-500">
              Writing content with Claude for {selectedSite?.name ?? "..."}...
            </p>
          ) : generatedContent || contentApproved ? (
            <div className="space-y-4">
              {contentApproved ? (
                <div
                  className="space-y-4 text-sm [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_p]:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: approvedContent ?? "" }}
                />
              ) : (
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleContentInput}
                  className="min-h-[200px] space-y-4 text-sm outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_p]:leading-relaxed"
                />
              )}
              <p className="text-xs text-slate-500">Word count: {contentWordCount}</p>
              {internalLinksUsed.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Internal links used</p>
                  <ul className="flex flex-wrap gap-2">
                    {internalLinksUsed.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal-600 underline hover:text-teal-700"
                        >
                          {link.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!contentApproved && (
                <button
                  type="button"
                  onClick={handleContentApprove}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Content approved
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              Content review — locked
            </div>
          )}
        </div>
      </div>

      {/* Section 3 — Images review */}
      <div className={section3Unlocked ? "" : "opacity-50 pointer-events-none"}>
        <h2 className="text-sm font-medium text-slate-500">Images review</h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
          {imagesLoading ? (
            <p className="text-sm text-slate-500">Generating images with Gemini...</p>
          ) : !generatedImages || generatedImages.length === 0 ? (
            <div className="space-y-3">
              {imagesError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {imagesError}
                </div>
              )}
              <p className="text-sm text-slate-600">
                {imagesError
                  ? "Click below to retry image generation."
                  : "Generates a featured image plus 3–4 in-content images placed after the matching H2 sections, with SEO filenames and alt text. FAQ sections are skipped."}
              </p>
              <button
                type="button"
                onClick={handleGenerateImages}
                disabled={imagesLoading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {imagesError ? "Retry image generation" : "Generate images"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {generatedImages
                .filter((img) => img.type === "featured")
                .map((img, i) => (
                  <div key={`f-${i}`} className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Featured image</p>
                    <div className="relative max-w-2xl">
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={img.altText ?? ""}
                        className="h-auto w-full rounded-lg border border-slate-200"
                      />
                      {(img.altText || img.fileSlug) && (
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {img.fileSlug && (
                            <p>
                              <span className="font-medium text-slate-600">File:</span> {img.fileSlug}.jpg
                            </p>
                          )}
                          {img.altText && (
                            <p>
                              <span className="font-medium text-slate-600">Alt:</span> {img.altText}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRegenerateImage(generatedImages!.indexOf(img))}
                          disabled={regeneratingIndex === generatedImages!.indexOf(img)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {regeneratingIndex === generatedImages!.indexOf(img) ? "Regenerating..." : "Regenerate"}
                        </button>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={img.included}
                            onChange={() => handleToggleInclude(generatedImages!.indexOf(img))}
                            className="rounded border-slate-300"
                          />
                          Include this image
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              {generatedImages.filter((img) => img.type === "in-content").length > 0 && (
                <>
                  <p className="text-xs font-medium text-slate-600">In-content images</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {generatedImages
                      .filter((img) => img.type === "in-content")
                      .sort((a, b) => a.index - b.index)
                      .map((img, i) => (
                        <div key={`ic-${img.index}`} className="rounded-lg border border-slate-200 p-2">
                          <img
                            src={`data:${img.mimeType};base64,${img.base64}`}
                            alt={img.altText ?? ""}
                            className="h-auto w-full rounded"
                          />
                          <p className="mt-1 text-xs font-medium text-slate-700">
                            {img.sectionHeading ? `Section: ${img.sectionHeading}` : `In-content ${i + 1}`}
                          </p>
                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                            {img.fileSlug && (
                              <p>
                                <span className="font-medium text-slate-600">File:</span> {img.fileSlug}.jpg
                              </p>
                            )}
                            {img.altText && (
                              <p>
                                <span className="font-medium text-slate-600">Alt:</span> {img.altText}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRegenerateImage(generatedImages!.indexOf(img))}
                              disabled={regeneratingIndex === generatedImages!.indexOf(img)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {regeneratingIndex === generatedImages!.indexOf(img) ? "Regenerating..." : "Regenerate"}
                            </button>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={img.included}
                                onChange={() => handleToggleInclude(generatedImages!.indexOf(img))}
                                className="rounded border-slate-300"
                              />
                              Include this image
                            </label>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {!imagesApproved && (
                <button
                  type="button"
                  onClick={handleImagesApprove}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Images approved
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 4 — Publish */}
      <div className={section4Unlocked ? "" : "opacity-50 pointer-events-none"}>
        <h2 className="text-sm font-medium text-slate-500">Publish</h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
          {publishResult ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="font-medium text-green-800">Draft published successfully</p>
              <p className="mt-1 text-sm text-green-700">{publishResult.site.name} – {title}</p>
              {publishResult.yoast?.focusKeyphrase != null && (
                <p className="mt-2 text-sm text-green-800">
                  Yoast SEO: attempted to set meta description, SEO title, and focus keyphrase via REST (focus:{" "}
                  <span className="font-mono">{publishResult.yoast.focusKeyphrase}</span>
                  {publishResult.yoast.metaDescriptionSet === false
                    ? ". WordPress rejected meta fields; check Yoast REST support for posts."
                    : "."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={publishResult.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  View draft in WordPress
                </a>
                <button
                  type="button"
                  onClick={handleStartNewPost}
                  className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                >
                  Start new post
                </button>
              </div>
            </div>
          ) : section4Unlocked ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                <p><span className="font-medium text-slate-600">Site:</span> {selectedSite?.name}</p>
                <p><span className="font-medium text-slate-600">Post title:</span> {title}</p>
                <p><span className="font-medium text-slate-600">Word count:</span> {contentWordCount}</p>
                <p><span className="font-medium text-slate-600">Images:</span> {includedImagesCount}</p>
                {referenceUrl.trim() ? (
                  <p>
                    <span className="font-medium text-slate-600">Reference footer:</span>{" "}
                    <span className="text-teal-700">Yes — disclaimer + link at end of post</span>
                  </p>
                ) : null}
              </div>
              {publishing && publishStep && (
                <ol className="space-y-1 text-sm text-slate-600">
                  <li className={publishStep === "Uploading featured image..." ? "font-medium text-teal-600" : "text-slate-400"}>
                    1. Uploading featured image...
                  </li>
                  <li className={publishStep === "Uploading in-content images..." ? "font-medium text-teal-600" : publishStep === "Creating draft post..." ? "text-slate-400" : ""}>
                    2. Uploading in-content images...
                  </li>
                  <li className={publishStep === "Creating draft post..." ? "font-medium text-teal-600" : ""}>
                    3. Creating draft post...
                  </li>
                </ol>
              )}
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {publishing ? "Publishing..." : `Publish as Draft to ${selectedSite?.name ?? ""}`}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              Approve content and images above to unlock publish
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
