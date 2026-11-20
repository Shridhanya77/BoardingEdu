# 5. School admin

A school administrator is `User.role = SCHOOL_ADMIN` with exactly one `SchoolAdminProfile.school`. The foreign key is required. Designation is optional (for example Principal or Admissions Officer).

The console is `frontend/components/school-admin/SchoolAdminConsole.tsx` at `/dashboard/school/` and `/dashboard/school/{section}/...`.

## Login

1. `POST /api/auth/jwt/token/` with email or username.
2. If the account has no school, login fails with “not assigned to a school”.
3. If `verification_status` is not `VERIFIED`, login fails with “awaiting admin approval” (`school_admin_is_approved`).
4. If the school is verified, an email OTP is required (`OTP_ROLES` includes `SCHOOL_ADMIN`).
5. `POST /api/auth/otp/verify/` returns the JWT pair.
6. Refresh uses `ApprovedSchoolAdminTokenRefreshSerializer`, which checks approval again.

Until verification, the school admin cannot open the console. Staff use Django Admin to set verification. The Next.js platform dashboard can also call `POST /api/schools/schools/{id}/verification/`.

Self-registration is `POST /api/schools/schools/register/` from `/signup/school/`. It creates a `PENDING` school with `status=False`, the admin user, and sends a registration OTP. The school stays off the public directory until staff set `status=True`. The admin still cannot sign in until verification is `VERIFIED`.

## Console sections

| Section id | Label | What it manages |
| --- | --- | --- |
| `overview` | Dashboard | Enquiry counts, review counts, monthly activity, subscription summary |
| `completion` | Profile completion | Missing public fields from the school payload |
| `profile` | School profile | Descriptive and contact fields for this school only |
| `grades` | Grades offered | `SchoolGrade` rows |
| `facilities` | Facilities | Links to the facility catalogue |
| `fees` | Fees and admissions | Fee items and publish/unpublish |
| `gallery` | Photographs | Photo URLs, captions, categories |
| `resources` | Brochure and documents | Public brochure and required-document links |
| `reviews` | Reviews | Read reviews for this school. Publishing is a staff action |
| `enquiries` | Admission leads | Pipeline for this school’s enquiries |
| `plans` | Subscription plans | Active plans and prices |
| `subscription` | My subscription | Current lead-access subscription |
| `payments` | Payment history | Razorpay payment rows |
| `account` | Account settings | Password and account details |

Data load: `GET /api/dashboards/school/?months=3|6|12`.

The school record itself is read with `GET /api/schools/schools/mine/`.

## What the school admin may change

Direct edits on `/api/schools/schools/{id}/` are not how the console saves. The console patches `/api/schools/schools/mine/` and the school-scoped dashboard write endpoints. Those endpoints submit an approval record.

### Profile (`PATCH /api/schools/schools/mine/`)

`SchoolPortalSerializer` accepts the school’s own descriptive data: name fields, logo URL, cover URL, address, geography ids, gender, established year, student-teacher ratio, contact details, website, principal name, tagline, about, admission open flag, coordinates, and board/type selections that the serializer allows.

`submit_school_profile_changes` writes `school_profile_changes` with status `PENDING`. Only one pending profile change per school is allowed. A newer submission supersedes the previous pending one. The live school row does not change until a reviewer approves it in Django Admin. The API returns **202** when a change is waiting and **200** when nothing new was pending.

The school admin cannot set `verification_status`, `is_featured`, or another school’s id.

### Grades, facilities, photos, resources, fees

Write endpoints under `/api/dashboards/school/`:

| Method and path | Effect |
| --- | --- |
| `POST/PATCH/DELETE /api/dashboards/school/grades/` and `.../{school_grade_id}/` | Queue a grade change |
| `POST/PATCH/DELETE /api/dashboards/school/facilities/` and `.../{school_facility_id}/` | Queue a facility link |
| `POST/PATCH/DELETE /api/dashboards/school/photos/` and `.../{photo_id}/` | Queue a photograph |
| `POST/PATCH/DELETE /api/dashboards/school/admission-resources/` and `.../{resource_id}/` | Queue a brochure or required document |
| `POST/PATCH/DELETE /api/dashboards/school/fees/items/` and `.../{fee_item_id}/` | Queue a fee line |
| `POST /api/dashboards/school/fees/{fee_structure_id}/publish/` | Queue publish or unpublish |

Implementation: `backend/apps/dashboards/school_ops.py`. Each write creates or updates a `SchoolContentChange` (`FACILITY`, `GRADE`, `PHOTO`, `RESOURCE`, `VIDEO`, `FEE_ITEM`, `FEE_STRUCTURE`) with action `UPSERT`, `DELETE`, or `PUBLISH`. Pending rows are unique per school and `change_key`.

