mapboxgl.accessToken = window.MAPBOX_TOKEN;

const palette = [
  '#f8c1c5',
  '#ef8b99',
  '#d75d7d',
  '#b23667',
  '#8a204f',
  '#5b1238'
];

const chartColor = '#5b1238';

const countryNamesES = {
  Germany: 'Alemania',
  France: 'Francia',
  Spain: 'España',
  Italy: 'Italia',
  Portugal: 'Portugal',
  Sweden: 'Suecia',
  Finland: 'Finlandia',
  Poland: 'Polonia',
  Romania: 'Rumanía',
  Bulgaria: 'Bulgaria',
  Greece: 'Grecia',
  Austria: 'Austria',
  Belgium: 'Bélgica',
  Netherlands: 'Países Bajos',
  Ireland: 'Irlanda',
  Denmark: 'Dinamarca',
  Czechia: 'Chequia',
  Slovakia: 'Eslovaquia',
  Hungary: 'Hungría',
  Croatia: 'Croacia',
  Lithuania: 'Lituania',
  Latvia: 'Letonia',
  Estonia: 'Estonia',
  Switzerland: 'Suiza',
  Norway: 'Noruega',
  Iceland: 'Islandia',
  Slovenia: 'Eslovenia',
  Luxembourg: 'Luxemburgo',
  Malta: 'Malta'
};

let allRows = [];
let currentYear = 2025;
let popup = null;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [18, 50],
zoom: 3.55,
maxBounds: [
  [-25, 33],
  [45, 72]
],
 pitchWithRotate: false,
  dragRotate: false,
  minZoom: 3,
maxZoom: 5
});

map.on('style.load', () => {
  const layers = map.getStyle().layers;

  layers.forEach(layer => {
    if (layer.type !== 'symbol') return;

    const id = layer.id.toLowerCase();

    if (
      id.includes('settlement') ||
      id.includes('poi') ||
      id.includes('airport') ||
      id.includes('transit') ||
      id.includes('road')
    ) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }

    if (
      id.includes('country') &&
      layer.layout &&
      layer.layout['text-field']
    ) {
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name_es'],
        ['get', 'name']
      ]);

      map.setPaintProperty(layer.id, 'text-color', '#ffffff');
      map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(60,60,60,0.85)');
      map.setPaintProperty(layer.id, 'text-halo-width', 1.4);
      map.setLayoutProperty(layer.id, 'text-size', [
  'interpolate',
  ['linear'],
  ['zoom'],
  2, 11,
  5, 16
]);
    }
  });
});

function num(value) {
  return Number(String(value).replace(',', '.'));
}

function getCountryKey(d) {
  return d.iso_code || d.iso3_code || d.cntr_id || d.country || d.name_engl || d.name;
}

function parseGeometry(wkt) {
  if (!wkt || !window.wellknown) return null;
  return wellknown.parse(wkt);
}

function buildGeoJSON(year) {
  const rows = allRows.filter(d => num(d.year) === Number(year));

  return {
    type: 'FeatureCollection',
    features: rows
      .map(d => {
        const rawName = d.name_engl || d.country || d.name || d.cntr_name;

        return {
          type: 'Feature',
          geometry: parseGeometry(d.geom),
          properties: {
            name: countryNamesES[rawName] || rawName,
            country_key: getCountryKey(d),
            year: num(d.year),
            poverty_rate: num(d.poverty_rate)
          }
        };
      })
      .filter(f => f.geometry)
  };
}

function getHistory(countryKey) {
  return allRows
    .filter(d => getCountryKey(d) === countryKey)
    .map(d => ({
      year: num(d.year),
      poverty_rate: num(d.poverty_rate)
    }))
    .filter(d => !isNaN(d.year) && !isNaN(d.poverty_rate))
    .sort((a, b) => a.year - b.year);
}

function makeMiniChart(history) {
  if (!history.length) return '';

  const width = 145;
  const height = 58;
  const padding = 14;

  const values = history.map(d => d.poverty_rate);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const points = history.map((d, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.poverty_rate - min) / (max - min || 1)) * (height - padding * 2);
    return { x, y, year: d.year, value: d.poverty_rate };
  });

  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="${padding}" y1="14" x2="${padding}" y2="${height - padding}" stroke="#DDD"/>
      <line x1="${width / 2}" y1="14" x2="${width / 2}" y2="${height - padding}" stroke="#EEE"/>
      <line x1="${width - padding}" y1="14" x2="${width - padding}" y2="${height - padding}" stroke="#DDD"/>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#D0D0D0"/>

      <polyline
        points="${line}"
        fill="none"
        stroke="${chartColor}"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="3" fill="${chartColor}"/>
      `).join('')}

      <circle cx="${last.x}" cy="${last.y}" r="4" fill="${chartColor}"/>

      <text x="${padding - 2}" y="${height - 1}" font-size="10" fill="#777">2015</text>
      <text x="${width / 2 - 10}" y="${height - 1}" font-size="10" fill="#777">2020</text>
      <text x="${width - padding - 18}" y="${height - 1}" font-size="10" fill="#777">2025</text>
    </svg>
  `;
}

function updateMap(year) {
  const source = map.getSource('poverty-source');
  if (source) source.setData(buildGeoJSON(year));
}

map.on('load', async () => {
 const SUPABASE_URL = 'SUPABASE_URL';

const SUPABASE_KEY = 'PUBLIC_KEY';

const response = await fetch(
  `${SUPABASE_URL}/rest/v1/poverty_map?select=*`,
  {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  }
);

allRows = await response.json();

  map.addSource('poverty-source', {
    type: 'geojson',
    data: buildGeoJSON(currentYear)
  });

  const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;

  map.addLayer(
    {
      id: 'poverty-fill',
      type: 'fill',
      source: 'poverty-source',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'poverty_rate'],
          10, palette[0],
          14, palette[1],
          18, palette[2],
          22, palette[3],
          26, palette[4],
          30, palette[5]
        ],
        'fill-opacity': 0.9,
        'fill-outline-color': 'rgba(70,40,55,0.55)'
      }
    },
    firstSymbolLayer
  );

  map.addLayer({
    id: 'poverty-hover',
    type: 'line',
    source: 'poverty-source',
    paint: {
      'line-color': 'rgba(40,20,35,0.75)',
      'line-width': 1.2
    },
    filter: ['==', 'country_key', '']
  });

  map.on('mousemove', 'poverty-fill', e => {
    map.getCanvas().style.cursor = 'pointer';

    const p = e.features[0].properties;
    const history = getHistory(p.country_key);
    const latest = history.find(d => d.year === 2025) || history[history.length - 1];

    map.setFilter('poverty-hover', ['==', 'country_key', p.country_key]);

    if (popup) popup.remove();

    popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '170px'
    })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tooltip">
          <h3>${p.name}</h3>
          <p><strong>${latest.poverty_rate}%</strong> en ${latest.year}</p>
          ${makeMiniChart(history)}
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'poverty-fill', () => {
    map.getCanvas().style.cursor = '';
    map.setFilter('poverty-hover', ['==', 'country_key', '']);

    if (popup) popup.remove();
  });
});

document.getElementById('yearSlider').addEventListener('input', e => {
  currentYear = Number(e.target.value);
  document.getElementById('yearLabel').textContent = currentYear;
  updateMap(currentYear);
});