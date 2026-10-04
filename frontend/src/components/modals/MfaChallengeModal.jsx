import PropTypes from "prop-types";

import { __t } from "../../i18n";
import { api } from "../../../api.js";
import { Button, Field, Input, Modal, Spinner } from "../ui";

// The second step of signing in when the account has MFA enabled.
//
// This closes a LOCKOUT. /auth/login returns
//   {mfa_required: true, temp_token: "...", token_type: "bearer"}
// with NO access_token for an MFA-enabled user. The sign-in path checked
// `result.access_token`, so it fell through to "login failed" — telling the
// user their correct credentials were rejected, with no way to proceed. Anyone
// who enrolled through the account-security panel was locked out of the
// application entirely.
//
// The temp_token is valid for 5 minutes (auth_service.check_mfa_required), so
// the expiry message below is a real deadline, not decoration.
export default function MfaChallengeModal({ open, tempToken, onSuccess, onCancel }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.auth.mfaChallenge(tempToken, code);
      // The server sets the auth cookies itself (_set_auth) before returning,
      // so there is nothing to persist here — just hand control back.
      await onSuccess(tokens);
    } catch (err) {
      // Show the server's reason. A wrong code and an expired challenge are
      // different problems with different fixes, and only the server knows
      // which happened.
      setError(err?.message || String(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={__t("auth.mfaTitle") || "Two-factor authentication"}
      subtitle={__t("auth.mfaSubtitle") || "Enter the code from your authenticator app"}
      closeLabel={__t("common.cancel") || "Cancel"}
    >
      <form onSubmit={submit}>
        <Field label={__t("auth.mfaCode") || "6-digit code"}>
          <Input
            mono
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>

        {error && (
          <p className="fs-11" style={{ color: "var(--danger)", margin: "6px 0 0" }}>
            {error}
          </p>
        )}

        <p className="fs-11 fg-3" style={{ margin: "8px 0 12px" }}>
          {__t("auth.mfaExpiry") ||
            "This challenge expires about 5 minutes after sign-in. If it lapses, sign in again to get a new one."}
        </p>

        <div className="flex items-center gap-8">
          <Button type="submit" disabled={busy || !code}>
            {busy ? <Spinner /> : __t("auth.mfaVerify") || "Verify"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {__t("common.cancel") || "Cancel"}
          </Button>
        </div>

        <p className="fs-11 fg-3" style={{ margin: "10px 0 0" }}>
          {__t("auth.mfaBackupHint") ||
            "Lost your authenticator? Use one of the backup codes you saved when you enabled two-factor."}
        </p>
      </form>
    </Modal>
  );
}

MfaChallengeModal.propTypes = {
  open: PropTypes.bool,
  tempToken: PropTypes.string,
  onSuccess: PropTypes.func,
  onCancel: PropTypes.func,
};
