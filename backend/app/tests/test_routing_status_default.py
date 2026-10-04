"""A routing or process plan created through the API must have a real status.

Both create endpoints use a raw `text()` INSERT. The models declare
`status = Column(String(50), default="draft")`, but that is an ORM-side
default: it is applied by the SQLAlchemy flush machinery, which a raw INSERT
never goes through. The column has `server_default=None` and is nullable, so
every row created through the API landed with `status = NULL`.

Nothing caught it:
  * the CHECK constraint `status IN ('draft','active','archived')` passes,
    because in SQL `NULL IN (...)` is NULL, not FALSE;
  * the list endpoint derives `is_active = status == 'active'`, which is
    False for NULL — indistinguishable from a genuine draft;
  * the UI renders an empty status pill rather than an error.

So the defect was invisible from every direction except reading the INSERT.
"""

import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_created_routing_has_a_non_null_status(client, auth_headers, db_session):
    resp = await client.post(
        "/api/v1/manufacturing/routings",
        headers=auth_headers,
        json={"name": "Status default probe"},
    )
    assert resp.status_code in (200, 201), resp.text
    num = resp.json()["routing_number"]

    row = (
        await db_session.execute(
            text("SELECT status FROM routing_tables WHERE routing_number = :n"),
            {"n": num},
        )
    ).first()
    assert row is not None, f"routing {num} was not persisted"
    assert row[0] is not None, (
        "status is NULL — the ORM default did not apply because the endpoint "
        "uses a raw text() INSERT, and the column has no server_default"
    )
    assert row[0] == "draft", f"expected 'draft', got {row[0]!r}"


@pytest.mark.asyncio
async def test_created_process_plan_has_a_non_null_status(client, auth_headers, db_session):
    resp = await client.post(
        "/api/v1/manufacturing/process-plans",
        headers=auth_headers,
        json={"name": "Status default probe"},
    )
    assert resp.status_code in (200, 201), resp.text
    num = resp.json()["plan_number"]

    row = (
        await db_session.execute(
            text("SELECT status FROM process_plans WHERE plan_number = :n"),
            {"n": num},
        )
    ).first()
    assert row is not None, f"process plan {num} was not persisted"
    assert row[0] is not None, "status is NULL — same raw-INSERT trap as routing_tables"
    assert row[0] == "draft", f"expected 'draft', got {row[0]!r}"


def test_the_status_column_still_has_no_server_default():
    """Guard the guard.

    If someone later adds a server_default, the explicit "st" parameter in the
    INSERT becomes redundant rather than load-bearing — and the two tests above
    would pass for a different reason than the one they document. Fail loudly
    so the comment gets updated instead of quietly rotting.
    """
    import app.main  # noqa: F401  (registers the models)
    from app.db.base import Base

    for table in ("routing_tables", "process_plans"):
        col = Base.metadata.tables[table].columns["status"]
        assert col.server_default is None, (
            f"{table}.status now has a server_default; the explicit status in the "
            "raw INSERT is no longer what keeps it non-NULL, so update the tests "
            "and the comment in routing_api.py"
        )
