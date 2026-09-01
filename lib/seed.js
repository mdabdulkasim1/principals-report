"use strict";
/**
 * Seed initial schools + accounts if the database is empty.
 */
const db = require("./db");
const { hashPassword } = require("./auth");

const DEFAULTS = {
  admin: { username: "chairman", password: "Chairman@123", name: "Chairman" },
  schools: [
    {
      name: "AKB School of Excellence",
      place: "Cheranmahadevi",
      principal: { username: "principal.akb", password: "Principal@123", name: "Principal — AKB School" },
    },
    {
      name: "Second School (rename me)",
      place: "—",
      principal: { username: "principal.school2", password: "Principal@123", name: "Principal — Second School" },
    },
  ],
};

async function seedIfEmpty() {
  const users = await db.getUsers();
  if (users.length > 0) return { seeded: false };

  // Admin / Chairman
  await db.createUser({
    id: db.id(),
    username: DEFAULTS.admin.username,
    name: DEFAULTS.admin.name,
    role: "admin",
    schoolId: null,
    passHash: hashPassword(DEFAULTS.admin.password),
    mustChangePassword: true,
    active: true,
    createdAt: new Date().toISOString(),
  });

  for (const s of DEFAULTS.schools) {
    const schoolId = db.id();
    await db.createSchool({ id: schoolId, name: s.name, place: s.place });
    await db.createUser({
      id: db.id(),
      username: s.principal.username,
      name: s.principal.name,
      role: "principal",
      schoolId,
      passHash: hashPassword(s.principal.password),
      mustChangePassword: true,
      active: true,
      createdAt: new Date().toISOString(),
    });
  }

  return { seeded: true, defaults: DEFAULTS };
}

module.exports = { seedIfEmpty, DEFAULTS };
