import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { KnowledgeFilePort } from "../../../application/ports/knowledge.ts";
import { KnowledgeError } from "./extractors.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

export class KnowledgeFileStore implements KnowledgeFilePort {
  constructor(private readonly rootDir: string) {}

  async writeSource(notebookSlug: string, sourceId: string, markdown: string): Promise<string> {
    if (!SLUG.test(notebookSlug) || !/^[a-zA-Z0-9-]{8,80}$/.test(sourceId)) {
      throw new KnowledgeError("EXTRACTION_FAILED", "invalid notebook or source id");
    }
    const directory = join(this.rootDir, notebookSlug, "sources");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${sourceId}.md`);
    await writeFile(path, markdown, "utf8");
    return relative(this.rootDir, path).split(sep).join("/");
  }

  async readSource(relativePath: string): Promise<string> {
    if (isAbsolute(relativePath)) throw new KnowledgeError("EXTRACTION_FAILED", "invalid source path");
    const realRoot = await realpath(this.rootDir).catch(() => this.rootDir);
    const candidate = resolve(this.rootDir, relativePath);
    const relation = relative(realRoot, candidate);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new KnowledgeError("EXTRACTION_FAILED", "source path escapes the knowledge root");
    }
    return readFile(candidate, "utf8");
  }
}
