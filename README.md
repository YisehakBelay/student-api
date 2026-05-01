# Student API

A REST API built with Node.js, Express, and MongoDB.

## Features
- Create, read, update, and delete students
- Manage courses and enrollments
- Submit grades and calculate GPA
- Track attendance by student, course, and date
- Track fees, payments, and outstanding balances

## Tech Stack
- Node.js
- Express.js
- MongoDB (Mongoose)

## API Endpoints

| Method | Endpoint |
|--------|----------|
| GET | /api/students |
| GET | /api/students/:id |
| GET | /api/students/:id/courses |
| POST | /api/students |
| PUT | /api/students/:id |
| DELETE | /api/students/:id |
| GET | /api/courses |
| POST | /api/courses |
| PUT | /api/courses/:id |
| DELETE | /api/courses/:id |
| GET | /api/enrollments |
| POST | /api/enrollments |
| PUT | /api/enrollments/:id/grade |
| DELETE | /api/enrollments/:id |
| GET | /api/attendance |
| POST | /api/attendance |
| POST | /api/attendance/bulk |
| GET | /api/attendance/course/:courseId/date/:date |
| GET | /api/attendance/summary/:studentId |
| PUT | /api/attendance/:id |
| DELETE | /api/attendance/:id |
| GET | /api/fees |
| GET | /api/fees/summary |
| GET | /api/fees/:id |
| POST | /api/fees |
| PUT | /api/fees/:id |
| PUT | /api/fees/:id/payment |
| DELETE | /api/fees/:id/payment/:paymentId |
| DELETE | /api/fees/:id |

## Run Locally

```bash
npm install
npm start
```

Optional environment variables:

```bash
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/studentDB
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```
