"""Service BOM line items: they must be creatable at all, and tenant-isolated.

Two defects in the item routes, both from raw text() SQL:

* POST /service-bom/{id}/items INSERTed without "tenantId". The column is NOT
  NULL (TenantAwareMixin) and a raw INSERT bypasses the ORM listener that fills
  it, so adding an item failed every time -- the screen's item count could
  never move off 0. (Header create already set it explicitly; items did not.)
* POST and DELETE never checked that the service BOM belonged to the caller's
  tenant (only GET did), so any signed-in user could write into, or delete
  from, another tenant's service BOM by guessing integer ids.

Isolation needs ordinary tenant-scoped users: conftest's auth_headers is a
superuser, which bypasses tenant filtering by design.
"""

import pytest

from app.tests.test_requirements import _scoped_login

BASE = "/api/v1/enterprise/service-bom"


async def _make_bom(client, headers, name):
    created = await client.post(BASE, headers=headers, json={"name": name})
    assert created.status_code in (200, 201), created.text
    listing = (await client.get(BASE, headers=headers)).json()
    return next(b["id"] for b in listing if b["name"] == name)


@pytest.mark.asyncio
async def test_an_item_can_be_added_and_carries_the_boms_tenant(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "sbom-add-t1@example.com")
    bom_id = await _make_bom(client, t1, "T1 pump service")

    add = await client.post(
        f"{BASE}/{bom_id}/items", headers=t1, json={"part_pn": "SEAL-1", "quantity": 2}
    )
    assert add.status_code == 200, add.text

    detail = (await client.get(f"{BASE}/{bom_id}", headers=t1)).json()
    assert [i["part_pn"] for i in detail["items"]] == ["SEAL-1"]
    assert detail["items"][0]["tenantId"] == 1


@pytest.mark.asyncio
async def test_another_tenant_cannot_add_to_or_delete_from_the_bom(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "sbom-iso-t1@example.com")
    bom_id = await _make_bom(client, t1, "T1 compressor service")
    await client.post(f"{BASE}/{bom_id}/items", headers=t1, json={"part_pn": "FILTER-9"})
    item_id = (await client.get(f"{BASE}/{bom_id}", headers=t1)).json()["items"][0]["id"]

    t2 = await _scoped_login(client, db_session, 2, "sbom-iso-t2@example.com")
    write = await client.post(f"{BASE}/{bom_id}/items", headers=t2, json={"part_pn": "INJECTED"})
    assert write.status_code == 404, write.text
    delete = await client.delete(f"{BASE}/{bom_id}/items/{item_id}", headers=t2)
    assert delete.status_code == 404, delete.text

    # t1's Bearer headers are still valid: the helper strips the shared
    # access_token cookie after each login, so the explicit header is what
    # scopes this request.
    items = (await client.get(f"{BASE}/{bom_id}", headers=t1)).json()["items"]
    assert [i["part_pn"] for i in items] == ["FILTER-9"]


@pytest.mark.asyncio
async def test_deleting_an_item_twice_is_an_honest_404(client, db_session):
    t1 = await _scoped_login(client, db_session, 1, "sbom-del-t1@example.com")
    bom_id = await _make_bom(client, t1, "T1 gearbox service")
    await client.post(f"{BASE}/{bom_id}/items", headers=t1, json={"part_pn": "BEARING-2"})
    item_id = (await client.get(f"{BASE}/{bom_id}", headers=t1)).json()["items"][0]["id"]

    assert (await client.delete(f"{BASE}/{bom_id}/items/{item_id}", headers=t1)).status_code == 200
    assert (await client.delete(f"{BASE}/{bom_id}/items/{item_id}", headers=t1)).status_code == 404
