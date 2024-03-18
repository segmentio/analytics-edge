/// <reference types="@cloudflare/workers-types" />
import { Segment } from '@segment/edge-sdk'

const EdgeSettingsHeader = 'x-segment-edge-settings';
const EdgeFeaturesHeader = "x-segment-edge-features";

export default {
  async fetch(request: Request, _env: {}, _ctx: ExecutionContext) {
    console.log(request.url)
    const settingsHeader = request.headers.get(EdgeSettingsHeader);
    const featuresHeader = request.headers.get(EdgeFeaturesHeader);
    const settings = settingsHeader ? JSON.parse(settingsHeader) : undefined;
    const features = featuresHeader ? JSON.parse(featuresHeader) : undefined;
    const segment = new Segment(settings, features)
    const response = await segment.handleEvent(request);
    return response;
  },
}
