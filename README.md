# Comment Management API

A secure comment management system with user authentication, built with PostgreSQL, Prisma ORM, and Node.js. Features JWT authentication, user validation, and comprehensive CRUD operations for comments.

## Features

- **JWT Authentication** - Secure token-based authentication
- **User Management** - Create and manage users with upsert functionality
- **Comment CRUD** - Full Create, Read, Update, Delete operations
- **Filtering** - Filter comments by video ID, user ID, and status
- **Validation** - User existence validation and proper error handling
- **Modern Stack** - PostgreSQL, Prisma ORM, Express.js, ES Modules
- **Build System** - esbuild for fast builds with path aliases

## Prerequisites

- Node.js =< 18.0.0
- npm or yarn
- PostgreSQL database (or Prisma Accelerate)

## Development

### Start Development Server

```bash
# Start with live reload
npm run dev:local

# Or build and start
npm run dev:build
npm start
```

### Available Scripts

```bash
npm run setup          # Complete project setup
npm run dev:local      # Start development server with live reload
npm run dev:build      # Build project with esbuild
npm run build          # Production build
npm run start          # Start production server
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
npm run test           # Run API tests
```

## API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Endpoints

#### Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Health check passed",
    "timestamp": "2025-08-07T13:14:46.835Z",
    "database": "connected"
  }
}
```

#### User Management

**Create/Update User**

```http
POST /api/users/upsert
Content-Type: application/json

{
    "id": "joshua_mata_2024",
    "firstName": "Joshua",
    "lastName": "Mata",
    "company": "Microsoft",
    "role": "lead full stack developer",
    "phone": "+1-234-0453",
    "channel": "mobile",
    "billing": 1,
    "plan": 3,
    "trusted": 1
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "joshua_mata_2024",
      "sub": null,
      "cus": null,
      "firstName": "Joshua",
      "lastName": "Mata",
      "role": "lead full stack developer",
      "company": "Microsoft",
      "phone": "+1-234-0453",
      "channel": "mobile",
      "billing": 1,
      "plan": 3,
      "trusted": 1,
      "modified": 1754573026,
      "created": 1754573026
    },
    "token": "token...",
    "message": "User updated successfully"
  }
}
```

**Login**

```http
POST /api/auth/login
Content-Type: application/json

{
  "userId": "joshua_mata_2024"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "token...",
    "user": {
      "id": "joshua_mata_2024",
      "firstName": "Joshua",
      "lastName": "Mata",
      "company": "Microsoft",
      "role": "lead full stack developer"
    },
    "message": "Login successful"
  }
}
```

#### Comments

**Get All Comments**

```http
GET /api/comments
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": 2,
        "cid": "tutorial_react_2024",
        "vid": "react_hooks_advanced",
        "uid": "john_doe_2024",
        "comment": "This is a comment.",
        "created": 1754510723,
        "status": 1,
        "user": {
          "id": "john_doe_2024",
          "firstName": "John",
          "lastName": "Doe",
          "company": "TechCorp Solutions"
        }
      }
    ]
  }
}
```

**Create Comment**

```http
POST /api/comments
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
    "cid": "project managmeent",
    "vid": "ssss2",
    "uid": "william_brown_2024",
    "comment": "This is a comment",
    "status": 1
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "comment": {
      "id": 16,
      "cid": "w",
      "vid": "2",
      "uid": "william_brown_2024",
      "comment": "This is a comment",
      "created": 1754576875,
      "status": 1,
      "user": {
        "id": "william_brown_2024",
        "firstName": "William",
        "lastName": "Brown",
        "company": "Innovation Labs"
      }
    }
  }
}
```

**Get Single Comment**

```http
GET /api/comments?uid=william_brown_2024
Authorization: Bearer YOUR_JWT_TOKEN
```

**Update Comment**

```http
PUT /api/comments/1
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "uid": "william_brown_2024",
  "comment": "This is updated",
  "status": 5
}
```

**Delete Comment**

```http
DELETE /api/comments/1
Authorization: Bearer YOUR_JWT_TOKEN
{
    "uid": "william_brown_2024"
}
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  sub TEXT,
  cus TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  company TEXT,
  phone TEXT,
  channel TEXT,
  billing INT,
  plan INT,
  trusted INT,
  modified INT,
  created INT
);
```

### Comments Table

```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  cid VARCHAR(32) NOT NULL,
  vid VARCHAR(32) NOT NULL,
  uid VARCHAR(32) NOT NULL,
  comment TEXT NOT NULL,
  created INT,
  status INT,
  FOREIGN KEY (uid) REFERENCES users(id)
);
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
EXPIRESIN="24h"
PORT=3000
NODE_ENV="development"
```

### Project Structure

```
comment-management-api/
├── src/
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.js
│   │   ├── comments/
│   │   │   ├── index.js
│   │   │   └── [id].js
│   │   ├── health.js
│   │   └── users/
│   │       └── upsert.js
│   ├── constants/
│   │   ├── comment.constants.js
│   │   ├── helper.constants.js
│   │   ├── http-methods.constants.js
│   │   └── status-codes.constants.js
│   ├── lib/
│   │   ├── auth.js
│   │   ├── jwt-utils.js
│   │   └── prisma.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── comments.routes.js
│   │   ├── health.routes.js
│   │   ├── index.js
│   │   └── users.routes.js
│   ├── utils/
│   │   └── response.js
│   └── index.js
├── prisma/
│   └── schema.prisma
├── build.js
├── dev-server.js
├── setup.js
└── package.json
```
