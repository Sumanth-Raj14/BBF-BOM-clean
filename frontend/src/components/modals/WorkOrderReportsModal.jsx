import PropTypes from "prop-types";

import { __t } from "../../i18n";
import { toast } from "../../utils/toast";
import { api } from "../../../api.js";
import { Button, Field, Input, Modal, Spinner, Tabs, TabPanel } from "../ui";

// Daily and efficiency reports for work orders.
//
// These two endpoints had wrappers (added with the shop-floor work) and no
// surface at all — the exact "backend with a client but no screen" pattern.
//
// Four behaviours of the backend drive the copy here. Each would otherwise
// make the UI quietly lie:
//
//  1. Divide-by-zero returns the INTEGER 0, not null. on_time_delivery is 0
//     when completed_orders is 0, and quality_rate is 0 when nothing was
//     produced. Rendering "0%" there reads as a measured catastrophe rather
//     than "no data", so both are shown as an em dash when their denominator
//     is zero.
//  2. The denominators differ: on_time_delivery is over COMPLETED orders,
//     quality_rate is over UNITS produced. The labels say which.
//  3. The efficiency range filters WorkOrder.created_at, not completed_date —
//     so it is "orders raised in this period", not "orders completed in it".
//     Saying "completed" would be wrong.
//  4. A malformed date is swallowed server-side (except ValueError: pass):
//     no 422, the filter is silently dropped, and you get unfiltered totals
//     with the bad string echoed back in `period`. So dates are validated here
//     before sending.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function Stat({ label, value, hint }) {
  return (
    <div className="bg-sunk rounded-r2" style={{ padding: 12, minWidth: 128 }}>
      <div className="fs-10 fg-3">{label}</div>
      <div className="fs-18 fw-600 font-mono">{value}</div>
      {hint && <div className="fs-10 fg-3" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
Stat.propTypes = { label: PropTypes.string, value: PropTypes.node, hint: PropTypes.string };

export default function WorkOrderReportsModal({ open, onClose }) {
  const TABS_ID = "wo-reports-tabs";
  const [tab, setTab] = React.useState("daily");
  const [busy, setBusy] = React.useState(false);

  const [daily, setDaily] = React.useState({ date: "", workCenter: "", data: null, error: null });
  const [eff, setEff] = React.useState({
    start: "", end: "", workCenter: "", data: null, error: null,
  });

  if (!open) return null;

  const badDate = (v) => v && !ISO.test(v);

  async function runDaily() {
    if (badDate(daily.date)) {
      toast(__t("woReports.badDate") || "Date must be YYYY-MM-DD", { kind: "error" });
      return;
    }
    setBusy(true);
    try {
      const params = {};
      if (daily.date) params.report_date = daily.date;
      if (daily.workCenter) params.work_center = daily.workCenter;
      const data = await api.workOrderOps.dailyReport(params);
      setDaily((s) => ({ ...s, data, error: null }));
    } catch (e) {
      setDaily((s) => ({ ...s, data: null, error: e?.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }

  async function runEff() {
    if (badDate(eff.start) || badDate(eff.end)) {
      toast(__t("woReports.badDate") || "Dates must be YYYY-MM-DD", { kind: "error" });
      return;
    }
    setBusy(true);
    try {
      const params = {};
      if (eff.start) params.start_date = eff.start;
      if (eff.end) params.end_date = eff.end;
      if (eff.workCenter) params.work_center = eff.workCenter;
      const data = await api.workOrderOps.efficiencyReport(params);
      setEff((s) => ({ ...s, data, error: null }));
    } catch (e) {
      setEff((s) => ({ ...s, data: null, error: e?.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }

  const d = daily.data;
  const e = eff.data;
  // Denominator-aware: 0 from the server means "nothing to measure", not 0%.
  const pct = (value, denominator) =>
    denominator > 0 ? `${Number(value).toFixed(1)}%` : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={__t("woReports.title") || "Work order reports"}
      closeLabel={__t("common.close") || "Close"}
    >
      <Tabs
        id={TABS_ID}
        items={[
          { value: "daily", label: __t("woReports.daily") || "Daily" },
          { value: "efficiency", label: __t("woReports.efficiency") || "Efficiency" },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel={__t("woReports.title") || "Work order reports"}
      />

      {/* ONE TabPanel, content switched inside — the component takes
          id/value/active and does not accept a per-tab value, so a panel per
          tab renders nothing at all. */}
      <TabPanel id={TABS_ID} value={tab} active className="mt-16">
        {tab === "daily" && (
        <>
        <div className="field-row" style={{ marginTop: 12 }}>
          <Field label={__t("woReports.date") || "Date (YYYY-MM-DD)"}>
            <Input
              mono
              placeholder="2026-10-04"
              value={daily.date}
              onChange={(ev) => setDaily({ ...daily, date: ev.target.value })}
            />
          </Field>
          <Field label={__t("woReports.workCenter") || "Work center (optional)"}>
            <Input
              value={daily.workCenter}
              onChange={(ev) => setDaily({ ...daily, workCenter: ev.target.value })}
            />
          </Field>
        </div>
        <Button onClick={runDaily} disabled={busy}>
          {busy ? <Spinner /> : __t("woReports.run") || "Run report"}
        </Button>
        <p className="fs-11 fg-3" style={{ margin: "6px 0 0" }}>
          {__t("woReports.dailyHint") ||
            "Left blank, the date defaults to the SERVER's local day, which may not be yours."}
        </p>

        {daily.error && (
          <p className="fs-11" style={{ color: "var(--danger)" }}>{daily.error}</p>
        )}
        {d && (
          <div className="flex gap-8" style={{ flexWrap: "wrap", marginTop: 14 }}>
            <Stat label={__t("woReports.forDate") || "Date"} value={d.date} />
            <Stat label={__t("woReports.workCenter") || "Work center"} value={d.work_center} />
            <Stat label={__t("woReports.started") || "Started"} value={d.orders_started} />
            <Stat label={__t("woReports.completed") || "Completed"} value={d.orders_completed} />
            <Stat label={__t("woReports.produced") || "Produced"} value={d.total_produced} />
            <Stat label={__t("woReports.scrapped") || "Scrapped"} value={d.total_scrapped} />
          </div>
        )}
        </>
        )}

        {tab === "efficiency" && (
        <>
        <div className="field-row" style={{ marginTop: 12 }}>
          <Field label={__t("woReports.start") || "Start (YYYY-MM-DD)"}>
            <Input
              mono
              value={eff.start}
              onChange={(ev) => setEff({ ...eff, start: ev.target.value })}
            />
          </Field>
          <Field label={__t("woReports.end") || "End (YYYY-MM-DD)"}>
            <Input
              mono
              value={eff.end}
              onChange={(ev) => setEff({ ...eff, end: ev.target.value })}
            />
          </Field>
          <Field label={__t("woReports.workCenter") || "Work center (optional)"}>
            <Input
              value={eff.workCenter}
              onChange={(ev) => setEff({ ...eff, workCenter: ev.target.value })}
            />
          </Field>
        </div>
        <Button onClick={runEff} disabled={busy}>
          {busy ? <Spinner /> : __t("woReports.run") || "Run report"}
        </Button>
        <p className="fs-11 fg-3" style={{ margin: "6px 0 0" }}>
          {__t("woReports.effRangeHint") ||
            "The range filters when work orders were RAISED (created), not when they were completed. The end date is exclusive of that day's later hours."}
        </p>

        {eff.error && <p className="fs-11" style={{ color: "var(--danger)" }}>{eff.error}</p>}
        {e && (
          <div className="flex gap-8" style={{ flexWrap: "wrap", marginTop: 14 }}>
            <Stat label={__t("woReports.period") || "Period"} value={e.period} />
            <Stat label={__t("woReports.workCenter") || "Work center"} value={e.work_center} />
            <Stat label={__t("woReports.totalOrders") || "Orders raised"} value={e.total_orders} />
            <Stat label={__t("woReports.completed") || "Completed"} value={e.completed_orders} />
            <Stat
              label={__t("woReports.onTime") || "On-time delivery"}
              value={pct(e.on_time_delivery, e.completed_orders)}
              hint={__t("woReports.ofCompleted") || "of completed orders"}
            />
            <Stat
              label={__t("woReports.quality") || "Quality rate"}
              value={pct(e.quality_rate, e.total_produced)}
              hint={__t("woReports.ofProduced") || "of units produced"}
            />
            <Stat label={__t("woReports.produced") || "Produced"} value={e.total_produced} />
            <Stat label={__t("woReports.scrapped") || "Scrapped"} value={e.total_scrapped} />
          </div>
        )}
        </>
        )}
      </TabPanel>
    </Modal>
  );
}

WorkOrderReportsModal.propTypes = { open: PropTypes.bool, onClose: PropTypes.func };
