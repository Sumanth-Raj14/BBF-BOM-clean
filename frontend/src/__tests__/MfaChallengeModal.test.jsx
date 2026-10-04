import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

window.React = React;

const mfaChallenge = vi.fn();
vi.mock("../../api.js", () => ({ api: { auth: { mfaChallenge: (...a) => mfaChallenge(...a) } } }));

import MfaChallengeModal from "../components/modals/MfaChallengeModal.jsx";

// This modal closes a LOCKOUT. /auth/login returns
//   {mfa_required: true, temp_token: "...", token_type: "bearer"}
// with NO access_token for an MFA-enabled account. The sign-in path tested
// `result.access_token`, so it fell through to "login failed" — telling users
// their correct credentials were rejected. Anyone who enrolled in two-factor
// through the account-security panel could not get back in.
describe("MfaChallengeModal", () => {
  beforeEach(() => {
    mfaChallenge.mockReset();
  });

  it("sends the temp_token with the typed code", async () => {
    mfaChallenge.mockResolvedValue({ access_token: "real" });
    const onSuccess = vi.fn();

    render(
      <MfaChallengeModal open tempToken="TEMP-123" onSuccess={onSuccess} onCancel={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText(/6-digit code/i), "123456");
    await userEvent.click(screen.getByText(/^Verify$/));

    await waitFor(() => expect(mfaChallenge).toHaveBeenCalledWith("TEMP-123", "123456"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("does not complete sign-in until the challenge resolves", async () => {
    let resolve;
    mfaChallenge.mockReturnValue(new Promise((r) => (resolve = r)));
    const onSuccess = vi.fn();

    render(<MfaChallengeModal open tempToken="T" onSuccess={onSuccess} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/6-digit code/i), "000000");
    await userEvent.click(screen.getByText(/^Verify$/));

    // In flight: the user is NOT signed in yet.
    expect(onSuccess).not.toHaveBeenCalled();
    resolve({ access_token: "real" });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows the server's reason on a rejected code and keeps the form open", async () => {
    // A wrong code and an expired 5-minute challenge need different responses
    // from the user, and only the server knows which happened.
    mfaChallenge.mockRejectedValue(new Error("Invalid or expired challenge"));
    const onSuccess = vi.fn();

    render(<MfaChallengeModal open tempToken="T" onSuccess={onSuccess} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/6-digit code/i), "999999");
    await userEvent.click(screen.getByText(/^Verify$/));

    expect(await screen.findByText(/Invalid or expired challenge/)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
    // Still usable — not reset or closed out from under them.
    expect(screen.getByText(/^Verify$/)).toBeTruthy();
  });

  it("tells the user backup codes are the way out if they lost the authenticator", async () => {
    render(<MfaChallengeModal open tempToken="T" onSuccess={vi.fn()} onCancel={() => {}} />);
    expect(screen.getByText(/backup codes you saved/i)).toBeTruthy();
  });
});
