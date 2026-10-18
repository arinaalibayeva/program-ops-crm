from app.auth import hash_password, verify_password

from .conftest import PASSWORD

ADMIN = {"email": "admin@example.edu", "password": PASSWORD}


def test_passwords_are_hashed_and_checked():
    stored = hash_password("s3cret-enough")
    assert "s3cret" not in stored
    assert verify_password("s3cret-enough", stored)
    assert not verify_password("wrong", stored)
    assert not verify_password("anything", None)


def test_admin_pages_need_sign_in(anonymous):
    assert anonymous.get("/api/cohort").status_code == 401
    assert anonymous.get("/api/me").status_code == 401
    assert anonymous.post("/api/attendance/toggle", json={"eventId": "ev-1", "enrollmentId": "enr-1"}).status_code == 401


def test_check_in_stays_public(anonymous):
    assert anonymous.get("/api/checkin/chk-ev-9-today").status_code == 200


def test_sign_in_and_out(anonymous):
    me = anonymous.post("/api/auth/login", json=ADMIN | {"email": "  ADMIN@example.edu "}).json()
    assert me["email"] == "admin@example.edu" and "passwordHash" not in me
    assert anonymous.get("/api/cohort").status_code == 200
    assert anonymous.post("/api/auth/logout").status_code == 204
    assert anonymous.get("/api/cohort").status_code == 401


def test_wrong_password_or_unknown_email_look_the_same(anonymous):
    wrong = anonymous.post("/api/auth/login", json=ADMIN | {"password": "nope"})
    unknown = anonymous.post("/api/auth/login", json={"email": "who@example.edu", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Email or password is incorrect."}


def test_participants_cannot_use_admin_pages(anonymous):
    anonymous.post("/api/auth/login", json={"email": "pat@example.edu", "password": PASSWORD})
    assert anonymous.get("/api/cohort").status_code == 403


def test_reset_keeps_accounts(client):
    client.post("/api/reset")
    assert client.get("/api/me").json()["email"] == "admin@example.edu"
