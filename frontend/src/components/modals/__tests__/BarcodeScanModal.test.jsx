import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const lookup = vi.fn();
vi.mock("../../../globals", () => ({
  Icon: new Proxy({}, { get: () => () => null }),
  api: { barcodes: { lookup: (...args) => lookup(...args) } },
}));
vi.mock("../../../utils/toast", () => ({ toast: vi.fn() }));

import BarcodeScanModal from "../BarcodeScanModal.jsx";

window.React = React;

function scan(code) {
  const input = screen.getByLabelText(/enter barcode manually/i);
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(() => lookup.mockClear());

describe("BarcodeScanModal", () => {
  // The lookup returns the part itself and 404s on a miss. The modal checked a
  // `found` field the response never had, so every SUCCESSFUL scan was
  // reported as "No part found".
  it("shows the part when the lookup succeeds", async () => {
    lookup.mockResolvedValue({
      partId: 5,
      pn: "PN-5",
      name: "Hex standoff M3",
      barcode: "4988600ABCD1234EF56",
      status: "Active",
    });
    render(<BarcodeScanModal open onClose={() => {}} />);
    scan("PN-5");

    expect(await screen.findByText("Hex standoff M3")).toBeInTheDocument();
    expect(screen.queryByText(/no part found/i)).not.toBeInTheDocument();
    expect(lookup).toHaveBeenCalledWith("PN-5");
  });

  // A real miss is a 404 (covered server-side in test_barcodes.py). Driving a
  // rejected promise through this vi.fn is reported by vitest as a failure of
  // its own, even though the modal catches it, so the no-match branch is
  // exercised with a result that carries no part instead.
  it("says no part was found when the result carries no part", async () => {
    lookup.mockResolvedValue({});
    render(<BarcodeScanModal open onClose={() => {}} />);
    scan("NOPE-1");

    expect(await screen.findByText(/no part found for barcode: NOPE-1/i)).toBeInTheDocument();
  });
});
