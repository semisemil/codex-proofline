# Proofline State

This directory stores project-local Proofline state.

Source of truth:

- `.proofline/issues/*.md`

Dashboard files:

- `.proofline/dashboard/index.html`
- `.proofline/dashboard/style.css`
- `.proofline/dashboard/app.js`

The dashboard files are static and should not be edited during normal issue registration.

## Local view

Open:

`.proofline/dashboard/index.html`

Then choose the `.proofline/issues` folder.

## Server or Pages view

If using Manifest Mode, keep `.proofline/issues/index.json` updated. The dashboard can then load issue files automatically over HTTP.
