import datetime as dt

from app import models as m
from tests.conftest import PASSWORD

NEW_PASSWORD = "a brand new password"


def invite(client, email="new@example.edu", role="admin"):
    response = client.post("/api/team/invites", json={"name": " New Person ", "email": email, "role": role})
    assert response.status_code == 200, response.text
    return response.json()


def test_invite_flow_signs_the_person_in(client, session_factory):
    link = invite(client)
    assert link["member"] == {
        "id": link["member"]["id"], "name": "New Person", "email": "new@example.edu", "role": "admin", "status": "invited",
    }
    token = link["token"]
    with session_factory() as session:  # only a hash is stored
        assert session.get(m.Invite, token) is None

    client.post("/api/auth/logout")
    info = client.get(f"/api/invites/{token}").json()
    assert (info["name"], info["isReset"], info["invitedBy"]) == ("New Person", False, "Test Admin")

    assert client.post(f"/api/invites/{token}", json={"password": "short"}).status_code == 400
    assert client.post(f"/api/invites/{token}", json={"password": NEW_PASSWORD}).json()["email"] == "new@example.edu"
    assert client.get("/api/cohort").status_code == 200  # signed in

    assert client.get(f"/api/invites/{token}").status_code == 404  # one use only
    client.post("/api/auth/logout")
    login = client.post("/api/auth/login", json={"email": "new@example.edu", "password": NEW_PASSWORD})
    assert login.status_code == 200


def test_uninvited_account_cannot_sign_in_before_setting_a_password(client):
    invite(client)
    client.post("/api/auth/logout")
    response = client.post("/api/auth/login", json={"email": "new@example.edu", "password": ""})
    assert response.status_code == 401


def test_expired_link(client, session_factory):
    token = invite(client)["token"]
    with session_factory() as session:
        for record in session.query(m.Invite):
            record.expires_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)
        session.commit()
    assert client.get(f"/api/invites/{token}").status_code == 410
    assert client.post(f"/api/invites/{token}", json={"password": NEW_PASSWORD}).status_code == 410
    assert [x["status"] for x in client.get("/api/team").json() if x["email"] == "new@example.edu"] == ["expired"]


def test_new_link_replaces_the_old_one_and_resets_a_password(client):
    first = invite(client)
    second = client.post(f"/api/team/{first['member']['id']}/link").json()
    assert client.get(f"/api/invites/{first['token']}").status_code == 404
    assert client.post(f"/api/invites/{second['token']}", json={"password": NEW_PASSWORD}).status_code == 200


def test_duplicate_and_invalid_invites(client):
    invite(client)
    same = client.post("/api/team/invites", json={"name": "X", "email": "NEW@example.edu", "role": "admin"})
    assert same.status_code == 400
    assert client.post("/api/team/invites", json={"name": "", "email": "a@b.co"}).status_code == 400
    assert client.post("/api/team/invites", json={"name": "X", "email": "nope"}).status_code == 400
    assert client.post("/api/team/invites", json={"name": "X", "email": "a@b.co", "role": "participant"}).status_code == 422


def test_only_managers_manage_access(client):
    token = invite(client)["token"]
    client.post("/api/auth/logout")
    client.post(f"/api/invites/{token}", json={"password": NEW_PASSWORD})  # now a plain admin
    assert client.get("/api/team").status_code == 200
    denied = client.post("/api/team/invites", json={"name": "X", "email": "x@example.edu"})
    assert denied.status_code == 403
    assert client.delete("/api/team/user-admin").status_code == 403


def test_team_needs_sign_in(anonymous):
    assert anonymous.get("/api/team").status_code == 401
    assert anonymous.post("/api/team/invites", json={"name": "X", "email": "x@example.edu"}).status_code == 401


def test_removing_someone_signs_them_out(client, session_factory):
    link = invite(client)
    assert client.delete("/api/team/user-admin").json()["detail"] == "You can't remove yourself."
    with session_factory() as session:
        session.add(m.PersonalItem(id="item-abcdef12", user_id=link["member"]["id"], kind="todo", body="x"))
        session.commit()
    client.delete(f"/api/team/{link['member']['id']}")
    with session_factory() as session:
        assert session.get(m.User, link["member"]["id"]) is None
        assert session.get(m.PersonalItem, "item-abcdef12") is None
        assert session.query(m.Invite).count() == 0


def test_last_manager_stays_a_manager(client):
    assert client.patch("/api/team/user-admin", json={"role": "admin"}).status_code == 400


def test_repeated_wrong_passwords_lock_the_account(anonymous):
    bad = {"email": "admin@example.edu", "password": "wrong"}
    for _ in range(5):
        assert anonymous.post("/api/auth/login", json=bad).status_code == 401
    locked = anonymous.post("/api/auth/login", json={"email": "admin@example.edu", "password": PASSWORD})
    assert locked.status_code == 429
