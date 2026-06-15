const request = require("supertest");
const app     = require("../server");

async function getToken(role = "admin") {
  const res = await request(app).post("/api/auth/register").send({
    name: `${role} user`, email: `${role}${Date.now()}@test.com`, password: "secret123", role,
  });
  return res.body.token;
}

const coursePayload = {
  name: "Algebra I", subject: "Mathematics", teacherName: "Mr. Jones",
  gradeLevel: 9, semester: "Fall", year: 2025, credits: 1,
};

describe("Courses — POST /api/courses", () => {
  it("admin can create a course", async () => {
    const token = await getToken("admin");
    const res = await request(app).post("/api/courses")
      .set("Authorization", `Bearer ${token}`)
      .send(coursePayload);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Algebra I");
  });

  it("teacher cannot create a course", async () => {
    const token = await getToken("teacher");
    const res = await request(app).post("/api/courses")
      .set("Authorization", `Bearer ${token}`)
      .send(coursePayload);
    expect(res.status).toBe(403);
  });

  it("rejects invalid semester", async () => {
    const token = await getToken("admin");
    const res = await request(app).post("/api/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...coursePayload, semester: "Summer" });
    expect(res.status).toBe(400);
  });
});

describe("Courses — GET /api/courses", () => {
  let token;

  beforeEach(async () => {
    token = await getToken("admin");
    await request(app).post("/api/courses").set("Authorization", `Bearer ${token}`).send(coursePayload);
  });

  it("returns paginated list with enrollmentCount", async () => {
    const res = await request(app).get("/api/courses").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty("enrollmentCount");
    expect(res.body.total).toBe(1);
  });

  it("unauthenticated request is rejected", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(401);
  });
});

describe("Courses — DELETE /api/courses/:id", () => {
  it("soft-deletes a course", async () => {
    const token = await getToken("admin");
    const created = await request(app).post("/api/courses").set("Authorization", `Bearer ${token}`).send(coursePayload);
    const id = created.body._id;
    const del = await request(app).delete(`/api/courses/${id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.message).toMatch(/deactivated/i);

    const list = await request(app).get("/api/courses").set("Authorization", `Bearer ${token}`);
    expect(list.body.data.find((c) => c._id === id)).toBeUndefined();
  });
});
