"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function PlanMarkdownViewer({
  session,
  slug,
}: {
  session: string;
  slug: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `https://raw.githubusercontent.com/SAAF-Project/SAAF-Project/main/plans/${session}/${slug}.md`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.text();
      })
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [session, slug]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className={`h-3 bg-border rounded animate-pulse`} style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-4 text-muted text-sm">
        Could not load plan content.{" "}
        <a
          href={`https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/${session}/${slug}.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent"
        >
          View on GitHub ↗
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-bold text-text mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-text mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold text-accent mt-3 mb-1">{children}</h3>,
          p: ({ children }) => <p className="text-muted text-sm mb-2 leading-relaxed">{children}</p>,
          code: ({ children }) => <code className="bg-surface2 px-1.5 py-0.5 rounded text-xs text-text font-mono">{children}</code>,
          pre: ({ children }) => <pre className="bg-surface2 rounded-lg p-3 overflow-x-auto mb-3 text-xs font-mono">{children}</pre>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-muted text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-muted text-sm">{children}</ol>,
          li: ({ children }) => <li className="text-muted text-sm">{children}</li>,
          table: ({ children }) => <table className="w-full text-xs border-collapse mb-3">{children}</table>,
          th: ({ children }) => <th className="text-left p-2 border border-border text-muted font-semibold bg-surface2">{children}</th>,
          td: ({ children }) => <td className="p-2 border border-border text-muted">{children}</td>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children}</a>,
          strong: ({ children }) => <strong className="text-text font-semibold">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-accent pl-3 text-muted italic my-2">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
