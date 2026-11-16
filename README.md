# QMS Quest — browser upload package

Drag ALL contents of this folder into the repository ROOT. Keep public/, api/ and backend/ as folders. Do not upload the outer GitHub-Upload directory or a ZIP. This package contains fewer than 100 files; preparation stops if it reaches that limit.

Preview: npm run dev (or node backend/serve.mjs). Node.js 22 or newer, no package dependencies. Build: npm run build (or node backend/build.mjs), output dist. Vercel: Other framework; the api/ functions stay at repository root.

All current game questions, art, mini-games, aircraft/tree mapping and organiser pages are included. Shared official scoring still requires the existing server environment settings; uploading files does not connect it automatically. No secrets or results are included.

This is the runtime package. Development tests, audit-generation scripts, full documentation and artwork provenance remain in the QMS source and full Github/github1 copies. Its package scripts intentionally expose only preview/start/build.

To refresh from the original QMS folder: node backend/prepare-upload.mjs --refresh-browser. Independently edited or unexpected files are preserved and cause refresh to stop. No GitHub upload is performed by that command.
