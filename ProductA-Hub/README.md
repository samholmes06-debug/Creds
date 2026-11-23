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

1. Open `editor.html` in Chrome or Edge (double-click it; no install, no internet). It is the site with the editor hidden inside it, and it opens straight into the editor. It was tested in Chromium, the engine behind both; Safari and Firefox have not been tested.
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
  index.html            the page, with its wording inside (no other file needed for the text)
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
- Before exporting, the editor warns about documents with no PDF, a missing job code, or placeholder wording. The **final** folder has no editor, no editing marks and no concept label. **Website folder with concept label** keeps the label, for internal review.

### The editable working folder (hidden editor)

**Editable folder (.zip)** is the same site with this editor hidden inside `index.html`. Unzip it, open `index.html`, and **click the header 5 times quickly** (the logo area) to open the editor. Edit, then export again. Use it as your working copy, and **Export clean site** when it's approved: the clean folder has no editor in it at all.

- On a web server (or a local one) the editor loads the PDFs already in the folder, so you carry on where you left off. Opened straight from a computer, browsers block that: use **Save project** and **Open…** (a zip with your PDFs inside) to carry your work between sessions.
- Don't host the editable folder for readers: anyone who clicks the header 5 times would see the editor. Host the clean site.

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

## Consent and tracking (optional)

In the editor, **Consent and tracking** adds a step before the page opens and, if you wish, optional usage statistics. It is **off by default**. Switch it off and export again and the code and wording are removed from the file.

**What the page does**
- Shows your wording with a required tick, and an optional second tick for usage statistics. A footer link lets the reader see and change the choice.
- With a **consent address** set, it asks the server whether this reader has already agreed (to the current wording version) and sends the choice to the server. If the server can't be reached, the reader is asked again rather than let through unrecorded.
- With a **usage events address** set, and only if the reader ticked the optional box, it sends small events: page view, stakeholder and engagement chosen, module added or removed, figure viewed, pack viewed, PDF downloaded, pack downloaded. Each carries a random id made for that page load (not stored, not linked to a person) and no name. Nothing is sent before consent or after it is withdrawn.
- With both addresses blank, the choice is remembered in the reader's browser only. That is for testing: it is not a record.

**What the server must do** (on Azure, Functions or App Service behind your login)
1. `GET /api/consent` returns the signed-in reader's record (`{version, analytics}`), or 204 if none.
2. `POST /api/consent` saves it, stamped with the **server's** knowledge of who is signed in and the time. The page never sends a name, because a page can't be trusted to say who it is.
3. `POST /api/events` saves usage events, ignoring them unless that reader's record allows analytics.
4. Refuse the pages' PDFs (and ideally everything) to anyone with no consent record. The page's gate is a notice; this check is what makes it enforceable.

`examples/consent-server.mjs` is a small test server doing exactly these jobs (`node examples/consent-server.mjs <site-folder>`). It is for trying the flow, not for production.

**How tracking fits together**
- **Who:** your login (on Azure, Entra ID) knows who each reader is and records sign-ins. The server stamps that identity on consent records and events.
- **Which PDFs:** the server's request log counts each download per PDF (the `?via=` marker says how it was used). This needs no consent code and works even with the page's tracking switched off, but it is still personal data, so the privacy notice must cover it.
- **What they did on the page:** the optional events above.
- Report from the stored records or the logs (for example in Log Analytics or a database).

Check the wording, lawful basis and retention with the client's data protection team. The page can't decide those.

## Sign-in page (optional)

In the editor, **Sign-in page** makes a branded `signin.html` for the website folder: your logo, colour and fonts, a title, a short introduction, one or more sign-in buttons and a help line. It is **off by default**; switch it off and export again and it is left out.

**It is only the look.** The real login is done by the host (Azure or the client's SSO). Each button just goes to the host's login address, and the host decides who gets in. The page holds no passwords and checks nothing itself.

- **Azure:** **Fill for Azure** sets the button to `/.auth/login/aad` (Microsoft Entra ID on Azure Static Web Apps). Tick **Also write a starting Azure config** to add `staticwebapp.config.json`, which requires sign-in for every file except the sign-in page, fonts and logo, and sends signed-out visitors to `signin.html`. It is a starting point written from Azure's documented format and **not tested on Azure**: check it against the current guidance, and test that a PDF address is refused when signed out. Custom login providers on Azure Static Web Apps can need a paid plan.
- **The client's SSO:** **Fill for the client's SSO** adds a button with a placeholder address. Replace it with the login address your IT team gives you (for example the provider's address on the host). Add several buttons if readers can choose.
- **After sign-in:** the page footer can show "Signed in as … · Sign out", read from the host's who-is-signed-in address (`/.auth/me` on Azure Static Web Apps). If the host has no such address, nothing is shown.

## Not included yet

- **The login itself.** Passwords, accounts, two-factor and invitations are the hosting layer's job. The sign-in page only gives them a branded front door.
- **The FAQ search and checklist ticks** from the earlier prototype. Modules are now approved PDFs, so their detail lives in the PDF.

## Licences

`lib/pdf-lib.min.js` (pdf-lib, MIT) merges the pack. `src/vendor/` holds pdf.js (Apache 2.0), used only inside the editor to read PDFs. The brand fonts in `assets/fonts/` were supplied for this project: check that your licence allows them to be embedded in files you share.
