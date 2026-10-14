# Printflow (PrintSwap)

Offline browser tool for merging Bambu Studio sliced `.gcode.3mf` / `.3mf` plates with PrintFlow3D bed-swap G-code. Files stay in the browser that opens the page; nothing is uploaded.

## Hosted page

GitHub Actions publishes the static build to GitHub Pages on every push to `main`, and when that workflow is run manually. The deploy job starts only after check, test, lint, and the production build succeed in the same workflow. There is no local deploy command. Open:

https://jbrewlet.github.io/printswap/

That address serves the app only. Dropping a sliced plate reads it with the File API, merges it locally, and downloads a `.flow.3mf`. The plate is not sent to GitHub or any other server.

The published page is public on the internet, even while this repository stays private. Anyone with the link can open the tool, and the page's JavaScript includes the plate-swap G-code. Plate files themselves never leave the browser.

A private personal repository needs GitHub Pro before Pages will publish. The site URL above starts working after the Pages workflow on `main` succeeds.

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
