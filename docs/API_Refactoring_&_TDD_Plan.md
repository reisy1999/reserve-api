# API Refactoring & TDD Plan

_Last updated: 2025-11-04 (JST)_

---

## ✅ IMPLEMENTATION COMPLETE - 2025-11-04 23:XX JST

**Status**: All planned features have been successfully implemented and tested.

**Summary**:
- ✅ Admin Departments API (list with pagination/filtering/sorting, detail) - **27 E2E tests**
- ✅ Slot-Department CRUD API (POST/PATCH/DELETE) - **6 E2E tests**
- ✅ Admin ReservationTypes API (list with pagination/filtering/sorting, detail, CRUD) - **24 E2E tests**
- ✅ RBAC enforcement on all admin routes (AdminTokenGuard)
- ✅ **Total: 68 E2E tests passing** (all suites green)

**Key Achievements**:
1. Pagination with defaults (limit=50, page=1) and max validation (limit≤100)
2. Default sorting (id ASC) with stable tie-break on all admin lists
3. Case-insensitive partial name filtering on departments and reservation types
4. Active/inactive filtering on both resources
5. Full RBAC coverage (401 for unauthenticated, admin-only access)
6. Idempotent DELETE operations for slot-department links
7. Proper 404/409 error handling (missing resources, duplicate links)

**Test Coverage**:
- `test/e2e/departments.e2e-spec.ts` - Admin departments + public API
- `test/e2e/slot-departments.e2e-spec.ts` - Slot-department CRUD
- `test/e2e/reservation-types.e2e-spec.ts` - Admin reservation types + public API

**Files Modified/Created**:
- Admin Controllers: `admin-department.controller.ts`, `admin-slots.controller.ts`, `admin-reservation-type.controller.ts`
- DTOs: `find-departments-admin.dto.ts`, `slot-department.dto.ts`, `find-reservation-types-admin.dto.ts`
- Services: Enhanced `department.service.ts`, `reservations.service.ts`, `reservation-type.service.ts`
- Entities: `reservation-slot-department.entity.ts`

---

## 1) Executive Summary

We will **unify admin operations under `/api/admin/*`**, correct the docs (departments public API already exists), and **add missing admin endpoints**. Migration will be **non-breaking** via **deprecated aliases**, while **RBAC** is enforced on all admin routes. We proceed **TDD-first (E2E Red→Green)** and keep public responses **minimal + active-only**.

---

## 2) Scope & Routing Map

| Current Path                             | Target Path                                           | Action                                                     | RBAC   | Notes                                                              |
| ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `GET /api/departments`                   | `GET /api/departments`                                | **Keep (public)**                                          | Public | Explicitly document **active-only** filter & minimal fields.       |
| –                                        | `GET /api/admin/departments`                          | **Add** (admin list, full fields, pagination)              | Admin  | Public route remains; **admin route is canonical** for management. |
| –                                        | `GET /api/admin/departments/:id`                      | **Add** (detail view)                                      | Admin  | Include meta (createdAt/updatedAt, related settings).              |
| –                                        | `POST /api/admin/slots/:id/departments`               | **Add** (link department with capacity override)           | Admin  | Validates FK; duplicate → **409**.                                 |
| –                                        | `PATCH /api/admin/slots/:slotId/departments/:deptId`  | **Add** (toggle/adjust capacity)                           | Admin  | Transactional update.                                              |
| –                                        | `DELETE /api/admin/slots/:slotId/departments/:deptId` | **Add** (unlink)                                           | Admin  | Idempotent: second call returns **204/200-equivalent**.            |
| `POST /api/admin/reservation-types` etc. | `POST /api/admin/reservation-types` etc.              | **Keep** (already admin-scoped)                            | Admin  | No change.                                                         |
| `GET /api/reservation-types`             | `GET /api/reservation-types`                          | **Keep** (public, active-only)                             | Public | Mark as **limited response** (no sensitive/admin fields).          |
| `GET /api/reservation-types/:id` etc.    | `GET /api/admin/reservation-types/:id`                | **Add alias** under admin; mark public ones **deprecated** | Admin  | Controller re-route to same service; RBAC on admin.                |
| –                                        | `GET /api/admin/reservation-types`                    | **Add** (paged, includes inactive)                         | Admin  | Full fields + filters.                                             |

**Deprecation policy:** Old **public mutation** routes (if any) are marked `deprecated: true` and return a `Deprecation` header **always** when called. We do **route-based** deprecation (not token-based).

---

## 3) Red → Green Implementation Order (Test-First)

1. **Routes Skeleton** → _E2E Red_
   - Add failing E2E specs for new `/api/admin/*`; include header checks for `Deprecation` on deprecated routes.
   - Create minimal controllers (501) to ensure routing is exercised.

