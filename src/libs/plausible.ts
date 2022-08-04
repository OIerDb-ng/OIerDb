import Plausible from 'plausible-tracker';

export const { enableAutoPageviews, trackEvent, trackPageview } = Plausible({
  apiHost: 'https://stat.u.sb',
});
