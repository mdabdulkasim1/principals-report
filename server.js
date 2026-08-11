"use strict";
/**
 * Monthly Principal Academic Report — portal server.
 * Zero external dependencies: Node built-in http/fs/crypto only.
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
const { seedIfEmpty } = require("./lib/seed");

const PORT = process.env.PORT || 3000;
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
function currentUser(req) {
  const s = auth.getSession(auth.tokenFromReq(req));
  if (!s) return null;
  const data = db.load();
  return data.users.find((u) => u.id === s.userId) || null;
}
function publicUser(u) {
  return u && { id: u.id, username: u.username, name: u.name, role: u.role, schoolId: u.schoolId, mustChangePassword: !!u.mustChangePassword };
}
function schoolName(data, id) {
  const s = data.schools.find((x) => x.id === id);
  return s ? s.name : "Unknown";
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
      // SPA fallback: serve index.html for unknown non-asset routes
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
  const data = db.load();
  const method = req.method;
  const seg = pathname.replace(/^\/api\//, "").split("/").filter(Boolean); // e.g. ['reports','<id>','submit']

  /* ---- Auth: login / logout / me (no session required) ---- */
  if (seg[0] === "login" && method === "POST") {
    const body = await readBody(req);
    const user = data.users.find((u) => u.username.toLowerCase() === String(body.username || "").toLowerCase());
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

  /* ---- Everything below requires a session ---- */
  const me = currentUser(req);
  if (!me) return sendError(res, 401, "Not authenticated");
  const isAdmin = me.role === "admin";

  if (seg[0] === "me" && method === "GET") {
    return send(res, 200, { user: publicUser(me) });
  }

  if (seg[0] === "change-password" && method === "POST") {
    const body = await readBody(req);
    if (!auth.verifyPassword(body.current, me.passHash)) return sendError(res, 400, "Current password is incorrect");
    if (!body.next || String(body.next).length < 6) return sendError(res, 400, "New password must be at least 6 characters");
    me.passHash = auth.hashPassword(body.next);
    me.mustChangePassword = false;
    await db.save();
    return send(res, 200, { ok: true });
  }

  /* ---- Schools ---- */
  if (seg[0] === "schools") {
    if (method === "GET") {
      const list = isAdmin ? data.schools : data.schools.filter((s) => s.id === me.schoolId);
      return send(res, 200, { schools: list });
    }
    if (method === "POST" && isAdmin) {
      const body = await readBody(req);
      if (!body.name) return sendError(res, 400, "School name required");
      const school = { id: db.id(), name: body.name, place: body.place || "" };
      data.schools.push(school);
      await db.save();
      return send(res, 201, { school });
    }
    if (seg[1] && method === "PUT" && isAdmin) {
      const body = await readBody(req);
      const school = data.schools.find((s) => s.id === seg[1]);
      if (!school) return sendError(res, 404, "School not found");
      if (body.name != null) school.name = body.name;
      if (body.place != null) school.place = body.place;
      await db.save();
      return send(res, 200, { school });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Users (admin only) ---- */
  if (seg[0] === "users") {
    if (!isAdmin) return sendError(res, 403, "Admin only");
    if (method === "GET") {
      return send(res, 200, {
        users: data.users.map((u) => ({
          id: u.id, username: u.username, name: u.name, role: u.role,
          schoolId: u.schoolId, active: u.active !== false,
          schoolName: u.schoolId ? schoolName(data, u.schoolId) : null,
        })),
      });
    }
    if (method === "POST" && !seg[1]) {
      const body = await readBody(req);
      if (!body.username || !body.password) return sendError(res, 400, "Username and password required");
      if (data.users.some((u) => u.username.toLowerCase() === String(body.username).toLowerCase()))
        return sendError(res, 409, "Username already exists");
      const user = {
        id: db.id(),
        username: body.username,
        name: body.name || body.username,
        role: body.role === "admin" ? "admin" : "principal",
        schoolId: body.role === "admin" ? null : body.schoolId || null,
        passHash: auth.hashPassword(body.password),
        mustChangePassword: true,
        active: true,
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      await db.save();
      return send(res, 201, { user: publicUser(user) });
    }
    if (seg[1] && seg[2] === "reset-password" && method === "POST") {
      const body = await readBody(req);
      const user = data.users.find((u) => u.id === seg[1]);
      if (!user) return sendError(res, 404, "User not found");
      if (!body.password || String(body.password).length < 6) return sendError(res, 400, "Password must be at least 6 characters");
      user.passHash = auth.hashPassword(body.password);
      user.mustChangePassword = true;
      await db.save();
      return send(res, 200, { ok: true });
    }
    if (seg[1] && method === "PUT") {
      const body = await readBody(req);
      const user = data.users.find((u) => u.id === seg[1]);
      if (!user) return sendError(res, 404, "User not found");
      if (body.name != null) user.name = body.name;
      if (body.schoolId != null && user.role === "principal") user.schoolId = body.schoolId;
      if (body.active != null) user.active = !!body.active;
      await db.save();
      return send(res, 200, { ok: true });
    }
    if (seg[1] && method === "DELETE") {
      if (seg[1] === me.id) return sendError(res, 400, "You cannot delete your own account");
      const idx = data.users.findIndex((u) => u.id === seg[1]);
      if (idx === -1) return sendError(res, 404, "User not found");
      data.users.splice(idx, 1);
      await db.save();
      return send(res, 200, { ok: true });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Reports ---- */
  if (seg[0] === "reports") {
    // List
    if (!seg[1] && method === "GET") {
      let list = data.reports.slice();
      if (!isAdmin) list = list.filter((r) => r.schoolId === me.schoolId);
      if (query.school) list = list.filter((r) => r.schoolId === query.school);
      if (query.month) list = list.filter((r) => r.month === query.month);
      if (query.status) list = list.filter((r) => r.status === query.status);
      list.sort((a, b) => (b.month || "").localeCompare(a.month || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      return send(res, 200, {
        reports: list.map((r) => summaryOf(data, r)),
      });
    }
    // Create
    if (!seg[1] && method === "POST") {
      const body = await readBody(req);
      const schoolId = isAdmin ? body.schoolId : me.schoolId;
      if (!schoolId) return sendError(res, 400, "School is required");
      if (!isAdmin && schoolId !== me.schoolId) return sendError(res, 403, "You can only create reports for your own school");
      if (!body.month) return sendError(res, 400, "Month is required");
      if (data.reports.some((r) => r.schoolId === schoolId && r.month === body.month))
        return sendError(res, 409, "A report for this school and month already exists");
      const now = new Date().toISOString();
      const report = {
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
      };
      data.reports.push(report);
      await db.save();
      return send(res, 201, { report });
    }
    // Single report ops
    const report = data.reports.find((r) => r.id === seg[1]);
    if (seg[1] && !report) return sendError(res, 404, "Report not found");
    if (report && !isAdmin && report.schoolId !== me.schoolId) return sendError(res, 403, "Forbidden");

    if (seg[1] && !seg[2] && method === "GET") {
      return send(res, 200, { report: Object.assign({ schoolName: schoolName(data, report.schoolId) }, report) });
    }
    if (seg[1] && !seg[2] && method === "PUT") {
      const body = await readBody(req);
      if (!isAdmin) {
        if (report.status === "reviewed") return sendError(res, 403, "This report has been reviewed and is locked");
        if (body.data) report.data = body.data;
        if (body.academicYear != null) report.academicYear = body.academicYear;
        report.kpis = computeKpis(report.data);
        report.updatedAt = new Date().toISOString();
        if (report.status === "submitted") report.status = "submitted"; // stays; principal editing a submitted report keeps it submitted
      } else {
        // Admin may edit data too if needed
        if (body.data) { report.data = body.data; report.kpis = computeKpis(report.data); }
        if (body.academicYear != null) report.academicYear = body.academicYear;
        report.updatedAt = new Date().toISOString();
      }
      await db.save();
      return send(res, 200, { report });
    }
    if (seg[1] && seg[2] === "submit" && method === "POST") {
      if (!isAdmin && report.schoolId !== me.schoolId) return sendError(res, 403, "Forbidden");
      report.status = "submitted";
      report.submittedAt = new Date().toISOString();
      report.updatedAt = report.submittedAt;
      report.kpis = computeKpis(report.data);
      await db.save();
      return send(res, 200, { report });
    }
    if (seg[1] && seg[2] === "review" && method === "POST") {
      if (!isAdmin) return sendError(res, 403, "Admin only");
      const body = await readBody(req);
      report.chairmanRemarks = body.remarks || "";
      report.status = body.status === "returned" ? "returned" : "reviewed";
      report.reviewedAt = new Date().toISOString();
      report.updatedAt = report.reviewedAt;
      await db.save();
      return send(res, 200, { report });
    }
    if (seg[1] && !seg[2] && method === "DELETE") {
      if (!isAdmin && report.status !== "draft") return sendError(res, 403, "Only draft reports can be deleted");
      const idx = data.reports.findIndex((r) => r.id === seg[1]);
      data.reports.splice(idx, 1);
      await db.save();
      return send(res, 200, { ok: true });
    }
    return sendError(res, 405, "Method not allowed");
  }

  /* ---- Dashboard ---- */
  if (seg[0] === "dashboard" && method === "GET") {
    return send(res, 200, buildDashboard(data, me));
  }

  return sendError(res, 404, "Unknown API endpoint");
}

function summaryOf(data, r) {
  return {
    id: r.id,
    schoolId: r.schoolId,
    schoolName: schoolName(data, r.schoolId),
    month: r.month,
    academicYear: r.academicYear,
    status: r.status,
    kpis: r.kpis,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    updatedAt: r.updatedAt,
    chairmanRemarks: r.chairmanRemarks,
  };
}

function buildDashboard(data, me) {
  const isAdmin = me.role === "admin";
  const schools = isAdmin ? data.schools : data.schools.filter((s) => s.id === me.schoolId);
  let reports = data.reports.filter((r) => r.status !== "draft");
  if (!isAdmin) reports = reports.filter((r) => r.schoolId === me.schoolId);

  const months = Array.from(new Set(reports.map((r) => r.month))).sort();
  const latestMonth = months.length ? months[months.length - 1] : null;

  // Per-school latest snapshot
  const schoolCards = schools.map((s) => {
    const srep = reports.filter((r) => r.schoolId === s.id).sort((a, b) => a.month.localeCompare(b.month));
    const latest = srep.length ? srep[srep.length - 1] : null;
    const prev = srep.length > 1 ? srep[srep.length - 2] : null;
    const trend =
      latest && prev && latest.kpis.overallAvg != null && prev.kpis.overallAvg != null
        ? Math.round((latest.kpis.overallAvg - prev.kpis.overallAvg) * 10) / 10
        : null;
    return {
      schoolId: s.id,
      name: s.name,
      place: s.place,
      latestMonth: latest ? latest.month : null,
      latestReportId: latest ? latest.id : null,
      overallAvg: latest ? latest.kpis.overallAvg : null,
      attendance: latest ? latest.kpis.attendance : null,
      below40: latest ? latest.kpis.below40 : null,
      syllabusAvg: latest ? latest.kpis.syllabusAvg : null,
      bestGrade: latest ? latest.kpis.bestGrade : null,
      weakGrade: latest ? latest.kpis.weakGrade : null,
      bestTeacher: latest ? latest.kpis.bestTeacher : null,
      abacusClasses: latest ? latest.kpis.abacusClasses : null,
      abacusWell: latest ? latest.kpis.abacusWell : null,
      olympiadsRegistered: latest ? latest.kpis.olympiadsRegistered : null,
      olympiadsScheduled: latest ? latest.kpis.olympiadsScheduled : null,
      boardReadiness: latest ? latest.kpis.boardReadiness : null,
      trend,
      reportCount: srep.length,
    };
  });

  // Trend series: overallAvg per school over months
  const series = schools.map((s) => ({
    schoolId: s.id,
    name: s.name,
    points: months.map((m) => {
      const rep = reports.find((r) => r.schoolId === s.id && r.month === m);
      return { month: m, value: rep ? rep.kpis.overallAvg : null };
    }),
  }));

  // Submission matrix (admin): which school submitted which month
  const submissionMatrix = months.map((m) => ({
    month: m,
    schools: schools.map((s) => {
      const rep = reports.find((r) => r.schoolId === s.id && r.month === m);
      return { schoolId: s.id, status: rep ? rep.status : "missing" };
    }),
  }));

  // Recent reports (submitted, awaiting review first)
  const recent = reports
    .slice()
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
    .slice(0, 12)
    .map((r) => summaryOf(data, r));

  const pendingReview = reports.filter((r) => r.status === "submitted").length;

  return {
    role: me.role,
    months,
    latestMonth,
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
  const result = seedIfEmpty();
  if (result.seeded) {
    console.log("\n  First run — seeded database with default accounts:");
    console.log("  Chairman (admin):  chairman / Chairman@123");
    console.log("  Principal (AKB):   principal.akb / Principal@123");
    console.log("  Principal (2nd):   principal.school2 / Principal@123");
    console.log("  >> Change these passwords after first login.\n");
  }
  server.listen(PORT, () => {
    console.log(`  Principal Academic Report portal running on http://localhost:${PORT}\n`);
  });
}

module.exports = { server, buildDashboard };
