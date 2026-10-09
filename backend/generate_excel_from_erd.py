"""
BoardEdu ER Diagram → Excel Workbook Generator
- Creates ONE sheet per table from your 3 ER diagrams
- Column headers: column_name, data_type, constraints, pk/fk info
- Master tables (Roles, SchoolTypes, Boards, Countries, etc.) get 5-10 seed rows
- Run:  python generate_excel_from_erd.py
Output: BoardingEdu_ERD_Data.xlsx (same folder)
"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from copy import copy

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BoardingEdu_ERD_Data.xlsx")

# -------- STYLES --------
HEADER_FILL = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")   # Dark blue
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11, name="Calibri")
PK_FILL = PatternFill(start_color="FDE68A", end_color="FDE68A", fill_type="solid")        # Yellow (PK)
FK_FILL = PatternFill(start_color="BFDBFE", end_color="BFDBFE", fill_type="solid")        # Blue (FK)
UQ_FILL = PatternFill(start_color="BBF7D0", end_color="BBF7D0", fill_type="solid")        # Green (UQ)
NN_FONT = Font(color="B91C1C", bold=False, name="Calibri")                                # Red (NN)
SECTION_FILL = PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid")   # Light blue
THIN_BORDER = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)
WRAP = Alignment(wrap_text=True, vertical="center")

# ---------------- TABLE DEFINITIONS ----------------
# FORMAT per table: (sheet_name, column_defs, seed_data)
#   column_defs: [ (name, type, constraints, comment) ]
#     constraints: space-separated list PK FK UQ NN AI DEFAULT etc.
TABLES = []

# ========================================================================
# DIAGRAM 1 + MASTER CORE TABLES (ER Diagram 1 Top Row + Users/Roles)
# ========================================================================

# 1. COUNTRIES
TABLES.append(("COUNTRIES",
[
    ("country_id", "UUID", "PK NN", "Primary Key UUID"),
    ("country_code", "VARCHAR(5)", "UQ NN", "ISO code e.g. IN, US, UK"),
    ("country_name", "VARCHAR(100)", "NN", "Full name"),
    ("slug", "VARCHAR(100)", "UQ NN", "URL-safe slug"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", "Active/Inactive"),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("00000000-0000-0000-0000-000000000001","IN","India","india",True,"2026-01-01 00:00","2026-01-01 00:00"),
    ("00000000-0000-0000-0000-000000000002","US","United States","united-states",True,"2026-01-01 00:00","2026-01-01 00:00"),
    ("00000000-0000-0000-0000-000000000003","UK","United Kingdom","united-kingdom",True,"2026-01-01 00:00","2026-01-01 00:00"),
    ("00000000-0000-0000-0000-000000000004","AE","United Arab Emirates","united-arab-emirates",True,"2026-01-01 00:00","2026-01-01 00:00"),
    ("00000000-0000-0000-0000-000000000005","SG","Singapore","singapore",True,"2026-01-01 00:00","2026-01-01 00:00"),
]))

# 2. STATES
TABLES.append(("STATES",
[
    ("state_id", "UUID", "PK NN", ""),
    ("country_id", "UUID", "FK NN", "→ COUNTRIES.country_id"),
    ("state_code", "VARCHAR(10)", "UQ(COUNTRY) NN", "e.g. KA, MH within India"),
    ("state_name", "VARCHAR(100)", "NN", ""),
    ("slug", "VARCHAR(100)", "UQ(COUNTRY) NN", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("10000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000001","KA","Karnataka","karnataka",True,"2026-01-01","2026-01-01"),
    ("10000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000001","MH","Maharashtra","maharashtra",True,"2026-01-01","2026-01-01"),
    ("10000000-0000-0000-0000-000000000003","00000000-0000-0000-0000-000000000001","UK","Uttarakhand","uttarakhand",True,"2026-01-01","2026-01-01"),
    ("10000000-0000-0000-0000-000000000004","00000000-0000-0000-0000-000000000001","DL","Delhi","delhi",True,"2026-01-01","2026-01-01"),
    ("10000000-0000-0000-0000-000000000005","00000000-0000-0000-0000-000000000001","TN","Tamil Nadu","tamil-nadu",True,"2026-01-01","2026-01-01"),
]))

# 3. CITIES
TABLES.append(("CITIES",
[
    ("city_id", "UUID", "PK NN", ""),
    ("state_id", "UUID", "FK NN", "→ STATES.state_id"),
    ("city_code", "VARCHAR(10)", "UQ(STATE) NN", "e.g. BLR, MUM"),
    ("city_name", "VARCHAR(100)", "NN", ""),
    ("slug", "VARCHAR(100)", "UQ(STATE) NN", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("20000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000001","BLR","Bangalore","bangalore",True,"2026-01-01","2026-01-01"),
    ("20000000-0000-0000-0000-000000000002","10000000-0000-0000-0000-000000000002","MUM","Mumbai","mumbai",True,"2026-01-01","2026-01-01"),
    ("20000000-0000-0000-0000-000000000003","10000000-0000-0000-0000-000000000003","DDN","Dehradun","dehradun",True,"2026-01-01","2026-01-01"),
    ("20000000-0000-0000-0000-000000000004","10000000-0000-0000-0000-000000000004","DEL","New Delhi","new-delhi",True,"2026-01-01","2026-01-01"),
    ("20000000-0000-0000-0000-000000000005","10000000-0000-0000-0000-000000000005","CHE","Chennai","chennai",True,"2026-01-01","2026-01-01"),
]))

# 4. LOCATIONS
TABLES.append(("LOCATIONS",
[
    ("location_id", "UUID", "PK NN", ""),
    ("city_id", "UUID", "FK NN", "→ CITIES.city_id"),
    ("location_code", "VARCHAR(10)", "UQ(CITY) NN", "e.g. WFD, JPN"),
    ("location_name", "VARCHAR(100)", "NN", "Area/Locality"),
    ("slug", "VARCHAR(100)", "UQ(CITY) NN", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("30000000-0000-0000-0000-000000000001","20000000-0000-0000-0000-000000000001","WFD","Whitefield","whitefield",True,"2026-01-01","2026-01-01"),
    ("30000000-0000-0000-0000-000000000002","20000000-0000-0000-0000-000000000001","JPN","Jayanagar","jayanagar",True,"2026-01-01","2026-01-01"),
    ("30000000-0000-0000-0000-000000000003","20000000-0000-0000-0000-000000000001","KRK","Koramangala","koramangala",True,"2026-01-01","2026-01-01"),
    ("30000000-0000-0000-0000-000000000004","20000000-0000-0000-0000-000000000002","AND","Andheri","andheri",True,"2026-01-01","2026-01-01"),
    ("30000000-0000-0000-0000-000000000005","20000000-0000-0000-0000-000000000003","RPK","Rajpur Road","rajpur-road",True,"2026-01-01","2026-01-01"),
]))

# ========================================================================
# DIAGRAM 3 GREEN SECTION: MASTER DATA (Fees + Admissions Global Tables)
# ========================================================================

# 5. ACADEMIC_YEARS
TABLES.append(("ACADEMIC_YEARS",
[
    ("academic_year_id", "UUID", "PK NN", ""),
    ("year_code", "VARCHAR(9)", "UQ NN", "e.g. 2026-27"),
    ("display_name", "VARCHAR(50)", "NN", "Academic Year 2026-27"),
    ("start_date", "DATE", "NN", ""),
    ("end_date", "DATE", "NN", ""),
    ("is_current", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("40000000-0000-0000-0000-000000000001","2025-26","Academic Year 2025-26","2025-04-01","2026-03-31",False,True,"2026-01-01","2026-01-01"),
    ("40000000-0000-0000-0000-000000000002","2026-27","Academic Year 2026-27","2026-04-01","2027-03-31",True,True,"2026-01-01","2026-01-01"),
    ("40000000-0000-0000-0000-000000000003","2027-28","Academic Year 2027-28","2027-04-01","2028-03-31",False,True,"2026-01-01","2026-01-01"),
]))

# 6. GRADES
TABLES.append(("GRADES",
[
    ("grade_id", "UUID", "PK NN", ""),
    ("grade_code", "VARCHAR(10)", "UQ NN", "e.g. LKG, G1, G12"),
    ("grade_name", "VARCHAR(20)", "UQ NN", "Pre-KG, Grade 1 ..."),
    ("education_stage", "VARCHAR(30)", "NN", "Preschool / Primary / Secondary / SeniorSecondary"),
    ("sort_order", "SMALLINT", "UQ NN", "1=Lowest grade"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("50000000-0000-0000-0000-000000000001","LKG","LKG","Preschool",1,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000002","UKG","UKG","Preschool",2,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000003","G1","Grade 1","Primary",3,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000004","G5","Grade 5","Primary",7,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000005","G8","Grade 8","Secondary",10,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000006","G10","Grade 10","Secondary",12,True,"2026-01-01","2026-01-01"),
    ("50000000-0000-0000-0000-000000000007","G12","Grade 12","SeniorSecondary",14,True,"2026-01-01","2026-01-01"),
]))

# 7. FEE_TYPES
TABLES.append(("FEE_TYPES",
[
    ("fee_type_id", "UUID", "PK NN", ""),
    ("fee_code", "VARCHAR(30)", "UQ NN", ""),
    ("fee_name", "VARCHAR(100)", "UQ NN", ""),
    ("category", "VARCHAR(30)", "NN", "Academic / Accommodation / Transport / Misc"),
    ("description", "TEXT", "", ""),
    ("refundable", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("mandatory_default", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("60000000-0000-0000-0000-000000000001","TUITION","Tuition Fee","Academic","Annual instruction charges",False,True,True,"2026-01-01","2026-01-01"),
    ("60000000-0000-0000-0000-000000000002","ADMISSION","Admission Fee","Academic","One-time admission",False,True,True,"2026-01-01","2026-01-01"),
    ("60000000-0000-0000-0000-000000000003","REGISTRATION","Registration Fee","Academic","Prospectus + form",False,False,True,"2026-01-01","2026-01-01"),
    ("60000000-0000-0000-0000-000000000004","HOSTEL","Hostel / Boarding Fee","Accommodation","Residence + meals",False,False,True,"2026-01-01","2026-01-01"),
    ("60000000-0000-0000-0000-000000000005","TRANSPORT","Transport Fee","Transport","Bus / van service",False,False,True,"2026-01-01","2026-01-01"),
    ("60000000-0000-0000-0000-000000000006","SECURITY_DEPOSIT","Security Deposit","Misc","Refundable at exit",True,True,True,"2026-01-01","2026-01-01"),
]))

# 8. FEE_CONCESSION_TYPES
TABLES.append(("FEE_CONCESSION_TYPES",
[
    ("concession_type_id", "UUID", "PK NN", ""),
    ("concession_code", "VARCHAR(30)", "UQ NN", ""),
    ("concession_name", "VARCHAR(100)", "UQ NN", "Sibling / Staff / Merit / EWS etc."),
    ("discount_type", "VARCHAR(20)", "NN", "PERCENTAGE or FIXED_AMOUNT"),
    ("default_value", "DECIMAL(12,2)", "NN", "Default % or flat amount"),
    ("eligibility_description", "TEXT", "", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("60100000-0000-0000-0000-000000000001","SIBLING","Sibling Concession","PERCENTAGE",5.00,"Second child onward",True,"2026-01-01","2026-01-01"),
    ("60100000-0000-0000-0000-000000000002","STAFF","Staff Child Concession","PERCENTAGE",25.00,"Child of teaching/non-teaching staff",True,"2026-01-01","2026-01-01"),
    ("60100000-0000-0000-0000-000000000003","MERIT","Merit Scholarship","PERCENTAGE",20.00,"Top 5% entrance test",True,"2026-01-01","2026-01-01"),
    ("60100000-0000-0000-0000-000000000004","EWS","EWS Quota Concession","PERCENTAGE",100.00,"Economically weaker section per RTE",True,"2026-01-01","2026-01-01"),
]))

# 9. DOCUMENT_TYPES
TABLES.append(("DOCUMENT_TYPES",
[
    ("document_type_id", "UUID", "PK NN", ""),
    ("document_code", "VARCHAR(30)", "UQ NN", ""),
    ("document_name", "VARCHAR(100)", "UQ NN", ""),
    ("document_category", "VARCHAR(30)", "NN", "Identity / Academic / Medical / Residence / Other"),
    ("description", "TEXT", "", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("60200000-0000-0000-0000-000000000001","BIRTH_CERT","Birth Certificate","Identity","Govt issued birth certificate",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000002","AADHAAR","Aadhaar Card","Identity","Child Aadhaar number",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000003","TC","Transfer Certificate","Academic","From previous school",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000004","MARK_SHEET","Previous Year Mark Sheet","Academic","Last 2 years report card",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000005","VACCINE","Vaccination Record","Medical","Age-appropriate vaccines",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000006","ADDRESS_PROOF","Address Proof","Residence","Parent electricity bill / rental",True,"2026-01-01","2026-01-01"),
    ("60200000-0000-0000-0000-000000000007","PASSPORT_PHOTO","Passport Size Photo","Identity","4 recent colour photos",True,"2026-01-01","2026-01-01"),
]))

# ========================================================================
# DIAGRAM 1 LEFT: BOARDS, SCHOOL_TYPES, FACILITIES (Master)
# ========================================================================

# 10. BOARDS
TABLES.append(("BOARDS",
[
    ("board_id", "UUID", "PK NN", ""),
    ("board_code", "VARCHAR(10)", "UQ NN", "CBSE, ICSE, IB, IGCSE, STATE"),
    ("board_name", "VARCHAR(100)", "NN", ""),
    ("slug", "VARCHAR(100)", "UQ NN", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("70000000-0000-0000-0000-000000000001","CBSE","Central Board of Secondary Education","cbse",True,"2026-01-01","2026-01-01"),
    ("70000000-0000-0000-0000-000000000002","ICSE","Indian Certificate of Secondary Education","icse",True,"2026-01-01","2026-01-01"),
    ("70000000-0000-0000-0000-000000000003","IB","International Baccalaureate","ib",True,"2026-01-01","2026-01-01"),
    ("70000000-0000-0000-0000-000000000004","IGCSE","International General Certificate of Secondary Education","igcse",True,"2026-01-01","2026-01-01"),
    ("70000000-0000-0000-0000-000000000005","STATE","State Board","state-board",True,"2026-01-01","2026-01-01"),
]))

# 11. SCHOOL_TYPES (YOUR 3 TYPES!)
TABLES.append(("SCHOOL_TYPES",
[
    ("school_type_id", "UUID", "PK NN", ""),
    ("type_code", "VARCHAR(20)", "UQ NN", "DAY / DAY-BOARDING / FULL-BOARDING"),
    ("type_name", "VARCHAR(50)", "UQ NN", ""),
    ("slug", "VARCHAR(50)", "UQ NN", ""),
    ("boarding_required", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("description", "TEXT", "", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("70100000-0000-0000-0000-000000000001","DAY","Day School","day",False,"Regular day scholar program; no residence on campus",True,"2026-01-01","2026-01-01"),
    ("70100000-0000-0000-0000-000000000002","DAY-BOARDING","Day Boarding","day-boarding",False,"Extended day with meals + homework support; student returns home nightly",True,"2026-01-01","2026-01-01"),
    ("70100000-0000-0000-0000-000000000003","FULL-BOARDING","Full Boarding (Residential)","full-boarding",True,"Full-time on-campus hostel accommodation with meals, 24/7 supervision",True,"2026-01-01","2026-01-01"),
]))

# 12. FACILITIES
TABLES.append(("FACILITIES",
[
    ("facility_id", "UUID", "PK NN", ""),
    ("facility_code", "VARCHAR(30)", "UQ NN", ""),
    ("facility_name", "VARCHAR(100)", "NN", ""),
    ("slug", "VARCHAR(100)", "UQ NN", ""),
    ("category", "VARCHAR(30)", "NN", "ACADEMIC / SPORTS / ACCOMMODATION / DINING / HEALTH / SAFETY / TRANSPORT / TECHNOLOGY / ARTS / STUDENT_SUPPORT"),
    ("icon_url", "VARCHAR(255)", "", "lucide icon name or URL"),
    ("description", "TEXT", "", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # ACADEMIC
    ("80000000-0000-0000-0000-000000000001","LIBRARY","Library","library","ACADEMIC","Library","Books, digital resources, reading area",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000002","SCIENCE_LAB","Science Laboratory","science-laboratory","ACADEMIC","Flask","Physics, Chemistry, Biology labs",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000003","COMPUTER_LAB","Computer Laboratory","computer-laboratory","ACADEMIC","Monitor","IT lab with internet",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000004","SMART_CLASS","Smart Classrooms","smart-classrooms","ACADEMIC","Projector","Interactive boards, projectors",True,"2026-01-01","2026-01-01"),
    # SPORTS
    ("80000000-0000-0000-0000-000000000005","SPORTS_GROUND","Sports Ground","sports-ground","SPORTS","Target","Cricket / football field",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000006","SWIMMING_POOL","Swimming Pool","swimming-pool","SPORTS","Waves","Semi-Olympic / Olympic size",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000007","GYMNASIUM","Gymnasium","gymnasium","SPORTS","Dumbbell","Indoor badminton, basketball, gym",True,"2026-01-01","2026-01-01"),
    # ACCOMMODATION
    ("80000000-0000-0000-0000-000000000008","HOSTEL","Hostel / Dormitory","hostel","ACCOMMODATION","BedDouble","Separate boys/girls hostel",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000009","DINING_HALL","Dining Hall / Mess","dining-hall","DINING","Utensils","Multi-cuisine cafeteria",True,"2026-01-01","2026-01-01"),
    # HEALTH & SAFETY
    ("80000000-0000-0000-0000-000000000010","MEDICAL","Medical Centre / Infirmary","medical-centre","HEALTH","Stethoscope","On-campus nurse + doctor visits",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000011","CCTV","CCTV Surveillance","cctv-surveillance","SAFETY","Camera","24x7 camera coverage campus-wide",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000012","SECURITY","24x7 Security Personnel","security-personnel","SAFETY","Shield","Trained security guards at gates & dorms",True,"2026-01-01","2026-01-01"),
    # TRANSPORT & TECH
    ("80000000-0000-0000-0000-000000000013","SCHOOL_BUS","School Bus Service","school-transport","TRANSPORT","Bus","GPS-enabled fleet",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000014","WIFI","Wi-Fi Campus","wi-fi-campus","TECHNOLOGY","Wifi","High-speed campus wifi",True,"2026-01-01","2026-01-01"),
    # ARTS & STUDENT SUPPORT
    ("80000000-0000-0000-0000-000000000015","MUSIC_ROOM","Music Room","music-room","ARTS","Music","Instrumental & vocal training",True,"2026-01-01","2026-01-01"),
    ("80000000-0000-0000-0000-000000000016","COUNSELLING","Counselling Services","counselling-services","STUDENT_SUPPORT","Heart","Career, emotional & academic counselling",True,"2026-01-01","2026-01-01"),
]))

# ========================================================================
# USERS / ROLES / RBAC (ER Diagram 1 Right Side)
# ========================================================================

# 13. ROLES
TABLES.append(("ROLES",
[
    ("role_id", "UUID", "PK NN", ""),
    ("role_name", "VARCHAR(30)", "UQ NN", "SUPER_ADMIN / STAFF_ADMIN / SCHOOL_ADMIN / PARENT"),
    ("description", "VARCHAR(255)", "", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("90000000-0000-0000-0000-000000000001","SUPER_ADMIN","Platform owner — full system, permissions, users, verification",True,"2026-01-01"),
    ("90000000-0000-0000-0000-000000000002","STAFF_ADMIN","Operations / CRM — leads, enquiries, follow-ups, counselling",True,"2026-01-01"),
    ("90000000-0000-0000-0000-000000000003","SCHOOL_ADMIN","School manager — profile, fees, admissions, reviews for their school ONLY",True,"2026-01-01"),
    ("90000000-0000-0000-0000-000000000004","PARENT","Parent / Guardian — search, apply, track children applications",True,"2026-01-01"),
]))

# 14. USERS
TABLES.append(("USERS",
[
    ("user_id", "UUID", "PK NN", "Django AbstractUser extended"),
    ("email", "VARCHAR(255)", "UQ NN", "Unique login email"),
    ("password_hash", "VARCHAR(255)", "NN", "Bcrypt/argon hashed"),
    ("is_phone_verified", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("is_email_verified", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("status", "VARCHAR(20)", "NN DEFAULT ACTIVE", "ACTIVE / INACTIVE / SUSPENDED"),
    ("last_login_at", "TIMESTAMPTZ", "", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # (placeholder UUIDs; seed script can replace with real Django User rows via createsuperuser)
]))

# 15. USER_ROLES (M2M Users<->Roles)
TABLES.append(("USER_ROLES",
[
    ("user_role_id", "UUID", "PK NN", ""),
    ("user_id", "UUID", "FK NN", "→ USERS.user_id"),
    ("role_id", "UUID", "FK NN", "→ ROLES.role_id"),
    ("assigned_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[]))  # Seed during user creation

# 16. PARENT_PROFILES
TABLES.append(("PARENT_PROFILES",
[
    ("parent_id", "UUID", "PK NN", ""),
    ("user_id", "UUID", "FK UQ NN", "→ USERS.user_id (1:1)"),
    ("first_name", "VARCHAR(50)", "NN", ""),
    ("last_name", "VARCHAR(50)", "NN", ""),
    ("city", "VARCHAR(100)", "", ""),
    ("profile_photo_url", "VARCHAR(500)", "", ""),
    ("dob", "DATE", "", ""),
    ("address", "VARCHAR(500)", "", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[]))

# 17. CHILDREN
TABLES.append(("CHILDREN",
[
    ("child_id", "UUID", "PK NN", ""),
    ("parent_id", "UUID", "FK NN", "→ PARENT_PROFILES.parent_id"),
    ("name", "VARCHAR(100)", "NN", ""),
    ("date_of_birth", "DATE", "NN", ""),
    ("gender", "VARCHAR(10)", "NN", "MALE / FEMALE / OTHER"),
    ("current_grade", "UUID", "FK", "→ GRADES.grade_id (Applying for grade)"),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[]))

# ========================================================================
# SCHOOLS (CENTRAL ENTITY - Diagram 1 & 2) + SCHOOL_FACILITIES (Junction)
# ========================================================================

# 18. SCHOOLS
TABLES.append(("SCHOOLS",
[
    ("school_id", "UUID", "PK NN", ""),
    ("school_code", "VARCHAR(20)", "UQ NN", "e.g. SCH001"),
    ("school_name", "VARCHAR(255)", "NN", ""),
    ("short_name", "VARCHAR(50)", "", ""),
    ("slug", "VARCHAR(300)", "UQ NN", "URL slug"),
    # 4-Level Geography FKs (matches Diagram 1 arrows)
    ("country_id", "UUID", "FK NN", "→ COUNTRIES"),
    ("state_id", "UUID", "FK NN", "→ STATES"),
    ("city_id", "UUID", "FK NN", "→ CITIES"),
    ("location_id", "UUID", "FK", "→ LOCATIONS (optional)"),
    # Master FKs (Diagram 1)
    ("board_id", "UUID", "FK NN", "→ BOARDS"),
    ("school_type_id", "UUID", "FK NN", "→ SCHOOL_TYPES"),
    # Attributes
    ("gender", "VARCHAR(10)", "NN DEFAULT COED", "COED / BOYS / GIRLS"),
    ("established_year", "SMALLINT", "", ""),
    ("pincode", "VARCHAR(20)", "", ""),
    ("address", "VARCHAR(500)", "NN", ""),
    ("lat", "DECIMAL(9,6)", "", "Latitude"),
    ("lng", "DECIMAL(9,6)", "", "Longitude"),
    ("phone", "VARCHAR(50)", "", ""),
    ("email", "VARCHAR(255)", "", ""),
    ("principal_name", "VARCHAR(100)", "", ""),
    ("boarding_required", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("verification_status", "VARCHAR(20)", "NN DEFAULT UNVERIFIED", "UNVERIFIED / PENDING / VERIFIED"),
    ("published_at", "TIMESTAMPTZ", "", "Date made public"),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # 3 Sample Schools with REAL UUID FK links to our seeded master data
    ("A0000000-0000-0000-0000-000000000001","SCH001","St. Mary's Residential School","St. Mary's","st-marys-residential-bangalore",
     "00000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000001","20000000-0000-0000-0000-000000000001","30000000-0000-0000-0000-000000000001",
     "70000000-0000-0000-0000-000000000001","70100000-0000-0000-0000-000000000003",
     "COED",1985,"560066","Whitefield Road, Bangalore","12.9698","77.7500","+91 80 2580 1234","info@stmarys.edu","Dr. Elizabeth Andrews",
     True,True,"VERIFIED","2026-01-15 00:00","2026-01-01","2026-06-01"),

    ("A0000000-0000-0000-0000-000000000002","SCH002","DPS Bangalore South","DPS South","dps-bangalore-south-jp-nagar",
     "00000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000001","20000000-0000-0000-0000-000000000001","30000000-0000-0000-0000-000000000002",
     "70000000-0000-0000-0000-000000000001","70100000-0000-0000-0000-000000000002",
     "COED",2005,"560078","JP Nagar, Bangalore","12.8990","77.5780","+91 80 2658 9999","admissions@dpssouth.edu","Mr. Rakesh Khanna",
     False,True,"VERIFIED","2026-02-01 00:00","2026-01-01","2026-06-01"),

    ("A0000000-0000-0000-0000-000000000003","SCH003","Bombay International School","BIS Mumbai","bombay-international-andheri",
     "00000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000002","20000000-0000-0000-0000-000000000002","30000000-0000-0000-0000-000000000004",
     "70000000-0000-0000-0000-000000000004","70100000-0000-0000-0000-000000000001",
     "COED",1998,"400053","Andheri West, Mumbai","19.1220","72.8340","+91 22 2631 4455","admin@bis.edu","Ms. Priya Iyer",
     False,True,"PENDING",None,"2026-01-01","2026-06-01"),
]))

# 19. SCHOOL_FACILITIES (Diagram 1 Junction M2M + Diagram 2 metadata)
TABLES.append(("SCHOOL_FACILITIES",
[
    ("school_facility_id", "UUID", "PK NN", ""),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("facility_id", "UUID", "FK NN", "→ FACILITIES"),
    ("available", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("quantity_or_capacity", "INTEGER", "", "E.g., 200 computers, 400 dorm beds"),
    ("description", "VARCHAR(500)", "", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # St. Mary's (SCH001) facilities
    ("B0000000-0000-0000-0000-000000000001","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000001",True,None,"Air-conditioned library with 25,000+ books, digital e-library access","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000002","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000006",True,None,"25m x 15m semi-Olympic heated swimming pool with certified coaches","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000003","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000008",True,400,"Separate boys (250 beds) and girls (150 beds) hostels with house parents","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000004","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000009",True,600,"Multi-cuisine dining hall — North Indian, South Indian, Continental menu rotation","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000005","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000010",True,None,"8-bed infirmary with 24x7 nurse; doctor on-call 30 mins; tie-up with nearby multi-specialty hospital","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000006","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000011",True,180,"CCTV cameras (80+ IP cameras, 30-day backup, monitored from control room)","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000007","A0000000-0000-0000-0000-000000000001","80000000-0000-0000-0000-000000000013",True,14,"GPS-enabled AC buses covering Whitefield, Marathahalli, KR Puram","2026-01-01","2026-01-01"),

    # DPS South (SCH002) facilities
    ("B0000000-0000-0000-0000-000000000008","A0000000-0000-0000-0000-000000000002","80000000-0000-0000-0000-000000000001",True,None,"3-story library block with reading rooms","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-000000000009","A0000000-0000-0000-0000-000000000002","80000000-0000-0000-0000-000000000004",True,None,"All 80 classrooms equipped with interactive smart boards","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-00000000000A","A0000000-0000-0000-0000-000000000002","80000000-0000-0000-0000-000000000003",True,120,"3 computer labs, latest PCs, high-speed leased line internet","2026-01-01","2026-01-01"),

    # BIS Mumbai (SCH003) facilities
    ("B0000000-0000-0000-0000-00000000000B","A0000000-0000-0000-0000-000000000003","80000000-0000-0000-0000-000000000002",True,None,"Physics, Chemistry, Biology, Composite labs with latest equipment","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-00000000000C","A0000000-0000-0000-0000-000000000003","80000000-0000-0000-0000-000000000015",True,None,"Separate keyboard, vocal, instrumental music rooms","2026-01-01","2026-01-01"),
    ("B0000000-0000-0000-0000-00000000000D","A0000000-0000-0000-0000-000000000003","80000000-0000-0000-0000-000000000016",True,None,"Full-time in-house career counsellor + weekly psychologist visits","2026-01-01","2026-01-01"),
]))

# ========================================================================
# FEES SECTION (Diagram 3 BROWN)
# ========================================================================

# 20. SCHOOL_FEES
TABLES.append(("SCHOOL_FEES",
[
    ("fee_id", "UUID", "PK NN", ""),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("fee_type_id", "UUID", "FK NN", "→ FEE_TYPES"),
    ("academic_year_id", "UUID", "FK NN", "→ ACADEMIC_YEARS"),
    ("grade_id", "UUID", "FK", "→ GRADES (NULL = all grades flat fee)"),
    ("amount", "DECIMAL(12,2)", "NN", "In currency_code below"),
    ("frequency", "VARCHAR(20)", "NN", "ANNUAL / QUARTERLY / MONTHLY / ONE_TIME"),
    ("currency_code", "CHAR(3)", "NN DEFAULT INR", "ISO 4217 code"),
    ("mandatory", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("refundable", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("applicable_from", "DATE", "", "Effective date (e.g., new rates from Apr 1)"),
    ("description", "VARCHAR(500)", "", ""),
    ("due_date", "DATE", "", "Payment deadline"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # SCH001: St. Mary's - Full Boarding CBSE AY 2026-27 - Grade 8
    ("C0000000-0000-0000-0000-000000000001","A0000000-0000-0000-0000-000000000001","60000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000005",350000.00,"ANNUAL","INR",True,False,"2026-04-01","Tuition (Grade 8) - Annual","2026-06-15",True,"2026-01-01","2026-01-01"),
    ("C0000000-0000-0000-0000-000000000002","A0000000-0000-0000-0000-000000000001","60000000-0000-0000-0000-000000000004","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000005",250000.00,"ANNUAL","INR",False,False,"2026-04-01","Full Boarding (Hostel + Meals, Grade 8)","2026-06-15",True,"2026-01-01","2026-01-01"),
    ("C0000000-0000-0000-0000-000000000003","A0000000-0000-0000-0000-000000000001","60000000-0000-0000-0000-000000000005","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000005",55000.00,"ANNUAL","INR",False,False,"2026-04-01","School Transport - AC Bus (Grade 8)","2026-06-15",True,"2026-01-01","2026-01-01"),
    ("C0000000-0000-0000-0000-000000000004","A0000000-0000-0000-0000-000000000001","60000000-0000-0000-0000-000000000002","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000005",75000.00,"ONE_TIME","INR",True,False,"2026-04-01","Admission Fee (One-time, Grade 8 new admissions)","2026-06-15",True,"2026-01-01","2026-01-01"),
    ("C0000000-0000-0000-0000-000000000005","A0000000-0000-0000-0000-000000000001","60000000-0000-0000-0000-000000000006","40000000-0000-0000-0000-000000000002",None,100000.00,"ONE_TIME","INR",True,True,"2026-04-01","Security Deposit (refundable on TC)","2026-06-15",True,"2026-01-01","2026-01-01"),

    # SCH002: DPS South - Day Boarding CBSE AY 2026-27 - Grade 1
    ("C0000000-0000-0000-0000-000000000006","A0000000-0000-0000-0000-000000000002","60000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000003",140000.00,"ANNUAL","INR",True,False,"2026-04-01","Tuition Grade 1 - Annual","2026-06-10",True,"2026-01-01","2026-01-01"),
    ("C0000000-0000-0000-0000-000000000007","A0000000-0000-0000-0000-000000000002","60000000-0000-0000-0000-000000000003","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000003",2500.00,"ONE_TIME","INR",False,False,"2026-04-01","Prospectus + Registration Grade 1","2026-06-01",True,"2026-01-01","2026-01-01"),

    # SCH003: BIS Mumbai - Day IGCSE AY 2026-27 - Grade 10
    ("C0000000-0000-0000-0000-000000000008","A0000000-0000-0000-0000-000000000003","60000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000006",520000.00,"ANNUAL","INR",True,False,"2026-04-01","IGCSE Tuition Grade 10 - Annual incl. exam fees component","2026-07-01",True,"2026-01-01","2026-01-01"),
]))

# 21. FEE_COMPONENTS (1:n SchoolFees breakdown)
TABLES.append(("FEE_COMPONENTS",
[
    ("fee_component_id", "UUID", "PK NN", ""),
    ("fee_id", "UUID", "FK NN", "→ SCHOOL_FEES"),
    ("component_name", "VARCHAR(100)", "NN", "E.g., Books, Lab Fee included in Tuition"),
    ("amount", "DECIMAL(12,2)", "NN", ""),
    ("mandatory", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("refundable", "BOOLEAN", "NN DEFAULT FALSE", ""),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("D0000000-0000-0000-0000-000000000001","C0000000-0000-0000-0000-000000000001","Base Tuition (Instruction)",250000.00,True,False,1,True,"2026-01-01","2026-01-01"),
    ("D0000000-0000-0000-0000-000000000002","C0000000-0000-0000-0000-000000000001","Books & Stationery Kit",25000.00,True,False,2,True,"2026-01-01","2026-01-01"),
    ("D0000000-0000-0000-0000-000000000003","C0000000-0000-0000-0000-000000000001","Smart Class + IT Lab Fee",30000.00,True,False,3,True,"2026-01-01","2026-01-01"),
    ("D0000000-0000-0000-0000-000000000004","C0000000-0000-0000-0000-000000000001","Activity (Sports/Arts/Cocurricular)",45000.00,True,False,4,True,"2026-01-01","2026-01-01"),
]))

# 22. FEE_PAYMENT_SCHEDULES
TABLES.append(("FEE_PAYMENT_SCHEDULES",
[
    ("schedule_id", "UUID", "PK NN", ""),
    ("fee_id", "UUID", "FK NN", "→ SCHOOL_FEES"),
    ("installment_number", "SMALLINT", "NN", "1=Term1, 2=Term2, 3=Term3 or 1-12 Monthly"),
    ("installment_name", "VARCHAR(50)", "NN", "Term I, October Installment"),
    ("due_date", "DATE", "NN", ""),
    ("amount", "DECIMAL(12,2)", "NN", "Amount due this installment"),
    ("late_fee_amount", "DECIMAL(12,2)", "NN DEFAULT 0", "Flat late fee after due"),
    ("late_fee_per_day", "DECIMAL(12,2)", "NN DEFAULT 0", "Daily compound/flat after grace"),
    ("grace_period_days", "SMALLINT", "NN DEFAULT 5", "Days after due before late fee"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # SCH001 Grade 8 Tuition (350k Annual) → 2 installments (June + Nov)
    ("E0000000-0000-0000-0000-000000000001","C0000000-0000-0000-0000-000000000001",1,"Term I (April - September)","2026-06-15",175000.00,2000.00,50.00,5,True,"2026-01-01","2026-01-01"),
    ("E0000000-0000-0000-0000-000000000002","C0000000-0000-0000-0000-000000000001",2,"Term II (October - March)","2026-11-15",175000.00,2000.00,50.00,5,True,"2026-01-01","2026-01-01"),

    # SCH002 Grade 1 Tuition (140k Annual) → 3 installments (June, Nov, Feb)
    ("E0000000-0000-0000-0000-000000000003","C0000000-0000-0000-0000-000000000006",1,"Term I","2026-06-10",48000.00,1000.00,25.00,5,True,"2026-01-01","2026-01-01"),
    ("E0000000-0000-0000-0000-000000000004","C0000000-0000-0000-0000-000000000006",2,"Term II","2026-11-10",48000.00,1000.00,25.00,5,True,"2026-01-01","2026-01-01"),
    ("E0000000-0000-0000-0000-000000000005","C0000000-0000-0000-0000-000000000006",3,"Term III","2027-02-10",44000.00,1000.00,25.00,5,True,"2026-01-01","2026-01-01"),
]))

# 23. SCHOOL_FEE_CONCESSIONS
TABLES.append(("SCHOOL_FEE_CONCESSIONS",
[
    ("school_fee_concession_id", "UUID", "PK NN", ""),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("fee_id", "UUID", "FK", "→ SCHOOL_FEES (NULL = all fees of school)"),
    ("concession_type_id", "UUID", "FK NN", "→ FEE_CONCESSION_TYPES"),
    ("maximum_discount", "DECIMAL(12,2)", "NN", "Max % or Max flat amount"),
    ("eligibility_criteria", "TEXT", "", "School-specific description"),
    ("application_required", "BOOLEAN", "NN DEFAULT TRUE", "Concession requires form/submission"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("F0000000-0000-0000-0000-000000000001","A0000000-0000-0000-0000-000000000001",None,"60100000-0000-0000-0000-000000000001",10.00,"2nd child 5%, 3rd child 10% on Tuition + Hostel",True,True,"2026-01-01","2026-01-01"),
    ("F0000000-0000-0000-0000-000000000002","A0000000-0000-0000-0000-000000000001",None,"60100000-0000-0000-0000-000000000003",30.00,"Entrance Test Rank 1-20: 30%, Rank 21-50: 20%, Rank 51-100: 10% on Tuition only",True,True,"2026-01-01","2026-01-01"),
    ("F0000000-0000-0000-0000-000000000003","A0000000-0000-0000-0000-000000000002","C0000000-0000-0000-0000-000000000006","60100000-0000-0000-0000-000000000004",100.00,"EWS RTE quota: 25% seats Grade 1 income < 1L/annum",True,True,"2026-01-01","2026-01-01"),
]))

# ========================================================================
# ADMISSIONS SECTION (Diagram 3 BLUE)
# ========================================================================

# 24. ADMISSIONS
TABLES.append(("ADMISSIONS",
[
    ("admission_id", "UUID", "PK NN", ""),
    ("admission_code", "VARCHAR(30)", "UQ NN", "e.g. SCH001-2627"),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("academic_year_id", "UUID", "FK NN", "→ ACADEMIC_YEARS"),
    ("application_fee", "DECIMAL(12,2)", "NN DEFAULT 0", "Prospectus form cost"),
    ("application_start", "DATE", "NN", "Admissions open date"),
    ("application_deadline", "DATE", "NN", "Form submission last date"),
    ("admission_start", "DATE", "NN", "Classes commence"),
    ("admission_end", "DATE", "NN", "Academic session end (or admission close)"),
    ("application_mode", "VARCHAR(20)", "NN DEFAULT BOTH", "ONLINE / OFFLINE / BOTH"),
    ("application_url", "VARCHAR(255)", "", "External portal link"),
    ("currency_code", "CHAR(3)", "NN DEFAULT INR", ""),
    ("applicable_grades", "UUID[]", "NN", "Array of grade_ids accepting apps"),
    ("entrance_exam_required", "BOOLEAN", "NN DEFAULT FALSE", "Test/interview required"),
    ("entrance_exam_date", "DATE", "", ""),
    ("interview_required", "BOOLEAN", "NN DEFAULT FALSE", "Parent + child interaction"),
    ("age_criteria_description", "TEXT", "", "Cutoff dates, min age per grade"),
    ("eligibility_criteria_description", "TEXT", "", "General eligibility"),
    ("admission_process_description", "TEXT", "", "Overall narrative"),
    ("contact_phone", "VARCHAR(50)", "", ""),
    ("contact_email", "VARCHAR(255)", "", ""),
    ("description", "TEXT", "", "Highlights"),
    ("status", "VARCHAR(20)", "NN DEFAULT DRAFT", "DRAFT / PUBLISHED / CLOSED / ARCHIVED"),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("G0000000-0000-0000-0000-000000000001","SCH001-2627","A0000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002",
     3000.00,"2026-10-01","2026-12-20","2026-04-01","2027-03-31","ONLINE",
     "https://admissions.stmarys.edu/register",
     "INR",
     ['50000000-0000-0000-0000-000000000003',
           '50000000-0000-0000-0000-000000000005',
           '50000000-0000-0000-0000-000000000006',
           '50000000-0000-0000-0000-000000000007'],
     True,"2027-01-15",True,
     "Grade 1: 5-6 years as of June 1 2026; Grade 8: 12-13 years; Grade 12 max 18",
     "2 years prior school report card; birth certificate; Aadhaar; conduct certificate for Grade 3+",
     "1) Submit form → 2) Entrance Test (Jan 15) → 3) Parent-Student Interview (Jan 20-25) → 4) Offer Letter (Jan 30) → 5) Fee Payment (Feb 15 last)",
     "+91 80 2580 5000","admissions@stmarys.edu",
     "St. Mary's Residential School — Full Boarding CBSE admissions for 2026-27. NRI/Foreign seats available. Limited seats Grade 8 (boarding).",
     "PUBLISHED","2026-01-01","2026-06-10"),
]))

# 25. ADMISSION_GRADES (PER-GRADE STATUS - DIAGRAM 3 KEY!)
TABLES.append(("ADMISSION_GRADES",
[
    ("admission_grade_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("grade_id", "UUID", "FK NN", "→ GRADES"),
    ("seat_status", "VARCHAR(20)", "NN DEFAULT OPEN", "OPEN / WAITLIST / CLOSED"),
    ("total_seats", "INTEGER", "NN", "Intake for this grade"),
    ("seats_filled", "INTEGER", "NN DEFAULT 0", "Currently admitted"),
    ("minimum_age", "DECIMAL(4,1)", "", "Min age years"),
    ("maximum_age", "DECIMAL(4,1)", "", "Max age years"),
    ("eligibility_criteria", "TEXT", "", "Grade-specific rules"),
    ("application_end_date", "DATE", "", "Grade-specific deadline (overrides parent)"),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    # SCH001 AY 2627 grade-specific (matches Diagram 7 example: Open/Waitlist/Closed)
    ("H0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000003","OPEN",120,45,5.0,6.0,"TC from previous school + birth certificate","2026-12-20",1,True,"2026-01-01","2026-01-01"),
    ("H0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000004","OPEN",60,55,9.0,10.5,"Grade 4 report card; CBSE/ICSE equivalent","2026-12-20",5,True,"2026-01-01","2026-06-01"),
    ("H0000000-0000-0000-0000-000000000003","G0000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000005","WAITLIST",60,60,12.0,13.5,"Grade 7 CBSE TC required; minimum 75% in last year","2026-11-30",10,True,"2026-01-01","2026-08-15"),
    ("H0000000-0000-0000-0000-000000000004","G0000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000006","CLOSED",80,80,14.5,16.0,"No longer accepting applications; next year 2027-28 opens Oct 2026","2026-10-15",12,False,"2026-01-01","2026-10-15"),
]))

# 26. ADMISSION_DOCUMENTS
TABLES.append(("ADMISSION_DOCUMENTS",
[
    ("admission_document_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("document_type_id", "UUID", "FK NN", "→ DOCUMENT_TYPES"),
    ("required", "BOOLEAN", "NN DEFAULT TRUE", "Mandatory vs optional"),
    ("applicable_to_grade", "UUID", "FK", "→ GRADES (NULL = all grades)"),
    ("accepted_formats", "VARCHAR(100)", "NN", ".pdf,.jpg,.png (max 5MB)"),
    ("max_size_mb", "SMALLINT", "NN DEFAULT 5", ""),
    ("multiple_allowed", "BOOLEAN", "NN DEFAULT FALSE", "E.g., multiple mark sheets"),
    ("description", "TEXT", "", "Specific instructions"),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("I0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000001",True,None,".pdf,.jpg,.png",10,False,"Government-issued birth certificate (English/Hindi). Self-attested copy; must show DOB clearly.",1,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000003",True,"50000000-0000-0000-0000-000000000005",".pdf",10,False,"Transfer Certificate from previous school (for Grade 8+ applicants). Original TC to be submitted at time of admission.",2,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000003","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000004",True,None,".pdf",20,True,"Last 2 academic years report card / mark sheet (all pages). Color scan.",3,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000004","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000005",True,None,".pdf,.jpg",10,False,"Immunization record / vaccine history + medical fitness certificate from RMP.",4,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000005","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000007",True,None,".jpg,.png",5,True,"4 recent passport-size colour photos (white background, formal dress).",5,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000006","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000002",True,None,".pdf,.jpg",10,False,"Child Aadhaar (both sides) + parent Aadhaar copy.",6,True,"2026-01-01","2026-01-01"),
    ("I0000000-0000-0000-0000-000000000007","G0000000-0000-0000-0000-000000000001","60200000-0000-0000-0000-000000000006",False,None,".pdf,.jpg",10,False,"Address proof (parent utility bill or rental agreement - OPTIONAL for hostel students, RECOMMENDED).",7,True,"2026-01-01","2026-01-01"),
]))

# 27. ADMISSION_REQUIREMENTS
TABLES.append(("ADMISSION_REQUIREMENTS",
[
    ("requirement_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("requirement_type", "VARCHAR(30)", "NN", "DOCUMENT / MIN_AGE / MIN_MARKS / TEST_SCORE / INTERVIEW / OTHER"),
    ("requirement_name", "VARCHAR(200)", "NN", ""),
    ("description", "TEXT", "", ""),
    ("mandatory", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("J0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001","MIN_AGE","Minimum Age per Grade Cutoff","Age calculated as of June 1st, 2026. Grade 1 (5-6 yrs), Grade 8 (12-13 yrs).",True,1,True,"2026-01-01","2026-01-01"),
    ("J0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001","MIN_MARKS","Minimum 70% in Previous 2 Years","All Grade 3+ applicants must show ≥ 70% aggregate in last 2 academic years.",True,2,True,"2026-01-01","2026-01-01"),
    ("J0000000-0000-0000-0000-000000000003","G0000000-0000-0000-0000-000000000001","TEST_SCORE","Entrance Test (English + Math + Reasoning)","Objective 100-mark test. Syllabus: previous grade CBSE. Cutoff 60% for General, 50% for Reserved.",True,3,True,"2026-01-01","2026-01-01"),
    ("J0000000-0000-0000-0000-000000000004","G0000000-0000-0000-0000-000000000001","INTERVIEW","Parent + Student Interaction","30-min panel interview. Assesses communication, values fit with boarding ethos, parental support.",True,4,True,"2026-01-01","2026-01-01"),
    ("J0000000-0000-0000-0000-000000000005","G0000000-0000-0000-0000-000000000001","DOCUMENT","All Mandatory Uploads (see Documents tab)","All documents marked MANDATORY must be uploaded on portal before deadline.",True,5,True,"2026-01-01","2026-01-01"),
]))

# 28. ADMISSION_STEPS (Ordered Process Steps)
TABLES.append(("ADMISSION_STEPS",
[
    ("admission_step_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("step_number", "SMALLINT", "NN", "1..N ordered"),
    ("step_name", "VARCHAR(200)", "NN", ""),
    ("step_description", "TEXT", "", ""),
    ("duration_hint", "VARCHAR(50)", "", "Expected time"),
    ("mandatory", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("K0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001",1,"Online Registration & Fee Payment","Create parent account on portal, fill child profile, pay ₹3,000 application fee. Receive APP Number.","~15 minutes",True,1,True,"2026-01-01","2026-01-01"),
    ("K0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001",2,"Upload All Mandatory Documents","Scan & upload birth cert, mark sheets, medical, photos — per Documents list (see other tab).","~20 minutes",True,2,True,"2026-01-01","2026-01-01"),
    ("K0000000-0000-0000-0000-000000000003","G0000000-0000-0000-0000-000000000001",3,"Appear for Entrance Test","Report to campus on test date with hall ticket + ID. 100-mark objective test (English, Math, Reasoning).","3 hours",True,3,True,"2026-01-01","2026-01-01"),
    ("K0000000-0000-0000-0000-000000000004","G0000000-0000-0000-0000-000000000001",4,"Parent + Student Interview","Panel session with Principal + House Master. Optional campus tour & hostel visit post-interview.","45 mins",True,4,True,"2026-01-01","2026-01-01"),
    ("K0000000-0000-0000-0000-000000000005","G0000000-0000-0000-0000-000000000001",5,"Offer Letter & Fee Deposit","Selected candidates receive e-offer. Block seat by paying 1st term fee within 15 days of offer.","~5 days",True,5,True,"2026-01-01","2026-01-01"),
    ("K0000000-0000-0000-0000-000000000006","G0000000-0000-0000-0000-000000000001",6,"Document Verification + Joining","Submit original documents (TC, birth cert) in-person on joining day. Issue hostel room key, ID card, timetable.","1 day",True,6,True,"2026-01-01","2026-01-01"),
]))

# 29. ADMISSION_RESOURCES
TABLES.append(("ADMISSION_RESOURCES",
[
    ("resource_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("resource_type", "VARCHAR(30)", "NN", "SYLLABUS / SAMPLE_PAPER / BROCHURE / TIMETABLE / FAQ / VIDEO / OTHER"),
    ("title", "VARCHAR(255)", "NN", ""),
    ("description", "TEXT", "", ""),
    ("file_url", "VARCHAR(500)", "", "S3/GCS object URL"),
    ("file_name", "VARCHAR(255)", "", "Original upload filename"),
    ("mime_type", "VARCHAR(100)", "", ""),
    ("file_size_bytes", "BIGINT", "", ""),
    ("display_order", "SMALLINT", "NN DEFAULT 0", ""),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("L0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001","BROCHURE","St. Mary's Residential School — 2026-27 Admissions Brochure","Full-colour 28-page brochure: campus life, academics, boarding, fees, admission timeline.","https://cdn.boardingedu.com/sch001/brochures/SCH001-Brochure-2026.pdf","SCH001-Brochure-2026.pdf","application/pdf",15234567,1,True,"2026-01-01","2026-01-01"),
    ("L0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001","SYLLABUS","Entrance Test Syllabus — Grade 8","Topic-wise breakup for English (Grammar+Comprehension+Composition), Math, and Logical Reasoning.","https://cdn.boardingedu.com/sch001/2627/syllabus/Grade-8-Syllabus.pdf","Grade-8-Entrance-Syllabus.pdf","application/pdf",189234,2,True,"2026-01-01","2026-01-01"),
    ("L0000000-0000-0000-0000-000000000003","G0000000-0000-0000-0000-000000000001","SAMPLE_PAPER","Grade 8 Entrance Sample Paper with Key","Previous year question paper pattern + 1 full sample with answer key.","https://cdn.boardingedu.com/sch001/2627/sample/Grade-8-Sample-Paper-Key.pdf","Grade-8-Sample-Paper-Key.pdf","application/pdf",3120987,3,True,"2026-01-01","2026-01-01"),
    ("L0000000-0000-0000-0000-000000000004","G0000000-0000-0000-0000-000000000001","FAQ","Admissions FAQ — 2026-27","Top 50 parent questions about boarding, dress code, holidays, medical, refunds, NRI process.","https://cdn.boardingedu.com/sch001/2627/faq/SCH001-FAQ-2026.pdf","SCH001-FAQ-2026.pdf","application/pdf",428192,4,True,"2026-01-01","2026-01-01"),
    ("L0000000-0000-0000-0000-000000000005","G0000000-0000-0000-0000-000000000001","VIDEO","Virtual Campus Tour — St. Mary's","15-min drone + walkthrough tour: academic blocks, hostels, mess, sports facilities, pool.","https://cdn.boardingedu.com/sch001/media/virtual-tour-2026.mp4","SCH001-Virtual-Tour-2026.mp4","video/mp4",198273645,5,True,"2026-01-01","2026-01-01"),
]))

# 30. ADMISSION_CONTACTS
TABLES.append(("ADMISSION_CONTACTS",
[
    ("admission_contact_id", "UUID", "PK NN", ""),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("contact_name", "VARCHAR(100)", "NN", ""),
    ("designation", "VARCHAR(100)", "NN", "Role at school"),
    ("phone", "VARCHAR(50)", "", ""),
    ("alternate_phone", "VARCHAR(50)", "", ""),
    ("email", "VARCHAR(255)", "", ""),
    ("office_hours", "VARCHAR(255)", "", "Mon - Sat: 9am - 4pm IST"),
    ("status", "BOOLEAN", "NN DEFAULT TRUE", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[
    ("M0000000-0000-0000-0000-000000000001","G0000000-0000-0000-0000-000000000001","Ms. Anjali Desai","Head of Admissions","+91 80 2580 5000","+91 98450 12345","admissions@stmarys.edu","Monday to Saturday: 9:00 AM to 4:00 PM (Closed Sundays & Public Holidays)",True,"2026-01-01","2026-01-01"),
    ("M0000000-0000-0000-0000-000000000002","G0000000-0000-0000-0000-000000000001","Mr. Sandeep Menon","Admissions Counsellor (Boarding & NRI)","+91 80 2580 5005","+91 98860 54321","boarding.admissions@stmarys.edu","Monday to Friday: 9:30 AM - 5:00 PM",True,"2026-01-01","2026-01-01"),
]))

# ========================================================================
# DIAGRAM 1 CRM TABLES: ADMISSION_ENQUIRIES, APPLICATIONS, LEADS (User flows)
# ========================================================================

# 31. ADMISSION_ENQUIRIES
TABLES.append(("ADMISSION_ENQUIRIES",
[
    ("enquiry_id", "UUID", "PK NN", ""),
    ("enquiry_code", "VARCHAR(30)", "UQ NN", "EQ-2026-000001"),
    ("parent_id", "UUID", "FK", "→ PARENT_PROFILES (authenticated)"),
    ("child_id", "UUID", "FK", "→ CHILDREN (when logged in)"),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("academic_year_id", "UUID", "FK NN", "→ ACADEMIC_YEARS"),
    ("grade", "UUID", "FK", "→ GRADES (applying for)"),
    ("message", "TEXT", "NN", "Parent's free-text question"),
    ("source", "VARCHAR(30)", "NN", "WEBSITE / GOOGLE / REFERENCE / FACEBOOK / EXPO / OTHER"),
    ("status", "VARCHAR(20)", "NN DEFAULT NEW", "NEW / ASSIGNED / IN_PROGRESS / CALL_BACK / CONVERTED / CLOSED_LOST / SPAM"),
    ("assigned_to", "UUID", "FK", "→ USERS.user_id (STAFF_ADMIN who owns it)"),
    ("next_followup_at", "TIMESTAMPTZ", "", "Next followup datetime"),
    ("priority", "VARCHAR(10)", "NN DEFAULT MEDIUM", "LOW / MEDIUM / HIGH / URGENT"),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("closed_at", "TIMESTAMPTZ", "", "Date resolved or closed"),
],
[]))

# 32. APPLICATIONS
TABLES.append(("APPLICATIONS",
[
    ("application_id", "UUID", "PK NN", ""),
    ("application_code", "VARCHAR(30)", "UQ NN", "APP-SCH001-2627-000001"),
    ("parent_id", "UUID", "FK NN", "→ PARENT_PROFILES"),
    ("child_id", "UUID", "FK NN", "→ CHILDREN"),
    ("school_id", "UUID", "FK NN", "→ SCHOOLS"),
    ("admission_id", "UUID", "FK NN", "→ ADMISSIONS"),
    ("status", "VARCHAR(30)", "NN DEFAULT DRAFT", "DRAFT / SUBMITTED / UNDER_REVIEW / SHORTLISTED / CALLED_FOR_TEST / TEST_CLEARED / INTERVIEW_SCHEDULED / OFFERED / ACCEPTED / FEE_PAID / REJECTED / WITHDRAWN"),
    ("submitted_at", "TIMESTAMPTZ", "", ""),
    ("reviewed_at", "TIMESTAMPTZ", "", ""),
    ("approved_at", "TIMESTAMPTZ", "", ""),
    ("rejected_at", "TIMESTAMPTZ", "", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[]))

# 33. LEADS
TABLES.append(("LEADS",
[
    ("lead_id", "UUID", "PK NN", ""),
    ("lead_code", "VARCHAR(30)", "UQ NN", "LD-2026-000001"),
    ("enquiry_id", "UUID", "FK", "→ ADMISSION_ENQUIRIES (if lead originated from website enquiry)"),
    ("parent_id", "UUID", "FK", "→ PARENT_PROFILES"),
    ("child_id", "UUID", "FK", "→ CHILDREN"),
    ("school_id", "UUID", "FK", "→ SCHOOLS (target school)"),
    ("assigned_to", "UUID", "FK NN", "→ USERS (STAFF_ADMIN)"),
    ("lead_source", "VARCHAR(30)", "NN DEFAULT OTHER", "MANUAL / ENQUIRY / EXPO / REFERENCE / COLD_CALL / PAID_AD / PARTNER"),
    ("priority", "VARCHAR(10)", "NN DEFAULT MEDIUM", "LOW / MEDIUM / HIGH / HOT"),
    ("status", "VARCHAR(20)", "NN DEFAULT NEW", "NEW / CONTACTED / QUALIFIED / MEETING_SCHEDULED / PROPOSAL_SENT / NEGOTIATION / WON / LOST / INACTIVE"),
    ("next_followup_at", "TIMESTAMPTZ", "", ""),
    ("created_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
    ("updated_at", "TIMESTAMPTZ", "NN DEFAULT NOW()", ""),
],
[]))

# ============================================================
# GENERATION FUNCTION
# ============================================================
def build():
    wb = Workbook()
    wb.remove(wb.active)

    for sheet_name, cols, rows in TABLES:
        ws = wb.create_sheet(title=sheet_name[:31])  # Excel limit 31 chars

        # ----- Row 1: SECTION HEADER (Table info) -----
        ws.cell(row=1, column=1, value=f"TABLE: {sheet_name}").fill = SECTION_FILL
        ws.cell(row=1, column=1).font = Font(bold=True, size=13)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max(len(cols), 4))

        # ----- Row 3: COLUMN HEADER NAMES -----
        header_row = 3
        headers = ["Column Name", "Data Type", "Constraints", "Comments / Description"]
        for ci, h in enumerate(headers, start=1):
            cell = ws.cell(row=header_row, column=ci, value=h)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = THIN_BORDER

        # ----- Row 4+: COLUMN DEFS -----
        def_constraints_text = [c[2].strip() or "" for c in cols]
        for i, (name, dtype, cstr, comment) in enumerate(cols, start=1):
            row_idx = header_row + i
            c1 = ws.cell(row=row_idx, column=1, value=name)
            c2 = ws.cell(row=row_idx, column=2, value=dtype)
            c3 = ws.cell(row=row_idx, column=3, value=cstr)
            c4 = ws.cell(row=row_idx, column=4, value=comment)

            # Highlight PK/FK/UQ
            cstr_upper = cstr.upper()
            if "PK" in cstr_upper:
                for c in (c1,c2,c3,c4): c.fill = PK_FILL
            elif "FK" in cstr_upper:
                for c in (c1,c2,c3,c4): c.fill = FK_FILL
            elif "UQ" in cstr_upper:
                for c in (c1,c2,c3,c4): c.fill = UQ_FILL
            # NN font red
            if "NN" in cstr_upper:
                for c in (c1, c2, c3, c4):
                    if c.font.color and c.font.color.type == "rgb" and c.font.color.rgb == "FFFF0000":
                        c.font = copy(NN_FONT)
                    else:
                        c.font = copy(c.font)                # Re-apply NN font only if not PK/FK highlight
                        c3.font = Font(color="B91C1C", name="Calibri", size=10)
            for c in (c1,c2,c3,c4):
                c.border = THIN_BORDER
                c.alignment = WRAP

        # ----- BLANK GAP then SEED DATA BLOCK -----
        data_start = header_row + len(cols) + 3  # 2 blank lines + 1 header
        if rows:
            ws.cell(row=data_start - 1, column=1, value=f"SAMPLE / SEED DATA ROWS — ({len(rows)} rows)").fill = SECTION_FILL
            ws.cell(row=data_start - 1, column=1).font = Font(bold=True, size=12)
            ws.merge_cells(start_row=data_start-1, start_column=1, end_row=data_start-1, end_column=len(cols))

            for ci, (name, *_rest) in enumerate(cols, start=1):
                hc = ws.cell(row=data_start, column=ci, value=name)
                hc.fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
                hc.font = Font(bold=True, color="FFFFFF", size=10)
                hc.alignment = Alignment(horizontal="center", wrap_text=True)
                hc.border = THIN_BORDER

            for ri, row in enumerate(rows, start=1):
                for ci, val in enumerate(row, start=1):
                    if isinstance(val, list):
                         val = ", ".join(str(x) for x in val)
                         dc = ws.cell(row=data_start + ri, column=ci, value=val)
                         dc.border = THIN_BORDER
                         dc.alignment = WRAP

        # Auto column widths
        widths = [max(20, max([22] + [len(str(c[0])) for c in cols]))] + [20, 30, 55]
        for i, w in enumerate(widths, start=1):
            if i <= 4:
                ws.column_dimensions[get_column_letter(i)].width = w
        # For data >4 columns, just make them wider
        if len(cols) > 4:
            for i in range(5, len(cols)+1):
                ws.column_dimensions[get_column_letter(i)].width = 22

        # Freeze panes
        ws.freeze_panes = "A4"

    wb.save(OUTPUT_FILE)
    print(f"✅ Excel workbook saved successfully:\n   → {OUTPUT_FILE}")
    print(f"📊 Total sheets: {len(TABLES)}")
    for sn, _, rd in TABLES:
        print(f"   • {sn} → {len(rd)} seed rows")

if __name__ == "__main__":
    build()