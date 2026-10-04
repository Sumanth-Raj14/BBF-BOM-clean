import pytest


@pytest.mark.asyncio
async def test_generate_barcode(client, auth_headers):
    part_resp = await client.post(
        "/api/v1/parts/",
        headers=auth_headers,
        json={"pn": "BC-001", "name": "Barcode Part"},
    )
    part_id = part_resp.json()["id"]
    resp = await client.get(f"/api/v1/barcodes/generate/{part_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["partId"] == part_id
    assert data["pn"] == "BC-001"
    assert "barcode" in data
    assert "imageUrl" in data


@pytest.mark.asyncio
async def test_generate_barcode_not_found(client, auth_headers):
    resp = await client.get("/api/v1/barcodes/generate/99999", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_generate_barcode_with_format(client, auth_headers):
    part_resp = await client.post(
        "/api/v1/parts/",
        headers=auth_headers,
        json={"pn": "BC-FMT", "name": "Format Barcode Part"},
    )
    part_id = part_resp.json()["id"]
    # The parameter is aliased to `format`. This used to send `fmt` and assert
    # the DEFAULT value, so it passed whether format handling worked or not.
    # A non-default value is the only way the assertion can fail.
    resp = await client.get(
        f"/api/v1/barcodes/generate/{part_id}",
        headers=auth_headers,
        params={"format": "qr"},
    )
    assert resp.status_code == 200
    assert resp.json()["format"] == "qr"


@pytest.mark.asyncio
async def test_generate_image_url_renders_the_requested_format(client, auth_headers):
    """Follow the imageUrl that generate hands back, as a label printer would.

    It used to say `?fmt=`, which the image route ignores (its parameter is
    aliased `format`), so asking for a QR code returned a code128 SVG.
    """
    part_resp = await client.post(
        "/api/v1/parts/",
        headers=auth_headers,
        json={"pn": "BC-QR-RT", "name": "QR round trip"},
    )
    part_id = part_resp.json()["id"]
    gen = await client.get(
        f"/api/v1/barcodes/generate/{part_id}", headers=auth_headers, params={"format": "qr"}
    )
    image_url = gen.json()["imageUrl"]

    resp = await client.get(image_url, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("image/png"), (
        f"{image_url} rendered {resp.headers.get('content-type')!r}, not a QR PNG"
    )


@pytest.mark.asyncio
async def test_a_printed_qr_label_scans_back_to_its_part(client, auth_headers):
    """The app must be able to read the labels it prints.

    /barcodes/qr encodes "PN:<pn>|ID:<id>|Name:<name>"; the client reduces that
    to the PN before calling lookup. Lookup used to match only the stored
    Part.barcode column, which a QR label never carries, so every printed label
    came back "No part found".
    """
    part_resp = await client.post(
        "/api/v1/parts/", headers=auth_headers, json={"pn": "BC-SCAN-1", "name": "Scan me"}
    )
    part_id = part_resp.json()["id"]

    resp = await client.get("/api/v1/barcodes/lookup/BC-SCAN-1", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["partId"] == part_id

    miss = await client.get("/api/v1/barcodes/lookup/NO-SUCH-PN-XYZ", headers=auth_headers)
    assert miss.status_code == 404


@pytest.mark.asyncio
async def test_a_printed_code128_label_scans_back_to_its_part(client, auth_headers):
    """The Code 128 label from /barcodes/image encodes a one-way generated code
    (never stored on the part), so lookup must recognise it to resolve it."""
    part_resp = await client.post(
        "/api/v1/parts/", headers=auth_headers, json={"pn": "BC-C128-1", "name": "Linear label"}
    )
    part_id = part_resp.json()["id"]
    code = (await client.get(f"/api/v1/barcodes/generate/{part_id}", headers=auth_headers)).json()[
        "barcode"
    ]

    resp = await client.get(f"/api/v1/barcodes/lookup/{code}", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["partId"] == part_id

    # Same shape, wrong digits: must not resolve to some other part.
    bogus = "4988600" + "0" * 12
    assert (
        await client.get(f"/api/v1/barcodes/lookup/{bogus}", headers=auth_headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_get_barcode_image(client, auth_headers):
    part_resp = await client.post(
        "/api/v1/parts/",
        headers=auth_headers,
        json={"pn": "BC-IMG", "name": "Image Barcode Part"},
    )
    part_id = part_resp.json()["id"]
    resp = await client.get(f"/api/v1/barcodes/image/{part_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert "image" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_get_barcode_image_not_found(client, auth_headers):
    resp = await client.get("/api/v1/barcodes/image/99999", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_qr_code(client, auth_headers):
    part_resp = await client.post(
        "/api/v1/parts/",
        headers=auth_headers,
        json={"pn": "BC-QR", "name": "QR Code Part"},
    )
    part_id = part_resp.json()["id"]
    resp = await client.get(f"/api/v1/barcodes/qr/{part_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert "image" in resp.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_get_qr_code_not_found(client, auth_headers):
    resp = await client.get("/api/v1/barcodes/qr/99999", headers=auth_headers)
    assert resp.status_code == 404
