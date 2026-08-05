import { Building2, Plus, Power, Trash2 } from "lucide-react";
import { money, pct } from "../lib/formatting.js";

export function LocationManager({
  activeLocationId,
  locationMeta,
  locations,
  setLocationMeta,
  onNew,
  onLoad,
  onToggleActive,
  onDelete,
}) {
  function updateMeta(key, value) {
    setLocationMeta((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="locationPanel">
      <div className="panelHeader">
        <div className="panelTitle">
          <Building2 size={18} />
          <h2>Saved Locations</h2>
        </div>
        <button onClick={onNew} title="Start a new location model">
          <Plus size={16} />
          New
        </button>
      </div>
      <div className="locationFields">
        <input
          value={locationMeta.locationName}
          onChange={(event) => updateMeta("locationName", event.target.value)}
          placeholder="Location name"
        />
        <label className="compactField">
          <span>Projected open</span>
          <input
            type="date"
            value={locationMeta.projectedOpenDate}
            onChange={(event) => updateMeta("projectedOpenDate", event.target.value)}
          />
        </label>
        <input
          value={locationMeta.scenarioName}
          onChange={(event) => updateMeta("scenarioName", event.target.value)}
          placeholder="Scenario name"
        />
      </div>
      <div className="locationList">
        {locations.length === 0 ? (
          <p className="emptyState">No saved locations yet.</p>
        ) : (
          locations.map((location) => {
            const isActive = location.isActive !== false;
            return (
            <article
              className={[
                "locationItem",
                location.id === activeLocationId ? "active" : "",
                isActive ? "" : "inactive",
              ]
                .filter(Boolean)
                .join(" ")}
              key={location.id}
            >
              <button className="locationLoad" onClick={() => onLoad(location)}>
                <strong>{location.locationName}</strong>
                <span>
                  {isActive ? "Active" : "Inactive"} · {location.projectedOpenDate} ·{" "}
                  {money.format(location.outputs.month36.grossOperatingProfit)} M36
                  op profit · {pct.format(location.outputs.month36.operatingMargin)}
                </span>
              </button>
              <button
                aria-pressed={isActive}
                className={isActive ? "iconButton locationStatusButton active" : "iconButton locationStatusButton"}
                onClick={() => onToggleActive(location.id, !isActive)}
                title={isActive ? "Exclude location from scenarios" : "Include location in scenarios"}
              >
                <Power size={15} />
              </button>
              <button className="iconButton" onClick={() => onDelete(location.id)} title="Delete location">
                <Trash2 size={15} />
              </button>
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}
