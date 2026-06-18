# Vetted Dashboard Library Shortlist

These recommendations are stored for future dashboard upgrades. They are not random GitHub
installs and should be added only when the feature needs them.

## Recommended

- Apache ECharts: production-grade advanced charting for dashboards.
  Source: https://github.com/apache/echarts
- D3: low-level visualization primitives for custom charts and data transforms.
  Source: https://github.com/d3/d3
- Plotly.js: strong interactive analytics charts when scientific/BI charting matters.
  Source: https://github.com/plotly/plotly.js
- Three.js: trusted 3D rendering foundation.
  Source: https://github.com/mrdoob/three.js
- React Three Fiber: React renderer for Three.js if the dashboard migrates to React.
  Source: https://github.com/pmndrs/react-three-fiber
- deck.gl: enterprise geospatial and large-scale WebGL data visualization.
  Source: https://github.com/visgl/deck.gl
- Motion: production motion library for React interfaces.
  Source: https://github.com/motiondivision/motion
- Scrollama: lightweight scroll-driven storytelling.
  Source: https://github.com/russellsamora/scrollama
- TensorFlow.js: browser/server JavaScript ML from Google.
  Source: https://github.com/tensorflow/tfjs
- ONNX Runtime Web: production model inference runtime from Microsoft.
  Source: https://github.com/microsoft/onnxruntime
- Arquero: tidy data transformation for JavaScript analytics.
  Source: https://github.com/uwdata/arquero
- Vercel AI SDK: AI app framework if the app later becomes a full-stack product.
  Source: https://github.com/vercel/ai
- LangChain.js: agent/RAG orchestration when workflows become complex.
  Source: https://github.com/langchain-ai/langchainjs
- LanceDB: vector database candidate for local or deployable semantic retrieval.
  Source: https://github.com/lancedb/lancedb

## Avoid For Now

- LlamaIndexTS: archived/deprecated as of 2026; avoid for new work.
- echarts-gl: stale release history; prefer Three.js or deck.gl for 3D.
- Random GitHub dashboard templates: unsafe supply-chain risk.
- Direct GitHub dependency installs: prefer npm packages with lockfiles and audits.

## Current Implementation Decision

Use a no-new-dependency local lexical RAG first. Add ECharts or Three.js later only after the
dashboard needs richer visuals and the package is installed through npm with a lockfile.
