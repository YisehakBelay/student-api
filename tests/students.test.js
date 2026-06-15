const request = require("supertest");
const app     = require("../server");

async function getToken(role = "admin") {
  const res = await request(app).post("/api/auth/register").send({
    name: `${role} user`, email: `${role}${Date.now()}@test.com`, password: "secret123", role,
  });
  return res.body.token;
}

const studentPayload = { name: "Alice Smith", email: "alice@school.com", gradeLevel: 10 };

describe("Students — POST /api/students", () => {
  it("admin can create a student", async () => {
    const token = await getToken("admin");
    const res = await request(app).post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send(studentPayload);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Alice Smith");
    expect(res.body.studentId).toMatch(/^STU/);
  });

  it("teacher cannot create a student", async () => {
    const token = await getToken("teacher");
    const res = await request(app).post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send(studentPayload);
    expect(res.status).toBe(403);
  });

  it("rejects invalid grade level", async () => {
    const token = await getToken("admin");
    const res = await request(app).post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...studentPayload, gradeLevel: 8 });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email", async () => {
    const token = await getToken("admin");
    await request(app).post("/api/students").set("Authorization", `Bearer ${token}`).send(studentPayload);
    const res = await request(app).post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send(studentPayload);
    expect(res.status).toBe(400);
  });
});

describe("Students — GET /api/students", () => {
  let adminToken, teacherToken;

  beforeEach(async () => {
    adminToken   = await getToken("admin");
    teacherToken = await getToken("teacher");
    await request(app).post("/api/students").set("Authorization", `Bearer ${adminToken}`).send(studentPayload);
  });

  it("admin can list students", async () => {
    const res = await request(app).get("/api/students").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it("teacher can list students", async () => {
    const res = await request(app).get("/api/students").set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
  });

  it("student role cannot list all students", async () => {
    const token = await getToken("student");
    const res = await request(app).get("/api/students").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("respects pagination params", async () => {
    const res = await request(app).get("/api/students?page=1&limit=10").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("pages");
  });
});

describe("Students — PUT /api/students/:id", () => {
  it("admin can update a student", async () => {
    const token = await getToken("admin");
    const created = await request(app).post("/api/students").set("Authorization", `Bearer ${token}`).send(studentPayload);
    const id = created.body._id;
    const res = await request(app).put(`/api/students/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...studentPayload, name: "Alice Updated" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice Updated");
  });
});

describe("Students — DELETE /api/students/:id", () => {
  it("soft-deletes a student by default", async () => {
    const token = await getToken("admin");
    const created = await request(app).post("/api/students").set("Authorization", `Bearer ${token}`).send(studentPayload);
    const id = created.body._id;
    const del = await request(app).delete(`/api/students/${id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.message).toMatch(/deactivated/i);

    // Soft-deleted student should not appear in list
    const list = await request(app).get("/api/students").set("Authorization", `Bearer ${token}`);
    expect(list.body.data.find((s) => s._id === id)).toBeUndefined();
  });
});
