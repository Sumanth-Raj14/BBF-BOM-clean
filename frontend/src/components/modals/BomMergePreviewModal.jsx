import PropTypes from "prop-types";

import { __t } from "../../i18n";
import { api } from "../../../api.js";
import { Badge, Button, Field, Input, Modal, Select, Spinner } from "../ui";
import DataTable from "../ui/DataTable.jsx";

// Preview of folding several BOMs into one.
//
// It is called a PREVIEW throughout, and there is no "Save" or "Merge"
// button, because POST /enterprise/bom/merge PERSISTS NOTHING. The handler
// reads the source BOMs, folds duplicates in memory and returns the result —
// it contains no INSERT, no db.add and no commit. A button that said "Merge"
// and a toast that said "BOMs merged" would claim an action the server never
// performs, which is the precise class of dead-fake this codebase has spent
// real effort deleting.
//
// The strategy is a Select, not a free-text field, because the handler is an
// if/elif on "keep_highest_qty" and "sum" with NO else branch: any other
// string silently takes neither path, so a duplicate quietly keeps the FIRST
// BOM's quantity while the response echoes the unknown value back as though
// it had been honoured.

export default function BomMergePreviewModal({ open, bomId, onClose }) {
  const [ids, setIds] = React.useState("");
  const [name, setName] = React.useState("");
  const [strategy, setStrategy] = React.useState("keep_highest_qty");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (open) {
      // Seed with the BOM this was opened from, so it is one of the sources.
      setIds(bomId != null ? String(bomId) : "");
      setName("");
      setResult(null);
      setError(null);
    }
  }, [open, bomId]);

  if (!open) return null;

  const parsed = ids
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  // The server returns 400 below two sources; say so before the round trip.
  const tooFew = parsed.length < 2;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.enterpriseExtra.previewBomMerge(parsed, name || "Merged BOM", strategy);
      setResult(r);
    } catch (e) {
      setError(e?.message || String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: "pn", header: __t("part.partNumber") || "Part number",
      render: (r) => <span className="font-mono fs-11">{r.pn}</span> },
    { key: "name", header: __t("common.name") || "Name" },
    { key: "quantity", header: __t("part.quantity") || "Qty", align: "num",
      render: (r) => <span className="font-mono">{r.quantity ?? "—"}</span> },
    { key: "uom", header: __t("part.uom") || "UoM" },
    { key: "sources", header: __t("bomMerge.sources") || "From BOMs",
      render: (r) => (
        <span className="font-mono fs-10 fg-3">{(r.sources || []).join(", ")}</span>
      ) },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={__t("bomMerge.title") || "Merge BOMs — preview"}
      subtitle={__t("bomMerge.subtitle") || "Nothing is saved"}
      closeLabel={__t("common.close") || "Close"}
    >
      <div
        className="rounded-r2"
        style={{ padding: 10, marginBottom: 12, border: "1px solid var(--bd-1)" }}
      >
        <span className="fs-11 fg-3">
          {__t("bomMerge.previewOnly") ||
            "This endpoint computes the merged result and returns it. It does not create a BOM, and nothing here is written to the database — copy what you need, or use it to check the fold before building the BOM yourself."}
        </span>
      </div>

      <div className="field-row">
        <Field label={__t("bomMerge.sourceIds") || "Source BOM ids (comma separated, at least 2)"}>
          <Input
            mono
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            aria-label={__t("bomMerge.sourceIds") || "Source BOM ids"}
          />
        </Field>
        <Field label={__t("bomMerge.targetName") || "Name for the result"}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={__t("bomMerge.strategy") || "Duplicate handling"}>
          {/* Select renders CHILDREN (<option>), it does not take an options
              array — passing one yields an empty dropdown with no error. */}
          <Select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="keep_highest_qty">
              {__t("bomMerge.keepHighest") || "Keep the highest quantity"}
            </option>
            <option value="sum">
              {__t("bomMerge.sum") || "Add the quantities together"}
            </option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-8">
        <Button onClick={run} disabled={busy || tooFew}>
          {busy ? <Spinner /> : __t("bomMerge.preview") || "Preview merge"}
        </Button>
        {tooFew && (
          <span className="fs-11 fg-3">
            {__t("bomMerge.needTwo") || "Give at least two BOM ids — the server rejects fewer."}
          </span>
        )}
      </div>

      {error && (
        <p className="fs-11" style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
            <strong className="fs-13">{result.merged_name}</strong>
            <Badge tone="neutral">
              {result.total_items} {__t("bomMerge.lines") || "lines"}
            </Badge>
            <Badge tone="neutral">
              {__t("bomMerge.from") || "from"} {(result.source_bom_ids || []).join(", ")}
            </Badge>
          </div>
          <DataTable
            dense
            ariaLabel={__t("bomMerge.title") || "Merged preview"}
            columns={columns}
            rows={result.items || []}
          />
        </div>
      )}
    </Modal>
  );
}

BomMergePreviewModal.propTypes = {
  open: PropTypes.bool,
  bomId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func,
};
