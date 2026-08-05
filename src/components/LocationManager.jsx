import { Building2 } from "lucide-react";
import { money, pct } from "../lib/formatting.js";

export function LocationManager({
  activeLocationId,
  locations,
  onLoad,
  onUpdateOpenDate,
}) {
  return (
    <section className="locationPanel">
      <div className="panelHeader">
        <div className="panelTitle">
          <Building2 size={18} />
          <h2>Portfolio Locations</h2>
        </div>
      </div>
      <div className="locationList">
        {locations.length === 0 ? (
          <p className="emptyState">No locations configured.</p>
        ) : (
          locations.map((location) => {
            return (
            <article
              className={[
                "locationItem",
                location.id === activeLocationId ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={location.id}
            >
              <button className="locationLoad" onClick={() => onLoad(location)}>
                <strong>{location.locationName}</strong>
                <span>
                  Opens {location.projectedOpenDate} · {money.format(location.outputs.month36.grossOperatingProfit)} M36 op
                  profit · {pct.format(location.outputs.month36.operatingMargin)}
                </span>
              </button>
              <label className="compactField locationDateField">
                <span>Projected open</span>
                <input
                  type="date"
                  value={location.projectedOpenDate}
                  onChange={(event) => onUpdateOpenDate(location.id, event.target.value)}
                />
              </label>
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}
