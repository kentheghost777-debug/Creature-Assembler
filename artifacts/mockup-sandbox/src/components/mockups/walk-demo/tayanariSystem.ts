/**
 * Single coordination layer for Primeria's Tayanari catalog, regional Dex, and
 * level-evolution graph.
 *
 * Existing creature definitions remain in their current files during the safe
 * migration. Runtime consumers use this API so data can be moved behind it
 * incrementally without changing save IDs or battle behavior.
 */

export type CatalogTayanari = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  wildImg?: string;
  playerImg?: string;
};

export type EvolutionRule<TForm> = {
  from: string;
  atLevel: number;
  to: TForm & { id: string; name: string };
};

export type DexRegion<TMon> = {
  key: string;
  label: string;
  accent: string;
  mons: readonly TMon[];
};

export type DexDiscovery = "unknown" | "seen" | "caught" | "evolved";

export type TayanariSystemIssue = {
  level: "error" | "warning";
  code:
    | "duplicate_region_id"
    | "conflicting_identity"
    | "duplicate_evolution_trigger"
    | "evolution_cycle"
    | "missing_evolution_source"
    | "missing_image";
  id: string;
  message: string;
};

export function discoveryFor(
  id: string,
  seenIds: ReadonlySet<string>,
  caughtIds: ReadonlySet<string>,
  evolvedIds: ReadonlySet<string>,
): DexDiscovery {
  if (evolvedIds.has(id)) return "evolved";
  if (caughtIds.has(id)) return "caught";
  if (seenIds.has(id)) return "seen";
  return "unknown";
}

export function createTayanariSystem<
  TMon extends CatalogTayanari,
  TForm extends { id: string; name: string },
>(config: {
  regions: readonly DexRegion<TMon>[];
  evolutions: readonly EvolutionRule<TForm>[];
}) {
  const byId = new Map<string, TMon>();
  const firstRegionById = new Map<string, string>();
  const issues: TayanariSystemIssue[] = [];

  for (const region of config.regions) {
    for (const mon of region.mons) {
      const existing = byId.get(mon.id);
      if (!existing) {
        byId.set(mon.id, mon);
        firstRegionById.set(mon.id, region.key);
      } else {
        issues.push({
          level: "warning",
          code: "duplicate_region_id",
          id: mon.id,
          message: `${mon.id} appears in both ${firstRegionById.get(mon.id)} and ${region.key}.`,
        });
        if (existing.name !== mon.name || existing.type !== mon.type) {
          issues.push({
            level: "error",
            code: "conflicting_identity",
            id: mon.id,
            message: `${mon.id} has conflicting names or types across regional definitions.`,
          });
        }
      }

      if (!mon.wildImg && !mon.playerImg && !("wildSheet" in mon)) {
        issues.push({
          level: "warning",
          code: "missing_image",
          id: mon.id,
          message: `${mon.name} has no direct image or sprite-sheet reference.`,
        });
      }
    }
  }

  const evoByTrigger = new Map<string, EvolutionRule<TForm>>();
  const evoByFrom = new Map<string, EvolutionRule<TForm>[]>();

  for (const rule of config.evolutions) {
    const trigger = `${rule.from}@${rule.atLevel}`;
    if (evoByTrigger.has(trigger)) {
      issues.push({
        level: "error",
        code: "duplicate_evolution_trigger",
        id: rule.from,
        message: `Multiple evolutions use the trigger ${trigger}.`,
      });
      continue;
    }
    evoByTrigger.set(trigger, rule);
    const list = evoByFrom.get(rule.from) ?? [];
    list.push(rule);
    list.sort((a, b) => a.atLevel - b.atLevel);
    evoByFrom.set(rule.from, list);
  }

  const evolutionIds = new Set<string>();
  for (const rule of config.evolutions) {
    evolutionIds.add(rule.from);
    evolutionIds.add(rule.to.id);
  }

  for (const rule of config.evolutions) {
    if (!byId.has(rule.from) && !config.evolutions.some(e => e.to.id === rule.from)) {
      issues.push({
        level: "warning",
        code: "missing_evolution_source",
        id: rule.from,
        message: `${rule.from} is an evolution source but is absent from the regional catalog.`,
      });
    }
  }

  function evolutionAt(id: string, level: number): EvolutionRule<TForm> | null {
    return evoByTrigger.get(`${id}@${level}`) ?? null;
  }

  function nextEvolution(id: string): EvolutionRule<TForm> | null {
    return evoByFrom.get(id)?.[0] ?? null;
  }

  function buildEvolutionChain(rootId: string, maxForms = 12): Array<{
    id: string;
    name: string;
    atLevel?: number;
    form?: TMon | TForm;
  }> {
    const result: Array<{ id: string; name: string; atLevel?: number; form?: TMon | TForm }> = [];
    const visited = new Set<string>();
    let currentId = rootId;
    let currentName = byId.get(rootId)?.name ?? rootId;

    while (result.length < maxForms) {
      if (visited.has(currentId)) {
        issues.push({
          level: "error",
          code: "evolution_cycle",
          id: currentId,
          message: `Evolution cycle detected at ${currentId}.`,
        });
        break;
      }
      visited.add(currentId);
      result.push({ id: currentId, name: currentName, form: byId.get(currentId) });
      const next = nextEvolution(currentId);
      if (!next) break;
      currentId = next.to.id;
      currentName = next.to.name;
      result.push({
        id: currentId,
        name: currentName,
        atLevel: next.atLevel,
        form: next.to,
      });
      // The newly-added form is the next loop's current form. Remove it here so
      // it is not duplicated before following another edge.
      if (nextEvolution(currentId)) result.pop();
      else break;
    }
    return result;
  }

  function uniqueRegionMons(region: DexRegion<TMon>): TMon[] {
    const found = new Set<string>();
    return region.mons.filter(mon => {
      if (found.has(mon.id)) return false;
      found.add(mon.id);
      return true;
    });
  }

  return Object.freeze({
    regions: config.regions,
    evolutions: config.evolutions,
    byId,
    evolutionIds,
    issues,
    get: (id: string) => byId.get(id) ?? null,
    evolutionAt,
    nextEvolution,
    buildEvolutionChain,
    uniqueRegionMons,
  });
}
