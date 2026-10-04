import React from "react";

import { __t } from "../../i18n";
import { toast } from "../../utils/toast";
import { api, apiRequest } from "../../../api.js";
import {
  ScreenHeader,
  Tabs,
  TabPanel,
  Button,
  Select,
  DataTable,
  StatusPill,
  EmptyState,
  Spinner,
  Modal,
} from "../ui";

// WS2 — unified "My Work / Team Work" board wired to /work/* + /teams/* .
const WORK_QUEUE_TABS_ID = "work-queue-tabs";

export default function WorkQueueScreen() {
  const [tab, setTab] = React.useState("mine");
  const [teams, setTeams] = React.useState([]);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [membersOpen, setMembersOpen] = React.useState(false);

  const loadTeams = React.useCallback(async () => {
    try {
      const t = await apiRequest("/teams/mine");
      const list = Array.isArray(t) ? t : [];
      setTeams(list);
      setSelectedTeam((cur) => cur || (list[0] ? list[0].id : null));
    } catch (e) {
      // teams are optional for the "My Work" view
    }
  }, []);

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (tab === "team") {
        if (!selectedTeam) {
          setItems([]);
          return;
        }
        res = await apiRequest(`/work/team/${selectedTeam}`);
      } else {
        res = await apiRequest("/work/my");
      }
      setItems((res && res.items) || []);
    } catch (e) {
      setError(e.message || "Failed to load work items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, selectedTeam]);

  React.useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const createTeam = async () => {
    const name = window.prompt("New team name:");
    if (!name) return;
    try {
      await apiRequest("/teams/", { method: "POST", body: JSON.stringify({ name }) });
      toast("Team created", { kind: "success" });
      loadTeams();
    } catch (e) {
      toast("Could not create team: " + (e.message || ""), { kind: "error" });
    }
  };

  const assignToTeam = async (item, teamId) => {
    try {
      await apiRequest("/work/assign", {
        method: "POST",
        body: JSON.stringify({
          item_type: item.type,
          item_id: item.id,
          assigned_team_id: teamId,
        }),
      });
      toast(`${item.ref} assigned to team`, { kind: "success" });
      loadItems();
    } catch (e) {
      toast("Assign failed: " + (e.message || ""), { kind: "error" });
    }
  };

  const tabItems = [
    { value: "mine", label: "My Work" },
    { value: "team", label: "Team Work" },
  ];

  const columns = [
    {
      key: "ref",
      header: "Ref",
      render: (it) => <span className="font-mono fw-600">{it.ref}</span>,
    },
    { key: "title", header: "Item" },
    {
      key: "type",
      header: "Type",
      render: (it) => (it.type === "work_order" ? "Work Order" : "CAPA"),
    },
    {
      key: "status",
      header: "Status",
      render: (it) => <StatusPill status={it.status} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (it) => <span className="capitalize">{it.priority || "—"}</span>,
    },
    {
      key: "due_date",
      header: "Due",
      render: (it) => it.due_date || "—",
    },
    {
      key: "assign",
      header: "Assign",
      render: (it) => (
        <Select
          aria-label={`Assign ${it.ref} to team`}
          value=""
          onChange={(e) => {
            const tid = Number(e.target.value);
            if (tid) assignToTeam(it, tid);
          }}
        >
          <option value="">To team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      ),
    },
  ];

  const description =
    `${items.length} ${items.length === 1 ? "item" : "items"}` +
    (tab === "team" && selectedTeam
      ? " · " + (teams.find((t) => t.id === selectedTeam)?.name || "team")
      : " · assigned to you or your teams");

  return (
    <div className="screen-wrap">
      <ScreenHeader
        title={__t("work.title") || "My Work"}
        description={description}
        actions={
          <div className="flex gap-8">
            {tab === "team" && (
              <Select
                aria-label="Select team"
                value={selectedTeam || ""}
                onChange={(e) => setSelectedTeam(Number(e.target.value) || null)}
              >
                {teams.length === 0 && <option value="">No teams</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.member_count})
                  </option>
                ))}
              </Select>
            )}
            {tab === "team" && selectedTeam && (
              <Button variant="secondary" onClick={() => setMembersOpen(true)}>
                {__t("work.members") || "Members"}
              </Button>
            )}
            <Button variant="secondary" onClick={createTeam}>
              + New team
            </Button>
          </div>
        }
      />

      <TeamMembersModal
        open={membersOpen}
        team={teams.find((t) => t.id === selectedTeam) || null}
        onClose={() => setMembersOpen(false)}
        onChanged={loadTeams}
      />

      <Tabs
        id={WORK_QUEUE_TABS_ID}
        items={tabItems}
        value={tab}
        onChange={setTab}
        ariaLabel="Work queue view"
      />

      <TabPanel
        id={WORK_QUEUE_TABS_ID}
        value={tab}
        active
        className="mt-16"
      >
        {loading ? (
          <div className="flex items-center gap-8 fg-3 fs-12" style={{ padding: "32px 0" }}>
            <Spinner size="sm" label="Loading work items…" />
            <span aria-hidden="true">Loading…</span>
          </div>
        ) : error ? (
          <EmptyState
            title={error}
            actions={
              <Button variant="secondary" onClick={loadItems}>
                Retry
              </Button>
            }
          />
        ) : (
          <DataTable
            dense
            ariaLabel="Work items"
            columns={columns}
            rows={items}
            getRowKey={(it) => it.type + "-" + it.id}
            empty={
              <EmptyState
                title={`Nothing assigned ${tab === "team" ? "to this team" : "to you"} yet`}
              />
            }
          />
        )}
      </TabPanel>
    </div>
  );
}

