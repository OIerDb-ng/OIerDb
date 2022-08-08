import Plausible from 'plausible-tracker';

export const { enableAutoPageviews, trackEvent, trackPageview } = Plausible({
  domain: 'oier.baoshuo.dev',
  apiHost: 'https://stat.u.sb',
});
