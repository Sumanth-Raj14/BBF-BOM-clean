import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// vi.hoisted: vi.mock is hoisted above plain consts, and its factory reads this.
const vendorsApi = vi.hoisted(() => ({ list: vi.fn(), bulkDelete: vi.fn(), update: vi.fn() }));
vi.mock("../../../../api.js", () => ({ api: { vendors: vendorsApi } }));
vi.mock("../../../globals", () => ({
  Icon: new Proxy({}, { get: () => () => null }),
  LeadHeat: () => null,
  useAppStore: () => ({ openModal: vi.fn(), modal: null }),
}));
vi.mock("../../../utils/toast", () => ({ toast: vi.fn() }));

import VendorsScreen from "../VendorsScreen.jsx";

window.React = React;

// POST /vendors/bulk-delete had no caller: the table had no multi-select.

const VENDORS = [
  { id: 11, name: "Acme Fasteners", leadTime: 5 },
  { id: 12, name: "Bolt Brothers", leadTime: 6 },
];

beforeEach(() => {
  vendorsApi.list.mockReset().mockResolvedValue(VENDORS);
  vendorsApi.bulkDelete.mockReset().mockResolvedValue({ deleted: 1 });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("VendorsScreen bulk delete", () => {
  it("deletes the ticked vendors by their numeric server id", async () => {
    render(<VendorsScreen data={{}} openModal={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText(/select acme fasteners/i));
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));

    await waitFor(() => expect(vendorsApi.bulkDelete).toHaveBeenCalledWith([11]));
    // Reloads from the server rather than trusting a local edit.
    await waitFor(() => expect(vendorsApi.list).toHaveBeenCalledTimes(2));
  });

  it("never sends a ticked vendor the current filter hides", async () => {
    render(<VendorsScreen data={{}} openModal={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText(/select all vendors/i));

    // Narrow the list to one vendor after ticking both.
    fireEvent.change(screen.getByLabelText(/filter vendors/i), { target: { value: "bolt" } });
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));

    await waitFor(() => expect(vendorsApi.bulkDelete).toHaveBeenCalledWith([12]));
  });

  it("does not open the vendor when its checkbox is clicked", async () => {
    const openModal = vi.fn();
    render(<VendorsScreen data={{}} openModal={openModal} />);
    fireEvent.click(await screen.findByLabelText(/select acme fasteners/i));
    expect(openModal).not.toHaveBeenCalled();
  });
});
