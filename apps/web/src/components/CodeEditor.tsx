import { Suspense, lazy, useEffect, useRef, useState } from "react";

const Monaco = lazy(() => import("@monaco-editor/react"));

function FallbackEditor({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <textarea
      className="min-h-[220px] rounded-none border-0 font-mono text-xs"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      aria-label="Editor de código"
    />
  );
}

export function CodeEditor({
  value,
  onChange,
  language = "typescript",
}: {
  value: string;
  onChange(value: string): void;
  language?: string;
}) {
  const [fallback, setFallback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Monaco loads from a CDN by default. In an air-gapped deployment, fall
    // back to a plain textarea instead of leaving an empty editor forever.
    timerRef.current = setTimeout(() => setFallback(true), 6000);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-line" data-testid="code-editor">
      {fallback ? (
        <FallbackEditor value={value} onChange={onChange} />
      ) : (
        <Suspense fallback={<FallbackEditor value={value} onChange={onChange} />}>
          <Monaco
            height="320px"
            defaultLanguage={language}
            language={language}
            value={value}
            theme="vs-dark"
            onMount={() => {
              clearTimeout(timerRef.current);
              setFallback(false);
            }}
            onChange={(next) => onChange(next ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </Suspense>
      )}
    </div>
  );
}
