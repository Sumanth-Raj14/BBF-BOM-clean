import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../utils/toast", () => ({ toast: vi.fn() }));

import "../enterprise-screens.jsx";

window.React = React;

// Row click used to set state nothing rendered, so a service BOM could be
// created but never opened or filled.

const BOM = {
  id: 7,
  name: "Pump PM",
  bom_number: "SBOM-2026-0001",
  service_type: "maintenance",
  items_count: 0,
  created_at: null,
};

let items;

beforeEach(() => {
  items = [];
  window.SkeletonTable = () => <div>loading</div>;
  window.apiRequest = vi.fn(async (url, opts = {}) => {
    if (url === "/enterprise/service-bom") return [BOM];
    if (url === "/enterprise/service-bom/7") return { header: BOM, items };
    if (url === "/enterprise/service-bom/7/items" && opts.method === "POST") {
      items = [{ id: 1, ...JSON.parse(opts.body) }];
      return { status: "added" };
    }
    throw new Error(`unexpected request ${opts.method || "GET"} ${url}`);
  });
});

describe("ServiceBOMScreen", () => {
  it("opens a service BOM from its row and adds a line to it", async () => {
    const Screen = window.ServiceBOMScreen;
    render(<Screen />);

    fireEvent.click(await screen.findByText("Pump PM"));
    expect(await screen.findByText(/no lines yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/part no\./i), { target: { value: "SEAL-1" } });
    fireEvent.click(screen.getByRole("button", { name: /add line/i }));

    await waitFor(() =>
      expect(window.apiRequest).toHaveBeenCalledWith(
        "/enterprise/service-bom/7/items",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const post = window.apiRequest.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(post[1].body)).toMatchObject({
      part_pn: "SEAL-1",
      quantity: 1,
      unit: "EA",
      service_type: "maintenance",
    });
    expect(await screen.findByText("SEAL-1")).toBeInTheDocument();
  });

  it("will not add a line with neither a part number nor a name", async () => {
    const Screen = window.ServiceBOMScreen;
    render(<Screen />);
    fireEvent.click(await screen.findByText("Pump PM"));
    await screen.findByText(/no lines yet/i);

    expect(screen.getByRole("button", { name: /add line/i })).toBeDisabled();
  });
});
