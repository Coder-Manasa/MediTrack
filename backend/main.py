
from datetime import date
from typing import Optional
import re
import os
import sqlite3
from contextlib import closing

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

DB_PATH = os.getenv("DATABASE_PATH", "patients.db")

# Keep these options identical to the frontend dropdowns.
GENDERS = ["Female", "Male", "Other"]

WARDS = [
    "General Ward",
    "ICU",
    "Emergency",
    "Maternity",
    "Pediatrics",
    "Private Ward",
]

DEPARTMENTS = [
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "General Medicine",
    "Pediatrics",
    "Oncology",
    "Gynecology",
]

DOCTORS = [
    "Dr. Ananya Rao",
    "Dr. Rahul Sharma",
    "Dr. Meera Nair",
    "Dr. Arjun Kumar",
    "Dr. Priya Menon",
]


# ---------------- DATABASE CONNECTION ----------------

def get_db_connection():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with closing(get_db_connection()) as con:

        con.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                ward TEXT NOT NULL,
                department TEXT NOT NULL,
                doctor TEXT NOT NULL,
                admission_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Admitted',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        con.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                is_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        con.execute("""
            CREATE TABLE IF NOT EXISTS admin_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL DEFAULT 'Hospital Admin',
                email TEXT NOT NULL DEFAULT 'admin@meditrack.com',
                role TEXT NOT NULL DEFAULT 'Administrator'
            )
        """)

        con.execute("""
            INSERT OR IGNORE INTO admin_profile (id)
            VALUES (1)
        """)

        con.commit()


# ---------------- NOTIFICATIONS ----------------

def create_notification(title, message, notification_type="info"):
    with closing(get_db_connection()) as con:
        con.execute("""
            INSERT INTO notifications (title, message, type)
            VALUES (?, ?, ?)
        """, (title, message, notification_type))

        con.commit()


# ---------------- FASTAPI APPLICATION ----------------

app = FastAPI(
    title="MediTrack API",
    version="1.0.0",
    description="Patient admission management API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- PATIENT VALIDATION ----------------

class PatientInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=0, le=120)
    gender: str
    ward: str
    department: str
    doctor: str
    admission_date: date

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value or not re.fullmatch(r"[A-Za-z ]+", value):
            raise ValueError(
                "Name is required and must contain letters and spaces only."
            )

        return value

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, value):
        if value not in GENDERS:
            raise ValueError("Please select a valid gender.")
        return value

    @field_validator("ward")
    @classmethod
    def validate_ward(cls, value):
        if value not in WARDS:
            raise ValueError("Please select a valid ward.")
        return value

    @field_validator("department")
    @classmethod
    def validate_department(cls, value):
        if value not in DEPARTMENTS:
            raise ValueError("Please select a valid department.")
        return value

    @field_validator("doctor")
    @classmethod
    def validate_doctor(cls, value):
        if value not in DOCTORS:
            raise ValueError("Please select a valid doctor.")
        return value

    @field_validator("admission_date")
    @classmethod
    def validate_admission_date(cls, value):
        if value > date.today():
            raise ValueError("Admission date cannot be in the future.")
        return value


# ---------------- PROFILE MODEL ----------------

class ProfileInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_profile_name(cls, value):
        value = value.strip()

        if not re.fullmatch(r"[A-Za-z ]+", value):
            raise ValueError("Enter a valid name.")

        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip()

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address.")

        return value


def serialize(row):
    return dict(row)


# ---------------- STARTUP ----------------

@app.on_event("startup")
def startup():
    init_db()


# ---------------- GENERAL ROUTES ----------------

@app.get("/")
def root():
    return {
        "message": "MediTrack API is running",
        "docs": "/docs"
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/options")
def options():
    return {
        "genders": GENDERS,
        "wards": WARDS,
        "departments": DEPARTMENTS,
        "doctors": DOCTORS
    }


# ---------------- PATIENT ROUTES ----------------

@app.get("/api/patients")
def list_patients(
    search: Optional[str] = Query(default=None),
    ward: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    doctor: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    sql = "SELECT * FROM patients WHERE 1=1"
    params = []

    if search:
        sql += " AND name LIKE ?"
        params.append(f"%{search.strip()}%")

    for field, value in [
        ("ward", ward),
        ("department", department),
        ("doctor", doctor),
        ("status", status)
    ]:
        if value:
            sql += f" AND {field} = ?"
            params.append(value)

    sql += " ORDER BY id DESC"

    with closing(get_db_connection()) as con:
        rows = con.execute(sql, params).fetchall()

    return [serialize(row) for row in rows]


@app.post("/api/patients", status_code=201)
def create_patient(patient: PatientInput):
    data = patient.model_dump()
    data["admission_date"] = data["admission_date"].isoformat()

    with closing(get_db_connection()) as con:
        cur = con.execute(
            """
            INSERT INTO patients (
                name, age, gender, ward,
                department, doctor, admission_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["name"],
                data["age"],
                data["gender"],
                data["ward"],
                data["department"],
                data["doctor"],
                data["admission_date"]
            )
        )

        con.commit()

        row = con.execute(
            "SELECT * FROM patients WHERE id = ?",
            (cur.lastrowid,)
        ).fetchone()

    create_notification(
        "New patient admitted",
        f"{data['name']} has been admitted to {data['ward']}.",
        "success"
    )
    create_notification(
    "New admission",
    f"{patient.name} was admitted.",
    "success"
    )
    return serialize(row)


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: int, patient: PatientInput):
    data = patient.model_dump()
    data["admission_date"] = data["admission_date"].isoformat()

    with closing(get_db_connection()) as con:
        existing = con.execute(
            "SELECT id FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Patient not found."
            )

        con.execute(
            """
            UPDATE patients
            SET name=?, age=?, gender=?, ward=?,
                department=?, doctor=?, admission_date=?
            WHERE id=?
            """,
            (
                data["name"],
                data["age"],
                data["gender"],
                data["ward"],
                data["department"],
                data["doctor"],
                data["admission_date"],
                patient_id
            )
        )

        con.commit()

        row = con.execute(
            "SELECT * FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

    create_notification(
        "Patient record updated",
        f"{data['name']}'s patient record has been updated.",
        "info"
    )
    create_notification(
    "Patient updated",
    "Patient information was updated.",
    "info"
    )
    return serialize(row)


@app.patch("/api/patients/{patient_id}/discharge")
def discharge_patient(patient_id: int):
    with closing(get_db_connection()) as con:
        row = con.execute(
            "SELECT * FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Patient not found."
            )

        if row["status"] == "Discharged":
            raise HTTPException(
                status_code=400,
                detail="This patient is already discharged."
            )

        con.execute(
            "UPDATE patients SET status='Discharged' WHERE id=?",
            (patient_id,)
        )

        con.commit()

        updated = con.execute(
            "SELECT * FROM patients WHERE id=?",
            (patient_id,)
        ).fetchone()

    create_notification(
        "Patient discharged",
        f"{row['name']} has been discharged.",
        "success"
    )
    create_notification(
    "Patient discharged",
    "A patient was discharged.",
    "success"
    )
    return serialize(updated)


@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int):
    with closing(get_db_connection()) as con:
        row = con.execute(
            "SELECT name FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Patient not found."
            )

        con.execute(
            "DELETE FROM patients WHERE id=?",
            (patient_id,)
        )

        con.commit()

    create_notification(
        "Patient record deleted",
        f"{row['name']}'s record has been deleted.",
        "warning"
    )
    create_notification(
    "Patient removed",
    "A patient record was deleted.",
    "warning"
    )
    return {"message": "Patient deleted successfully."}


