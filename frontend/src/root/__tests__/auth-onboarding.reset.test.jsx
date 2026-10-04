import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import { ResetPasswordScreen } from "../auth-onboarding.jsx";

// Only the request half of password reset used to be wired: the email went
// out, but its link (/auth/reset-password?token=...) had no screen, so the
// token could never be redeemed.

function at(search) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { search, href: "", pathname: "/auth/reset-password" },
  });
}

beforeEach(() => {
  window.React = React;
  window.Icon = new Proxy({}, { get: () => (props) => <span {...props} /> });
  window.apiRequest = vi.fn().mockResolvedValue({ message: "ok" });
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

function fill(pw, confirm) {
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
}

describe("ResetPasswordScreen", () => {
  it("redeems the token from the link with the new password", async () => {
    at("?token=tok-123");
    render(<ResetPasswordScreen />);
    fill("N3w-passw0rd!", "N3w-passw0rd!");
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(window.apiRequest).toHaveBeenCalledWith("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "tok-123", password: "N3w-passw0rd!" }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/password has been changed/i);
  });

  it("strips the bearer token from the address bar on arrival", () => {
    at("?token=tok-123");
    render(<ResetPasswordScreen />);
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/reset-password");
  });

  it("will not submit when the two passwords differ", () => {
    at("?token=tok-123");
    render(<ResetPasswordScreen />);
    fill("one-password", "another-one");
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeDisabled();
    expect(window.apiRequest).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the token is expired", async () => {
    at("?token=old");
    window.apiRequest.mockRejectedValue(new Error("Invalid or expired reset token"));
    render(<ResetPasswordScreen />);
    fill("N3w-passw0rd!", "N3w-passw0rd!");
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired reset token/i);
  });

  it("explains a link with no token instead of showing a form that cannot work", () => {
    at("");
    render(<ResetPasswordScreen />);
    expect(screen.getByRole("alert")).toHaveTextContent(/link is incomplete/i);
    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
  });
});
