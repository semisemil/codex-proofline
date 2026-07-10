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

Connect the `.proofline/issues` folder once. The dashboard remembers that folder and reads Markdown issues from it on later visits. Use the folder reassignment control if the issues folder moves.
