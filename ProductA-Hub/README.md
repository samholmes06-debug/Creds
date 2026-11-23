# Product A launch story: editable hub

A scroll-story hub for a launch notification. Readers choose a stakeholder and the type of engagement, read the story, add approved PDF modules as they go, then preview, download or email the pack.

This folder splits the work in three, so the design stays stable while the content changes:

| What | File | Who touches it |
|---|---|---|
| The editor | `editor.html` | Anyone: forms, drag-and-drop, one-click export |
| The content | `content.js` | Anyone, by hand or through the editor |
| The design and behaviour | `index.html` (built from `src/`) | A developer, rarely |

Everything works **offline**: the fonts, libraries and files are inside the pages, and nothing is fetched from the internet. This was tested by opening the files with the network switched off.

## The quick route: use the editor

1. Open `editor.html` in Chrome or Edge (double-click it; no install, no internet). It was tested in Chromium, the engine behind both; Safari and Firefox have not been tested.
2. Work down the list on the left. Changes appear in the live preview on the right. Use Desktop, iPad and Phone to check widths.
   - **Brand and logo:** product name, logo (SVG best), brand colour, job code, date, optional replacement fonts.
   - **Core notification** and **Modules:** add each approved PDF by choosing it or dragging it onto its box. The editor reads the PDF, counts the pages and makes the page pictures for the in-page viewer. In **Modules**, you can drop all the PDFs at once: each is matched by its code (a file called `PA-MOD-02.pdf` goes to the module with that code).
   - **Stakeholders and engagements**, **Recommendations**, **Key figures**, **Story chapters**, **Timeline**, **Pack, email and footer:** all the wording, with add, remove and reorder buttons.
3. Open **Check and export**. It lists anything to fix (missing job code, items pointing at a deleted module, large file size) and any **placeholder wording** still in the text, such as "mock-up", "Condition X", an "XX-UK-" job code or "£X,XXX".
4. Choose **Export website folder (.zip)** to host the hub (see below), or **Single file** for one offline page to email or open without a server.

### The website folder (for hosting)

**Export website folder (.zip)** is the version to host. Unzip it and upload the folder:

```
product-a-hub/
  index.html            the page
  content.js            the wording, with paths to the files below
  lib/pdf-lib.min.js    merges a pack in the reader's browser
  assets/pdfs/          each approved PDF as its own file
  assets/pages/         page pictures for the on-screen viewer (first 30 pages of each PDF)
  assets/fonts/ logo/   brand fonts and logo
  HOSTING-NOTES.txt
```

- **Separate PDFs.** Readers can download any one PDF, or build a pack and download it as one merged PDF. Large PDFs stay as ordinary files, not inside the page, so the page stays small and loads fast.
- **Per-PDF logging.** Each download is its own request in the web server's access log. The page marks how the file was used: `?via=download` (a reader downloaded that PDF) or `?via=pack` (it was read to build a merged pack). Count these per PDF, and per user once login is in place. Leave `assets/pages/` out of download counts.
- **Protect the whole folder**, not just `index.html`, or anyone who knows a PDF's address can fetch it without logging in. The folder is marked `noindex` so search engines skip it.
- **Merging a pack** happens in the reader's browser. A pack of several hundred MB can fail on a phone; the separate downloads still work. It needs a web server: opened straight from a computer, browsers block it, and each PDF opens in a new tab instead.
- Before exporting, the editor warns about documents with no PDF, a missing job code, or placeholder wording. The **final** folder has no editor, no editing marks and no concept label. **Website folder, working copy** keeps the concept label, for internal review.

### The single file

**Single file** is one clean page with the fonts, logo, approved PDFs and page pictures inside, for email or a CLM. It works offline. It suits a few small PDFs; with large ones the file becomes slow to open, so use the website folder. **Single file, working copy** keeps the concept label.

Both final versions have no editor or edit links, make no network requests (apart from the folder's own files), and a page from outside can't change what they show. Wording in the text itself (for example the footer line "placeholders for this mock-up") is content, so change it in the editor first. The Check page shows where it is.

Other buttons in the top bar:
- **Save project** keeps your work, with its PDFs, as a `.zip`. **Open…** reloads it (older `.json` projects and a `content.js` also open).

Nothing is stored in the browser, so save your project before closing the page. The editor warns you if you try to leave with unsaved changes.

`examples/` holds two single files made with the placeholder PDFs in `assets/pdfs`: the working copy (`…-offline-example.html`) and the final copy (`…-final-example.html`). The final example still shows the sample footer wording, because that is content.

## The folder route: edit content.js by hand

`index.html` reads `content.js` and the files in `assets/`. Open `index.html` to see it.

- **Wording:** edit `content.js`. It is commented and laid out in the order of the page. In text, `**double asterisks**` make bold.
- **PDFs:** replace the files in `assets/pdfs/` and `assets/pages/` (keeping the file names), or change the paths in `content.js`. The `assets/pages/` pictures are one image per PDF page, used by the in-page viewer.
- **Logo:** replace `assets/logo/placeholder-logo.svg` or change `brand.logo`.
- **Fonts:** the four brand fonts are in `assets/fonts/`.

This is the same layout the editor's website export produces. **One limit of opening it straight from your computer:** browsers won't let a page read other files in its folder, so **"Download as one PDF" can't merge** there. It says so and each PDF still opens in a new tab. Merging works on a web server or in the single file.

## Rebuilding after a design change

Developers can change `src/style.css`, `src/template.html` or `src/hub.js`, then run:

```
node src/build.mjs
```

Needs Node 18 or later and installs nothing. It rewrites `index.html` and `editor.html`. It checks that nothing embedded can break the editor page.

`src/make-samples.mjs` regenerates the placeholder PDFs and page pictures from `content.js` (needs Playwright; run it as described at the top of the file).

## What each part of the page does

- **Top bar:** logo, the two choices (stakeholder, engagement), and the core PDF button.
- **Opening screen:** headline, the core PDF cover, and the stakeholder chooser. Choosing both adds the recommended modules to the pack.
- **Key figures:** large numbers that change as you scroll. Each can offer a related module.
- **Story:** the core notification, chapter by chapter. Chapters reorder for the chosen stakeholder, and each can offer a related module.
- **Timeline:** milestones that move sideways as you scroll.
- **Your pack:** the chosen documents, the PDF viewer, **Download as one PDF** and the approved email text.
- **Dock:** a running summary of the pack that follows the reader down the page.

## Veeva CLM

The same page can run inside Veeva. In the editor's **Veeva** section, tick **Include the Veeva library**, add the Approved Email template and fragment IDs, and export. Then put `veeva-library.js` (from your Veeva CLM resources) next to the exported file and zip them. Inside Veeva the download buttons become "Send by Approved Email" and choices are tracked. See `veeva/README.md` in the repository for the sandbox steps.

## Not included yet

- **Password protection, logged consent and site analytics.** These need a server: a password inside a downloadable file is not real protection, and consent and analytics records have to be stored somewhere the user can't edit. They belong in the hosting layer in front of the website folder, which needs no change to the page. Per-PDF download counts come from the server's access log (see above). The page has no tracking of its own (outside Veeva).
- **The FAQ search and checklist ticks** from the earlier prototype. Modules are now approved PDFs, so their detail lives in the PDF.

## Licences

`lib/pdf-lib.min.js` (pdf-lib, MIT) merges the pack. `src/vendor/` holds pdf.js (Apache 2.0), used only inside the editor to read PDFs. The brand fonts in `assets/fonts/` were supplied for this project: check that your licence allows them to be embedded in files you share.
