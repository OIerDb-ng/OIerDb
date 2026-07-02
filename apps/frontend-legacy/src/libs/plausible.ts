import Plausible, { PlausibleOptions, EventOptions } from 'plausible-tracker';

export const { enableAutoPageviews, trackEvent, trackPageview } = Plausible({
  domain: 'oier.baoshuo.dev',
  apiHost: 'https://stat.u.sb',
});

export const trackMultiDomain = (url?: string) => {
  if (window.location.host !== 'oier.baoshuo.dev') {
    trackEvent(
      'Domain',
      { props: { domain: window.location.host } },
      { url: url || window.location.href }
    );
  }
};

export const trackMultiDomainPageview = (
  eventData?: PlausibleOptions,
  options?: EventOptions
) => {
  trackPageview(eventData, options);
  trackMultiDomain(eventData.url);
};

export const enableAutoTrackMultiDomain = () => {
  const multiDomain = () => trackMultiDomain();

  // Attach pushState and popState listeners
  const originalPushState = history.pushState;
  if (originalPushState) {
    history.pushState = function (data, title, url) {
      originalPushState.apply(this, [data, title, url]);
      multiDomain();
    };
    addEventListener('popstate', multiDomain);
  }

  trackMultiDomain();

  return function cleanup() {
    if (originalPushState) {
      history.pushState = originalPushState;
      removeEventListener('popstate', multiDomain);
    }
  };
};
