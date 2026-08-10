/* ================= Monthly Principal Academic Report ================= */
(function () {
  "use strict";

  var STORAGE_KEY = "principal_academic_report_v1";

  /* ---------- Configuration (from the specimen) ---------- */
  var GRADES_1_8 = [1, 2, 3, 4, 5, 6, 7, 8];
  var SECONDARY_GRADES = [6, 7, 8];
  var SECONDARY_SUBJECTS = ["English", "Tamil", "Hindi", "Arabic", "History", "Mathematics", "Science", "Geography"];
  var PRIMARY_GRADES = [1, 2, 3, 4, 5];
  var PRIMARY_SUBJECTS = ["English", "Tamil", "Hindi", "Arabic", "English Language", "Mathematics", "Science", "Lead / Other Activities"];
  var NURSERY_CLASSES = ["Nursery", "JKG", "SKG"];
  var SYLLABUS_GRADES = ["Pre-KG", "JKG", "SKG", "Grade-1", "Grade-2", "Grade-3", "Grade-4", "Grade-5", "Grade-6", "Grade-7", "Grade-8"];
  var SLOW_GRADES = ["Grade-1", "Grade-2", "Grade-3", "Grade-4", "Grade-5", "Grade-6", "Grade-7", "Grade-8"];
  var G9_ROWS = 6;
  var ACTIVITY_SECTIONS = ["Nursery", "Grade 1 to 5", "Grade 6 to 8"];

  /* ---------- Small DOM helpers ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }
  function txtInput(field, opts) {
    opts = opts || {};
    var i = el("input", { type: "text", "data-field": field });
    if (opts.left) i.className = "text-left";
    if (opts.numeric) i.setAttribute("inputmode", "decimal");
    if (opts.calc) i.setAttribute("data-calc", opts.calc);
    if (opts.placeholder) i.setAttribute("placeholder", opts.placeholder);
    return i;
  }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* ================= Build generated tables ================= */

  // Section 2 – Grade-wise summary
  function buildGradeSummary() {
    var tb = document.querySelector("#gradeSummary tbody");
    GRADES_1_8.forEach(function (g) {
      var pre = "gs_" + g + "_";
      tb.appendChild(el("tr", null, [
        el("td", { class: "grade-label" }, [String(g)]),
        el("td", null, [txtInput(pre + "avg", { numeric: true, calc: "grade" })]),
        el("td", null, [txtInput(pre + "high", { numeric: true, calc: "grade" })]),
        el("td", null, [txtInput(pre + "low", { numeric: true, calc: "grade" })]),
        el("td", null, [txtInput(pre + "below", { numeric: true, calc: "grade" })]),
        el("td", null, [txtInput(pre + "att", { numeric: true, calc: "grade" })])
      ]));
    });
  }

  // Sections 3 & 4 – per-grade subject tables
  function buildSubjectTables(containerId, grades, subjects, prefix) {
    var host = document.getElementById(containerId);
    grades.forEach(function (g) {
      var block = el("div", { class: "grade-block" });
      block.appendChild(el("h3", null, ["Grade " + g]));
      var table = el("table", { class: "data-table" });
      table.appendChild(el("thead", null, [el("tr", null,
        ["Subject", "Average %", "Highest", "Lowest", "Students <40%", "Action Plan / Students Requiring Action"]
          .map(function (h) { return el("th", null, [h]); })
      )]));
      var tbody = el("tbody");
      subjects.forEach(function (s, idx) {
        var pre = prefix + "_" + g + "_" + idx + "_";
        tbody.appendChild(el("tr", null, [
          el("td", { class: "grade-label text-left" }, [s]),
          el("td", null, [txtInput(pre + "avg", { numeric: true, calc: "subject", "data-subject": s })]),
          el("td", null, [txtInput(pre + "high", { numeric: true })]),
          el("td", null, [txtInput(pre + "low", { numeric: true })]),
          el("td", null, [txtInput(pre + "below", { numeric: true })]),
          el("td", null, [txtInput(pre + "action", { left: true })])
        ]));
      });
      table.appendChild(tbody);
      block.appendChild(table);
      host.appendChild(block);
    });
    // tag subject-avg inputs so the executive summary can aggregate them
    host.querySelectorAll('input[data-calc="subject"]').forEach(function (i) {
      var tr = i.closest("tr");
      i.setAttribute("data-subject", tr.querySelector("td").textContent.trim());
    });
  }

  // Section 5 – Nursery
  function buildNursery() {
    var tb = document.querySelector("#nurseryTable tbody");
    NURSERY_CLASSES.forEach(function (c, idx) {
      var pre = "nur_" + idx + "_";
      tb.appendChild(el("tr", null, [
        el("td", { class: "grade-label" }, [c]),
        el("td", null, [txtInput(pre + "count", { numeric: true })]),
        el("td", null, [txtInput(pre + "writing", { numeric: true })]),
        el("td", null, [txtInput(pre + "reading", { numeric: true })]),
        el("td", null, [txtInput(pre + "activity", { numeric: true })]),
        el("td", null, [txtInput(pre + "improve", { left: true })])
      ]));
    });
  }

  // Section 7 – Syllabus
  function buildSyllabus() {
    var tb = document.querySelector("#syllabusTable tbody");
    SYLLABUS_GRADES.forEach(function (g, idx) {
      var pre = "syl_" + idx + "_";
      var sel = el("select", { "data-field": pre + "ontrack" }, []);
      ["Y", "N"].forEach(function (o) { sel.appendChild(el("option", null, [o])); });
      tb.appendChild(el("tr", null, [
        el("td", { class: "grade-label" }, [g]),
        el("td", null, [txtInput(pre + "subjects", { numeric: true })]),
        el("td", null, [txtInput(pre + "pct", { numeric: true })]),
        el("td", null, [sel]),
        el("td", null, [txtInput(pre + "reason", { left: true })])
      ]));
    });
  }

  // Section 8 – Slow learner
  function buildSlowLearner() {
    var tb = document.querySelector("#slowLearnerTable tbody");
    SLOW_GRADES.forEach(function (g, idx) {
      var pre = "sl_" + idx + "_";
      var sel = el("select", { "data-field": pre + "parent" }, []);
      ["Y", "N"].forEach(function (o) { sel.appendChild(el("option", null, [o])); });
      tb.appendChild(el("tr", null, [
        el("td", { class: "grade-label" }, [g]),
        el("td", null, [txtInput(pre + "below", { numeric: true, calc: "slow" })]),
        el("td", null, [txtInput(pre + "hours", { numeric: true, calc: "slow" })]),
        el("td", null, [sel]),
        el("td", null, [txtInput(pre + "improve", { numeric: true, calc: "slow" })])
      ]));
    });
  }

  // Section 9 – Grade 9
  function buildG9() {
    var tb = document.querySelector("#g9Table tbody");
    for (var r = 0; r < G9_ROWS; r++) {
      var pre = "g9_" + r + "_";
      tb.appendChild(el("tr", null, [
        el("td", null, [txtInput(pre + "subject", { left: true })]),
        el("td", null, [txtInput(pre + "avg", { numeric: true })]),
        el("td", null, [txtInput(pre + "below50", { numeric: true })]),
        el("td", null, [txtInput(pre + "hours", { numeric: true })]),
        el("td", null, [txtInput(pre + "risk", { left: true })])
      ]));
    }
  }

  // Section 12 – Activities
  function buildActivities() {
    var tb = document.querySelector("#activitiesTable tbody");
    ACTIVITY_SECTIONS.forEach(function (s, idx) {
      tb.appendChild(el("tr", null, [
        el("td", { class: "grade-label" }, [s]),
        el("td", null, [txtInput("act_" + idx, { left: true })])
      ]));
    });
  }

  /* ---------- Dynamic tables (add / remove rows) ---------- */
  function teacherRow(data) {
    data = data || {};
    var tr = el("tr", { class: "dyn-row" });
    var lp = el("select", null, []); ["Yes", "No"].forEach(function (o) { lp.appendChild(el("option", null, [o])); });
    lp.value = data.lessonPlan || "Yes";
    var cells = [
      el("td", { class: "row-index" }, []),
      cellInput(data.name, true), cellInput(data.subject, true), cellInput(data.section, true),
      cellInput(data.avg, false, true), el("td", null, [lp]),
      cellInput(data.correction, true), cellInput(data.remarks, true)
    ];
    lp.dataset.role = "lessonPlan";
    tr.append.apply(tr, cells);
    tr.appendChild(delCell());
    return tr;
  }
  function bestTeacherRow(data) {
    data = data || {};
    var tr = el("tr", { class: "dyn-row bt-row" });
    tr.appendChild(cellInput(data.name, true));
    ["te", "en", "ac", "pd", "in", "pf"].forEach(function (k) {
      tr.appendChild(cellInput(data[k], false, true, "bt-score"));
    });
    tr.appendChild(el("td", null, [el("span", { class: "auto bt-total" }, ["—"])]));
    tr.appendChild(el("td", null, [el("span", { class: "auto bt-rank" }, ["—"])]));
    tr.appendChild(delCell());
    return tr;
  }
  function actionRow(data) {
    data = data || {};
    var tr = el("tr", { class: "dyn-row" });
    tr.appendChild(el("td", { class: "row-index" }, []));
    tr.appendChild(cellInput(data.point, true));
    tr.appendChild(cellInput(data.responsibility, true));
    tr.appendChild(cellInput(data.target, true));
    tr.appendChild(delCell());
    return tr;
  }
  function cellInput(val, left, numeric, cls) {
    var i = el("input", { type: "text" });
    if (left) i.className = "text-left";
    if (cls) i.className = ((i.className ? i.className + " " : "") + cls);
    if (numeric) i.setAttribute("inputmode", "decimal");
    if (val != null) i.value = val;
    i.dataset.dyn = "1";
    return el("td", null, [i]);
  }
  function delCell() {
    var b = el("button", { type: "button", class: "del-row no-print", title: "Remove row" }, ["✕"]);
    b.addEventListener("click", function () { var tr = b.closest("tr"); tr.parentNode.removeChild(tr); reindex(); recalc(); scheduleSave(); });
    return el("td", { class: "no-print" }, [b]);
  }
  function reindex() {
    document.querySelectorAll("#teacherTable tbody tr").forEach(function (tr, i) { var c = tr.querySelector(".row-index"); if (c) c.textContent = i + 1; });
    document.querySelectorAll("#actionTable tbody tr").forEach(function (tr, i) { var c = tr.querySelector(".row-index"); if (c) c.textContent = i + 1; });
  }

  /* ================= Auto-calculations ================= */
  function recalc() {
    // ---- Section 2 school row ----
    var avgs = [], highs = [], lows = [], belows = [], atts = [];
    GRADES_1_8.forEach(function (g) {
      var a = num(val("gs_" + g + "_avg")); if (a != null) avgs.push(a);
      var h = num(val("gs_" + g + "_high")); if (h != null) highs.push(h);
      var l = num(val("gs_" + g + "_low")); if (l != null) lows.push(l);
      var b = num(val("gs_" + g + "_below")); if (b != null) belows.push(b);
      var t = num(val("gs_" + g + "_att")); if (t != null) atts.push(t);
    });
    var schoolAvg = avgs.length ? round1(avg(avgs)) : null;
    var totalBelow = belows.length ? sum(belows) : null;
    setTotal("gs_avg", schoolAvg);
    setTotal("gs_high", highs.length ? Math.max.apply(null, highs) : null);
    setTotal("gs_low", lows.length ? Math.min.apply(null, lows) : null);
    setTotal("gs_below", totalBelow);
    setTotal("gs_att", atts.length ? round1(avg(atts)) : null);

    // ---- Executive summary ----
    setAuto("es_overall", schoolAvg != null ? schoolAvg + " %" : "—");
    // best / weakest grade
    var best = null, weak = null;
    GRADES_1_8.forEach(function (g) {
      var a = num(val("gs_" + g + "_avg")); if (a == null) return;
      if (!best || a > best.v) best = { g: g, v: a };
      if (!weak || a < weak.v) weak = { g: g, v: a };
    });
    setAuto("es_bestGrade", best ? "Grade " + best.g + " (" + round1(best.v) + " %)" : "—");
    setAuto("es_weakGrade", weak ? "Grade " + weak.g + " (" + round1(weak.v) + " %)" : "—");
    setAuto("es_below40", totalBelow != null ? String(totalBelow) : "—");
    setAuto("pt_below40", totalBelow != null ? String(totalBelow) : "—");

    // best / weakest subject overall (aggregate every subject-average field)
    var subjAgg = {};
    document.querySelectorAll('input[data-calc="subject"]').forEach(function (i) {
      var s = (i.getAttribute("data-subject") || "").trim();
      var v = num(i.value);
      if (!s || v == null) return;
      (subjAgg[s] = subjAgg[s] || []).push(v);
    });
    var bestS = null, weakS = null;
    Object.keys(subjAgg).forEach(function (s) {
      var a = avg(subjAgg[s]);
      if (!bestS || a > bestS.v) bestS = { s: s, v: a };
      if (!weakS || a < weakS.v) weakS = { s: s, v: a };
    });
    setAuto("es_bestSubject", bestS ? bestS.s + " (" + round1(bestS.v) + " %)" : "—");
    setAuto("es_weakSubject", weakS ? weakS.s + " (" + round1(weakS.v) + " %)" : "—");

    // ---- Section 8 totals ----
    var slBelow = [], slHours = [], slImp = [];
    SLOW_GRADES.forEach(function (g, idx) {
      var pre = "sl_" + idx + "_";
      var b = num(val(pre + "below")); if (b != null) slBelow.push(b);
      var h = num(val(pre + "hours")); if (h != null) slHours.push(h);
      var i = num(val(pre + "improve")); if (i != null) slImp.push(i);
    });
    setTotal("sl_below", slBelow.length ? sum(slBelow) : null);
    setTotal("sl_hours", slHours.length ? sum(slHours) : null);
    setTotal("sl_improve", slImp.length ? round1(avg(slImp)) : null);

    // ---- Section 11 best-teacher totals + ranks ----
    var rows = Array.prototype.slice.call(document.querySelectorAll("#bestTeacherTable tbody tr"));
    var scored = [];
    rows.forEach(function (tr) {
      var scores = Array.prototype.slice.call(tr.querySelectorAll(".bt-score")).map(function (i) { return num(i.value) || 0; });
      var total = scores.reduce(function (a, b) { return a + b; }, 0);
      var any = tr.querySelector(".bt-score").value !== "" || scores.some(function (s) { return s > 0; });
      tr.querySelector(".bt-total").textContent = any ? String(total) : "—";
      scored.push({ tr: tr, total: total, any: any });
    });
    var ranked = scored.filter(function (r) { return r.any; }).slice().sort(function (a, b) { return b.total - a.total; });
    scored.forEach(function (r) { r.tr.querySelector(".bt-rank").textContent = "—"; });
    ranked.forEach(function (r, i) { r.tr.querySelector(".bt-rank").textContent = ordinal(i + 1); });
  }

  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function avg(a) { return sum(a) / a.length; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function val(field) { var e = document.querySelector('[data-field="' + field + '"]'); return e ? e.value : ""; }
  function setAuto(id, text) { var e = document.getElementById(id); if (e) e.textContent = text; }
  function setTotal(key, v) { var e = document.querySelector('[data-total="' + key + '"]'); if (e) e.textContent = (v == null ? "—" : String(v)); }

  /* ================= State: save / load ================= */
  function collectState() {
    var state = { fields: {}, teachers: [], bestTeachers: [], actions: [] };
    document.querySelectorAll("[data-field]").forEach(function (e) {
      state.fields[e.getAttribute("data-field")] = e.type === "checkbox" ? e.checked : e.value;
    });
    document.querySelectorAll("[contenteditable][data-field]").forEach(function (e) {
      state.fields[e.getAttribute("data-field")] = e.textContent;
    });
    document.querySelectorAll("#teacherTable tbody tr").forEach(function (tr) {
      var t = tr.querySelectorAll('input[data-dyn]');
      var lp = tr.querySelector('select[data-role="lessonPlan"]');
      state.teachers.push({ name: t[0].value, subject: t[1].value, section: t[2].value, avg: t[3].value, lessonPlan: lp.value, correction: t[4].value, remarks: t[5].value });
    });
    document.querySelectorAll("#bestTeacherTable tbody tr").forEach(function (tr) {
      var t = tr.querySelectorAll('input[data-dyn]');
      state.bestTeachers.push({ name: t[0].value, te: t[1].value, en: t[2].value, ac: t[3].value, pd: t[4].value, "in": t[5].value, pf: t[6].value });
    });
    document.querySelectorAll("#actionTable tbody tr").forEach(function (tr) {
      var t = tr.querySelectorAll('input[data-dyn]');
      state.actions.push({ point: t[0].value, responsibility: t[1].value, target: t[2].value });
    });
    return state;
  }

  function applyState(state) {
    if (!state) return;
    Object.keys(state.fields || {}).forEach(function (k) {
      var e = document.querySelector('[data-field="' + k + '"]');
      if (!e) return;
      if (e.type === "checkbox") e.checked = !!state.fields[k];
      else if (e.hasAttribute("contenteditable")) e.textContent = state.fields[k];
      else e.value = state.fields[k];
    });
    // dynamic tables
    rebuildDynamic("#teacherTable tbody", state.teachers, teacherRow);
    rebuildDynamic("#bestTeacherTable tbody", state.bestTeachers, bestTeacherRow);
    rebuildDynamic("#actionTable tbody", state.actions, actionRow);
    // restore lesson-plan selects (value set after row creation)
    if (state.teachers) document.querySelectorAll("#teacherTable tbody tr").forEach(function (tr, i) {
      var sel = tr.querySelector('select[data-role="lessonPlan"]'); if (sel && state.teachers[i]) sel.value = state.teachers[i].lessonPlan || "Yes";
    });
    toggleG9();
    reindex(); recalc();
  }
  function rebuildDynamic(sel, arr, factory) {
    var tb = document.querySelector(sel);
    tb.innerHTML = "";
    (arr && arr.length ? arr : [null]).forEach(function (d) { tb.appendChild(factory(d)); });
  }

  /* ---------- persistence actions ---------- */
  var saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { doSave(true); }, 600); }
  function doSave(silent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      status(silent ? "Saved ✓" : "Saved to this browser ✓");
    } catch (e) { status("Save failed"); }
  }
  function doLoad() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { status("Nothing saved yet"); return; }
    try { applyState(JSON.parse(raw)); status("Loaded ✓"); } catch (e) { status("Load failed"); }
  }
  function status(msg) { var s = document.getElementById("saveStatus"); s.textContent = msg; clearTimeout(status._t); status._t = setTimeout(function () { s.textContent = ""; }, 2500); }

  function exportFile() {
    var data = JSON.stringify(collectState(), null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var name = (val("schoolName") || "report").replace(/[^\w]+/g, "_") + "_" + (val("month") || "").replace(/[^\w]+/g, "_") + ".json";
    var a = el("a", { href: URL.createObjectURL(blob), download: name.replace(/_+/g, "_") });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    status("Exported ✓");
  }
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () { try { applyState(JSON.parse(reader.result)); doSave(true); status("Imported ✓"); } catch (e) { status("Invalid file"); } };
    reader.readAsText(file);
  }

  function toggleG9() {
    var na = document.getElementById("g9na").checked;
    document.getElementById("g9Applicable").style.display = na ? "none" : "";
    document.getElementById("g9NaNote").style.display = na ? "block" : "none";
  }

  /* ================= Init ================= */
  function init() {
    buildGradeSummary();
    buildSubjectTables("secondarySubjects", SECONDARY_GRADES, SECONDARY_SUBJECTS, "sub");
    buildSubjectTables("primarySubjects", PRIMARY_GRADES, PRIMARY_SUBJECTS, "pri");
    buildNursery();
    buildSyllabus();
    buildSlowLearner();
    buildG9();
    buildActivities();

    // seed one row into each dynamic table
    document.querySelector("#teacherTable tbody").appendChild(teacherRow());
    document.querySelector("#bestTeacherTable tbody").appendChild(bestTeacherRow());
    document.querySelector("#actionTable tbody").appendChild(actionRow());
    reindex();

    // events
    document.addEventListener("input", function (e) {
      if (e.target.matches("input, textarea, select, [contenteditable]")) { recalc(); scheduleSave(); }
    });
    document.addEventListener("change", function (e) {
      if (e.target.id === "g9na") { toggleG9(); }
      if (e.target.matches("input, textarea, select")) { recalc(); scheduleSave(); }
    });
    document.querySelectorAll("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        var type = b.getAttribute("data-add");
        if (type === "teacher") document.querySelector("#teacherTable tbody").appendChild(teacherRow());
        else if (type === "bestTeacher") document.querySelector("#bestTeacherTable tbody").appendChild(bestTeacherRow());
        else if (type === "action") document.querySelector("#actionTable tbody").appendChild(actionRow());
        reindex(); recalc(); scheduleSave();
      });
    });

    document.getElementById("btnSave").addEventListener("click", function () { doSave(false); });
    document.getElementById("btnLoad").addEventListener("click", doLoad);
    document.getElementById("btnExport").addEventListener("click", exportFile);
    document.getElementById("btnImport").addEventListener("click", function () { document.getElementById("fileInput").click(); });
    document.getElementById("fileInput").addEventListener("change", function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
    document.getElementById("btnPrint").addEventListener("click", function () { window.print(); });
    document.getElementById("btnClear").addEventListener("click", function () {
      if (confirm("Clear all entered data? Export a backup first if you need to keep it.")) {
        localStorage.removeItem(STORAGE_KEY); location.reload();
      }
    });

    // auto-load previously saved data
    if (localStorage.getItem(STORAGE_KEY)) doLoad();
    recalc();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
