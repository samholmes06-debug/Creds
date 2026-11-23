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
4. Choose **Export final copy**. You get one clean file with the fonts, logo, approved PDFs and page pictures inside. Open it with Wi-Fi off to check it, then share it.

### The final copy

**Export final copy** is the version to send out. It is a finished page and nothing else:
- no editor, editing marks or edit links, and none of the editor's preview code;
- the concept label is removed;
- every approved PDF is inside it, so readers can view the pages, download each PDF and download the whole pack as one merged PDF, all offline;
- it makes no network requests, and a page from outside can't change what it shows.

Before exporting it warns you if any document has no PDF yet (its draft pages would be visible), if the job code is missing, or if placeholder wording remains. **Export working copy** is the same file with the concept label kept, for internal review.

Wording in the text itself (for example the footer line "placeholders for this mock-up") is content, so change it in the editor first. The Check page shows where it is.

Other buttons in the top bar:
- **Save project** keeps your work as a `.json` file. **Open…** reloads it (or a `content.js`).
- **Save content.js** writes the content for the folder version (see below).

Nothing is stored in the browser, so save your project before closing the page. The editor warns you if you try to leave with unsaved changes.

`examples/` holds two files made with the placeholder PDFs in `assets/pdfs`: the working copy (`…-offline-example.html`) and the final copy (`…-final-example.html`). The final example still shows the sample footer wording, because that is content.

## The folder route: edit content.js by hand

`index.html` reads `content.js` and the files in `assets/`. Open `index.html` to see it.

- **Wording:** edit `content.js`. It is commented and laid out in the order of the page. In text, `**double asterisks**` make bold.
- **PDFs:** replace the files in `assets/pdfs/` and `assets/pages/` (keeping the file names), or change the paths in `content.js`. The `assets/pages/` pictures are one image per PDF page, used by the in-page viewer.
- **Logo:** replace `assets/logo/placeholder-logo.svg` or change `brand.logo`.
- **Fonts:** the four brand fonts are in `assets/fonts/`.

**One limit of opening the folder version straight from your computer:** browsers won't let a page read other files in its folder, so **"Download as one PDF" can't merge** there. It says so and each PDF still opens in a new tab. Merging works if you either use the single-file export, put `content.js` made by the editor in the folder (its files are embedded), or host the folder on a web server.

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

- **Password protection, logged consent and site analytics.** These need a server: a password inside a downloadable file is not real protection, and consent and analytics records have to be stored somewhere the user can't edit. They belong in a hosted version, which can reuse this page unchanged. The page has no tracking of its own (outside Veeva).
- **The FAQ search and checklist ticks** from the earlier prototype. Modules are now approved PDFs, so their detail lives in the PDF.

## Licences

`lib/pdf-lib.min.js` (pdf-lib, MIT) merges the pack. `src/vendor/` holds pdf.js (Apache 2.0), used only inside the editor to read PDFs. The brand fonts in `assets/fonts/` were supplied for this project: check that your licence allows them to be embedded in files you share.
