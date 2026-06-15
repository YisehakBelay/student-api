const request = require("supertest");
const app     = require("../server");

async function getToken(role = "admin") {
  const res = await request(app).post("/api/auth/register").send({
    name: `${role} user`, email: `${role}${Date.now()}@test.com`, password: "secret123", role,
  });
  return res.body.token;
}

async function createStudent(token) {
  const res = await request(app).post("/api/students").set("Authorization", `Bearer ${token}`).send({
    name: "Bob", email: `bob${Date.now()}@school.com`, gradeLevel: 10,
  });
  return res.body._id;
}

async function createCourse(token) {
  const res = await request(app).post("/api/courses").set("Authorization", `Bearer ${token}`).send({
    name: "Physics", subject: "Science", teacherName: "Dr. Lee",
    gradeLevel: 10, semester: "Spring", year: 2025,
  });
  return res.body._id;
}

describe("Enrollments", () => {
  let token, studentId, courseId;

  beforeEach(async () => {
    token     = await getToken("admin");
    studentId = await createStudent(token);
    courseId  = await createCourse(token);
  });

  it("admin can enroll a student", async () => {
    const res = await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    expect(res.status).toBe(201);
    expect(res.body.student.name).toBe("Bob");
  });

  it("prevents duplicate enrollment", async () => {
    await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    const res = await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already enrolled/i);
  });

  it("teacher can submit a grade", async () => {
    const enrolled = await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    const enrollId = enrolled.body._id;

    const teacherToken = await getToken("teacher");
    const res = await request(app).put(`/api/enrollments/${enrollId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ grade: 87.5 });
    expect(res.status).toBe(200);
    expect(res.body.grade).toBe(87.5);
    expect(res.body.gradeSubmitted).toBe(true);
  });

  it("rejects grade outside 0–100", async () => {
    const enrolled = await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    const res = await request(app).put(`/api/enrollments/${enrolled.body._id}/grade`)
      .set("Authorization", `Bearer ${token}`)
      .send({ grade: 110 });
    expect(res.status).toBe(400);
  });

  it("admin can remove an enrollment", async () => {
    const enrolled = await request(app).post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId });
    const res = await request(app).delete(`/api/enrollments/${enrolled.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
