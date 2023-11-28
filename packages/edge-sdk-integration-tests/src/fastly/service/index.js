/// <reference types="@fastly/js-compute" />
import { Segment } from '@segment/edge-sdk';

const EdgeSettingsHeader = 'x-segment-edge-settings';
const EdgeFeaturesHeader = "x-segment-edge-features";

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleRequest(event) {
  const { request } = event;
  const settingsHeader = request.headers.get(EdgeSettingsHeader);
  const featuresHeader = request.headers.get(EdgeFeaturesHeader);
  const settings = settingsHeader ? JSON.parse(settingsHeader) : undefined;
  const features = featuresHeader ? JSON.parse(featuresHeader) : undefined;
  const segment = new Segment(settings, features)
  const response = await segment.handleEvent(request);
  return response;
}