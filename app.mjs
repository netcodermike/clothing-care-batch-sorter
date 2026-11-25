import { readFileSync } from 'node:fs'

function analyze({items}) {
  if (!Array.isArray(items)) throw Error('Provide a list of garments');
  const ids = new Set(), batches = new Map(), separate = [], review = [];
  const textFields = ['cycle', 'color_group', 'dry'];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim())
      throw Error('Every garment needs an ID');
    const id = item.id.trim();
    if (ids.has(id)) throw Error('Duplicate garment ID: ' + id);
    ids.add(id);
    if (item.machine_wash === false) { separate.push(id); continue; }
    if (item.machine_wash == null) {
      review.push({id, missing: ['machine_wash']});
      continue;
    }
    if (item.machine_wash !== true) throw Error('Machine wash must be true or false for ' + id);
    const maximum = item.wash_max_c;
    if (maximum != null && (!Number.isFinite(maximum) || maximum <= 0 || maximum > 100))
      throw Error('Washing temperature must be above 0 and at most 100 °C for ' + id);
    const labels = textFields.map(key => {
      if (item[key] == null) return '';
      if (typeof item[key] !== 'string') throw Error('Expected a text ' + key + ' for ' + id);
      return item[key].trim();
    });
    const missing = maximum == null ? ['wash_max_c'] : [];
    labels.forEach((label, i) => { if (!label) missing.push(textFields[i]); });
    if (missing.length) { review.push({id, missing}); continue; }
    const [cycle, colorGroup, dry] = labels;
    const key = JSON.stringify(labels);
    if (!batches.has(key)) {
      batches.set(key, {cycle, color_group: colorGroup, dry, max_temperature_c: maximum, items: []});
    }
    const batch = batches.get(key);
    batch.max_temperature_c = Math.min(batch.max_temperature_c, maximum);
    batch.items.push(id);
  }
  return {batches: [...batches.values()], separate, review};
}

try {
  if (process.argv.length !== 3) throw new Error('Usage: node app.mjs input.json')
  console.log(JSON.stringify(analyze(JSON.parse(readFileSync(process.argv[2], 'utf8')))))
} catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