# ---------------- NOTIFICATION ROUTES ----------------

@app.get("/api/notifications")
def get_notifications():
    with closing(get_db_connection()) as con:
        notifications = con.execute("""
            SELECT * FROM notifications
            ORDER BY created_at DESC, id DESC
        """).fetchall()

        unread = con.execute("""
            SELECT COUNT(*) FROM notifications
            WHERE is_read = 0
        """).fetchone()[0]

    return {
        "notifications": [serialize(row) for row in notifications],
        "unread_count": unread
    }


@app.patch("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):
    with closing(get_db_connection()) as con:
        cursor = con.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = ?
        """, (notification_id,))

        con.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    return {"message": "Notification marked as read"}


@app.post("/api/notifications/read-all")
def mark_all_notifications_read():
    with closing(get_db_connection()) as con:
        con.execute("""
            UPDATE notifications
            SET is_read = 1
        """)

        con.commit()

    return {"message": "All notifications marked as read"}


@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int):
    with closing(get_db_connection()) as con:
        cursor = con.execute(
            "DELETE FROM notifications WHERE id = ?",
            (notification_id,)
        )

        con.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {"message": "Notification deleted"}


# ---------------- ADMIN PROFILE ROUTES ----------------

@app.get("/api/profile")
def get_profile():
    with closing(get_db_connection()) as con:
        row = con.execute(
            "SELECT * FROM admin_profile WHERE id = 1"
        ).fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Admin profile not found."
        )

    return serialize(row)


@app.put("/api/profile")
def update_profile(profile: ProfileInput):
    with closing(get_db_connection()) as con:
        con.execute(
            """
            UPDATE admin_profile
            SET name = ?, email = ?
            WHERE id = 1
            """,
            (profile.name, profile.email)
        )

        con.commit()

        row = con.execute(
            "SELECT * FROM admin_profile WHERE id = 1"
        ).fetchone()

    create_notification(
        "Profile updated",
        "Administrator profile details have been updated.",
        "info"
    )

    return serialize(row)
@app.get("/api/profile")
def get_profile():
    conn = get_db_connection()

    profile = conn.execute("""
        SELECT * FROM admin_profile WHERE id = 1
    """).fetchone()

    conn.close()

    return dict(profile)


@app.put("/api/profile")
def update_profile(data: dict):
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email")

    conn = get_db_connection()

    conn.execute("""
        UPDATE admin_profile
        SET name = ?, email = ?
        WHERE id = 1
    """, (name, email))

    conn.commit()

    profile = conn.execute("""
        SELECT * FROM admin_profile WHERE id = 1
    """).fetchone()

    conn.close()

    return dict(profile)