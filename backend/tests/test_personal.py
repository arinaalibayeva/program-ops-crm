from app import models as m
from tests.conftest import PASSWORD


def test_add_edit_and_delete_items(client):
    items = client.post("/api/me/items", json={"id": "item-abcdef12", "kind": "todo", "body": "  Email partners "}).json()
    assert [(i["id"], i["body"], i["done"]) for i in items] == [("item-abcdef12", "Email partners", False)]

    done = client.patch("/api/me/items/item-abcdef12", json={"done": True}).json()
    assert done[0]["done"] is True
    edited = client.patch("/api/me/items/item-abcdef12", json={"body": "Email all partners"}).json()
    assert edited[0]["body"] == "Email all partners" and edited[0]["done"] is True

    assert client.delete("/api/me/items/item-abcdef12").json() == []


def test_a_todo_can_have_a_description_and_stays_when_done(client):
    items = client.post("/api/me/items", json={
        "id": "item-abcdef12", "kind": "todo", "body": "Call Bayview", "description": "  Ask about the Nov schedule ",
    }).json()
    assert items[0]["description"] == "Ask about the Nov schedule"

    done = client.patch("/api/me/items/item-abcdef12", json={"done": True}).json()
    assert [(i["body"], i["description"], i["done"]) for i in done] == [("Call Bayview", "Ask about the Nov schedule", True)]
    assert client.get("/api/me/items").json() == done

    cleared = client.patch("/api/me/items/item-abcdef12", json={"description": None}).json()
    assert "description" not in cleared[0]
    too_long = {"kind": "todo", "body": "x", "description": "y" * 2001}
    assert client.post("/api/me/items", json=too_long).status_code == 400


def test_empty_items_are_refused(client):
    assert client.post("/api/me/items", json={"kind": "note", "body": "  "}).status_code == 400
    assert client.post("/api/me/items", json={"kind": "other", "body": "x"}).status_code == 422


def test_items_are_private_to_each_person(client, session_factory):
    client.post("/api/me/items", json={"id": "item-abcdef12", "kind": "note", "body": "Mine"})
    client.post("/api/auth/logout")
    with session_factory() as session:
        session.get(m.User, "user-p").role = "admin"
        session.commit()
    client.post("/api/auth/login", json={"email": "pat@example.edu", "password": PASSWORD})

    assert client.get("/api/me/items").json() == []
    assert client.patch("/api/me/items/item-abcdef12", json={"done": True}).status_code == 404
    assert client.delete("/api/me/items/item-abcdef12").status_code == 404


def test_items_need_sign_in(anonymous):
    assert anonymous.get("/api/me/items").status_code == 401
