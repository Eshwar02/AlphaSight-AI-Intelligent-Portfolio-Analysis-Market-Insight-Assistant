'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /**
   * When true, syntax highlighting is skipped. rehype-highlight can throw on
   * partial code fences while the stream is still in flight, which crashes
   * the whole render subtree and leaves the bubble blank. Enable highlighting
   * only once the stream has finished.
   */
  streaming?: boolean;
}

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1] ?? '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeString]);

  if (!className && !codeString.includes('\n')) {
    // Inline code
    return (
      <code
        className="rounded bg-dark-950 px-1.5 py-0.5 text-sm font-mono text-accent-green"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-dark-700 bg-dark-950">
      <div className="flex items-center justify-between border-b border-dark-700 bg-dark-900 px-4 py-2">
        <span className="text-xs font-medium text-dark-400 uppercase">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-dark-400 transition-colors hover:text-dark-200"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className={cn('text-sm font-mono', className)} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, className, streaming = false }: MarkdownRendererProps) {
  const rehypePlugins = streaming
    ? []
    : [[rehypeHighlight, { ignoreMissing: true, detect: true }] as const];

  return (
    <div
      className={cn(
        'prose prose-invert max-w-none',
        'prose-p:leading-7 prose-p:my-2',
        'prose-headings:text-gray-100 prose-headings:font-bold prose-headings:border-b prose-headings:border-gray-700 prose-headings:pb-1',
        'prose-h1:text-3xl prose-h1:mt-6 prose-h1:mb-4',
        'prose-h2:text-2xl prose-h2:mt-5 prose-h2:mb-3',
        'prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2',
        'prose-h4:text-lg prose-h4:mt-3 prose-h4:mb-2',
        'prose-strong:text-gray-100',
        'prose-a:text-accent-green prose-a:no-underline hover:prose-a:underline',
        'prose-ul:my-3 prose-ol:my-3',
        'prose-li:my-1',
        'prose-blockquote:border-dark-700 prose-blockquote:text-dark-300',
        'prose-hr:border-dark-700',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={rehypePlugins as any}
        components={{
          code: CodeBlock as any,
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-dark-700">
              <table
                className="min-w-full divide-y divide-dark-700 text-sm"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-dark-900" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th
              className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-dark-300"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="whitespace-nowrap px-4 py-2.5 text-dark-200"
              {...props}
            >
              {children}
            </td>
          ),
          tr: ({ children, ...props }) => (
            <tr
              className="border-b border-dark-700/50 transition-colors hover:bg-dark-850/50"
              {...props}
            >
              {children}
            </tr>
          ),
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-green transition-colors hover:text-accent-green/80 hover:underline"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      />
    </div>
  );
}
