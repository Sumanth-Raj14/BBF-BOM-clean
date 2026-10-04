import PropTypes from "prop-types";

import { __t } from "../../i18n";
import { toast } from "../../utils/toast";
import { api } from "../../../api.js";
import { Badge, Button, EmptyState, Field, Modal, Select, Spinner } from "../ui";

// Grant permissions to a role.
//
// POST /rbac/roles/assign-permission was the last backend route with no client
// at all. MembersScreen assigns roles to USERS and its own comment defers the
// permission set OF a role as "a separate admin concern" — this is that.
//
// ONE-WAY, and the UI says so up front. There is no unassign-permission
// route: users have both assign-user and unassign-user, permissions have only
// assign. An admin who grants a permission expecting to revoke it later
// cannot, and finding that out afterwards is the worst time to learn it.
//
// The request body is camelCase (roleId / permissionId) — RolePermissionAssign
// is one of the few models in this backend that is not snake_case.

export default function RolePermissionsModal({ open, onClose }) {
  const [roles, setRoles] = React.useState([]);
  const [permissions, setPermissions] = React.useState([]);
  const [roleId, setRoleId] = React.useState("");
  const [permId, setPermId] = React.useState("");
  const [current, setCurrent] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const asList = (r) => (Array.isArray(r) ? r : r?.items || []);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([api.rbac.roles(), api.rbac.permissions()])
      .then(([r, p]) => {
        setRoles(asList(r));
        setPermissions(asList(p));
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const loadCurrent = React.useCallback(async (id) => {
    if (!id) {
      setCurrent([]);
      return;
    }
    try {
      setCurrent(asList(await api.rbac.rolePermissions(id)));
    } catch {
      // A failure here must not block granting; it only means the "already
      // has" list is unknown, so show nothing rather than a wrong empty state.
      setCurrent([]);
    }
  }, []);

  React.useEffect(() => {
    loadCurrent(roleId);
  }, [roleId, loadCurrent]);

  if (!open) return null;

  const label = (x) => x?.name || x?.code || x?.permission || `#${x?.id}`;
  const alreadyHas = current.some((c) => String(c.id) === String(permId));

  async function grant() {
    setBusy(true);
    try {
      await api.rbac.assignPermission(Number(roleId), Number(permId));
      await loadCurrent(roleId);
      toast(__t("rbac.granted") || "Permission granted", { kind: "success" });
      setPermId("");
    } catch (e) {
      // 403 means the current user is not an admin — a different problem from
      // a bad id, and the server's wording distinguishes them.
      toast(
        (__t("rbac.grantFailed") || "Could not grant permission") +
          ": " +
          (e?.message || String(e)),
        { kind: "error" },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={__t("rbac.title") || "Role permissions"}
      closeLabel={__t("common.close") || "Close"}
    >
      <div
        className="rounded-r2"
        style={{ padding: 10, marginBottom: 12, border: "1px solid var(--warn, #b45309)" }}
      >
        <span className="fs-11">
          {__t("rbac.oneWayWarning") ||
            "Granting is permanent from here: the API has no route to remove a permission from a role. Only add one you are sure the role should keep."}
        </span>
      </div>

      {loading && <Spinner label={__t("common.loading") || "Loading…"} />}
      {!loading && error && (
        <p className="fs-12 fg-3">
          {__t("common.loadFailed") || "Load failed"}: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="field-row">
            <Field label={__t("rbac.role") || "Role"}>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">{__t("common.select") || "Select…"}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {label(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={__t("rbac.permission") || "Permission"}>
              <Select value={permId} onChange={(e) => setPermId(e.target.value)}>
                <option value="">{__t("common.select") || "Select…"}</option>
                {permissions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-8">
            <Button onClick={grant} disabled={busy || !roleId || !permId || alreadyHas}>
              {busy ? <Spinner /> : __t("rbac.grant") || "Grant permission"}
            </Button>
            {alreadyHas && (
              <span className="fs-11 fg-3">
                {__t("rbac.alreadyHas") || "This role already has that permission."}
              </span>
            )}
          </div>

          <h4 className="m-0 fs-12 fw-600" style={{ marginTop: 18 }}>
            {__t("rbac.currentFor") || "Permissions this role already has"}
          </h4>
          {!roleId ? (
            <p className="fs-11 fg-3" style={{ margin: "6px 0 0" }}>
              {__t("rbac.pickRole") || "Pick a role to see what it can do."}
            </p>
          ) : current.length === 0 ? (
            <EmptyState
              message={
                __t("rbac.noneOrUnknown") ||
                "None listed. Either the role has no permissions, or they could not be read."
              }
            />
          ) : (
            <div className="flex gap-8" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {current.map((c) => (
                <Badge key={c.id} tone="neutral">
                  {label(c)}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

RolePermissionsModal.propTypes = { open: PropTypes.bool, onClose: PropTypes.func };
