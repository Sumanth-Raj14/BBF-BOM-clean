"""Team membership must not cross tenants.

add_member checked that the TEAM belonged to the caller's tenant but never
that the USER did. Anyone could add another tenant's user id to their own
team, and list_members would then return that user's email and name --
enumerate ids, harvest other tenants' staff.
"""

import pytest
from sqlalchemy import select

from app.models.user import User
from app.tests.conftest import no_tenant_filter
from app.tests.test_requirements import _scoped_login


async def _user_id(db_session, email):
    with no_tenant_filter():
        return (await db_session.execute(select(User.id).where(User.email == email))).scalar_one()


async def _make_team(client, headers, name):
    resp = await client.post("/api/v1/teams/", headers=headers, json={"name": name})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_a_user_from_another_tenant_cannot_be_added_to_a_team(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "team-t1@example.com")
    await _scoped_login(client, db_session, 2, "team-t2@example.com")
    outsider = await _user_id(db_session, "team-t2@example.com")
    team_id = await _make_team(client, t1, "T1 reviewers")

    resp = await client.post(
        f"/api/v1/teams/{team_id}/members", headers=t1, json={"user_id": outsider}
    )
    assert resp.status_code == 404, resp.text

    members = (await client.get(f"/api/v1/teams/{team_id}/members", headers=t1)).json()
    assert "team-t2@example.com" not in [m["email"] for m in members]


@pytest.mark.asyncio
async def test_members_can_be_listed_added_and_removed_within_a_tenant(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "team-own-t1@example.com")
    me = await _user_id(db_session, "team-own-t1@example.com")
    team_id = await _make_team(client, t1, "T1 builders")

    members = (await client.get(f"/api/v1/teams/{team_id}/members", headers=t1)).json()
    assert [(m["user_id"], m["role"]) for m in members] == [(me, "lead")]

    gone = await client.delete(f"/api/v1/teams/{team_id}/members/{me}", headers=t1)
    assert gone.status_code == 200, gone.text
    back = await client.post(
        f"/api/v1/teams/{team_id}/members", headers=t1, json={"user_id": me, "role": "member"}
    )
    assert back.json()["status"] == "added", back.text


@pytest.mark.asyncio
async def test_an_unknown_role_is_rejected(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "team-role-t1@example.com")
    me = await _user_id(db_session, "team-role-t1@example.com")
    team_id = await _make_team(client, t1, "T1 roles")
    await client.delete(f"/api/v1/teams/{team_id}/members/{me}", headers=t1)

    resp = await client.post(
        f"/api/v1/teams/{team_id}/members", headers=t1, json={"user_id": me, "role": "owner"}
    )
    assert resp.status_code == 422, resp.text
