const request = require("supertest");
const app     = require("../server");

describe("Auth — POST /api/auth/register", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Admin User", email: "admin@test.com", password: "secret123", role: "admin",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("admin");
  });

  it("rejects duplicate email", async () => {
    const body = { name: "A", email: "dup@test.com", password: "secret123" };
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it("rejects missing name", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "x@test.com", password: "secret123" });
    expect(res.status).toBe(400);
  });

  it("rejects password shorter than 6 chars", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "A", email: "b@test.com", password: "123" });
    expect(res.status).toBe(400);
  });
});

describe("Auth — POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User", email: "login@test.com", password: "secret123",
    });
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "login@test.com", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "login@test.com", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("rejects unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.com", password: "secret123" });
    expect(res.status).toBe(401);
  });
});

describe("Auth — GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Me User", email: "me@test.com", password: "secret123", role: "teacher",
    });
    token = res.body.token;
  });

  it("returns own profile with valid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("me@test.com");
    expect(res.body.role).toBe("teacher");
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(401);
  });
});
