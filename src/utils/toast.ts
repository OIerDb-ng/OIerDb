import Noty from 'noty';

function noty(type: Noty.Type, text: string, timeout: number) {
  const noty = new Noty({
    type,
    text,
    layout: 'bottomRight',
    theme: 'semanticui',
  });

  noty.show();

  setTimeout(() => noty.close(), timeout);
}

export default {
  success(message: string, timeout: number = 5000) {
    noty('success', message, timeout);
  },
  info(message: string, timeout: number = 5000) {
    noty('alert', message, timeout);
  },
  warning(message: string, timeout: number = 5000) {
    noty('warning', message, timeout);
  },
  error(message: string, timeout: number = 5000) {
    noty('error', message, timeout);
  },
};
