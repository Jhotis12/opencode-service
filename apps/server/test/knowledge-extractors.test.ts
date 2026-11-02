import { describe, expect, it, mock } from "bun:test";

mock.module("unpdf", () => ({
  extractText: async () => ({ totalPages: 2, text: ["Página uno con datos.", "Página dos con más datos."] }),
}));

mock.module("mammoth", () => ({
  extractRawText: async () => ({ value: "Contenido del documento DOCX." }),
}));

import { DocumentExtractor, KnowledgeError } from "../src/infrastructure/out/knowledge/extractors.ts";

describe("document extractors", () => {
  const extractor = new DocumentExtractor(10 * 1024 * 1024);

  it("converts PDF pages into markdown sections", async () => {
    const result = await extractor.extract({ filename: "manual.pdf", bytes: new Uint8Array([1, 2, 3]) });
    expect(result.kind).toBe("pdf");
    expect(result.markdown).toContain("## Página 1");
    expect(result.markdown).toContain("Página dos con más datos");
  });

  it("extracts DOCX plain text", async () => {
    const result = await extractor.extract({ filename: "politica.docx", bytes: new Uint8Array([4, 5]) });
    expect(result.kind).toBe("docx");
    expect(result.markdown).toContain("Contenido del documento DOCX");
  });

  it("converts CSV into a markdown table", async () => {
    const result = await extractor.extract({
      filename: "leads.csv",
      bytes: new TextEncoder().encode("nombre,plan\nAna,pro\nLuis,basic\n"),
    });
    expect(result.markdown).toContain("| nombre | plan |");
    expect(result.markdown).toContain("| Ana | pro |");
  });

  it("rejects unsupported extensions before reading content", async () => {
    await expect(extractor.extract({ filename: "virus.exe", bytes: new Uint8Array([1]) })).rejects.toBeInstanceOf(
      KnowledgeError,
    );
  });
});
