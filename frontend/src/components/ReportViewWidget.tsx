"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import "katex/dist/katex.min.css";

// --- Types ---

interface Report {
  title: string;
  subtitle?: string;
  sourceDocs?: string;
  content: string;
  toc: { id: string; title: string }[];
}

interface ReportViewWidgetProps {
  report: Report;
}

// --- Sample data ---

export const SAMPLE_REPORT: Report = {
  title: "Attention Mechanisms",
  subtitle: "A comprehensive overview of attention in modern deep learning",
  sourceDocs: "Based on 12 documents in \"Deep Learning Foundations\" tome",
  toc: [
    { id: "executive-summary", title: "Executive Summary" },
    { id: "scaled-dot-product-attention", title: "Scaled Dot-Product Attention" },
    { id: "why-scale-by-sqrt-dk", title: "Why Scale by √dₖ?" },
    { id: "implementation", title: "Implementation" },
    { id: "multi-head-attention", title: "Multi-Head Attention" },
    { id: "positional-encoding", title: "Positional Encoding" },
    { id: "complexity-analysis", title: "Complexity Analysis" },
    { id: "efficient-attention-variants", title: "Efficient Attention Variants" },
    { id: "key-findings", title: "Key Findings" },
    { id: "references", title: "References" },
  ],
  content: `## Executive Summary

The **attention mechanism** has become the foundational building block of modern deep learning, replacing recurrence in sequence modeling and enabling breakthroughs across NLP, vision, and multimodal AI.

This report examines the theoretical foundations of attention, with a focus on the *scaled dot-product* formulation introduced by Vaswani et al. (2017). We derive the key equations, analyze computational complexity, and survey recent efficient variants that address the quadratic bottleneck.

> "Attention is all you need — but the question is, *which* attention?"

## Scaled Dot-Product Attention

Given an input sequence of $n$ tokens with embedding dimension $d_{\\text{model}}$, we project each token into three learned subspaces:

$$Q = XW^Q, \\quad K = XW^K, \\quad V = XW^V$$

where $W^Q, W^K \\in \\mathbb{R}^{d_{\\text{model}} \\times d_k}$ and $W^V \\in \\mathbb{R}^{d_{\\text{model}} \\times d_v}$.

The attention output is computed as:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V$$

### Why Scale by sqrt(dk)?

When $d_k$ is large, the dot products grow in magnitude, pushing the softmax into regions where gradients are extremely small. Assuming $q$ and $k$ are independent random variables with mean 0 and variance 1, their dot product has:

$$\\text{Var}\\left(\\sum_{i=1}^{d_k} q_i k_i\\right) = d_k$$

Dividing by $\\sqrt{d_k}$ normalizes the variance to 1, keeping the softmax in a useful gradient regime.

### Implementation

\`\`\`python
def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, V), weights
\`\`\`

## Multi-Head Attention

Rather than computing a single attention function, we run $h$ parallel attention heads, each with dimension $d_k = d_v = d_{\\text{model}} / h$:

$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\ldots, \\text{head}_h) W^O$$

where each head is:

$$\\text{head}_i = \\text{Attention}(QW_i^Q, \\; KW_i^K, \\; VW_i^V)$$

| Parameter | Value | Description |
|-----------|-------|-------------|
| $d_{\\text{model}}$ | 512 | Model dimension |
| $h$ | 8 | Number of heads |
| $d_k$ | 64 | Key/query dimension per head |
| $d_v$ | 64 | Value dimension per head |

> **Design insight:** Multi-head attention allows the model to *jointly* attend to information from different representation subspaces. A single attention head would average the attention, potentially losing fine-grained patterns.

## Positional Encoding

Since self-attention is permutation-equivariant, we must inject position information explicitly. The original transformer uses **sinusoidal encodings**:

$$PE_{(\\text{pos},\\, 2i)} = \\sin\\left(\\frac{\\text{pos}}{10000^{2i/d_{\\text{model}}}}\\right)$$

$$PE_{(\\text{pos},\\, 2i+1)} = \\cos\\left(\\frac{\\text{pos}}{10000^{2i/d_{\\text{model}}}}\\right)$$

A key property: for any fixed offset $\\delta$, the encoding at position $\\text{pos} + \\delta$ is a *linear function* of $PE_{\\text{pos}}$:

$$PE_{\\text{pos}+\\delta} = M_\\delta \\cdot PE_{\\text{pos}}$$

where $M_\\delta$ is a rotation matrix — enabling the model to learn relative positions through linear transformations.

| Method | Pros | Cons |
|--------|------|------|
| Sinusoidal (fixed) | No parameters, extrapolates | Assumes specific structure |
| Learned embeddings | Flexible, task-adaptive | No extrapolation beyond training length |
| **RoPE** (Su et al., 2021) | Relative by construction | Complex implementation |
| ALiBi (Press et al., 2022) | Zero-shot length generalization | Linear bias may limit expressiveness |

## Complexity Analysis

For a sequence of length $n$ with model dimension $d$:

| Operation | Time | Space |
|-----------|------|-------|
| $QK^T$ | $O(n^2 d)$ | $O(n^2)$ |
| Softmax | $O(n^2)$ | $O(n^2)$ |
| Weighted sum | $O(n^2 d)$ | $O(nd)$ |
| **Total** | $\\mathbf{O(n^2 d)}$ | $\\mathbf{O(n^2 + nd)}$ |

For a transformer with $L$ layers and sequence length $n$:

$$\\text{Total FLOPs} \\approx 24 L n^2 d + 6 L n d^2$$

> At $n = 4096$, $d = 1024$, $L = 24$: the $n^2$ term dominates — attention accounts for **~75%** of total compute.

## Efficient Attention Variants

### Linear Attention

Replace softmax with a kernel approximation:

$$\\text{Attention}(Q, K, V) \\approx \\phi(Q) \\left(\\phi(K)^T V\\right)$$

This reorders multiplication to $O(n \\cdot d' \\cdot d_v)$ — linear in $n$, but loses exact attention patterns.

### Sparse Attention

Attend to a subset of positions:

- **Local window:** $O(nw)$ — each token attends to $w$ neighbors
- **Strided:** $O(n^2/s)$ — attend every $s$-th position
- **Random:** $O(nk)$ — attend to $k$ random positions

### Flash Attention (Dao et al., 2022)

Computes *exact* attention but restructures the computation tiling to minimize memory I/O — achieving $O(n^2)$ FLOPs with $O(n)$ memory and 2–4× wall-clock speedup.

## Key Findings

1. **Attention is a computational primitive.** Dynamic content-based routing of information is as fundamental as convolution was for vision.

2. **Scaling laws emerge from attention.** Performance follows predictable power laws:

$$L(N, D, C) \\propto N^{-\\alpha_N} + D^{-\\alpha_D} + C^{-\\alpha_C}$$

3. **Efficiency and accuracy are not at odds.** Flash Attention proves that rethinking *how* we compute attention (not *what*) yields massive speedups with zero approximation error.

4. **The future is hybrid.** State-space models (Mamba), linear attention, and gated convolutions are emerging as complements — not replacements — to standard attention.

## References

1. Vaswani, A. et al. (2017). *Attention Is All You Need.* NeurIPS.
2. Bahdanau, D. et al. (2014). *Neural Machine Translation by Jointly Learning to Align and Translate.* ICLR.
3. Dao, T. et al. (2022). *FlashAttention: Fast and Memory-Efficient Exact Attention.* NeurIPS.
4. Su, J. et al. (2021). *RoFormer: Enhanced Transformer with Rotary Position Embedding.* arXiv.
5. Katharopoulos, A. et al. (2020). *Transformers are RNNs.* ICML.

---

*Report generated by Sage*`,
};

