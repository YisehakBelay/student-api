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
    name: "Dana", email: `dana${Date.now()}@school.com`, gradeLevel: 12,
  });
  return res.body._id;
}

describe("Fees", () => {
  let token, studentId;

  beforeEach(async () => {
    token     = await getToken("admin");
    studentId = await createStudent(token);
  });

  it("admin can create a fee", async () => {
    const res = await request(app).post("/api/fees")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Tuition Fall 2025", totalAmount: 1500, category: "tuition" });
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(1500);
    expect(res.body.paidAmount).toBe(0);
  });

  it("rejects negative totalAmount", async () => {
    const res = await request(app).post("/api/fees")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Bad fee", totalAmount: -50 });
    expect(res.status).toBe(400);
  });

  it("records a payment and updates paidAmount", async () => {
    const created = await request(app).post("/api/fees")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Lab fee", totalAmount: 200 });
    const feeId = created.body._id;

    const res = await request(app).put(`/api/fees/${feeId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, note: "First payment" });
    expect(res.status).toBe(200);
    expect(res.body.paidAmount).toBe(100);
    expect(res.body.payments).toHaveLength(1);
  });

  it("rejects overpayment", async () => {
    const created = await request(app).post("/api/fees")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Sports fee", totalAmount: 100 });
    const res = await request(app).put(`/api/fees/${created.body._id}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 150 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds/i);
  });

  it("deletes a payment and recalculates paidAmount", async () => {
    const created = await request(app).post("/api/fees")
      .set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Library fee", totalAmount: 50 });
    const feeId = created.body._id;

    const paid = await request(app).put(`/api/fees/${feeId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 25 });
    const paymentId = paid.body.payments[0]._id;

    const res = await request(app).delete(`/api/fees/${feeId}/payment/${paymentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.paidAmount).toBe(0);
    expect(res.body.payments).toHaveLength(0);
  });

  it("returns fee summary", async () => {
    await request(app).post("/api/fees").set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Fee A", totalAmount: 300 });
    await request(app).post("/api/fees").set("Authorization", `Bearer ${token}`)
      .send({ student: studentId, description: "Fee B", totalAmount: 200 });

    const res = await request(app).get(`/api/fees/summary?student=${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalBilled).toBe(500);
    expect(res.body.outstanding).toBe(500);
    expect(res.body.unpaidCount).toBe(2);
  });
});
