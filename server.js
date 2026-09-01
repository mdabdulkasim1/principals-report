"use strict";
/**
 * Monthly Principal Academic Report — portal server.
 * All CRUD operations execute directly via async MySQL queries.
 *
 * Roles:
 *   admin      = Chairman  — sees all schools, dashboard, reviews reports, manages users
 *   principal  = one per school — creates / edits / submits that school's reports
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const db = require("./lib/db");
const auth = require("./lib/auth");
const { computeKpis } = require("./lib/kpi");
const { buildXlsx } = require("./lib/xlsx");
const { reportToSheets, dashboardToSheets, usersToSheets } = require("./lib/report-export");

const PORT = process.env.PORT || 3022;
const PUBLIC_DIR = path.join(__dirname, "public");

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function send(res, status, body, headers) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers || {}));
  res.end(payload);
}
function sendError(res, status, message) {
  send(res, status, { error: message });
}
function sendBinary(res, buf, filename) {
  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buf.length,
  });
  res.end(buf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) { reject(new Error("Payload too large")); req.destroy(); return; }
      data += c;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
async function currentUser(req) {
  const s = auth.getSession(auth.tokenFromReq(req));
  if (!s) return null;
  return await db.getUserById(s.userId);
}
function publicUser(u) {
  return u && { id: u.id, username: u.username, name: u.name, role: u.role, schoolId: u.schoolId, mustChangePassword: !!u.mustChangePassword };
}

/* ------------------------------------------------------------------ */
/* Static file serving                                                */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};
function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendError(res, 403, "Forbidden");
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      if (!path.extname(rel)) {
        return fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, idx) => {
          if (e2) return sendError(res, 404, "Not found");
          res.writeHead(200, { "Content-Type": MIME[".html"] });
          res.end(idx);
        });
      }
      return sendError(res, 404, "Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}

/* ------------------------------------------------------------------ */
/* API                                                                */
/* ------------------------------------------------------------------ */
async function handleApi(req, res, pathname, query) {
  const method = req.method;
  const seg = pathname.replace(/^\/api\//, "").split("/").filter(Boolean); // e.g. ['reports','<id>','submit']

  /* ---- Auth: login / logout / me ---- */
  if (seg[0] === "login" && method === "POST") {
    const body = await readBody(req);
    const user = await db.getUserByUsername(body.username || "");
    if (!user || !auth.verifyPassword(body.password, user.passHash)) return sendError(res, 401, "Invalid username or password");
    if (user.active === false) return sendError(res, 403, "Account disabled");
    const token = auth.createSession(user.id);
    auth.setSessionCookie(res, token);
    return send(res, 200, { user: publicUser(user) });
  }
  if (seg[0] === "logout" && method === "POST") {
    auth.destroySession(auth.tokenFromReq(req));
    auth.clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  /* ---- Require session ---- */
  const me = await currentUser(req);
  if (!me) return sendError(res, 401, "Not authenticated");
  const isAdmin = me.role === "admin";

  if (seg[0] === "me" && method === "GET") {
    return send(res, 200, { user: publicUser(me) });
  }

  if (seg[0] === "change-password" && method === "POST") {
    const body = await readBody(req);
    if (!auth.verifyPassword(body.current, me.passHash)) return sendError(res, 400, "Current password is incorrect");
    if (!body.next || String(body.next).length < 6) return sendError(res, 400, "New password must be at least 6 characters");
    const newHash = auth.hashPassword(body.next);
    await db.updateUser(me.id, { passHash: newHash, mustChangePassword: false });
    return send(res, 200, { ok: true });
  }

  /* ---- Schools ---- */
  if (seg[0] === "schools") {
    if (method === "GET") {
      const allSchools = await db.getSchools();
      const list = isAdmin ? allSchools : allSchools.filter((s) => s.id === me.schoolId);
      return send(res, 200, { schools: list });
    }
    if (method === "POST" && isAdmin) {
      const body = await readBody(req);
      if (!body.name) return sendError(res, 400, "School name required");
      const school = await db.createSchool({ id: db.id(), name: body.name, place: body.place || "" });
      return send(res, 201, { school });
    }
    if (seg[1] && method === "PUT" && isAdmin) {
      const body = await readBody(req);
      const school = await db.getSchoolById(seg[1]);
      if (!school) return sendError(res, 404, "School not found");
      const updated = await db.updateSchool(seg[1], { name: body.name, place: body.place });
      return send(res, 200, { school: updated });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Users (admin only) ---- */
  if (seg[0] === "users") {
    if (!isAdmin) return sendError(res, 403, "Admin only");
    const allSchools = await db.getSchools();
    const schoolMap = new Map(allSchools.map((s) => [s.id, s.name]));

    if (method === "GET") {
      const users = await db.getUsers();
      return send(res, 200, {
        users: users.map((u) => ({
          id: u.id, username: u.username, name: u.name, role: u.role,
          schoolId: u.schoolId, active: u.active !== false,
          schoolName: u.schoolId ? schoolMap.get(u.schoolId) || null : null,
        })),
      });
    }
    if (method === "POST" && !seg[1]) {
      const body = await readBody(req);
      if (!body.username || !body.password) return sendError(res, 400, "Username and password required");
      const existing = await db.getUserByUsername(body.username);
      if (existing) return sendError(res, 409, "Username already exists");
      const user = await db.createUser({
        id: db.id(),
        username: body.username,
        name: body.name || body.username,
        role: body.role === "admin" ? "admin" : "principal",
        schoolId: body.role === "admin" ? null : body.schoolId || null,
        passHash: auth.hashPassword(body.password),
        mustChangePassword: true,
        active: true,
        createdAt: new Date().toISOString(),
      });
      return send(res, 201, { user: publicUser(user) });
    }
    if (seg[1] && seg[2] === "reset-password" && method === "POST") {
      const body = await readBody(req);
      const user = await db.getUserById(seg[1]);
      if (!user) return sendError(res, 404, "User not found");
      if (!body.password || String(body.password).length < 6) return sendError(res, 400, "Password must be at least 6 characters");
      await db.updateUser(seg[1], { passHash: auth.hashPassword(body.password), mustChangePassword: true });
      return send(res, 200, { ok: true });
    }
    if (seg[1] && method === "PUT") {
      const body = await readBody(req);
      const user = await db.getUserById(seg[1]);
      if (!user) return sendError(res, 404, "User not found");
      await db.updateUser(seg[1], {
        name: body.name,
        schoolId: user.role === "principal" ? body.schoolId : null,
        active: body.active,
      });
      return send(res, 200, { ok: true });
    }
    if (seg[1] && method === "DELETE") {
      if (seg[1] === me.id) return sendError(res, 400, "You cannot delete your own account");
      const deleted = await db.deleteUser(seg[1]);
      if (!deleted) return sendError(res, 404, "User not found");
      return send(res, 200, { ok: true });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Reports ---- */
  if (seg[0] === "reports") {
    const allSchools = await db.getSchools();
    const schoolMap = new Map(allSchools.map((s) => [s.id, s.name]));

    // List
    if (!seg[1] && method === "GET") {
      let list = await db.getReports();
      if (!isAdmin) list = list.filter((r) => r.schoolId === me.schoolId);
      if (query.school) list = list.filter((r) => r.schoolId === query.school);
      if (query.month) list = list.filter((r) => r.month === query.month);
      if (query.status) list = list.filter((r) => r.status === query.status);
      list.sort((a, b) => (b.month || "").localeCompare(a.month || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      return send(res, 200, {
        reports: list.map((r) => ({
          id: r.id,
          schoolId: r.schoolId,
          schoolName: schoolMap.get(r.schoolId) || "Unknown",
          month: r.month,
          academicYear: r.academicYear,
          status: r.status,
          kpis: r.kpis,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt,
          updatedAt: r.updatedAt,
          chairmanRemarks: r.chairmanRemarks,
        })),
      });
    }
    // Create
    if (!seg[1] && method === "POST") {
      const body = await readBody(req);
      const schoolId = isAdmin ? body.schoolId : me.schoolId;
      if (!schoolId) return sendError(res, 400, "School is required");
      if (!isAdmin && schoolId !== me.schoolId) return sendError(res, 403, "You can only create reports for your own school");
      if (!body.month) return sendError(res, 400, "Month is required");
      const existing = await db.getReportBySchoolAndMonth(schoolId, body.month);
      if (existing) return sendError(res, 409, "A report for this school and month already exists");
      const now = new Date().toISOString();
      const report = await db.createReport({
        id: db.id(),
        schoolId,
        month: body.month,
        academicYear: body.academicYear || "",
        status: "draft",
        data: body.data || { fields: {}, teachers: [], bestTeachers: [], actions: [] },
        kpis: computeKpis(body.data || {}),
        chairmanRemarks: "",
        createdBy: me.id,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        reviewedAt: null,
      });
      return send(res, 201, { report });
    }

    // Single report ops
    const report = seg[1] ? await db.getReportById(seg[1]) : null;
    if (seg[1] && !report) return sendError(res, 404, "Report not found");
    if (report && !isAdmin && report.schoolId !== me.schoolId) return sendError(res, 403, "Forbidden");

    if (seg[1] && !seg[2] && method === "GET") {
      return send(res, 200, { report: Object.assign({ schoolName: schoolMap.get(report.schoolId) || "Unknown" }, report) });
    }
    if (seg[1] && !seg[2] && method === "PUT") {
      const body = await readBody(req);
      let newFields = {};
      if (!isAdmin) {
        if (report.status === "reviewed") return sendError(res, 403, "This report has been reviewed and is locked");
        if (body.data) newFields.data = body.data;
        if (body.academicYear != null) newFields.academicYear = body.academicYear;
        newFields.kpis = computeKpis(body.data || report.data);
        newFields.updatedAt = new Date().toISOString();
      } else {
        if (body.data) { newFields.data = body.data; newFields.kpis = computeKpis(body.data); }
        if (body.academicYear != null) newFields.academicYear = body.academicYear;
        newFields.updatedAt = new Date().toISOString();
      }
      const updated = await db.updateReport(seg[1], newFields);
      return send(res, 200, { report: updated });
    }
    if (seg[1] && seg[2] === "submit" && method === "POST") {
      if (!isAdmin && report.schoolId !== me.schoolId) return sendError(res, 403, "Forbidden");
      const now = new Date().toISOString();
      const updated = await db.updateReport(seg[1], {
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
        kpis: computeKpis(report.data),
      });
      return send(res, 200, { report: updated });
    }
    if (seg[1] && seg[2] === "review" && method === "POST") {
      if (!isAdmin) return sendError(res, 403, "Admin only");
      const body = await readBody(req);
      const now = new Date().toISOString();
      const updated = await db.updateReport(seg[1], {
        chairmanRemarks: body.remarks || "",
        status: body.status === "returned" ? "returned" : "reviewed",
        reviewedAt: now,
        updatedAt: now,
      });
      return send(res, 200, { report: updated });
    }
    if (seg[1] && !seg[2] && method === "DELETE") {
      if (!isAdmin && report.status !== "draft") return sendError(res, 403, "Only draft reports can be deleted");
      await db.deleteReport(seg[1]);
      return send(res, 200, { ok: true });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Dashboard ---- */
  if (seg[0] === "dashboard" && method === "GET") {
    const dash = await buildDashboard(me, query.month);
    return send(res, 200, dash);
  }

  /* ---- Excel exports ---- */
  if (seg[0] === "export" && method === "GET") {
    if (seg[1] === "dashboard") {
      const dash = await buildDashboard(me, query.month);
      const wb = buildXlsx(dashboardToSheets(dash, dash.selectedMonth));
      return sendBinary(res, wb, `dashboard-${dash.selectedMonth || "latest"}.xlsx`);
    }
    if (seg[1] === "report" && seg[2]) {
      const report = await db.getReportById(seg[2]);
      if (!report) return sendError(res, 404, "Report not found");
      if (!isAdmin && report.schoolId !== me.schoolId) return sendError(res, 403, "Forbidden");
      const s = await db.getSchoolById(report.schoolId);
      const sName = s ? s.name : "Unknown";
      const wb = buildXlsx(reportToSheets(report, sName));
      return sendBinary(res, wb, `report-${sName.replace(/[^\w]+/g, "_")}-${report.month}.xlsx`);
    }
    if (seg[1] === "users") {
      if (!isAdmin) return sendError(res, 403, "Admin only");
      const allUsers = await db.getUsers();
      const allSchools = await db.getSchools();
      const schoolMap = new Map(allSchools.map((s) => [s.id, s.name]));
      const usersList = allUsers.map((u) => ({
        name: u.name,
        username: u.username,
        role: u.role,
        active: u.active !== false,
        schoolName: u.schoolId ? schoolMap.get(u.schoolId) || null : null,
      }));
      const wb = buildXlsx(usersToSheets(usersList));
      return sendBinary(res, wb, "users.xlsx");
    }
    return sendError(res, 404, "Unknown export");
  }

  return sendError(res, 404, "Unknown API endpoint");
}

async function buildDashboard(me, wantMonth) {
  const isAdmin = me.role === "admin";
  const allSchools = await db.getSchools();
  const schools = isAdmin ? allSchools : allSchools.filter((s) => s.id === me.schoolId);

  let allReports = await db.getReports();
  let reports = allReports.filter((r) => r.status !== "draft");
  if (!isAdmin) reports = reports.filter((r) => r.schoolId === me.schoolId);

  const months = Array.from(new Set(reports.map((r) => r.month))).sort();
  const latestMonth = months.length ? months[months.length - 1] : null;
  const selectedMonth = wantMonth && months.indexOf(wantMonth) > -1 ? wantMonth : latestMonth;
  const selIdx = months.indexOf(selectedMonth);
  const prevMonth = selIdx > 0 ? months[selIdx - 1] : null;

  const repOf = (schoolId, month) => (month ? reports.find((r) => r.schoolId === schoolId && r.month === month) : null);

  const schoolCards = schools.map((s) => {
    const srep = reports.filter((r) => r.schoolId === s.id).sort((a, b) => a.month.localeCompare(b.month));
    const sel = repOf(s.id, selectedMonth) || (srep.length ? srep[srep.length - 1] : null);
    const cmpMonth = sel ? sel.month : selectedMonth;
    const cmpIdx = months.indexOf(cmpMonth);
    const prev = cmpIdx > 0 ? repOf(s.id, months[cmpIdx - 1]) : null;
    const kp = sel ? sel.kpis : {};
    const trend =
      sel && prev && kp.overallAvg != null && prev.kpis.overallAvg != null
        ? Math.round((kp.overallAvg - prev.kpis.overallAvg) * 10) / 10
        : null;
    return {
      schoolId: s.id,
      name: s.name,
      place: s.place,
      latestMonth: sel ? sel.month : null,
      latestReportId: sel ? sel.id : null,
      overallAvg: sel ? kp.overallAvg : null,
      attendance: sel ? kp.attendance : null,
      below40: sel ? kp.below40 : null,
      syllabusAvg: sel ? kp.syllabusAvg : null,
      bestGrade: sel ? kp.bestGrade : null,
      weakGrade: sel ? kp.weakGrade : null,
      bestTeacher: sel ? kp.bestTeacher : null,
      abacusClasses: sel ? kp.abacusClasses : null,
      abacusWell: sel ? kp.abacusWell : null,
      olympiadsRegistered: sel ? kp.olympiadsRegistered : null,
      olympiadsScheduled: sel ? kp.olympiadsScheduled : null,
      boardReadiness: sel ? kp.boardReadiness : null,
      trend,
      reportCount: srep.length,
    };
  });

  const emptyK = {};
  const comparison = schools.map((s) => {
    const cur = repOf(s.id, selectedMonth);
    const prev = repOf(s.id, prevMonth);
    return {
      schoolId: s.id,
      name: s.name,
      current: cur ? cur.kpis : emptyK,
      previous: prev ? prev.kpis : emptyK,
      hasCurrent: !!cur,
      hasPrevious: !!prev,
    };
  });

  const series = schools.map((s) => ({
    schoolId: s.id,
    name: s.name,
    points: months.map((m) => {
      const rep = reports.find((r) => r.schoolId === s.id && r.month === m);
      return { month: m, value: rep ? rep.kpis.overallAvg : null };
    }),
  }));

  const submissionMatrix = months.map((m) => ({
    month: m,
    schools: schools.map((s) => {
      const rep = reports.find((r) => r.schoolId === s.id && r.month === m);
      return { schoolId: s.id, status: rep ? rep.status : "missing" };
    }),
  }));

  const schoolMap = new Map(allSchools.map((s) => [s.id, s.name]));
  const recent = reports
    .slice()
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      schoolId: r.schoolId,
      schoolName: schoolMap.get(r.schoolId) || "Unknown",
      month: r.month,
      academicYear: r.academicYear,
      status: r.status,
      kpis: r.kpis,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      updatedAt: r.updatedAt,
      chairmanRemarks: r.chairmanRemarks,
    }));

  const pendingReview = reports.filter((r) => r.status === "submitted").length;

  return {
    role: me.role,
    months,
    latestMonth,
    selectedMonth,
    prevMonth,
    comparison,
    schoolCards,
    series,
    submissionMatrix,
    recent,
    pendingReview,
    totals: {
      schools: schools.length,
      reports: reports.length,
      avgAcrossSchools: (() => {
        const vals = schoolCards.map((c) => c.overallAvg).filter((v) => v != null);
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      })(),
      studentsBelow40: schoolCards.reduce((s, c) => s + (c.below40 || 0), 0),
      abacusClasses: schoolCards.reduce((s, c) => s + (c.abacusClasses || 0), 0),
      abacusWell: schoolCards.reduce((s, c) => s + (c.abacusWell || 0), 0),
      olympiadsScheduled: schoolCards.reduce((s, c) => s + (c.olympiadsScheduled || 0), 0),
      boardRisk: schoolCards.filter((c) => c.boardReadiness === "High Risk").length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname, parsed.query);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (err) {
    if (!res.headersSent) sendError(res, err.message === "Invalid JSON" ? 400 : 500, err.message || "Server error");
  }
});

if (require.main === module) {
  db.init()
    .then((result) => {
      if (result && result.seeded) {
        console.log("\n  First run — seeded database with default accounts:");
        console.log("  Chairman (admin):  chairman / Chairman@123");
        console.log("  Principal (AKB):   principal.akb / Principal@123");
        console.log("  Principal (2nd):   principal.school2 / Principal@123");
        console.log("  >> Change these passwords after first login.\n");
      }
      server.listen(PORT, () => {
        console.log(`  Principal Academic Report portal running on http://localhost:${PORT}\n`);
      });
    })
    .catch((err) => {
      console.error("  Failed to initialize MySQL database:", err);
      process.exit(1);
    });
}

module.exports = { server, buildDashboard };