// --- Component ---

export default function ReportViewWidget({ report }: ReportViewWidgetProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(report.content);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = report.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report.content]);

  const scrollToSection = useCallback((id: string) => {
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`[id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="w-full max-w-[800px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-outline-variant/10">
          <div className="flex-1 min-w-0">
            <h2 className="text-headline-sm font-semibold text-on-surface">
              {report.title}
            </h2>
            {report.subtitle && (
              <p className="text-body-md text-on-surface-variant mt-1">
                {report.subtitle}
              </p>
            )}
            {report.sourceDocs && (
              <p className="text-label-sm text-on-surface-variant/60 mt-2 tracking-[0.03em]">
                {report.sourceDocs}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
            <button onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150 uppercase tracking-[0.05em]">
              <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150 uppercase tracking-[0.05em]">
              <span className="material-symbols-outlined text-sm">markdown</span>MD
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150 uppercase tracking-[0.05em]">
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>PDF
            </button>
          </div>
        </div>

        <div className="flex">
          <nav className="hidden sm:flex flex-col gap-0.5 w-48 flex-shrink-0 p-4 pr-2 border-r border-outline-variant/10">
            <span className="text-label-sm text-on-surface-variant/50 uppercase tracking-[0.05em] mb-2 px-2">Contents</span>
            {report.toc.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)}
                className="text-left text-body-md text-on-surface-variant hover:text-on-surface
                           px-2 py-1.5 rounded-md hover:bg-surface-container-high/50
                           transition-all duration-150 truncate">
                {item.title}
              </button>
            ))}
          </nav>
          <div ref={contentRef} className="flex-1 min-w-0 p-6 max-h-[650px] overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none
                         prose-headings:text-on-surface prose-headings:font-semibold
                         prose-h2:text-title-md prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-outline-variant/10
                         prose-h3:text-body-md prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
                         prose-p:text-on-surface-variant prose-p:leading-relaxed prose-p:mb-4
                         prose-strong:text-on-surface
                         prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                         prose-blockquote:border-l-2 prose-blockquote:border-primary/30
                         prose-blockquote:text-on-surface-variant prose-blockquote:italic
                         prose-blockquote:bg-surface-container-low/30 prose-blockquote:rounded-r-lg
                         prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4
                         prose-code:text-primary prose-code:bg-surface-container-high/60
                         prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-label-sm
                         prose-code:before:content-none prose-code:after:content-none
                         prose-pre:bg-surface-container-low prose-pre:border prose-pre:border-outline-variant/10
                         prose-pre:rounded-lg prose-pre:text-body-md
                         prose-table:text-body-md prose-th:text-on-surface prose-th:font-semibold
                         prose-td:text-on-surface-variant
                         prose-tr:border-b prose-tr:border-outline-variant/10
                         prose-ol:text-on-surface-variant prose-ul:text-on-surface-variant
                         prose-li:marker:text-on-surface-variant/50
                         prose-hr:border-outline-variant/20 prose-hr:my-6
                         prose-em:text-on-surface-variant
                         [&_.katex]:text-on-surface
                         [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeSlug]}>
                {report.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
