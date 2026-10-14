# Printflow (PrintSwap)

Offline browser tool for merging Bambu Studio sliced `.gcode.3mf` / `.3mf` plates with PrintFlow3D bed-swap G-code. Files stay on your machine; nothing is uploaded.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3100](http://localhost:3100).

Production-style static build + preview:

```bash
npm start
```

## Workflow

1. Slice your model in **Bambu Studio** and export the sliced plate (`.gcode.3mf`).
2. Drop one or more sliced 3MF files into Printflow.
3. Set per-plate **Repeat** counts and global **Loops**.
4. Click **Generate** to download `{name}.flow.3mf` (same naming as Printflow 0.1.0).
5. Open the merged file in Bambu Studio and print on a Bambu A1 with the PrintFlow3D plate changer.

## Scripts

| Command           | Description                |
| ----------------- | -------------------------- |
| `npm run dev`     | Dev server on port 3100    |
| `npm run build`   | Static SPA build           |
| `npm run preview` | Serve build on port 3100   |
| `npm start`       | Build then preview         |
| `npm run check`   | Typecheck (`svelte-check`) |
| `npm run lint`    | ESLint + Prettier check    |
| `npm test`        | Vitest unit tests          |

## Reference

Layout and behavior target parity with PrintFlow3D Printflow 0.1.0.
