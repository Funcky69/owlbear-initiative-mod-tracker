import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/dist/index.js";

const EXTENSION_ID = "initiative-mod-tracker";

let state = {
  entries: [], // { tokenId, name, initiative, modifier, roll }
  activeIndex: 0,
};

/* -------------------------
   State helpers
------------------------- */

async function saveState() {
  await OBR.scene.setMetadata({ [EXTENSION_ID]: state });
}

async function loadState() {
  const metadata = await OBR.scene.getMetadata();
  state = metadata[EXTENSION_ID] ?? state;
}

/* -------------------------
   Initiative logic
------------------------- */

function rollInitiative(modifier = 0) {
  const roll = Math.floor(Math.random() * 20) + 1;
  return { roll, total: roll + modifier };
}

/* -------------------------
   Token handling
------------------------- */

async function addSelectedTokens() {
  const selected = await OBR.player.getSelection();

  for (const tokenId of selected) {
    // Prevent duplicates
    if (state.entries.some(e => e.tokenId === tokenId)) continue;

    const token = await OBR.scene.items.get(tokenId);
    if (!token) continue;

    state.entries.push({
      tokenId,
      name: token.name ?? "Token",
      initiative: 0,
      modifier: 0,
      roll: null,
    });
  }

  await saveState();
  render();
}

/* -------------------------
   UI Rendering
------------------------- */

function render() {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = "";

  const list = document.createElement("div");

  state.entries
    .sort((a, b) => {
      // 1) Total initiative
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      // 2) Modifier wins ties
      if (b.modifier !== a.modifier) {
        return b.modifier - a.modifier;
      }
      // 3) Raw roll as final tiebreaker
      return (b.roll ?? 0) - (a.roll ?? 0);
    })
    .forEach((entry, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.padding = "4px";
      row.style.marginBottom = "2px";
      row.style.background =
        index === state.activeIndex ? "#333" : "transparent";

      const name = document.createElement("span");
      name.textContent = entry.name;
      name.style.flex = "1";

      const total = document.createElement("span");
      total.textContent = entry.initiative.toString();
      total.style.width = "30px";
      total.style.textAlign = "right";

      const modInput = document.createElement("input");
      modInput.type = "number";
      modInput.value = entry.modifier;
      modInput.style.width = "45px";
      modInput.onchange = async (e) => {
        entry.modifier = Number(e.target.value);
        await saveState();
      };

      const rollBtn = document.createElement("button");
      rollBtn.textContent = "Roll";
      rollBtn.onclick = async () => {
        const { roll, total } = rollInitiative(entry.modifier);
        entry.roll = roll;
        entry.initiative = total;
        await saveState();
        render();
      };

      row.append(name, total, modInput, rollBtn);
      list.appendChild(row);
    });

  const controls = document.createElement("div");
  controls.style.marginTop = "8px";

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next Turn";
  nextBtn.onclick = async () => {
    if (state.entries.length === 0) return;
    state.activeIndex =
      (state.activeIndex + 1) % state.entries.length;
    await saveState();
    render();
  };

  controls.appendChild(nextBtn);
  root.append(list, controls);
}

/* -------------------------
   Owlbear hooks
------------------------- */

OBR.onReady(async () => {
  await loadState();

  OBR.contextMenu.create({
    id: `${EXTENSION_ID}.add`,
    icons: [{ icon: "+", label: "Add to Initiative" }],
    filter: {
      every: [{ key: "layer", value: "CHARACTER" }],
    },
    onClick: addSelectedTokens,
  });

  render();
});