Photographs store a public image URL, caption, alt text, category (`CAMPUS`, `CLASSROOM`, `SPORTS`, `LIBRARY`, `HOSTEL`, `OTHER`), sort order, and active flag. The console does not upload a binary into a school-admin-only bucket. Staff can also paste URLs in Django Admin. Video rows exist on the model and in the approval types. The console navigation does not have a separate video section; videos are maintained with the photo/media data and Django Admin inline.

### Facilities, sports, hostel, dining, classrooms, labs, transport, health

There is no separate table for sports, hostel, food, classrooms, laboratories, transport, or health. Those topics are `Facility.category` values on the shared catalogue (`ACADEMIC`, `SPORTS`, `ACCOMMODATION`, `DINING`, `HEALTH`, `SAFETY`, `TRANSPORT`, `TECHNOLOGY`, or another category string). The school admin attaches a catalogue facility and may set `available`, `quantity_or_capacity`, and a short description.

The school admin cannot create a new global facility, board, grade, city, or school type. Those catalogues are platform data. School types are not writable through the API at all.

### Fees

A `FeeStructure` belongs to one school and one academic year. It is public only when `status=True` and `published=True`. Line items (`FeeItem`) have a category (tuition, accommodation, dining, transport, and the other categories in the model), amount, payment frequency, optional grade, optional school type, and optional stream for grades 11 and 12.

The public “starting annual fee” annualises monthly, quarterly, half-yearly, term, and annual tuition-like items for the current academic year (or year codes `2026-2027` / `2026-27`). See `annual_fee_subquery()`.

### Academic information

Academic data the school admin can propose:

- Grades offered, seats, minimum and maximum entry age, active flag (`SchoolGrade`)
- Established year and student-teacher ratio on the school
- Boards, which are many-to-many with the school
- Fee structure for an academic year

Academic years and fee terms are master data. The school admin selects them. Staff create them.

### Staff and faculty

Not implemented as records. The only person field on the school is `principal_name`.

## Enquiries

`POST /api/dashboards/school/enquiries/{enquiry_id}/status/` requires `IsVerifiedSchoolAdmin` and the enquiry’s school to match the admin’s school.

The body may include CRM `status` and/or `application_status`. Allowed values are the choice lists on `AdmissionEnquiry`. Updating application status writes `ApplicationStatusEvent` through the model `save()`.

Contact details on a lead are included only when `viewer_can_see_contacts` is true (`apps.subscriptions.access`). That depends on an active subscription whose plan has `lead_access`. A plan may also set `lead_quota`, which limits how many of the newest leads reveal contacts. Without a subscription, the school admin still sees that an enquiry exists, but not the parent’s contact fields.

The school admin cannot reassign `assigned_to`. That field is limited to `STAFF_ADMIN` users and is a staff CRM control.

## Reviews

The Reviews section lists this school’s reviews from the dashboard payload (id, author, rating, title, a truncated body, status, verified flag, created time). Changing `PENDING` to `PUBLISHED` or `REJECTED` is done in Django Admin (`ReviewAdmin`), not by the school admin API.

## Subscriptions

| Endpoint | Who |
| --- | --- |
| `GET /api/subscriptions/plans/` | Authenticated school admin, active plans |
| `GET /api/subscriptions/mine/` | This school’s subscription and payments |
| `POST /api/subscriptions/orders/` | Creates a Razorpay order and a `PENDING` payment |
| `POST /api/subscriptions/verify/` | Checks the Razorpay signature and activates the subscription |
| `POST /api/subscriptions/webhook/` | Razorpay webhook. Signature is required |

A subscription does not start because the browser says payment succeeded. `VerifyPaymentView` or the webhook must verify the signature. Statuses: subscription `PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`; payment `PENDING`, `PAID`, `FAILED`, `REFUNDED`.

If Razorpay keys are empty, order creation cannot complete a live charge. That is configuration, not a missing code path.

## Account

Account settings use the password-change endpoint. The school admin cannot change their role, cannot attach a second school, and cannot edit another school’s profile.

## What needs a higher role

| Action | Who can do it |
| --- | --- |
| Approve or reject profile and content changes | Staff reviewer (`is_school_change_reviewer` in `schools/admin.py`) |
| Verify or unverify the school | Staff admin API or Django Admin |
| Create boards, grades, facilities, places, academic years | Platform admin |
| Feature or sponsor a school | Platform promotion admin |
| Publish or reject reviews | Staff in Django Admin |
| Assign an enquiry to a staff user | Staff |
| Create another school admin or change roles | Super admin / Django user admin |
| Edit popularity weights | Django Admin, platform staff |
