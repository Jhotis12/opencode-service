import type { Store } from "../ports/store.ts";
import type { EmbeddingPort, KnowledgeExtractor, KnowledgeFilePort } from "../ports/knowledge.ts";
import { chunkMarkdown, summarize } from "../../domain/knowledge/chunking.ts";
import { UnsafeUrlError, assertSafeUrl } from "../../domain/knowledge/url-safety.ts";
import { KnowledgeError, htmlToMarkdown } from "../../infrastructure/out/knowledge/extractors.ts";
import type { KbSourceRecord, NotebookRecord } from "../../domain/entities.ts";

export interface IngestDeps {
  store: Store;
  files: KnowledgeFilePort;
  embeddings: EmbeddingPort;
  extractor: KnowledgeExtractor;
  fetchImpl?: typeof fetch;
  resolver?: (hostname: string) => Promise<string[]>;
  maxUrlBytes?: number;
}

const NOTEBOOK_SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

export class IngestKnowledgeUseCase {
  constructor(private readonly deps: IngestDeps) {}

  createNotebook(projectSlug: string, input: { slug: string; name: string; description?: string }): NotebookRecord {
    if (!NOTEBOOK_SLUG.test(input.slug)) throw new KnowledgeError("EXTRACTION_FAILED", "invalid notebook slug");
    if (this.deps.store.notebooks.findBySlug(projectSlug, input.slug)) {
      throw new KnowledgeError("EXTRACTION_FAILED", `notebook already exists: ${input.slug}`);
    }
    const notebook: NotebookRecord = {
      id: crypto.randomUUID(),
      projectSlug,
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      createdAt: new Date().toISOString(),
    };
    this.deps.store.notebooks.create(notebook);
    return notebook;
  }

  listNotebooks(projectSlug: string): NotebookRecord[] {
    return this.deps.store.notebooks.list(projectSlug);
  }

  async ingestFile(
    projectSlug: string,
    notebookSlug: string,
    input: { filename: string; mime?: string; bytes: Uint8Array },
  ): Promise<{ source: KbSourceRecord; chunks: number; embedded: boolean }> {
    const notebook = this.requireNotebook(projectSlug, notebookSlug);
    const extracted = await this.deps.extractor.extract(input);
    return this.index(notebook, {
      title: input.filename,
      kind: extracted.kind,
      markdown: extracted.markdown,
      uri: undefined,
    });
  }

  async ingestUrl(
    projectSlug: string,
    notebookSlug: string,
    rawUrl: string,
  ): Promise<{ source: KbSourceRecord; chunks: number; embedded: boolean }> {
    const notebook = this.requireNotebook(projectSlug, notebookSlug);
    let safe: { url: URL };
    try {
      safe = await assertSafeUrl(rawUrl, this.deps.resolver);
    } catch (error) {
      throw new KnowledgeError("UNSAFE_URL", error instanceof Error ? error.message : "unsafe URL");
    }
    const fetcher = this.deps.fetchImpl ?? fetch;
    const response = await fetcher(safe.url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (response.status >= 300 && response.status < 400) {
      throw new KnowledgeError("UNSAFE_URL", "redirects are not allowed during URL ingestion");
    }
    if (!response.ok) throw new KnowledgeError("EXTRACTION_FAILED", `URL returned ${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const allowed = ["text/html", "application/xhtml+xml", "text/plain", "text/markdown"];
    if (!allowed.includes(contentType)) {
      throw new KnowledgeError("UNSUPPORTED_TYPE", `unsupported content type: ${contentType || "unknown"}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > (this.deps.maxUrlBytes ?? 5 * 1024 * 1024)) {
      throw new KnowledgeError("TOO_LARGE", "URL content exceeds the size limit");
    }
    const raw = new TextDecoder().decode(buffer);
    const isHtml = contentType === "text/html" || contentType === "application/xhtml+xml";
    const title = isHtml ? (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1]?.trim() || safe.url.hostname) : safe.url.hostname;
    return this.index(notebook, {
      title,
      kind: isHtml ? "url" : "text",
      markdown: isHtml ? htmlToMarkdown(raw) : raw,
      uri: safe.url.toString(),
    });
  }

  private requireNotebook(projectSlug: string, slug: string): NotebookRecord {
    const notebook = this.deps.store.notebooks.findBySlug(projectSlug, slug);
    if (!notebook) throw new KnowledgeError("EXTRACTION_FAILED", `unknown notebook: ${slug}`);
    return notebook;
  }

  private async index(
    notebook: NotebookRecord,
    input: { title: string; kind: string; markdown: string; uri?: string },
  ): Promise<{ source: KbSourceRecord; chunks: number; embedded: boolean }> {
    const markdown = input.markdown.trim();
    if (!markdown) throw new KnowledgeError("EXTRACTION_FAILED", "document contains no extractable text");
    const chunks = chunkMarkdown(markdown);
    if (chunks.length === 0) throw new KnowledgeError("EXTRACTION_FAILED", "document produced no chunks");

    const sourceId = crypto.randomUUID();
    const markdownPath = await this.deps.files.writeSource(notebook.projectSlug, notebook.slug, sourceId, markdown);
    const source: KbSourceRecord = {
      id: sourceId,
      notebookId: notebook.id,
      title: input.title,
      kind: input.kind,
      uri: input.uri,
      markdownPath,
      summary: summarize(markdown),
      createdAt: new Date().toISOString(),
    };
    this.deps.store.knowledge.insertSource(source);

    let embedded = true;
    let vectors: number[][] | undefined;
    try {
      vectors = await this.deps.embeddings.embed(chunks.map((chunk) => chunk.content));
    } catch {
      embedded = false;
    }

    const now = new Date().toISOString();
    this.deps.store.knowledge.insertChunks(
      chunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        sourceId,
        notebookId: notebook.id,
        ordinal: chunk.ordinal,
        section: chunk.section,
        content: chunk.content,
        embedding: vectors?.[index] ? JSON.stringify(vectors[index]) : undefined,
        createdAt: now,
      })),
    );
    return { source, chunks: chunks.length, embedded };
  }
}

export { UnsafeUrlError };
