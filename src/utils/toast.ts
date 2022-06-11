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

type Buttons = {
  name: string;
  type?: 'callback' | 'close';
  color?: string;
  callback?: () => void;
}[];

function dialog(type: Noty.Type, text: string, buttons: Buttons) {
  const noty = new Noty({
    type,
    text,
    buttons: buttons.map((button) =>
      Noty.button(
        button.name,
        `ui small basic ${button.color} button`,
        button.type === 'close' ? () => noty.close() : button.callback
      )
    ),
    layout: 'bottomRight',
    theme: 'semanticui',
  });

  noty.show();
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

export const confirm = {
  success(message: string, buttons: Buttons) {
    dialog('success', message, buttons);
  },
  info(message: string, buttons: Buttons) {
    dialog('info', message, buttons);
  },
  warning(message: string, buttons: Buttons) {
    dialog('warning', message, buttons);
  },
  error(message: string, buttons: Buttons) {
    dialog('error', message, buttons);
  },
};
