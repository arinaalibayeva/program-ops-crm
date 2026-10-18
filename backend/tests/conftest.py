import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.auth import hash_password
from app.db import Base, get_session
from app.main import app
from app.seed import load_sample, seed


PASSWORD = "correct horse battery"


@pytest.fixture
def session_factory():
    # A fresh in-memory database per test, loaded with the sample cohort.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        seed(session, load_sample())
        session.add(m.User(id="user-admin", name="Test Admin", email="admin@example.edu", role="admin",
                           password_hash=hash_password(PASSWORD)))
        session.add(m.User(id="user-p", name="Pat Participant", email="pat@example.edu", role="participant",
                           password_hash=hash_password(PASSWORD)))
        session.commit()
    return factory


@pytest.fixture
def anonymous(session_factory):
    """A browser that hasn't signed in."""

    def override():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(anonymous):
    """A browser signed in as an admin."""
    assert anonymous.post("/api/auth/login", json={"email": "admin@example.edu", "password": PASSWORD}).status_code == 200
    return anonymous