WorkQueueScreen.displayName = "WorkQueueScreen";
// Self-register on window so LazyScreens can resolve it after dynamic import.
window.WorkQueueScreen = WorkQueueScreen;

// Who is on a team, plus add and remove.
//
// GET/POST/DELETE /teams/{id}/members had no caller: a team could be created
// (and its creator made lead) but nobody could ever be added to it, so "Team
// Work" only ever showed the creator's own items. The server only accepts
// users from the caller's tenant, and roles "member" or "lead".
function TeamMembersModal({ open, team, onClose, onChanged }) {
  const [members, setMembers] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const loadMembers = React.useCallback(async () => {
    if (!team) return;
    setError(null);
    try {
      const list = await apiRequest(`/teams/${team.id}/members`);
      setMembers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || String(e));
      setMembers([]);
    }
  }, [team]);

  React.useEffect(() => {
    if (!open || !team) return;
    setMembers(null);
    setUserId("");
    setRole("member");
    loadMembers();
    api.users
      .list({ per_page: 200 })
      .then((res) => setUsers(res?.items || res?.data || (Array.isArray(res) ? res : [])))
      .catch(() => setUsers([]));
  }, [open, team, loadMembers]);

  if (!open || !team) return null;

  const memberIds = new Set((members || []).map((m) => m.user_id));
  const candidates = users.filter((u) => !memberIds.has(u.id));
  const label = (u) => u.fullName || u.username || u.email || `#${u.id}`;

  async function add() {
    if (!userId) return;
    setBusy(true);
    try {
      const res = await apiRequest(`/teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: Number(userId), role }),
      });
      if (res?.status === "exists") {
        toast(__t("work.alreadyMember") || "Already on this team", { kind: "info" });
      }
      setUserId("");
      await loadMembers();
      onChanged();
    } catch (e) {
      toast(e?.message || String(e), { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(m) {
    if (!window.confirm(`${__t("work.confirmRemoveMember") || "Remove from team"}: ${m.name || m.email}?`)) {
      return;
    }
    try {
      await apiRequest(`/teams/${team.id}/members/${m.user_id}`, { method: "DELETE" });
      await loadMembers();
      onChanged();
    } catch (e) {
      toast(e?.message || String(e), { kind: "error" });
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${team.name} · ${__t("work.members") || "Members"}`}
      closeLabel={__t("common.close") || "Close"}
    >
      {error && (
        <p className="fs-12" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {members === null ? (
        <Spinner size="sm" label={__t("common.loading") || "Loading…"} />
      ) : members.length === 0 ? (
        <EmptyState title={__t("work.noMembers") || "Nobody is on this team yet"} />
      ) : (
        <DataTable
          dense
          ariaLabel={__t("work.members") || "Team members"}
          rows={members.map((m) => ({ ...m, id: m.user_id }))}
          columns={[
            { key: "name", header: __t("common.name") || "Name" },
            { key: "email", header: __t("common.email") || "Email" },
            {
              key: "role",
              header: __t("common.role") || "Role",
              render: (m) => <StatusPill status={m.role} />,
            },
            {
              key: "actions",
              header: "",
              render: (m) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(m)}
                  aria-label={`${__t("common.remove") || "Remove"} ${m.name || m.email}`}
                >
                  {__t("common.remove") || "Remove"}
                </Button>
              ),
            },
          ]}
        />
      )}

      <div className="flex items-center gap-8" style={{ marginTop: 14 }}>
        <Select
          aria-label={__t("work.addWho") || "Person to add"}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">{__t("work.pickPerson") || "Add a person…"}</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {label(u)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={__t("common.role") || "Role"}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">{__t("work.roleMember") || "Member"}</option>
          <option value="lead">{__t("work.roleLead") || "Lead"}</option>
        </Select>
        <Button variant="primary" onClick={add} disabled={busy || !userId}>
          {__t("common.add") || "Add"}
        </Button>
      </div>
    </Modal>
  );
}