2. **Admin Guard & RBAC** → _E2E Red/Green_
   - Centralize Admin guard; **401 = unauthenticated**, **403 = authenticated but not admin**.
   - E2E for both cases on all admin routes.

3. **Admin Departments** → _E2E Red/Green_
   - `GET /api/admin/departments` with **pagination defaults** (`limit=50`, `page=1`), filtering (name/active), **default sort** (`id asc`; stable tie-break `, id asc`).
   - Sorting override via `?sort=id|name|updatedAt&order=asc|desc` applied as `ORDER BY <sort> <order>, id ASC`.
   - `GET /api/admin/departments/:id` returns meta; **404** when missing.

4. **Slot–Department CRUD** → _E2E Red/Green_
   - `POST / PATCH / DELETE` for slot↔department relations.
   - Errors: **404** (missing slot/department), **409** (duplicate or FK-blocked).
   - Use transactions; DELETE is **idempotent**.

5. **Admin ReservationTypes** → _E2E Red/Green_
   - `GET /api/admin/reservation-types` (paged, includes inactive, default sort).
   - Add admin aliases for detail/update/delete; mark public counterparts **deprecated** and emit `Deprecation` header.

6. **Public Endpoint Hardening** → _E2E Green_
   - Assert minimal shapes for public endpoints and **active-only** behavior.

---

## 4) E2E Matrix (to add to Jest e2e)

| Scenario                     | Expectation                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Admin department list/detail | `200`, correct schema; `meta: { total, page, limit }`                                            |
| RBAC on all `/api/admin/*`   | `401` (no auth), `403` (non-admin)                                                               |
| 404 on missing resources     | `404` for missing dept/slot/reservation-type                                                     |
| 409 on duplicate relations   | `409` when re-linking existing slot-department                                                   |
| Pagination defaults          | `limit=50`, `page=1`, **default sort = `id asc`**                                                |
| Sorting override             | `?sort=name&order=asc` / `?sort=updatedAt&order=desc` reflected; always `, id ASC` as tie-break  |
| Stable tie-break             | For equal sort keys, ordering remains deterministic due to secondary `id ASC`                    |
| Filtering                    | `name` filter = trimmed, **case-insensitive partial match**; `active` = strict boolean           |
| Invalid pagination params    | `limit` max enforced (e.g., `<=100`): either **400** or clamped (spec below); behavior is tested |
| Public vs Admin shapes       | Public = minimal (active-only); Admin = full fields                                              |
| Deprecation headers          | Deprecated routes include `Deprecation` (+ optional `Sunset`)                                    |

---

## 5) Docs & OpenAPI

- Fix doc: remove “all departments API missing”; note public `GET /api/departments` is **live & active-only**.
- Tag new admin endpoints under **`Admin`**; document RBAC and error codes (**401/403/404/409**).
- Mark deprecated routes with `deprecated: true`; document `Deprecation` header and replacements.
- **Admin Departments list – Query params (with defaults and validation):**
  - `limit` — integer, **default 50**, **max 100** (reject with **400** if exceeded, or clamp if that policy is chosen; pick one and keep tests consistent)
  - `page` — integer, **default 1**, `page >= 1`
  - `name` — string, **trimmed**, **case-insensitive partial match**
  - `active` — boolean (`true|false`), strict parsing
  - `sort` — enum **`id` | `name` | `updatedAt`**, **default `id`**
  - `order` — enum **`asc` | `desc`**, **default `asc`**
  - **Ordering rule:** `ORDER BY <sort> <order>, id ASC` (fixed secondary key for test stability)

- **Detail endpoint:** `GET /api/admin/departments/:id` returns full entity with meta (createdAt / updatedAt / related settings); **404** if missing.
- Public vs Admin response shapes are explicitly documented.

---

## 6) Definition of Done

- All new admin E2E (happy + denial) **pass**.
- Deprecated routes emit `Deprecation` header; minimal smoke tests remain.
- Public endpoints keep **backward compatibility** and minimal shape.
- OpenAPI & docs updated; CI gates include Phase-1 admin E2E.
- Pagination/filters/sort validated per above; **default `id asc`** behavior verified.

---

## 7) Risks & Mitigations (brief)

- **Front-end coupling to old paths** → Keep aliases; announce deprecation window; add CI lint on disallowed paths.
- **Relation integrity (slot-dept)** → FK constraints + transactional operations; `409` on duplicates.
- **List performance** → Enforce pagination, indexed filters, limited projections for public endpoints.
- **Deterministic ordering** → Fixed secondary `id ASC` avoids flaky tests and preserves the department code taxonomy ordering.

---
