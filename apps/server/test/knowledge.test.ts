import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { KnowledgeFileStore } from "../src/infrastructure/out/knowledge/knowledge-files.ts";
import {
  DocumentExtractor,
  KnowledgeError,
  htmlToMarkdown,
} from "../src/infrastructure/out/knowledge/extractors.ts";
import {
  HashEmbeddingAdapter,
  cosineSimilarity,
} from "../src/infrastructure/out/knowledge/embeddings.ts";
import { IngestKnowledgeUseCase } from "../src/application/use-cases/ingest-knowledge.ts";
import {
  SearchKnowledgeUseCase,
  buildGroundedContext,
} from "../src/application/use-cases/search-knowledge.ts";
import { chunkMarkdown, summarize } from "../src/domain/knowledge/chunking.ts";
import { UnsafeUrlError, assertSafeUrl, isPrivateAddress } from "../src/domain/knowledge/url-safety.ts";
import type { EmbeddingPort } from "../src/application/ports/knowledge.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup(overrides: { embeddings?: EmbeddingPort; resolver?: (host: string) => Promise<string[]>; fetchImpl?: typeof fetch } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "platform-kb-"));
  dirs.push(dir);
  const store = new SqliteStore(":memory:");
  const embeddings = overrides.embeddings ?? new HashEmbeddingAdapter();
  const files = new KnowledgeFileStore(join(dir, "knowledge"));
  const ingest = new IngestKnowledgeUseCase({
    store,
    files,
    embeddings,
    extractor: new DocumentExtractor(1024 * 1024),
    resolver: overrides.resolver,
    fetchImpl: overrides.fetchImpl,
    maxUrlBytes: 1024,
  });
  const search = new SearchKnowledgeUseCase(store, embeddings);
  ingest.createNotebook({ slug: "manual-facturacion", name: "Manual de facturación" });
  return { dir, store, files, ingest, search };
}

const manual = `# Facturación

## Emisión de facturas

Las facturas se emiten el primer día de cada mes. El cliente recibe un PDF por correo.

## Notas de crédito

Una nota de crédito se emite dentro de los 30 días posteriores a la factura original.

## Contacto

Escribe a facturacion@example.com para consultas.
`;

describe("chunking and summaries", () => {
  it("splits markdown by heading and keeps section metadata", () => {
    const chunks = chunkMarkdown(manual);
    expect(chunks.map((chunk) => chunk.section)).toEqual([
      "Emisión de facturas",
      "Notas de crédito",
      "Contacto",
    ]);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });

  it("splits oversized sections with overlap", () => {
    const long = `# Doc\n\n${"palabra ".repeat(1200)}`;
    const chunks = chunkMarkdown(long, { maxChars: 500, overlapChars: 100 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(Math.max(...chunks.map((chunk) => chunk.content.length))).toBeLessThan(800);
  });

  it("builds an extractive summary", () => {
    const summary = summarize(manual, 2);
    expect(summary.length).toBeGreaterThan(10);
    expect(summary.split(".").length).toBeLessThanOrEqual(3);
  });
});

describe("URL safety", () => {
  it("flags private, loopback, link-local and mapped addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.5", "172.16.4.1", "192.168.1.1", "169.254.169.254", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
  });

  it("rejects internal URLs and private DNS resolutions", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl("http://localhost/admin")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl("http://internal.example", async () => ["10.0.0.1"])).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl("http://public.example", async () => ["93.184.216.34"])).resolves.toBeDefined();
  });
});

describe("notebook ingestion and hybrid search", () => {
  it("ingests markdown, stores chunks and returns cited search results", async () => {
    const { ingest, search, store, dir } = await setup();
    const result = await ingest.ingestFile("manual-facturacion", {
      filename: "manual.md",
      bytes: new TextEncoder().encode(manual),
    });
    expect(result.chunks).toBeGreaterThan(0);
    expect(result.embedded).toBe(true);
    const sources = store.knowledge.listSources(store.notebooks.findBySlug("manual-facturacion")!.id);
    expect(sources[0]?.summary).toContain("facturas");
    const hits = await search.execute("manual-facturacion", "nota de crédito", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.citation).toMatch(/^\[Fuente: manual\.md, /);
    expect(hits[0]?.documentTitle).toBe("manual.md");
    expect(dir).toContain("platform-kb-");
  });

  it("degrades to full-text search when embeddings fail", async () => {
    const failing: EmbeddingPort = { embed: async () => { throw new Error("no embeddings"); } };
    const { ingest, search } = await setup({ embeddings: failing });
    await ingest.ingestFile("manual-facturacion", { filename: "manual.md", bytes: new TextEncoder().encode(manual) });
    const hits = await search.execute("manual-facturacion", "facturas", 5);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("rejects unsupported and oversized files", async () => {
    const { ingest } = await setup();
    await expect(
      ingest.ingestFile("manual-facturacion", { filename: "app.exe", bytes: new Uint8Array([1, 2]) }),
    ).rejects.toBeInstanceOf(KnowledgeError);
    const big = new Uint8Array(1024 * 1024 + 1);
    await expect(ingest.ingestFile("manual-facturacion", { filename: "big.txt", bytes: big })).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
  });

  it("blocks SSRF before fetching", async () => {
    let fetched = false;
    const { ingest } = await setup({
      resolver: async () => ["127.0.0.1"],
      fetchImpl: (async () => {
        fetched = true;
        return new Response("nope");
      }) as unknown as typeof fetch,
    });
    await expect(ingest.ingestUrl("manual-facturacion", "http://evil.example/secret")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    expect(fetched).toBe(false);
  });

  it("ingests public HTML URLs and converts them to markdown", async () => {
    const { ingest, search } = await setup({
      resolver: async () => ["93.184.216.34"],
      fetchImpl: (async () =>
        new Response("<html><head><title>Política</title></head><body><h1>Garantías</h1><p>La garantía dura 12 meses.</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })) as unknown as typeof fetch,
    });
    const result = await ingest.ingestUrl("manual-facturacion", "http://example.com/politica");
    expect(result.source.title).toBe("Política");
    expect(result.source.uri).toContain("example.com");
    const hits = await search.execute("manual-facturacion", "garantía", 3);
    expect(hits[0]?.content).toContain("12 meses");
  });

  it("rejects redirects during URL ingestion", async () => {
    const { ingest } = await setup({
      resolver: async () => ["93.184.216.34"],
      fetchImpl: (async () => new Response("", { status: 302, headers: { location: "http://127.0.0.1" } })) as unknown as typeof fetch,
    });
    await expect(ingest.ingestUrl("manual-facturacion", "http://example.com")).rejects.toMatchObject({ code: "UNSAFE_URL" });
  });

  it("strips scripts and markup from HTML", () => {
    const markdown = htmlToMarkdown("<h1>Hola</h1><script>alert(1)</script><p>Mundo &amp; paz</p>");
    expect(markdown).toContain("# Hola");
    expect(markdown).toContain("Mundo & paz");
    expect(markdown).not.toContain("alert");
  });

  it("computes cosine similarity for embeddings", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [])).toBe(0);
  });

  it("builds grounded context with citations and strict instructions", () => {
    const context = buildGroundedContext(
      [{ chunkId: "c", sourceId: "s", documentTitle: "Manual", section: "Facturas", content: "Contenido", score: 1, citation: "[Fuente: Manual, Facturas]" }],
      true,
    );
    expect(context).toContain("[Fuente: Manual, Facturas]");
    expect(context).toContain("únicamente con base en el contexto");
  });
});
