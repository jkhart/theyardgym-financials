import { ChevronDown, Settings2 } from "lucide-react";
import { ASSUMPTION_GROUPS } from "../lib/model/fields.js";

function AssumptionInput({ id, label, type, value, onChange }) {
  const step = type === "percent" || type === "decimal" ? 0.01 : 1;
  const displayValue = type === "percent" ? +(value * 100).toFixed(3) : value;
  return (
    <label className="inputRow">
      <span>{label}</span>
      <input
        type="number"
        value={displayValue}
        step={type === "currency" ? 100 : step}
        onChange={(event) => {
          const raw = Number(event.target.value);
          onChange(id, type === "percent" ? raw / 100 : raw);
        }}
      />
    </label>
  );
}

function LocationDateInput({ location, onFocus, onChange }) {
  return (
    <label className="inputRow">
      <span>{location.locationName}</span>
      <input
        type="date"
        value={location.projectedOpenDate}
        onFocus={() => onFocus(location)}
        onChange={(event) => onChange(location.id, event.target.value)}
      />
    </label>
  );
}

export function AssumptionsPanel({
  assumptions,
  locations = [],
  openGroup,
  setOpenGroup,
  updateAssumption,
  onSelectLocation,
  onUpdateOpenDate,
}) {
  return (
    <aside className="assumptions">
      <div className="panelTitle">
        <Settings2 size={18} />
        <h2>Assumptions</h2>
      </div>
      <section className="assumptionGroup">
        <button
          className="groupToggle"
          onClick={() => setOpenGroup(openGroup === "Portfolio Locations" ? "" : "Portfolio Locations")}
        >
          Portfolio Locations
          <ChevronDown
            size={16}
            className={openGroup === "Portfolio Locations" ? "chevron open" : "chevron"}
          />
        </button>
        {openGroup === "Portfolio Locations" && (
          <div className="groupFields">
            {locations.map((location) => (
              <LocationDateInput
                key={location.id}
                location={location}
                onFocus={onSelectLocation}
                onChange={onUpdateOpenDate}
              />
            ))}
          </div>
        )}
      </section>
      {ASSUMPTION_GROUPS.map((group) => (
        <section className="assumptionGroup" key={group.title}>
          <button
            className="groupToggle"
            onClick={() => setOpenGroup(openGroup === group.title ? "" : group.title)}
          >
            {group.title}
            <ChevronDown
              size={16}
              className={openGroup === group.title ? "chevron open" : "chevron"}
            />
          </button>
          {openGroup === group.title && (
            <div className="groupFields">
              {group.fields.map(([id, label, type]) => (
                <AssumptionInput
                  key={id}
                  id={id}
                  label={label}
                  type={type}
                  value={assumptions[id]}
                  onChange={updateAssumption}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </aside>
  );
}
