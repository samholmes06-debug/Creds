# Product A launch story: Veeva CLM sandbox package

Concept mock-up for sandbox testing. Figures, dates and job codes are placeholders.

## Files

| File | What it is |
|---|---|
| `ProductA_LaunchStory.zip` | The CLM slide package. Upload this to Vault as a multichannel slide. |
| `ProductA_LaunchStory.html` | The same page unzipped, for review in a browser. |
| `ProductA_LaunchStory_storyboard.pdf` | Every scene and state at iPad size, plus the recommendation and chapter-order rules, for MLR review. |

Inside the zip, at the root:

- `ProductA_LaunchStory.html`: named to match the zip, as Veeva expects
- `ProductA_LaunchStory-thumb.png`: 1024 × 768 thumbnail

Some setups expect `index.html` instead. If your sandbox does, rename the HTML file inside the zip and keep everything else the same.

## Before you upload

1. **Add the Veeva CLM library.** Put `veeva-library.js` from your Veeva CLM developer resources (or your CLM team) in the zip root, next to the HTML. The page already loads it. Without it the page runs normally but can't talk to Veeva.
2. **Fill in the settings** at the top of the main script in the HTML (search for `const VEEVA`):
   - `emailTemplate`: your Approved Email template ID
   - `fragments`: one Approved Email fragment ID per PDF (`core`, `value`, `pathway`, `formulary`, `tariffs`, `checklist`, `faqs`)
   - `pdfSlides` (optional): the key message media file name of each PDF slide, so "Open PDF" in the pack viewer jumps to the real PDF
   - `presentationId` (optional): only needed if those PDF slides live in a different presentation
   - `trackEvents`: set to `false` to turn off Call Clickstream records

   You can upload with the IDs blank first. Buttons then show "Approved Email isn't set up yet" instead of failing.
3. **Re-zip** with the files at the zip root, not inside a folder.

## What it does inside Veeva

When `veeva-library.js` is present:

- "Download core PDF" and "Download as one PDF" become **Send core PDF** and **Send pack by Approved Email**. They open Approved Email with the matching fragments, in pack order.
- Each document in the pack viewer gets **Send PDF**, and **Open PDF** when `pdfSlides` is set.
- The browser-only "Approved email" preview is hidden.
- **Call Clickstream** records (`Call_Clickstream_vod__c`) are written for:
  - stakeholder and engagement choices
  - each figure and chapter reached (once each per call)
  - modules added and removed
  - pack viewer opened
  - Approved Email launched

  Each record uses `Track_Element_Type_vod__c`, `Track_Element_Id_vod__c` and `Track_Element_Description_vod__c`.

Outside Veeva (a normal browser), everything behaves like the concept mock-up.

## The PDFs

The core notification and each module PDF are **separate Vault documents**, each with its own job code and MLR approval. They aren't bundled inside this HTML slide. They're used in two places:

1. **Approved Email fragments.** Each PDF is approved for email use and referenced by fragment ID in the `fragments` setting. This is how the pack reaches the stakeholder.
2. **PDF slides in the same presentation (optional).** Add each PDF as a slide in the same CLM presentation, after this HTML slide. "Open PDF" in the pack viewer then shows the real approved PDF in the meeting. You can hide those slides from the main slide order if your setup allows, so reps reach them only through the hub.

Until the PDFs exist, the pack viewer shows mock A4 pages. Once they're approved, either point "Open PDF" at the PDF slides, or replace the mock pages with page images exported from the approved PDFs. iPads don't reliably show multi-page PDFs inside a web page, so don't embed the PDFs in the HTML.

Keeping PDFs separate means a module can be updated and re-approved without re-approving this HTML slide. The slide only needs to change if a module's title, page count or position in the story changes.

## What to test in the sandbox

- [ ] The slide loads offline after sync, and the fonts display (GSK fonts are embedded)
- [ ] The page scrolls vertically in the iPad app, and the bar, numbers scene and timeline pin correctly
- [ ] Horizontal scrolling of the document tabs in the pack viewer doesn't trigger a slide swipe
- [ ] Choosing a stakeholder and engagement updates the pack, and the dock appears after the hero
- [ ] "Send pack" opens Approved Email with the expected fragments, in order
- [ ] Clickstream records appear on the call after it's saved
- [ ] "Open PDF" reaches the PDF slides, if configured
- [ ] Remote Engage meeting: check whether attendees follow the presenter's scrolling. If not, consider splitting into four or five slides.
- [ ] Checklist ticks: these use browser storage and may not persist between calls in CLM

## Notes

- The function names used (`createRecord`, `launchApprovedEmail`, `gotoSlide`) are from Veeva's CLM JavaScript library. Check the signatures against the library version your org uses.
- Only target this presentation and its email templates to budget holders and formulary decision-makers. Advance notification must not reach prescribers generally.
- Remove the "Concept mock-up – not for distribution" label before production. Search the HTML for `concept`.
