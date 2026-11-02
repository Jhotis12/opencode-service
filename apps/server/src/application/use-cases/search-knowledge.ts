import type { Store } from "../ports/store.ts";
import type { EmbeddingPort, KnowledgeSearchResult } from "../ports/knowledge.ts";
import { cosineSimilarity } from "../../infrastructure/out/knowledge/embeddings.ts";
import { KnowledgeError } from "../../infrastructure/out/knowledge/extractors.ts";
import type { NotebookRecord } from "../../domain/entities.ts";

export class SearchKnowledgeUseCase {
  constructor(
    private readonly store: Store,
    private readonly embeddings: EmbeddingPort,
  ) {}

  async execute(projectSlug: string, notebookSlug: string, query: string, limit = 5): Promise<KnowledgeSearchResult[]> {
    const notebook = this.store.notebooks.findBySlug(projectSlug, notebookSlug);
    if (!notebook) throw new KnowledgeError("EXTRACTION_FAILED", `unknown notebook: ${notebookSlug}`);
    if (!query.trim()) return [];
    return this.searchNotebook(notebook, query, limit, false);
  }

  async searchProject(projectSlug: string, query: string, limit = 5): Promise<KnowledgeSearchResult[]> {
    if (!query.trim()) return [];
    const results: KnowledgeSearchResult[] = [];
    for (const notebook of this.store.notebooks.list(projectSlug)) {
      results.push(...(await this.searchNotebook(notebook, query, limit, false)));
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async searchAcrossProjects(query: string, limit = 5, projectSlug?: string): Promise<KnowledgeSearchResult[]> {
    if (!query.trim()) return [];
    const notebooks = projectSlug
      ? this.store.notebooks.list(projectSlug)
      : this.store.notebooks.listAll();
    const results: KnowledgeSearchResult[] = [];
    for (const notebook of notebooks) {
      results.push(...(await this.searchNotebook(notebook, query, limit, true)));
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async searchNotebook(
    notebook: NotebookRecord,
    query: string,
    limit: number,
    includeProject: boolean,
  ): Promise<KnowledgeSearchResult[]> {
    const chunks = this.store.knowledge.chunksForNotebook(notebook.id);
    const sources = new Map(this.store.knowledge.listSources(notebook.id).map((source) => [source.id, source]));
    const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    const scores = new Map<string, number>();

    const fts = this.store.knowledge.searchFts(notebook.id, query, 50);
    fts.forEach((row, index) => {
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (60 + index + 1));
    });

    try {
      const [queryVector] = await this.embeddings.embed([query]);
      if (queryVector) {
        const vectorRanked = chunks
          .filter((chunk) => chunk.embedding)
          .map((chunk) => ({
            id: chunk.id,
            score: cosineSimilarity(queryVector, JSON.parse(chunk.embedding!) as number[]),
          }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
        vectorRanked.forEach((row, index) => {
          scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (60 + index + 1));
        });
      }
    } catch {
      // Degrade to full-text only when the embeddings provider is unavailable.
    }

    const results: KnowledgeSearchResult[] = [];
    for (const [chunkId, score] of [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
      const chunk = chunkById.get(chunkId);
      if (!chunk) continue;
      const source = sources.get(chunk.sourceId);
      const documentTitle = source?.title ?? "documento";
      const section = chunk.section || "documento";
      const citation = includeProject
        ? `[Fuente: ${notebook.projectSlug} / ${notebook.name} / ${documentTitle}, ${section}]`
        : `[Fuente: ${documentTitle}, ${section}]`;
      results.push({
        chunkId,
        sourceId: chunk.sourceId,
        documentTitle,
        section,
        content: chunk.content,
        score,
        citation,
        ...(includeProject
          ? { projectSlug: notebook.projectSlug, notebookSlug: notebook.slug, notebookName: notebook.name }
          : {}),
      });
    }
    return results;
  }
}

/** Context block injected into agent prompts for grounded answers with citations. */
export function buildGroundedContext(results: KnowledgeSearchResult[], strictGrounding: boolean): string {
  if (results.length === 0) return "";
  const lines = [
    "Contexto de los Bancos de Información asignados:",
    ...results.map((result) => `- ${result.citation}\n${result.content}`),
  ];
  if (strictGrounding) {
    lines.push(
      "Instrucciones: responde únicamente con base en el contexto anterior, incluye la cita [Fuente: ...] y si la respuesta no está en el contexto indica que no está disponible en el Notebook.",
    );
  }
  return lines.join("\n\n");
}
