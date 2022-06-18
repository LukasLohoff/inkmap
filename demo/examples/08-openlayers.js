import {
  downloadBlob,
  fromOlMap,
  print
} from '@camptocamp/inkmap';

import { Fill, Stroke, Style} from 'ol/style';
import { fromLonLat, get as getProjection } from 'ol/proj';
import { getTopLeft } from 'ol/extent';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import GeoJSON from 'ol/format/GeoJSON';
import OlLayerTile from 'ol/layer/Tile';
import OlMap from 'ol/Map';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlView from 'ol/View';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';

const root = document.getElementById('example-08');
const btn = /** @type {CustomButton} */ root.querySelector('custom-button');

const projection = getProjection('EPSG:3857');
const projectionExtent = projection.getExtent();

const geojson = {
  'type': 'FeatureCollection',
  'crs': {
    'type': 'name',
    'properties': {
      'name': 'EPSG:3857',
    },
  },
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [
          [
            [2e6, 5e6],
            [2e6, 6e6],
            [2e6, 7e6],
            [0e6, 5e6]
          ],
        ],
      },
    },
  ]
};

const vectorSource = new VectorSource({
  features: new GeoJSON().readFeatures(geojson),
});

const map = new OlMap({
  target: 'map',
  layers: [
    new OlLayerTile({
      source: new OlSourceOsm(),
    }),
    new OlLayerTile({
      name: 'True Color Composite',
      opacity: 0.5,
      source: new OlSourceTileWMS({
        url: 'https://geoserver.mundialis.de/geoserver/wms',
        params: {'LAYERS': '1_040302', 'TILED': true},
        serverType: 'geoserver'
      })
    }),
    new OlLayerTile({
      opacity: 0.6,
      source: new WMTS({
        attributions:
          'Tiles © <a href="https://mrdata.usgs.gov/geology/state/"' +
          ' target="_blank">USGS</a>',
        url: 'https://mrdata.usgs.gov/mapcache/wmts',
        layer: 'sgmc2',
        matrixSet: 'GoogleMapsCompatible',
        format: 'image/png',
        projection: projection,
        tileGrid: new WMTSTileGrid({
          origin: getTopLeft(projectionExtent),
          resolutions: [
            156543.03392804097,
            78271.51696402048,
            39135.75848201024,
            19567.87924100512,
            9783.93962050256,
            4891.96981025128,
            2445.98490512564,
            1222.99245256282,
            611.49622628141,
            305.748113140705,
            152.8740565703525,
            76.43702828517625,
            38.21851414258813,
            19.109257071294063,
            9.554628535647032,
            4.777314267823516,
            2.388657133911758,
            1.194328566955879,
            0.5971642834779395
          ],
          matrixIds: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]
        }),
        style: 'default',
        wrapX: true
      })
    }),
    new VectorLayer({
      source: vectorSource,
      style: [
        new Style({
          stroke: new Stroke({
            color: '#0000FF', // 'blue', todo: parser does not support named colors
            lineDash: [4],
            width: 3
          })
        }),
        new Style({
          fill: new Fill({
            color: 'rgba(0, 0, 255, 0.1)'
          })
        })
      ]
    })
  ],
  view: new OlView({
    center: fromLonLat([8, 50]),
    zoom: 4
  })
});

console.log('btn', btn);

btn.addEventListener('click', async () => {
  console.log('map in event listener', map);
  btn.showSpinner();

  const spec = await fromOlMap(map);

  // create a job, get a promise that resolves when the job is finished
  const blob = await print(spec);

  btn.hideSpinner();

  downloadBlob(blob, 'inkmap.png');
});
