# Product A launch hub

One main file, `index.html`, with `assets/` and `lib/` beside it. Open it in Chrome or Edge. No install, no internet.

## What you see
1. A mock **sign-in** screen. The button just continues.
2. A **consent** screen with a tick box.
3. The **hub** page.

## Editing (the hidden editor)
- On the hub page, **click the logo 5 times quickly**. The editor opens over the page.
- Edit the wording, add your PDFs (drop them on the document boxes; in **Modules** you can drop them all at once, matched by their codes), set the brand colour and logo.
- **Edit text on the page** (top of the editor) hides the editor and lets you double-click text on the page itself to change it: Enter saves, Esc cancels, and **Back to editor** returns. It covers the section headings and intros, the opening title, key-figure headings and text, story chapter titles and text, and timeline entries. Anything else (names of modules, stakeholders, email text) is edited in the editor's forms.
- **Show or hide sections** removes parts you don't need (key figures, story, timeline). Your text is kept.
- **Sign-in and consent screens** has their wording and on/off switches.
- **← Back to site** hides the editor so you can see the page as a reader would. Your edits show straight away. Click the logo 5 times again to return to the editor; your work is kept.
- **Show me the sign-in and consent screens** replays the first two screens.

## Keeping your work
Nothing is stored in the browser. Before you close the page:
- **Save my content** writes one file (a zip) with your wording and PDFs.
- Next time, open `index.html`, open the editor, and use **Open content…** to load it back.

## Finishing
**Export site** makes a folder (zip) with no editor in it: `index.html` plus the PDFs, page pictures, fonts and logo. That is what you upload to a host. Don't upload the original `index.html` to readers: it contains the editor. The mock sign-in and the consent screen are in the exported site; switch them off in the editor if the server will handle them.

"Download as one PDF" (merging a pack) works once the site is on a web host, not when opened straight from your computer. Each single PDF downloads either way.

## Later: the server side
The sign-in is a mock. Real sign-in, recording consent, and counting downloads are done by the host. The Check and export page and `src/` have the details, and the IT hand-over note covers what the server must do. `examples/consent-server.mjs` is a small test server showing the consent behaviour; you don't need it now.

## Rebuilding (developers)
`node src/build.mjs` rebuilds `index.html` from `src/`. `content.js` holds the sample content. Needs Node 18+. `src/vendor/` holds pdf.js (Apache 2.0); `lib/pdf-lib.min.js` is pdf-lib (MIT). The brand fonts were supplied for this project: check your licence allows embedding them.
