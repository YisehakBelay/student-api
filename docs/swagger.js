const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "StudentHub API",
      version: "2.0.0",
      description: "REST API for managing students, courses, enrollments, attendance, and fees.",
    },
    servers: [{ url: "http://localhost:5000", description: "Local dev" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────────────────────────
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name:     { type: "string", example: "Jane Doe" },
            email:    { type: "string", format: "email", example: "jane@school.com" },
            password: { type: "string", minLength: 6, example: "secret123" },
            role:     { type: "string", enum: ["admin", "teacher", "student"], default: "student" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id:   { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                role: { type: "string", enum: ["admin", "teacher", "student"] },
              },
            },
          },
        },
        // ── Student ───────────────────────────────────────────────────────────
        StudentInput: {
          type: "object",
          required: ["name", "email", "gradeLevel"],
          properties: {
            name:       { type: "string", example: "Alice Smith" },
            email:      { type: "string", format: "email", example: "alice@school.com" },
            gradeLevel: { type: "integer", enum: [9, 10, 11, 12] },
            age:        { type: "integer", minimum: 0 },
          },
        },
        Student: {
          allOf: [
            { $ref: "#/components/schemas/StudentInput" },
            {
              type: "object",
              properties: {
                _id:       { type: "string" },
                studentId: { type: "string", example: "STU1234567890" },
                gpa:       { type: "number", nullable: true },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          ],
        },
        // ── Course ────────────────────────────────────────────────────────────
        CourseInput: {
          type: "object",
          required: ["name", "subject", "teacherName", "gradeLevel", "semester", "year"],
          properties: {
            name:        { type: "string", example: "Algebra I" },
            subject:     { type: "string", example: "Mathematics" },
            teacherName: { type: "string", example: "Mr. Jones" },
            gradeLevel:  { type: "integer", enum: [9, 10, 11, 12] },
            semester:    { type: "string", enum: ["Fall", "Spring"] },
            year:        { type: "integer", example: 2025 },
            period:      { type: "integer", minimum: 1, maximum: 8 },
            credits:     { type: "number", minimum: 0.5, maximum: 4, default: 1 },
            description: { type: "string" },
          },
        },
        // ── Paginated wrapper ─────────────────────────────────────────────────
        PaginatedResponse: {
          type: "object",
          properties: {
            data:  { type: "array", items: {} },
            total: { type: "integer" },
            page:  { type: "integer" },
            pages: { type: "integer" },
          },
        },
        // ── Error ─────────────────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth",        description: "Register, login, and profile management" },
      { name: "Students",    description: "Student CRUD and GPA" },
      { name: "Courses",     description: "Course CRUD" },
      { name: "Enrollments", description: "Enrollments and grade submission" },
      { name: "Attendance",  description: "Attendance tracking" },
      { name: "Fees",        description: "Fee and payment management" },
    ],
    paths: {
      // ── Auth ─────────────────────────────────────────────────────────────────
      "/api/auth/register": {
        post: {
          tags: ["Auth"], summary: "Register a new user", security: [],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            400: { description: "Validation error or duplicate email", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"], summary: "Login", security: [],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
          responses: {
            200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
            401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"], summary: "Get own profile",
          responses: {
            200: { description: "OK" },
            401: { description: "Unauthorized" },
          },
        },
        put: {
          tags: ["Auth"], summary: "Update own name or password",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, password: { type: "string", minLength: 6 } } } } } },
          responses: { 200: { description: "Updated" }, 400: { description: "Validation error" } },
        },
      },
      // ── Students ─────────────────────────────────────────────────────────────
      "/api/students": {
        get: {
          tags: ["Students"], summary: "List all students (paginated, with GPA)",
          parameters: [
            { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "Paginated student list" }, 401: { description: "Unauthorized" }, 403: { description: "Forbidden" } },
        },
        post: {
          tags: ["Students"], summary: "Create a student (admin only)",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentInput" } } } },
          responses: { 201: { description: "Created" }, 400: { description: "Validation error" }, 403: { description: "Forbidden" } },
        },
      },
      "/api/students/{id}": {
        get: {
          tags: ["Students"], summary: "Get a student",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
        },
        put: {
          tags: ["Students"], summary: "Update a student (admin only)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentInput" } } } },
          responses: { 200: { description: "Updated" }, 403: { description: "Forbidden" }, 404: { description: "Not found" } },
        },
        delete: {
          tags: ["Students"], summary: "Soft-delete a student (admin only). Add ?permanent=true for hard delete + cascade.",
          parameters: [
            { name: "id",        in: "path",  required: true, schema: { type: "string" } },
            { name: "permanent", in: "query", schema: { type: "boolean" } },
          ],
          responses: { 200: { description: "Deleted" }, 403: { description: "Forbidden" }, 404: { description: "Not found" } },
        },
      },
      "/api/students/{id}/courses": {
        get: {
          tags: ["Students"], summary: "Get enrolled courses for a student",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
        },
      },
      // ── Courses ───────────────────────────────────────────────────────────────
      "/api/courses": {
        get: {
          tags: ["Courses"], summary: "List all courses (paginated)",
          parameters: [
            { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "Paginated course list" } },
        },
        post: {
          tags: ["Courses"], summary: "Create a course (admin only)",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CourseInput" } } } },
          responses: { 201: { description: "Created" }, 403: { description: "Forbidden" } },
        },
      },
      "/api/courses/{id}": {
        get:    { tags: ["Courses"], summary: "Get a course", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 404: { description: "Not found" } } },
        put:    { tags: ["Courses"], summary: "Update a course (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CourseInput" } } } }, responses: { 200: { description: "Updated" } } },
        delete: { tags: ["Courses"], summary: "Soft-delete a course (admin only). ?permanent=true for hard delete.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "permanent", in: "query", schema: { type: "boolean" } }], responses: { 200: { description: "Deleted" } } },
      },
      "/api/courses/{id}/enrollments": {
        get: { tags: ["Courses"], summary: "Get all enrollments for a course (admin/teacher)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
      },
      // ── Enrollments ───────────────────────────────────────────────────────────
      "/api/enrollments": {
        get:  { tags: ["Enrollments"], summary: "List enrollments (?student=id&course=id)", parameters: [{ name: "student", in: "query", schema: { type: "string" } }, { name: "course", in: "query", schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
        post: { tags: ["Enrollments"], summary: "Enroll a student in a course (admin only)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["student", "course"], properties: { student: { type: "string" }, course: { type: "string" } } } } } }, responses: { 201: { description: "Enrolled" }, 400: { description: "Already enrolled" } } },
      },
      "/api/enrollments/{id}/grade": {
        put: { tags: ["Enrollments"], summary: "Submit or update a grade (admin/teacher)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["grade"], properties: { grade: { type: "number", minimum: 0, maximum: 100 } } } } } }, responses: { 200: { description: "Grade submitted" } } },
      },
      "/api/enrollments/{id}": {
        delete: { tags: ["Enrollments"], summary: "Remove enrollment (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Removed" } } },
      },
      // ── Attendance ────────────────────────────────────────────────────────────
      "/api/attendance": {
        get:  { tags: ["Attendance"], summary: "List attendance records (?course=&student=&date=&page=&limit=)", parameters: [{ name: "course", in: "query", schema: { type: "string" } }, { name: "student", in: "query", schema: { type: "string" } }, { name: "date", in: "query", schema: { type: "string", format: "date" } }, { name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }], responses: { 200: { description: "Paginated" } } },
        post: { tags: ["Attendance"], summary: "Create/upsert one attendance record (admin/teacher)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["student", "course", "date"], properties: { student: { type: "string" }, course: { type: "string" }, date: { type: "string", format: "date" }, status: { type: "string", enum: ["present", "absent", "late", "excused"] }, note: { type: "string" } } } } } }, responses: { 201: { description: "Saved" } } },
      },
      "/api/attendance/bulk": {
        post: { tags: ["Attendance"], summary: "Bulk upsert attendance for a class on a date (admin/teacher)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["course", "date", "records"], properties: { course: { type: "string" }, date: { type: "string", format: "date" }, records: { type: "array", items: { type: "object", properties: { student: { type: "string" }, status: { type: "string", enum: ["present", "absent", "late", "excused"] } } } } } } } } }, responses: { 200: { description: "Saved" } } },
      },
      "/api/attendance/course/{courseId}/date/{date}": {
        get: { tags: ["Attendance"], summary: "Get attendance sheet for a class on a specific date (admin/teacher)", parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }, { name: "date", in: "path", required: true, schema: { type: "string", format: "date" } }], responses: { 200: { description: "OK" } } },
      },
      "/api/attendance/summary/{studentId}": {
        get: { tags: ["Attendance"], summary: "Attendance summary for a student (?course=)", parameters: [{ name: "studentId", in: "path", required: true, schema: { type: "string" } }, { name: "course", in: "query", schema: { type: "string" } }], responses: { 200: { description: "Totals and percentage" } } },
      },
      "/api/attendance/{id}": {
        put:    { tags: ["Attendance"], summary: "Update an attendance record (admin/teacher)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["present", "absent", "late", "excused"] }, note: { type: "string" }, date: { type: "string", format: "date" } } } } } }, responses: { 200: { description: "Updated" } } },
        delete: { tags: ["Attendance"], summary: "Delete an attendance record (admin/teacher)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
      },
      // ── Fees ──────────────────────────────────────────────────────────────────
      "/api/fees": {
        get:  { tags: ["Fees"], summary: "List fees (?student=&semester=&category=&year=&page=&limit=)", responses: { 200: { description: "Paginated" } } },
        post: { tags: ["Fees"], summary: "Create a fee record (admin only)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["student", "description", "totalAmount"], properties: { student: { type: "string" }, description: { type: "string" }, totalAmount: { type: "number", minimum: 0 }, category: { type: "string", enum: ["tuition", "registration", "lab", "library", "sports", "other"] }, semester: { type: "string", enum: ["Fall", "Spring"] }, year: { type: "integer" }, dueDate: { type: "string", format: "date" } } } } } }, responses: { 201: { description: "Created" } } },
      },
      "/api/fees/summary": {
        get: { tags: ["Fees"], summary: "Fee summary totals (admin only)", parameters: [{ name: "student", in: "query", schema: { type: "string" } }, { name: "semester", in: "query", schema: { type: "string" } }, { name: "year", in: "query", schema: { type: "integer" } }], responses: { 200: { description: "Aggregate totals" } } },
      },
      "/api/fees/{id}": {
        get:    { tags: ["Fees"], summary: "Get a fee record", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
        put:    { tags: ["Fees"], summary: "Update fee details (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" } } },
        delete: { tags: ["Fees"], summary: "Delete a fee record (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
      },
      "/api/fees/{id}/payment": {
        put: { tags: ["Fees"], summary: "Record a payment (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["amount"], properties: { amount: { type: "number", minimum: 0.01 }, note: { type: "string" } } } } } }, responses: { 200: { description: "Payment recorded" }, 400: { description: "Overpayment or already paid" } } },
      },
      "/api/fees/{id}/payment/{paymentId}": {
        delete: { tags: ["Fees"], summary: "Remove a payment and recalculate balance (admin only)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "paymentId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Removed" } } },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
