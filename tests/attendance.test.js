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
    name: "Carol", email: `carol${Date.now()}@school.com`, gradeLevel: 11,
  });
  return res.body._id;
}

async function createCourse(token) {
  const res = await request(app).post("/api/courses").set("Authorization", `Bearer ${token}`).send({
    name: "English", subject: "English", teacherName: "Ms. Park",
    gradeLevel: 11, semester: "Fall", year: 2025,
  });
  return res.body._id;
}

describe("Attendance", () => {
  let token, studentId, courseId;

  beforeEach(async () => {
    token     = await getToken("admin");
    studentId = await createStudent(token);
    courseId  = await createCourse(token);
  });

  it("creates an attendance record", async () => {
    const res = await request(app).post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId, date: "2025-09-01", status: "present" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("present");
  });

  it("upserts when same student/course/date submitted again", async () => {
    const body = { student: studentId, course: courseId, date: "2025-09-01", status: "present" };
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(body);
    const res = await request(app).post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, status: "absent" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("absent");

    // Should still be one record
    const list = await request(app).get(`/api/attendance?student=${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.total).toBe(1);
  });

  it("rejects invalid status", async () => {
    const res = await request(app).post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId, date: "2025-09-01", status: "tardy" });
    expect(res.status).toBe(400);
  });

  it("returns attendance summary for a student", async () => {
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId, date: "2025-09-01", status: "present" });
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, course: courseId, date: "2025-09-02", status: "absent" });

    const res = await request(app).get(`/api/attendance/summary/${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.present).toBe(1);
    expect(res.body.absent).toBe(1);
    expect(parseFloat(res.body.attendancePercent)).toBe(50.0);
  });

  it("bulk attendance saves all records", async () => {
    const student2 = await createStudent(token);
    const res = await request(app).post("/api/attendance/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        course: courseId,
        date: "2025-09-03",
        records: [
          { student: studentId, status: "present" },
          { student: student2,  status: "late" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
