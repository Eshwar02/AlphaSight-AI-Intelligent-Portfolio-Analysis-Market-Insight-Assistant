'use client';

import React from 'react';

interface Props {
  content: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  lastContent: string;
}

/**
 * During streaming, ReactMarkdown + rehype-highlight can throw when it
 * encounters partially-formed markdown (e.g. an unclosed code fence).
 * When that happens we fall back to rendering the raw text so the user
 * still sees the streaming content instead of a blank bubble.
 * The boundary resets whenever the content prop changes, giving markdown
 * another chance on the next chunk in case the syntax has since closed.
 */
export class MarkdownErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, lastContent: '' };

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.content !== state.lastContent) {
      return { hasError: false, lastContent: props.content };
    }
    return null;
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Markdown failures during streaming are expected; log and move on.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[MarkdownErrorBoundary] render failed:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="whitespace-pre-wrap text-sm leading-7 text-gray-200">
          {this.props.content}
        </div>
      );
    }
    return this.props.children;
  }
}
