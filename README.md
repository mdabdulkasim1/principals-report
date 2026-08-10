# Monthly Principal Academic Report

A standalone web app for preparing the **Monthly Principal Academic Report** submitted to the Chairman. It reproduces all 13 sections of the school's official specimen, auto-calculates the totals and averages, saves your work in the browser, and prints/exports a clean PDF for submission.

Built to match the *AKB School of Excellence* specimen (the school name and place are editable, so it works for any school).

## Running it

No installation, build step, or server needed.

1. Open **`index.html`** in any modern browser (Chrome, Edge, Firefox, Safari).
2. Fill in the fields. Your data is saved automatically in that browser.
3. Click **Print / Save PDF** and choose *Save as PDF* to produce the document for the Chairman.

To host it (optional), put the three files on any static web host or an internal server — there is no backend.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure — the 13 report sections and the toolbar |
| `styles.css` | Screen and print (A4) styling |
| `app.js` | Table generation, auto-calculations, save/load, import/export |

## The 13 sections

1. **Executive Summary** — key figures (several fields auto-fill from the data below)
2. **Grade-Wise Academic Performance Summary** (Grades 1–8, with an auto School row)
3. **Subject-Wise Performance Analysis** (Grades 6–8)
4. **Primary Section Summary** (Grades 1–5)
5. **Nursery Section Summary** (Nursery / JKG / SKG)
6. **Periodic Test / Assessment Report**
7. **Syllabus Completion Status**
8. **Slow Learner Monitoring** (with auto totals)
9. **Grade 9 Special Monitoring** (tick *Not Applicable* until the Grade 9 batch begins)
10. **Teacher Academic Accountability** (add as many teachers as needed)
11. **Best Teacher of the Month** (totals and ranks calculated automatically)
12. **Academic Discipline & Engagement**
13. **Action Plan for Next Month**

Plus a signature block for the Principal and the Chairman.

## What is calculated automatically

Fields marked **AUTO** are computed live — you never type them:

- **School row** in Section 2 — overall average (mean of grade averages), highest, lowest, total students below 40%, and average attendance.
- **Executive Summary** — overall school average, best/weakest performing grade, best/weakest subject overall (aggregated across the subject tables), and total students below 40%.
- **Section 6** — number of students below 40% (mirrors Section 2).
- **Section 8** — total students below 40%, total remedial hours, and average improvement.
- **Section 11** — each teacher's total out of 100 and their rank.

Percentages are shown to one decimal place, following the specimen's guidance.

## Saving your work

- **Save / Load** — keeps a copy in this browser's local storage (also saved automatically as you type).
- **Export file** — downloads a `.json` backup you can keep or move to another computer.
- **Import file** — loads a previously exported `.json` back into the form.
- **Clear** — wipes the current data (export a backup first if you need it).

> Browser storage is per-browser and per-device. To keep a permanent record or move between devices, use **Export file** and store the `.json` somewhere safe.

## Producing a month's report

1. Enter the month, academic year, and your name at the top.
2. Fill Sections 2–13. The AUTO fields update as you go.
3. Review the Executive Summary — it should reflect the figures you entered.
4. **Print / Save PDF**, then email the PDF to the Chairman.
5. **Export file** to archive that month's data.

For the next month, either clear the form and start fresh, or edit last month's data and re-export under a new name.
