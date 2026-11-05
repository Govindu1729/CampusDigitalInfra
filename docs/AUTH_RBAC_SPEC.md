# Centralized Authentication & 3-Tier RBAC Specification

> **Project:** CampusDigitalInfra / IITGN Maintenance Request System (MRS)  
> **Document Purpose:** API & Architecture contract for integration with the Centralized Identity & Access Management Service.  
> **Date:** November 2026  
> **Author:** Vipul Patil (CampusDigitalInfra Engineering Team)

---

## 1. Context & Overview

The **CampusDigitalInfra / IITGN Maintenance Request System** is delegating its authentication, session verification, and user management to a centralized identity service.

This document outlines:
1. The **3-Tier Role-Based Access Control (RBAC)** model.
2. The **data scoping rules** (Universal vs. Department-scoped).
3. The **hierarchical user administration permissions** (who can create/update/delete whom).
4. The **API endpoints and token payload contract** our application requires from the central authentication service.

---

## 2. 3-Tier Role Hierarchy & Data Visibility

| Tier | Role Code | Role Name | Role Level | Department Scoping | Query / Ticket Visibility |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Tier 1** | `OVERALL_ADMIN` | Overall Super Admin | `1` | **Universal** (`departmentId: null` / All) | Full visibility across **all** campus departments (Civil, Electrical, Plumbing, HVAC, etc.). |
| **Tier 2** | `DEPT_ADMIN` | Department Admin (Sub-Admin) | `2` | **Department Scoped** (Bound to single `departmentId`) | **Strictly isolated** to tickets/queries within their assigned department. |
| **Tier 3** | `DEPT_STAFF` | Department Staff / Field Technician | `3` | **Department Scoped** (Bound to single `departmentId`) | **Strictly isolated** to tickets/tasks within their assigned department. |

---

## 3. Hierarchical User Management (CRUD Enforcement Rules)

The identity service must strictly enforce the following rules when creating, modifying, or deleting users:

### Rule 1: Tier 1 (`OVERALL_ADMIN`) Authority
* Can **create, view, edit, and deactivate/delete** users of:
  * **Tier 1** (`OVERALL_ADMIN`)
  * **Tier 2** (`DEPT_ADMIN`) across all departments
  * **Tier 3** (`DEPT_STAFF`) across all departments
* Can assign or reassign users to any department.

### Rule 2: Tier 2 (`DEPT_ADMIN`) Authority
* Can **create, view, edit, and deactivate/delete** only **Tier 3 (`DEPT_STAFF`)** users belonging to **their own department**.
* **Forbidden Actions:**
  * Cannot create, modify, or delete `OVERALL_ADMIN` users.
  * Cannot create, modify, or delete `DEPT_ADMIN` users.
  * Cannot view, edit, or delete `DEPT_STAFF` belonging to any other department.
  * Cannot change their own department or the department of any user.

### Rule 3: Tier 3 (`DEPT_STAFF`) Authority
* **Zero administrative privileges.**
* Read-only access to their own user profile; cannot create, edit, or delete any user accounts.

```
                    ┌───────────────────────────┐
                    │  Tier 1: OVERALL_ADMIN    │
                    │  (Universal Access)       │
                    └─────────────┬─────────────┘
                                  │ Can manage Tier 1, 2, and 3
                    ┌─────────────▼─────────────┐
                    │   Tier 2: DEPT_ADMIN      │
                    │   (Per-Department Scope)  │
                    └─────────────┬─────────────┘
                                  │ Can manage Tier 3 within same dept only
                    ┌─────────────▼─────────────┐
                    │   Tier 3: DEPT_STAFF      │
                    │   (Field Technicians)     │
                    └───────────────────────────┘
```

---

## 4. Required API Endpoints & Token Specifications

### 4.1 Authentication & Token Verification

* **Endpoint:** `POST /api/auth/verify` (or JWKS public keys if using asymmetric JWTs)
* **Headers:** `Authorization: Bearer <TOKEN>`
* **Expected Response / Decoded JWT Claims:**

```json
{
  "success": true,
  "user": {
    "id": "usr_cuid12345",
    "email": "technician1@iitgn.ac.in",
    "name": "Ramesh Kumar",
    "role": {
      "code": "DEPT_STAFF",
      "name": "Department Staff",
      "level": 3
    },
    "department": {
      "id": "dept_elec_001",
      "code": "ELEC",
      "name": "Electrical Works"
    },
    "permissions": [
      "COMPLAINT_VIEW",
      "COMPLAINT_UPDATE_STATUS",
      "COMPLAINT_ADD_NOTES"
    ]
  }
}
```

