import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { KnowledgeFilePort } from "../../../application/ports/knowledge.ts";
import { KnowledgeError } from "./extractors.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

export class KnowledgeFileStore implements KnowledgeFilePort {
  constructor(private readonly workspacesDir: string) {}

  async writeSource(projectSlug: string, notebookSlug: string, sourceId: string, markdown: string): Promise<string> {
    if (!SLUG.test(projectSlug) || !SLUG.test(notebookSlug) || !/^[a-zA-Z0-9-]{8,80}$/.test(sourceId)) {
      throw new KnowledgeError("EXTRACTION_FAILED", "invalid project, notebook or source id");
    }
    const directory = join(this.workspacesDir, projectSlug, "knowledge", notebookSlug, "sources");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${sourceId}.md`);
    await writeFile(path, markdown, "utf8");
    return relative(join(this.workspacesDir, projectSlug), path).split(sep).join("/");
  }

  async readSource(projectSlug: string, relativePath: string): Promise<string> {
    if (!SLUG.test(projectSlug) || isAbsolute(relativePath)) {
      throw new KnowledgeError("EXTRACTION_FAILED", "invalid source path");
    }
    const projectRoot = join(this.workspacesDir, projectSlug);
    const candidate = resolve(projectRoot, relativePath);
    const realRoot = await realpath(projectRoot).catch(() => {
      throw new KnowledgeError("EXTRACTION_FAILED", "project not found");
    });
    const realCandidate = await realpath(candidate).catch(() => {
      throw new KnowledgeError("EXTRACTION_FAILED", "source not found");
    });
    const relation = relative(realRoot, realCandidate);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new KnowledgeError("EXTRACTION_FAILED", "source path escapes the project");
    }
    return readFile(realCandidate, "utf8");
  }
}
