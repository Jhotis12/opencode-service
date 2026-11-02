export interface EmbeddingPort {
  embed(texts: string[]): Promise<number[][]>;
}

export interface KnowledgeExtractor {
  extract(input: { filename: string; mime?: string; bytes: Uint8Array }): Promise<{ markdown: string; kind: string }>;
}

export interface KnowledgeFilePort {
  writeSource(notebookSlug: string, sourceId: string, markdown: string): Promise<string>;
  readSource(relativePath: string): Promise<string>;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  sourceId: string;
  documentTitle: string;
  section: string;
  content: string;
  score: number;
  citation: string;
}
