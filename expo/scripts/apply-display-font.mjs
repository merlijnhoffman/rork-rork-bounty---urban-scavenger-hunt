// One-off codemod: adds `fontFamily: displayFont` to every title/headline style
// in the listed files and imports it from '@/constants/typography'.
// Run: bun scripts/apply-display-font.mjs  (from the expo/ folder)
import { readFileSync, writeFileSync } from "node:fs";

const IMPORT_LINE = `import { displayFont } from '@/constants/typography';`;

const jobs = {
  "app/(tabs)/hunt.tsx": [
    "appTitle",
    "cityNameLarge",
    "sectionTitle",
    "nextHuntTitle",
    "ticketClaimedTitle",
    "stepTitle",
    "huntTitle",
    "winnerBannerTitle",
    "waitingTitle",
    "modalTitle",
    "modalSectionTitle",
    "errorCardTitle",
  ],
  "app/(tabs)/profile.tsx": [
    "authTitle",
    "benefitsTitle",
    "cardTitle",
    "verificationTitle",
    "loadingTicketTitle",
    "securityTitle",
  ],
  "app/bounty-mode.tsx": [
    "headerTitle",
    "zoneAlertTitle",
    "winnerDeclaredTitle",
    "infoTitle",
    "winnerScannerTitle",
    "winnerSuccessTitle",
    "winnerVerifyingTitle",
    "winnerPermissionTitle",
    "winnerScanInstructionsTitle",
  ],
  "app/settings.tsx": ["headerTitle", "sectionTitle"],
  "app/privacy.tsx": ["headerTitle", "title"],
  "app/+not-found.tsx": ["title"],
  "components/RecapScreen.tsx": ["title"],
  "components/HuntHistory.tsx": ["sectionTitle"],
  "components/ConnectModal.tsx": [
    "headerTitle",
    "emptyTitle",
    "expiredTitle",
    "successTitle",
    "verifyingTitle",
    "duplicateTitle",
    "permissionTitle",
    "scanInstructionsTitle",
    "manualEntryTitle",
  ],
};

let totalAdded = 0;
const missed = [];

for (const [file, styles] of Object.entries(jobs)) {
  let src = readFileSync(file, "utf8");
  if (!src.includes("constants/typography")) {
    const lines = src.split("\n");
    let lastImport = -1;
    lines.forEach((l, i) => {
      if (/^import /.test(l)) lastImport = i;
    });
    if (lastImport === -1) throw new Error(`No import found in ${file}`);
    lines.splice(lastImport + 1, 0, IMPORT_LINE);
    src = lines.join("\n");
  }
  for (const style of styles) {
    const re = new RegExp(`^(\\s+)(?:'?)${style}(?:'?)?: \\{\\n`, "m");
    const m = src.match(re);
    if (!m) {
      missed.push(`${file}: ${style}`);
      continue;
    }
    if (m[0].includes("fontFamily")) continue; // already has one right below? (unlikely)
    src = src.replace(re, `$&${m[1]}  fontFamily: displayFont,\n`);
    totalAdded++;
  }
  writeFileSync(file, src);
  console.log(`updated ${file}`);
}

console.log(`added fontFamily to ${totalAdded} styles`);
if (missed.length) {
  console.log("MISSED (style not found):");
  for (const m of missed) console.log("  " + m);
}
