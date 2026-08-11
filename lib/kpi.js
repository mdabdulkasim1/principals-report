"use strict";
/**
 * Derive headline KPIs from a report's raw field data.
 * `data.fields` uses the same keys the form emits (gs_1_avg, sub_6_1_avg, ...).
 * Returns a compact object stored on the report and used by the dashboard.
 */
const GRADES_1_8 = [1, 2, 3, 4, 5, 6, 7, 8];
const SUBJECT_SETS = {
  sub: [6, 7, 8], // secondary grades
  pri: [1, 2, 3, 4, 5], // primary grades
};
const SUBJECT_NAMES = {
  sub: ["English", "Tamil", "Hindi", "Arabic", "History", "Mathematics", "Science", "Geography"],
  pri: ["English", "Tamil", "Hindi", "Arabic", "English Language", "Mathematics", "Science", "Lead / Other Activities"],
};

function num(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function sum(a) { return a.reduce((x, y) => x + y, 0); }
function r1(n) { return n == null ? null : Math.round(n * 10) / 10; }

function computeKpis(data) {
  const f = (data && data.fields) || {};

  const gradeAvgs = [];
  const attends = [];
  let below40 = 0, below40Count = 0;
  let bestGrade = null, weakGrade = null;

  GRADES_1_8.forEach((g) => {
    const a = num(f[`gs_${g}_avg`]);
    const att = num(f[`gs_${g}_att`]);
    const b = num(f[`gs_${g}_below`]);
    if (a != null) {
      gradeAvgs.push(a);
      if (!bestGrade || a > bestGrade.v) bestGrade = { g, v: a };
      if (!weakGrade || a < weakGrade.v) weakGrade = { g, v: a };
    }
    if (att != null) attends.push(att);
    if (b != null) { below40 += b; below40Count++; }
  });

  // Subject aggregation across all subject tables
  const subjAgg = {};
  Object.keys(SUBJECT_SETS).forEach((prefix) => {
    SUBJECT_SETS[prefix].forEach((g) => {
      SUBJECT_NAMES[prefix].forEach((name, idx) => {
        const v = num(f[`${prefix}_${g}_${idx}_avg`]);
        if (v == null) return;
        (subjAgg[name] = subjAgg[name] || []).push(v);
      });
    });
  });
  let bestSubject = null, weakSubject = null;
  Object.keys(subjAgg).forEach((s) => {
    const a = avg(subjAgg[s]);
    if (!bestSubject || a > bestSubject.v) bestSubject = { s, v: a };
    if (!weakSubject || a < weakSubject.v) weakSubject = { s, v: a };
  });

  // Syllabus completion (avg of pct fields)
  const sylPct = [];
  for (let i = 0; i < 20; i++) {
    const v = num(f[`syl_${i}_pct`]);
    if (v != null) sylPct.push(v);
  }

  // Slow-learner improvement
  const slImprove = [];
  for (let i = 0; i < 12; i++) {
    const v = num(f[`sl_${i}_improve`]);
    if (v != null) slImprove.push(v);
  }

  // Best teacher of the month (max total from bestTeachers array)
  let bestTeacher = null;
  const bt = (data && data.bestTeachers) || [];
  bt.forEach((t) => {
    const total = ["te", "en", "ac", "pd", "in", "pf"].reduce((s, k) => s + (num(t[k]) || 0), 0);
    if (t.name && (!bestTeacher || total > bestTeacher.total)) bestTeacher = { name: t.name, total };
  });

  return {
    overallAvg: r1(avg(gradeAvgs)),
    attendance: r1(avg(attends)),
    below40: below40Count ? below40 : null,
    syllabusAvg: r1(avg(sylPct)),
    slowImprove: r1(avg(slImprove)),
    bestGrade: bestGrade ? { grade: bestGrade.g, value: r1(bestGrade.v) } : null,
    weakGrade: weakGrade ? { grade: weakGrade.g, value: r1(weakGrade.v) } : null,
    bestSubject: bestSubject ? { name: bestSubject.s, value: r1(bestSubject.v) } : null,
    weakSubject: weakSubject ? { name: weakSubject.s, value: r1(weakSubject.v) } : null,
    bestTeacher: bestTeacher || null,
    totalStudents: num(f.es_totalStudents),
  };
}

module.exports = { computeKpis };
