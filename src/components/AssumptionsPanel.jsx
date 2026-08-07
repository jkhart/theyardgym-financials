import { ChevronDown, Settings2 } from "lucide-react";
import { ASSUMPTION_GROUPS } from "../lib/model/fields.js";

export function AssumptionInput({ id, label, type, value, onChange }) {
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

export function AssumptionsPanel({ assumptions, openGroup, setOpenGroup, updateAssumption }) {
  return (
    <aside className="assumptions">
      <div className="panelTitle">
        <Settings2 size={18} />
        <h2>Shared Location Assumptions</h2>
      </div>
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
              {group.description && <p className="groupDescription">{group.description}</p>}
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
