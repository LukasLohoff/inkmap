import {toLonLat} from 'ol/proj';
import ImageWMS from 'ol/source/ImageWMS';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import VectorSource from 'ol/source/Vector';
import WMTS from 'ol/source/WMTS';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import {METERS_PER_UNIT} from 'ol/proj/Units';

import OpenLayersParser from 'geostyler-openlayers-parser';

export function hasOffscreenCanvasSupport() {
  return !!HTMLCanvasElement.prototype.transferControlToOffscreen;
}

/**
 * Will automatically download the image data as an image file.
 * @param {Blob} imageBlob
 * @param {string} filename
 */
export function downloadBlob(imageBlob, filename) {
  const anchor = document.createElement('a');
  const objectUrl = URL.createObjectURL(imageBlob);
  anchor.setAttribute('download', filename);
  anchor.setAttribute('href', objectUrl);
  anchor.click();
}

export function getScaleForResolution(resolution, units) {
  var dpi = 25.4 / 0.28;
  var mpu = METERS_PER_UNIT[units];
  var inchesPerMeter = 39.37;

  return (resolution ? parseFloat(resolution) : resolution) * mpu * inchesPerMeter * dpi;
}

//  * @return {Promise<import('../main/index').WfsLayer>} todo!
/**
 * Will generate a print spec from an openlayers map.
 * @param {OlMap} olMap
 */
export function fromOlMap(olMap) {
  console.log('olMap', olMap)
  const unit = olMap.getView().getProjection().getUnits();
  const resolution = olMap.getView().getResolution();
  const projection =  olMap.getView().getProjection().getCode();

  const scale = getScaleForResolution(resolution, unit);
  const center = olMap?.getView().getCenter();
  if (!unit || !center || resolution === null || resolution === undefined) {
    throw new Error('Can not determine unit / resolution from map');
  }
  const centerLonLat = toLonLat(center, projection);

  const layerPromises = olMap.getLayers().getArray()
    .map(mapOlLayerToInkmap);

  return Promise.all(layerPromises)
    .then((responses) => {
      const layers = responses.filter(l => l !== null);
      const config = {
        layers: layers,
        size: [400, 240, 'mm'], // todo: make configurable
        center: centerLonLat,
        dpi: 120, // todo: make configurable
        scale: scale,
        scaleBar: { // todo: make configurable
          position: 'bottom-left',
          units: 'metric'
        },
        projection: projection,
        northArrow: 'top-right', // todo: make configurable
        attributions: 'bottom-right' // todo: make configurable
      };
      return Promise.resolve(config);
    })
    .catch((error) => {
      console.error(error);
      return Promise.reject();
    });
}

const mapOlLayerToInkmap = async (olLayer) => {
  const source = olLayer.getSource();
  const opacity = olLayer.getOpacity();

  if (source instanceof TileWMS) {
    const tileWmsLayer = {
      type: 'WMS',
      url: source.getUrls()?.[0] ?? '',
      opacity: opacity,
      attribution: '', // todo: get attributions from source
      layer: source.getParams()?.LAYERS,
      tiled: true
    };
    return tileWmsLayer;
  } else if (source instanceof ImageWMS) {
    const imageWmsLayer = {
      type: 'WMS',
      url: source.getUrl() ?? '',
      opacity: opacity,
      attribution: '', // todo: get attributions from source
      layer: source.getParams()?.LAYERS,
      tiled: false
    };
    return imageWmsLayer;
  } else if (source instanceof WMTS) {
    const olTileGrid = source.getTileGrid();
    const resolutions = olTileGrid?.getResolutions();
    const matrixIds = resolutions?.map((res, idx) => idx);

    const tileGrid = {
      resolutions: olTileGrid?.getResolutions(),
      extent: olTileGrid?.getExtent(),
      matrixIds: matrixIds
    };

    const wmtsLayer = {
      type: 'WMTS',
      requestEncoding: source.getRequestEncoding(),
      url: source.getUrls()?.[0] ?? '',
      layer: source.getLayer(),
      projection: source.getProjection().getCode(),
      matrixSet: source.getMatrixSet(),
      tileGrid: tileGrid,
      format: source.getFormat(),
      opacity: opacity,
      attribution: '', // todo: get attributions from source
    };
    return wmtsLayer;
  } else if (source instanceof OSM) {
    const osmLayer = {
      type: 'XYZ',
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      opacity: opacity,
      attribution: '© OpenStreetMap (www.openstreetmap.org)',
      tiled: true
    };
    return osmLayer;
  } else if (source instanceof VectorSource) {
    const geojson = new GeoJSON().writeFeaturesObject(source.getFeatures());
    const parser = new OpenLayersParser();
    const config = {
      type: 'GeoJSON',
      geojson: geojson,
      style: undefined,
      attribution: ''
    };

    let olStyle = null;

    if (olLayer instanceof VectorLayer) {
      olStyle = olLayer.getStyle();
    }

    // todo: support stylefunction / different styles per feature
    // const styles = source.getFeatures()?.map(f => f.getStyle());

    if (olStyle) {
      // todo: gs-ol-parser does not support style with both fill and stroke defined
      const gsStyle = await parser.readStyle(olStyle);
      console.log('gsStyle', gsStyle);
      if (gsStyle.errors) {
        console.error('Geostyler errors: ', gsStyle.errors);
      }
      if (gsStyle.warnings) {
        console.warn('Geostyler warnings: ', gsStyle.warnings);
      }
      if (gsStyle.unsupportedProperties) {
        console.warn('Detected unsupported style properties: ', gsStyle.unsupportedProperties);
      }
      config.style = gsStyle.output;
    }
    return config;
  }
  return null;
};

/**
 * Resolves to a boolean (true/false) on subscription
 * True means a worker is used for print jobs
 * @type {Promise<boolean>}
 */
export const printerReady = new Promise((resolve) => {
  if (hasOffscreenCanvasSupport()) {
    navigator.serviceWorker.register('inkmap-worker.js').then(
      () => {
        // this will wait for the current window to be claimed by the worker
        setTimeout(() => {
          // a worker still may not be available, i.e. after a force refresh
          // use the library on the main thread in this case
          if (!navigator.serviceWorker.controller) resolve(false);
          resolve(true);
        }, 100);
      },
      () => {
        console.log(
          '[inkmap] Service worker was not found. See https://github.com/camptocamp/inkmap for using multi-threading'
        );
        resolve(false);
      }
    );
  } else {
    resolve(false);
  }
});

printerReady.then((useWorker) =>
  console.log(
    `[inkmap] Ready, ${useWorker ? 'using worker' : 'using main thread'}`
  )
);