> **Note on Overall Admin:** When the user is `OVERALL_ADMIN`, `department` should be `null` and `role.level` should be `1`.

---

### 4.2 User Management Endpoints (Hierarchical CRUD)

#### 1. List Users
* **Endpoint:** `GET /api/users`
* **Query Parameters:**
  * `departmentId` *(optional for Tier 1, auto-enforced for Tier 2)*
  * `roleCode` *(optional)*
  * `page`, `limit`
* **Behavior:**
  * If requested by Tier 1 (`OVERALL_ADMIN`): Returns all users, or filtered by `departmentId` if specified.
  * If requested by Tier 2 (`DEPT_ADMIN`): Service must automatically enforce `departmentId = caller.departmentId` and filter to `DEPT_STAFF` only.

#### 2. Create User
* **Endpoint:** `POST /api/users`
* **Request Payload:**
```json
{
  "name": "Suresh Patel",
  "email": "suresh.patel@iitgn.ac.in",
  "phone": "+91-9876543210",
  "roleCode": "DEPT_STAFF",
  "departmentId": "dept_elec_001"
}
```
* **Validation:**
  * If caller is `DEPT_ADMIN`, `roleCode` **must** be `DEPT_STAFF`, and `departmentId` **must** match caller's department. Return `403 Forbidden` otherwise.

#### 3. Update User
* **Endpoint:** `PATCH /api/users/:id`
* **Request Payload:**
```json
{
  "name": "Suresh Patel",
  "phone": "+91-9876543210",
  "active": true
}
```
* **Validation:**
  * Enforces the same hierarchical restrictions.

#### 4. Delete / Deactivate User
* **Endpoint:** `DELETE /api/users/:id`
* **Validation:**
  * `DEPT_ADMIN` can only delete/deactivate staff within their assigned department.

---

## 5. Ready-to-Send Email / Communication Template

Copy and send this directly to the auth/identity team:

```markdown
Subject: Requirements & API Specifications for Centralized Auth & 3-Tier RBAC Integration (CampusDigitalInfra)

Hi Team,

As agreed, our application (CampusDigitalInfra / IITGN Maintenance Request System) is delegating authentication, session verification, and user management to your centralized identity service.

Below are our exact requirements, hierarchy model, scoping rules, and the API endpoints/token payload our application needs from your service:

1. 3-Tier Role Hierarchy & Data Scoping:
- Tier 1: OVERALL_ADMIN (Universal scope) — Full visibility and control across all campus departments.
- Tier 2: DEPT_ADMIN (Scoped to specific departmentId) — Strictly restricted to viewing and managing tickets within their own department (e.g. Electrical, Civil, Plumbing).
- Tier 3: DEPT_STAFF (Scoped to specific departmentId) — Field staff/technicians restricted to viewing and executing tasks within their own department.

2. User Management Hierarchy Rules:
- Tier 1 (OVERALL_ADMIN) can create, view, modify, and delete Tier 1, Tier 2, and Tier 3 users across any department.
- Tier 2 (DEPT_ADMIN) can ONLY create, view, modify, and delete Tier 3 (DEPT_STAFF) users within their own department. They cannot touch Tier 1 or Tier 2 users, nor staff from other departments.
- Tier 3 (DEPT_STAFF) has zero user-management privileges.

3. Required Endpoints & Payload Contract:
- Token Verification / Session Claims: POST /api/auth/verify (or JWKS public keys for JWT). We need:
  {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": { "code": "DEPT_ADMIN", "level": 2 },
    "department": { "id": "...", "code": "ELEC", "name": "Electrical Works" }, // null for OVERALL_ADMIN
    "permissions": ["..."]
  }
- User Management CRUD:
  * GET /api/users (with department & role filtering, auto-scoped for Dept Admins)
  * POST /api/users
  * PATCH /api/users/:id
  * DELETE /api/users/:id

We have documented the complete specification in docs/AUTH_RBAC_SPEC.md. Please share the API base URL, Swagger/Postman docs, and authentication method so we can begin integration.

Thanks,
Vipul Patil
CampusDigitalInfra Team
```
